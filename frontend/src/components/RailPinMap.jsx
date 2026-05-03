import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import L from 'leaflet';
// Leaflet plugin must use this path: vite resolves `heatmap.js` to vendor patch, but keeps this import on node_modules (see vite.config.js aliases).
import HeatmapOverlayFactory from 'heatmap.js/plugins/leaflet-heatmap/leaflet-heatmap.js';
import { ROUTES, CITIES, FOCUS_PIN, CAMERAS, TILE_PROVIDERS } from '../data/railData.js';
import { makeDefectPinIcon, isPlaceholderMapImageUrl } from '../lib/leafletPinIcon.js';

const HeatmapOverlay = HeatmapOverlayFactory?.default ?? HeatmapOverlayFactory;

const SEV_HEAT = { crit: 10, high: 7, med: 5, low: 3, resolved: 2 };

function filterPinsByLine(pinList, lineFilter) {
  if (lineFilter === 'all') return pinList;
  return pinList.filter((p) => p.line === lineFilter);
}

function buildHeatmapPayload(pinList) {
  const data = pinList.map((pin) => ({
    lat: pin.lat,
    lng: pin.lon,
    count: SEV_HEAT[pin.sev] ?? 4
  }));
  const max = Math.max(1, ...data.map((d) => d.count));
  return { max, data };
}

function setupTilesWithFallback(map, badgeEl) {
  let providerIndex = 0;
  let currentLayer = null;
  let failCount = 0;
  let failResetAt = Date.now();

  function tryNext() {
    if (providerIndex >= TILE_PROVIDERS.length) {
      if (badgeEl) {
        badgeEl.textContent = 'No tiles · SVG fallback';
        badgeEl.classList.add('warn');
      }
      return;
    }
    const provider = TILE_PROVIDERS[providerIndex];
    if (badgeEl) {
      badgeEl.textContent = provider.name;
      badgeEl.classList.remove('warn');
    }
    if (currentLayer) map.removeLayer(currentLayer);
    failCount = 0;
    failResetAt = Date.now();

    currentLayer = L.tileLayer(provider.url, provider.options);
    currentLayer.on('tileerror', () => {
      const now = Date.now();
      if (now - failResetAt > 5000) { failCount = 0; failResetAt = now; }
      failCount++;
      if (failCount > 3) {
        providerIndex++;
        tryNext();
      }
    });
    currentLayer.addTo(map);
  }
  tryNext();
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

function statRow(label, value, valueClass = '') {
  if (value == null || value === '') return '';
  return (
    '<div class="pin-popup-stat">' +
    '<span class="pin-popup-stat-label">' +
    escapeHtml(label) +
    '</span>' +
    '<span class="pin-popup-stat-val ' +
    escapeHtml(valueClass) +
    '">' +
    escapeHtml(String(value)) +
    '</span>' +
    '</div>'
  );
}

function buildPopup(pin, onOpenDefect) {
  const wrap = document.createElement('div');
  const showImg = pin.imageUrl && !isPlaceholderMapImageUrl(pin.imageUrl);
  const preview = showImg
    ? '<div class="pin-popup-preview"><img src="' +
      escapeAttr(pin.imageUrl) +
      '" alt="" loading="lazy" decoding="async" /></div>'
    : '';

  const confStr =
    pin.conf != null && Number.isFinite(Number(pin.conf))
      ? String(Math.round(Number(pin.conf) * 1000) / 1000)
      : pin.conf != null
        ? String(pin.conf)
        : '';

  const stats =
    statRow('Track ID', pin.line) +
    statRow(
      'Severity',
      pin.severityNum != null
        ? String(pin.sev).toUpperCase() + ' · ' + pin.severityNum + '/10'
        : String(pin.sev).toUpperCase(),
      'pin-popup-severity-' + pin.sev
    ) +
    statRow('Milepost', pin.mp) +
    statRow('Confidence', confStr) +
    statRow('Captured', pin.capturedAt);

  wrap.innerHTML =
    preview +
    '<div class="pin-popup-id">' +
    escapeHtml(pin.id) +
    ' · MP ' +
    escapeHtml(pin.mp) +
    '</div>' +
    '<span class="sev-badge ' +
    escapeHtml(pin.sev) +
    '">' +
    escapeHtml(String(pin.sev).toUpperCase()) +
    '</span>' +
    '<div class="pin-popup-title" style="margin-top:6px;">' +
    escapeHtml(pin.type) +
    '</div>' +
    '<div class="pin-popup-stats">' +
    stats +
    '</div>' +
    '<a class="pin-popup-link" href="#">Open detail →</a>';
  const link = wrap.querySelector('.pin-popup-link');
  if (link) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      onOpenDefect?.(pin);
    });
  }
  return wrap;
}

