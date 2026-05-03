#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RailPin -- Jetson edge script.

Runs TensorRT inference on a live camera feed, streams annotated frames as
MJPEG via Flask, and uploads defect crops + metadata to Supabase Storage /
FastAPI on each detection.

Usage:
    python3 jetson_main.py [--engine best.engine] [--gps-csv gps_mock.csv] [options]

Stream-only (no credentials needed, good for local testing):
    python3 jetson_main.py --stream-only --gps-csv ../gps_mock.csv
"""

import argparse
import csv
import itertools
import os
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, List

import cv2
import numpy as np
import requests
from flask import Flask, Response

# TRT inference helpers live in the same directory
from inference import TRTInference, parse_detections, draw_detections

# ---------------------------------------------------------------------------
# Defect type mapping
# Maps model class names to the locked API enum (spec section 6).
# None means skip upload (structural label, not a defect).
# ---------------------------------------------------------------------------
DEFECT_TYPE_MAP = {
    "spalling":           "spalling",
    "squats":             "transverse_crack",
    "flaking":            "transverse_crack",
    "shelling":           "longitudinal_crack",
    "corrugation":        "joint_defect",
    "track":              None,
    "rail_fault":         "transverse_crack",
    "transverse_crack":   "transverse_crack",
    "longitudinal_crack": "longitudinal_crack",
    "joint_defect":       "joint_defect",
    "missing_fastener":   "missing_fastener",
}

# ---------------------------------------------------------------------------
# Shared annotated-frame buffer  (inference thread -> Flask thread)
# ---------------------------------------------------------------------------
_frame_lock = threading.Lock()
_latest_jpg = None  # type: Optional[bytes]


def _set_frame(jpg):
    # type: (bytes) -> None
    global _latest_jpg
    with _frame_lock:
        _latest_jpg = jpg


def _get_frame():
    # type: () -> Optional[bytes]
    with _frame_lock:
        return _latest_jpg


# ---------------------------------------------------------------------------
# Flask MJPEG server
# ---------------------------------------------------------------------------
_app = Flask(__name__)


def _mjpeg_gen():
    while True:
        jpg = _get_frame()
        if jpg is None:
            time.sleep(0.03)
            continue
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n"
        )
        time.sleep(0.033)  # ~30 fps cap on outbound stream


@_app.route("/stream")
def stream():
    return Response(
        _mjpeg_gen(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@_app.route("/health")
def health():
    return {"status": "ok"}


def _run_flask(port):
    # type: (int) -> None
    _app.run(host="0.0.0.0", port=port, threaded=True, use_reloader=False)


def _clamp_severity(value):
    # type: (object) -> float
    try:
        severity = float(value)
    except (TypeError, ValueError):
        severity = 1.0
    return round(max(1.0, min(10.0, severity)), 1)


def _gps_fix_label(gps):
    # type: (dict) -> str
    fix = gps.get("fix")
    if fix in ("3d", "3D"):
        return "3d"
    if fix in ("2d", "2D"):
        return "2d"
    try:
        mode = int(fix)
    except (TypeError, ValueError):
        mode = 0
    if mode >= 3:
        return "3d"
    if mode == 2:
        return "2d"
    return "no_fix"


def _milepost_from_gps(gps):
    # type: (dict) -> str
    return str(gps.get("milepost") or os.environ.get("DEFAULT_MILEPOST", "0+000"))


def _rail_line_id():
    # type: () -> int
    try:
        return int(os.environ.get("RAIL_LINE_ID", "1"))
    except ValueError:
        return 1


# ---------------------------------------------------------------------------
# GPS: real (gpsd) or CSV mock
# ---------------------------------------------------------------------------
class MockGPS(object):
    """Cycles through lat/lon rows of a CSV on a timer."""

    def __init__(self, csv_path, step_interval=1.0):
        rows = []
        with open(csv_path) as f:
            for row in csv.DictReader(f):
                rows.append({"lat": float(row["lat"]), "lon": float(row["lon"])})
        if not rows:
            raise ValueError("GPS CSV {!r} is empty".format(csv_path))
        self._cycle    = itertools.cycle(rows)
        self._interval = step_interval
        self.current   = next(self._cycle)
        threading.Thread(target=self._loop, daemon=True).start()

    def _loop(self):
        while True:
            time.sleep(self._interval)
            self.current = next(self._cycle)


# ---------------------------------------------------------------------------
# Dedup filter
# ---------------------------------------------------------------------------
class _Dedup(object):
    """Drop a detection if the same class at the same bbox area fired recently."""

    def __init__(self, window_sec=1.0, bucket_px=50):
        self._seen   = {}
        self._window = window_sec
        self._bucket = bucket_px
        self._lock   = threading.Lock()

    def should_send(self, class_name, cx, cy):
        key = (class_name, int(cx / self._bucket), int(cy / self._bucket))
        now = time.time()
        with self._lock:
            if now - self._seen.get(key, 0) < self._window:
                return False
            self._seen[key] = now
            return True


# ---------------------------------------------------------------------------
# Supabase upload + FastAPI POST  (fire-and-forget thread)
# ---------------------------------------------------------------------------
def _upload_and_post(supabase_url, supabase_key, fastapi_url,
                     device_id, frame_id, frame, det, gps, captured_at):
    frame_h, frame_w = frame.shape[:2]

    x1, y1, x2, y2 = (int(v) for v in det["bbox"])
    px = int((x2 - x1) * 0.10)
    py = int((y2 - y1) * 0.10)
    crop_x = max(0, x1 - px)
    crop_y = max(0, y1 - py)
    crop = frame[
        crop_y:min(frame_h, y2 + py),
        crop_x:min(frame_w, x2 + px),
    ].copy()

    # Draw bbox relative to crop origin so it's visible in the uploaded image
    cv2.rectangle(
        crop,
        (x1 - crop_x, y1 - crop_y),
        (x2 - crop_x, y2 - crop_y),
        (0, 0, 255), 2,
    )

    ok, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not ok:
        print("[upload] JPEG encode failed -- skipping")
        return

    date_str   = time.strftime("%Y-%m-%d", time.gmtime())
    ts_ms      = int(time.time() * 1000)
    uid6       = uuid.uuid4().hex[:6]
    image_path = "pins/{}/{}_{}_{}.jpg".format(date_str, device_id, ts_ms, uid6)

    # Step 1: Supabase Storage (direct REST API, no supabase-py needed)
    try:
        upload_url = "{}/storage/v1/object/defect-images/{}".format(supabase_url, image_path)
        resp = requests.post(
            upload_url,
            data=buf.tobytes(),
            headers={
                "Authorization": "Bearer {}".format(supabase_key),
                "Content-Type": "image/jpeg",
            },
            timeout=15,
        )
        resp.raise_for_status()
        public_url = "{}/storage/v1/object/public/defect-images/{}".format(supabase_url, image_path)
        print("[upload] Stored: {}".format(public_url))
    except Exception as exc:
        print("[upload] Storage upload failed: {} -- skipping POST".format(exc))
        return

    # Step 2: FastAPI /detect -- send relative storage path, get back severity
    try:
        resp = requests.post(
            "{}/detect".format(fastapi_url),
            json={"image_path": image_path},
            timeout=30,
        )
        if resp.status_code not in (200, 201):
            print("[detect] /detect returned {}: {}".format(
                resp.status_code, resp.text[:120]))
            return
        severity = _clamp_severity(resp.json().get("severity"))
    except Exception as exc:
        print("[detect] POST failed: {}".format(exc))
        return

    # Step 3: Write full pin record directly to Supabase
    defect_type = DEFECT_TYPE_MAP.get(det["class_name"], "transverse_crack")
    bbox = {
        "x": x1,
        "y": y1,
        "width": x2 - x1,
        "height": y2 - y1,
        "x1": x1,
        "y1": y1,
        "x2": x2,
        "y2": y2,
        "class_name": det["class_name"],
    }
    pin = {
        "status":      "new",
        "device_id":   device_id,
        "line_id":     _rail_line_id(),
        "defect_type": defect_type,
        "confidence":  round(float(det["confidence"]), 4),
        "frame_id":    frame_id,
        "bbox":        bbox,
        "lat":         gps.get("lat", 0.0),
        "lon":         gps.get("lon", 0.0),
        "milepost":    _milepost_from_gps(gps),
        "speed_mps":   gps.get("speed", None),
        "gps_fix":     _gps_fix_label(gps),
        "image_path":  image_path,
        "severity":    severity,
        "ai_verification": "Gemini severity score: {:.1f}/10".format(severity),
        "captured_at": captured_at,
    }
    try:
        resp = requests.post(
            "{}/rest/v1/pins".format(supabase_url),
            json=pin,
            headers={
                "Authorization": "Bearer {}".format(supabase_key),
                "apikey":        supabase_key,
                "Content-Type":  "application/json",
                "Prefer":        "return=representation",
            },
            timeout=10,
        )
        if resp.status_code in (200, 201):
            pin_id = resp.json()[0]["id"]
            print("[pin] created {} sev={} ({})".format(pin_id, severity, defect_type))
        else:
            print("[pin] insert failed ({}): {}".format(
                resp.status_code, resp.text[:120]))
    except Exception as exc:
        print("[pin] insert failed: {}".format(exc))


# ---------------------------------------------------------------------------
# Camera helpers
# ---------------------------------------------------------------------------
def _open_camera(device):
    """
    Try camera pipelines in order of likelihood for USB webcams on Jetson.
    Returns an opened, warmed-up VideoCapture, or None if everything fails.
    """
    # Extract numeric index from path (e.g. /dev/video1 -> 1) for fallbacks.
    import re
    m = re.search(r"\d+$", device)
    cam_index = int(m.group()) if m else 0

    # C920 caps: MJPEG supports 30fps at 720p; YUY2 tops out at 10fps at 720p.
    # Always use MJPEG for anything >= 720p and fall back to YUY2 640x480.
    pipelines = [
        (
            "v4l2src device={dev} ! "
            "image/jpeg,width=1280,height=720,framerate=30/1 ! "
            "jpegdec ! videoconvert ! video/x-raw,format=BGR ! appsink drop=1".format(dev=device),
            "MJPEG 1280x720 @ 30fps",
        ),
        (
            "v4l2src device={dev} ! "
            "image/jpeg,width=640,height=480,framerate=30/1 ! "
            "jpegdec ! videoconvert ! video/x-raw,format=BGR ! appsink drop=1".format(dev=device),
            "MJPEG 640x480 @ 30fps",
        ),
        # YUY2 640x480 -- C920 supports 30fps at this resolution in raw mode
        (
            "v4l2src device={dev} ! "
            "video/x-raw,format=YUY2,width=640,height=480,framerate=30/1 ! "
            "videoconvert ! video/x-raw,format=BGR ! appsink drop=1".format(dev=device),
            "YUY2 640x480 @ 30fps",
        ),
    ]

    for gst, label in pipelines:
        cap = cv2.VideoCapture(gst, cv2.CAP_GSTREAMER)
        if not cap.isOpened():
            time.sleep(0.5)  # let v4l2 release buffers before next attempt
            continue
        for _ in range(30):
            ret, _ = cap.read()
            if ret:
                print("[camera] Opened via {}".format(label))
                return cap
            time.sleep(0.05)
        cap.release()
        time.sleep(0.5)

    # Last resort: plain VideoCapture on the correct device index (no GStreamer)
    time.sleep(1.0)
    cap = cv2.VideoCapture(cam_index)
    if cap.isOpened():
        for _ in range(30):
            ret, _ = cap.read()
            if ret:
                print("[camera] Opened via cv2.VideoCapture({})".format(cam_index))
                return cap
            time.sleep(0.05)
        cap.release()

    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="RailPin Jetson edge script")
    parser.add_argument("--engine",       default="best.engine",  help="TRT .engine file")
    parser.add_argument("--camera",       default="/dev/video1",  help="Camera device node")
    parser.add_argument("--conf",         type=float, default=0.4, help="Confidence threshold")
    parser.add_argument("--port",         type=int,   default=5000, help="MJPEG stream port")
    parser.add_argument("--gps-csv",      default=None,           help="GPS mock CSV with lat,lon columns")
    parser.add_argument("--gps-interval", type=float, default=1.0, help="Seconds between GPS CSV steps")
    parser.add_argument("--no-gps",       action="store_true",    help="Disable GPS (coords 0,0)")
    parser.add_argument("--stream-only",  action="store_true",    help="Skip Supabase/FastAPI upload")
    args = parser.parse_args()

    # Env vars
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    fastapi_url  = os.environ.get("FASTAPI_URL", "").rstrip("/")
    device_id    = os.environ.get("DEVICE_ID", "jetson-01")

    upload_on = not args.stream_only
    if upload_on:
        missing = [k for k, v in [
            ("SUPABASE_URL", supabase_url),
            ("SUPABASE_SERVICE_ROLE_KEY", supabase_key),
            ("FASTAPI_URL", fastapi_url),
        ] if not v]
        if missing:
            print("[warn] Missing env vars: {} -- running stream-only".format(
                ", ".join(missing)))
            upload_on = False

    # GPS
    gps_source = None
    if not args.no_gps:
        if args.gps_csv:
            gps_source = MockGPS(args.gps_csv, step_interval=args.gps_interval)
            print("[init] Mock GPS from {}".format(args.gps_csv))
        else:
            try:
                from gpsLogger import GPSLogger
                gps_source = GPSLogger()
                threading.Thread(target=gps_source.update_gps, daemon=True).start()
                print("[init] Real GPS logger started")
            except Exception as exc:
                print("[warn] GPS init failed: {} -- using (0, 0)".format(exc))

    def get_gps():
        if gps_source is None:
            return {"lat": 0.0, "lon": 0.0}
        return gps_source.current

    # TRT model
    print("[init] Loading TRT engine: {}".format(args.engine))
    model = TRTInference(args.engine)
    model.print_io_info()

    # Camera
    cap = _open_camera(args.camera)
    if cap is None:
        print("[error] Cannot open camera -- exiting")
        return

    # Flask MJPEG thread
    threading.Thread(target=_run_flask, args=(args.port,), daemon=True).start()
    print("[init] MJPEG stream: http://0.0.0.0:{}/stream".format(args.port))

    # State
    dedup        = _Dedup(window_sec=1.0, bucket_px=50)
    last_pin_at  = 0.0
    fault_total  = 0
    frame_id     = 0
    t0           = time.time()
    read_misses  = 0

    print("[init] Upload={}  Device={}".format("enabled" if upload_on else "disabled", device_id))
    print("[init] Running -- Ctrl+C to stop\n")

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                read_misses += 1
                if read_misses >= 10:
                    print("[error] Camera produced no frames after 10 consecutive attempts -- stopping")
                    break
                time.sleep(0.05)
                continue
            read_misses = 0

            captured_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            orig_h, orig_w = frame.shape[:2]
            gps_snap = get_gps()

            outputs    = model.infer(frame)
            detections = parse_detections(outputs, orig_w, orig_h, args.conf)
            fault_total += len(detections)

            fps       = frame_id / max(time.time() - t0, 1e-3)
            annotated = draw_detections(frame.copy(), detections, fps, fault_total)

            _, jpg = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
            _set_frame(jpg.tobytes())

            if upload_on and detections:
                now = time.time()
                if now - last_pin_at >= 1.0:
                    best = max(detections, key=lambda d: d["confidence"])
                    defect_type = DEFECT_TYPE_MAP.get(best["class_name"])
                    if defect_type is not None:
                        cx = (best["bbox"][0] + best["bbox"][2]) / 2.0
                        cy = (best["bbox"][1] + best["bbox"][3]) / 2.0
                        if dedup.should_send(best["class_name"], cx, cy):
                            last_pin_at = now
                            threading.Thread(
                                target=_upload_and_post,
                                args=(
                                    supabase_url, supabase_key,
                                    fastapi_url, device_id, frame_id,
                                    frame.copy(), best, gps_snap, captured_at,
                                ),
                                daemon=True,
                            ).start()

            frame_id += 1

    except KeyboardInterrupt:
        print("\n[info] Stopped")
    finally:
        cap.release()
        if hasattr(gps_source, "running"):
            gps_source.running = False


if __name__ == "__main__":
    main()
