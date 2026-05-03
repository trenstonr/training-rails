from fastapi import HTTPException

from app.sms import send_sms

REQUIRED_DISPATCH_FIELDS = ("lat", "lon", "severity", "timestamp")


def dispatch_operator(payload: dict) -> dict:
    validate_dispatch_payload(payload)
    sms = send_sms(build_dispatch_message(payload))

    return {
        "status": "sent",
        "message_id": sms.message_id,
        "sms_status": sms.status,
        "to": sms.to,
    }


def validate_dispatch_payload(payload: dict) -> None:
    missing_fields = [
        field for field in REQUIRED_DISPATCH_FIELDS
        if payload.get(field) is None
    ]
    if missing_fields:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required fields: {', '.join(missing_fields)}",
        )


def build_dispatch_message(payload: dict) -> str:
    lat = payload["lat"]
    lon = payload["lon"]
    severity = payload["severity"]
    timestamp = payload["timestamp"]
    map_url = f"https://maps.google.com/?q={lat},{lon}"

    return (
        "URGENT: Severe track defect detected. Dispatch maintenance immediately.\n"
        f"Severity: {severity}\n"
        f"Location: {lat}, {lon}\n"
        f"Time: {timestamp}\n"
        f"Map: {map_url}"
    )