function addCities(map) {
  CITIES.forEach((city) => {
    L.marker([city.lat, city.lon], {
      icon: L.divIcon({
        className: 'leaflet-city ' + (city.major ? 'major' : ''),
        html:
          '<div class="leaflet-city-content">' +
          '<span class="leaflet-city-dot"></span>' +
          '<span>' + city.name + '</span>' +
          '</div>',
        iconSize: [120, 12],
        iconAnchor: [0, 6]
      }),
      interactive: false,
      keyboard: false
    }).addTo(map);
  });
}

function addRoutes(map) {
  const bundles = {};
  Object.keys(ROUTES).forEach((id) => {
    const route = ROUTES[id];
    const glow = L.polyline(route.coords, { color: route.color, weight: 8, opacity: 0.18, lineCap: 'round' }).addTo(map);
    const main = L.polyline(route.coords, { color: route.color, weight: 3, opacity: 0.9, lineCap: 'round' }).addTo(map);
    const ties = L.polyline(route.coords, { color: route.color, weight: 6, opacity: 0.4, dashArray: '1, 12', lineCap: 'round' }).addTo(map);
    bundles[id] = [
      { layer: glow, originalOpacity: 0.18 },
      { layer: main, originalOpacity: 0.9 },
      { layer: ties, originalOpacity: 0.4 }
    ];
  });
  return bundles;
}

function addPins(map, pinList, onOpenDefect) {
  const markers = [];
  const dataMap = new Map();
  pinList.forEach((pin) => {
    const marker = L.marker([pin.lat, pin.lon], { icon: makeDefectPinIcon(pin, false) }).addTo(map);
    marker.bindPopup(buildPopup(pin, onOpenDefect), {
      closeButton: false,
      offset: [0, -18],
      autoPan: false,
      keepInView: false,
      maxWidth: 220
    });
    marker.off('click');
    marker.on('click', () => onOpenDefect?.(pin));
    let closeTimer = null;
    let markerHovered = false;
    let popupHovered = false;
    const cancelClose = () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
    };
    const scheduleClose = () => {
      cancelClose();
      closeTimer = setTimeout(() => {
        if (!markerHovered && !popupHovered) marker.closePopup();
      }, 120);
    };
    marker.on('mouseover', () => {
      markerHovered = true;
      cancelClose();
      marker.openPopup();
    });
    marker.on('mouseout', () => {
      markerHovered = false;
      scheduleClose();
    });
    marker.on('popupopen', (event) => {
      const popupEl = event.popup.getElement();
      if (!popupEl) return;
      popupEl.addEventListener('mouseenter', () => {
        popupHovered = true;
        cancelClose();
      });
      popupEl.addEventListener('mouseleave', () => {
        popupHovered = false;
        scheduleClose();
      });
    });
    markers.push(marker);
    dataMap.set(marker, pin);
  });
  return { markers, dataMap };
}

function replacePinMarkers(map, pinStateRef, pinList, onOpenDefect) {
  const prev = pinStateRef.current;
  if (prev?.markers?.length) {
    prev.markers.forEach((m) => {
      map.removeLayer(m);
    });
  }
  pinStateRef.current = addPins(map, pinList, onOpenDefect);
}

function makeCameraIcon(label, cls) {
  return L.divIcon({
    className: 'leaflet-train-icon-wrap',
    html:
      '<div class="leaflet-train-wrap">' +
      '<span class="leaflet-train-label ' + cls + '">' + label + '</span>' +
      '<div class="leaflet-train-circle ' + cls + '">' +
      '<svg viewBox="0 0 24 24"><path d="M3 8a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1l3-2v10l-3-2v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><circle cx="9" cy="12" r="2.1"/></svg>' +
      '</div>' +
      '</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

/** Bounding box of every route vertex — used so the map is zoomed in enough to see train motion. */
function boundsFromAllRoutes() {
  const pts = Object.values(ROUTES).flatMap((r) => r.coords);
  return L.latLngBounds(pts);
}

function animateTrainAlongRoute(map, marker, coords, durationMs, stopRef) {
  const t0 = performance.now();
  function step(now) {
    if (stopRef.current) return;
    const root = map?.getContainer?.();
    if (!root || !map.hasLayer(marker)) return;

    const t = typeof now === 'number' ? now : performance.now();
    const elapsed = t - t0;
    const progress = (elapsed % durationMs) / durationMs;
    const idx = progress * (coords.length - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, coords.length - 1);
    const f = idx - i0;
    const lat = coords[i0][0] + (coords[i1][0] - coords[i0][0]) * f;
    const lon = coords[i0][1] + (coords[i1][1] - coords[i0][1]) * f;
    marker.setLatLng([lat, lon]);

    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const RailPinMap = forwardRef(function RailPinMap(
  { pins = [], pageActive, lineFilter, heatmapEnabled = false, onOpenDefect, onOpenCamera },
  ref
) {
  const containerRef = useRef(null);
  const badgeRef = useRef(null);
  const mapRef = useRef(null);
  const routeBundlesRef = useRef(null);
  const pinStateRef = useRef(null);
  const train422Ref = useRef(null);
  const demoMarkerRef = useRef(null);
  const heatmapLayerRef = useRef(null);
  const stopAnimRef = useRef({ current: false });
  const onOpenDefectRef = useRef(onOpenDefect);
  const onOpenCameraRef = useRef(onOpenCamera);
  const lineFilterRef = useRef(lineFilter);
  lineFilterRef.current = lineFilter;

  // Keep callback ref in sync without re-running init effect
  useEffect(() => { onOpenDefectRef.current = onOpenDefect; }, [onOpenDefect]);
  useEffect(() => { onOpenCameraRef.current = onOpenCamera; }, [onOpenCamera]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false
    });
    mapRef.current = map;

    // Zoom ~7 showed the whole corridor as a few pixels; trains moved but were visually static.
    map.fitBounds(boundsFromAllRoutes(), { padding: [44, 44], maxZoom: 10 });

    setupTilesWithFallback(map, badgeRef.current);
    routeBundlesRef.current = addRoutes(map);
    addCities(map);
    pinStateRef.current = addPins(map, [], (pin) => onOpenDefectRef.current?.(pin));

    // --- Heatmap (overlay instance + ref only). Toggle lives in a separate useEffect; pins effect updates setData. Do not add camera/train logic here. ---
    const heatCfg = {
      // scaleRadius:true multiplies radius by 2^zoom (hundreds–thousands of px); keep fixed screen px.
      radius: 80,
      maxOpacity: 0.34,
      minOpacity: 0.04,
      blur: 0.5,
      scaleRadius: false,
      useLocalExtrema: true,
      latField: 'lat',
      lngField: 'lng',
      valueField: 'count'
    };
    const heatLayer = new HeatmapOverlay(heatCfg);
    heatLayer.setData(buildHeatmapPayload(filterPinsByLine([], lineFilterRef.current)));
    heatmapLayerRef.current = heatLayer;

    // --- Live camera markers (rAF path along ROUTES; unrelated to heatmap layer lifetime). ---
    const train422 = L.marker(ROUTES['1'].coords[0], { icon: makeCameraIcon('JET-0', ''), zIndexOffset: 800 }).addTo(map);
    const train388 = L.marker(ROUTES['3'].coords[1], { icon: makeCameraIcon('JET-1', 't-388'), zIndexOffset: 800 }).addTo(map);
    train422.on('click', () => onOpenCameraRef.current?.(CAMERAS[0]));
    train388.on('click', () => onOpenCameraRef.current?.(CAMERAS[1]));
    train422Ref.current = train422;

    const stopRef = { current: false };
    stopAnimRef.current = stopRef;

    const startTrainAnimations = () => {
      map.invalidateSize();
      animateTrainAlongRoute(map, train422, ROUTES['1'].coords, 900000, stopRef);
      animateTrainAlongRoute(map, train388, ROUTES['3'].coords, 900000, stopRef);
    };

    map.whenReady(() => {
      map.invalidateSize();
      requestAnimationFrame(() => {
        requestAnimationFrame(startTrainAnimations);
      });
    });

    let resizeObs = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObs = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObs.observe(containerRef.current);
    }

    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      stopRef.current = true;
      resizeObs?.disconnect();
      heatmapLayerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Resize when page becomes active (Leaflet inside hidden container fix)
  useEffect(() => {
    if (pageActive && mapRef.current) {
      setTimeout(() => mapRef.current.invalidateSize(), 100);
    }
  }, [pageActive]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = heatmapLayerRef.current;
    if (!map || !layer) return;
    if (heatmapEnabled) {
      layer.addTo(map);
      if (typeof layer.bringToBack === 'function') layer.bringToBack();
    } else {
      map.removeLayer(layer);
    }
  }, [heatmapEnabled]);

  // Pins + line filter: markers, route emphasis, heatmap
  useEffect(() => {
    const map = mapRef.current;
    const bundles = routeBundlesRef.current;
    const pinState = pinStateRef.current;
    if (!map || !bundles || !pinState) return;

    replacePinMarkers(map, pinStateRef, pins, (pin) => onOpenDefectRef.current?.(pin));

    Object.keys(bundles).forEach((id) => {
      const visible = lineFilter === 'all' || lineFilter === id;
      bundles[id].forEach((item) => {
        const target = visible ? item.originalOpacity : 0.12;
        item.layer.setStyle({ opacity: target });
      });
    });

    const state = pinStateRef.current;
    state.markers.forEach((marker) => {
      const pin = state.dataMap.get(marker);
      if (!pin) return;
      const visible = lineFilter === 'all' || pin.line === lineFilter;
      const el = marker.getElement();
      if (el) {
        const inner = el.querySelector('.leaflet-pin');
        if (inner) {
          inner.style.opacity = visible ? '' : '0.15';
          inner.style.pointerEvents = visible ? '' : 'none';
        }
      }
    });

    if (demoMarkerRef.current) {
      const visible = lineFilter === 'all' || lineFilter === '1';
      const el = demoMarkerRef.current.getElement();
      if (el) {
        const inner = el.querySelector('.leaflet-pin');
        if (inner) {
          inner.style.opacity = visible ? '' : '0.15';
          inner.style.pointerEvents = visible ? '' : 'none';
        }
      }
    }

    const heat = heatmapLayerRef.current;
    if (heat) {
      heat.setData(buildHeatmapPayload(filterPinsByLine(pins, lineFilter)));
    }
  }, [pins, lineFilter]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    focusOnPin: ({ lat, lon, zoom = 12 }) => {
      const map = mapRef.current;
      if (!map || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
      map.setView([lat, lon], zoom, { animate: true });
    },
    centerOnTrain: () => {
      const t = train422Ref.current;
      const m = mapRef.current;
      if (t && m) m.setView(t.getLatLng(), 12, { animate: true });
    },
    dropDemoPin: () => {
      const map = mapRef.current;
      if (!map) return;
      if (demoMarkerRef.current) {
        map.removeLayer(demoMarkerRef.current);
        demoMarkerRef.current = null;
      }
      const m = L.marker([FOCUS_PIN.lat, FOCUS_PIN.lon], {
        icon: makeDefectPinIcon(FOCUS_PIN, { isNewDrop: true })
      }).addTo(map);
      m.on('click', () => onOpenDefectRef.current?.(FOCUS_PIN));
      m.bindPopup(buildPopup(FOCUS_PIN, (pin) => onOpenDefectRef.current?.(pin)), {
        closeButton: false,
        offset: [0, -18],
        autoPan: false,
        keepInView: false,
        maxWidth: 220
      });
      demoMarkerRef.current = m;
      map.setView([FOCUS_PIN.lat, FOCUS_PIN.lon], 11, { animate: true });
    }
  }));

  return (
    <>
      <div id="dashboard-map-leaflet" ref={containerRef} />
      <div className="tile-provider-badge" ref={badgeRef}>Loading tiles…</div>
    </>
  );
});

export default RailPinMap;

