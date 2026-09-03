import { displayDefectCategory } from '../lib/pinMappers.js';

export const ROUTES = {
  '1': {
    name: 'Corvallis–Albany',
    color: '#d6ff3d',
    coords: [
      [44.234345456231, -123.206062909545],
      [44.3246255593085, -123.220953825424],
      [44.4142368904097, -123.237003797525],
      [44.5042773377162, -123.251808229303],
      [44.5706119499183, -123.248770577783],
      [44.572, -123.245],
      [44.581, -123.22],
      [44.5895527944865, -123.207709708157],
      [44.591, -123.2],
      [44.601, -123.18],
      [44.6079413541001, -123.167338843363],
      [44.62, -123.135],
      [44.6268666785878, -123.126360560348],
      [44.628, -123.118]
    ]
  },
  '2': {
    name: 'Portland–Eugene',
    color: '#5ab0ff',
    coords: [
      [45.5148709278197, -122.677955284817],
      [45.481133049331, -122.70096568556],
      [45.4465871959262, -122.722968999263],
      [45.4124233901972, -122.74478695585],
      [45.3641692562368, -122.77610371523],
      [45.2498456668544, -122.846386058153],
      [45.1347882259873, -122.917737304252],
      [45.0195117180399, -122.987616428759],
      [44.9433104308447, -123.034526780817],
      [44.943, -123.035],
      [44.9160124077383, -123.040686575249],
      [44.8366873716684, -123.060326931778],
      [44.7559685534488, -123.078142644209],
      [44.6768604516378, -123.096817275967],
      [44.628, -123.118],
      [44.6268666785878, -123.126360560348],
      [44.62, -123.135],
      [44.6079413541001, -123.167338843363],
      [44.601, -123.18],
      [44.591, -123.2],
      [44.5895527944865, -123.207709708157],
      [44.581, -123.22],
      [44.572, -123.245],
      [44.5706119499183, -123.248770577783],
      [44.5042773377162, -123.251808229303],
      [44.4142368904097, -123.237003797525],
      [44.3246255593085, -123.220953825424],
      [44.234345456231, -123.206062909545],
      [44.1833172021144, -123.177356659748],
      [44.1389414096595, -123.147692411032],
      [44.0958906403147, -123.11686880497],
      [44.0524927965281, -123.08689970304]
    ]
  },
  '3': {
    name: 'Salem–Bend',
    color: '#ff7a45',
    coords: [
      
      [44.9160124077383, -123.040686575249],
      [44.9005891315251, -122.965190187376],
      [44.8593784195786, -122.893915605473],
      [44.8173174632437, -122.824022055923],
      [44.7893777026903, -122.681392705546],
      [44.7708260247919, -122.491849034632],
      [44.752161132088, -122.301430396917],
      [44.7188654167555, -122.130678395665],
      [44.6253926912199, -122.041814041615],
      [44.5312621334757, -121.952726063615],
      [44.4372176260141, -121.863593105877],
      [44.3889625221229, -121.775755894048],
      [44.3515037781356, -121.68805145067],
      [44.3142525892569, -121.601504899679],
      [44.2640801581252, -121.522468285188],
      [44.1954543933418, -121.45347090969],
      [44.1269150838142, -121.383514626209],
      [44.0583570317276, -121.315707240324]
    ]
  },
  '4': {
    name: 'Seattle–Tacoma',
    color: '#c084fc',
    coords: [
      [47.6062, -122.3321],
      [47.5180, -122.3500],
      [47.3900, -122.3800],
      [47.2529, -122.4443]
    ]
  }
};

export const CITIES = [
  { name: 'Portland',  lat: 45.5152, lon: -122.6784, major: true },
  { name: 'Salem',     lat: 44.9429, lon: -123.0351, major: true },
  { name: 'Albany',    lat: 44.6365, lon: -123.1059, major: false },
  { name: 'Corvallis', lat: 44.5638, lon: -123.2620, major: true },
  { name: 'Eugene',    lat: 44.0521, lon: -123.0868, major: true },
  { name: 'Bend',      lat: 44.0582, lon: -121.3153, major: true },
  { name: 'Seattle',   lat: 47.6062, lon: -122.3321, major: true },
  { name: 'Tacoma',    lat: 47.2529, lon: -122.4443, major: true }
];

/** Local demo data when Supabase env is missing or fetch fails (no images — use DB `image_path` when live). */
const FALLBACK_PINS_BASE = [
  // Route 1
  { id: 'DEF-04881', line: '1', sev: 'med',  type: 'Shelling',     lat: 44.572, lon: -123.245, mp: '2+150',  conf: 0.72, capturedAt: '2026-04-29 14:06:27' },
  { id: 'DEF-04882', line: '1', sev: 'low',  type: 'Flaking',    lat: 44.581, lon: -123.22, mp: '4+780',  conf: 0.66, capturedAt: '2026-04-29 13:41:10' },
  { id: 'DEF-04883', line: '1', sev: 'high', type: 'Crack', lat: 44.591, lon: -123.2, mp: '7+020',  conf: 0.83, capturedAt: '2026-04-29 14:12:14' },
  { id: 'DEF-04884', line: '1', sev: 'med',  type: 'Spalling',   lat: 44.601, lon: -123.18, mp: '9+200',  conf: 0.81, capturedAt: '2026-04-29 14:06:27' },
  { id: 'DEF-04885', line: '1', sev: 'low',  type: 'Spalling',         lat: 44.6079413541001, lon: -123.167338843363, mp: '12+440', conf: 0.68, capturedAt: '2026-04-29 14:13:55' },
  { id: 'DEF-04886', line: '1', sev: 'high', type: 'Flaking',       lat: 44.62, lon: -123.135, mp: '15+650', conf: 0.79, capturedAt: '2026-04-29 14:21:48' },
  { id: 'DEF-04887', line: '1', sev: 'med',  type: 'Shelling',           lat: 44.628, lon: -123.118, mp: '20+080', conf: 0.74, capturedAt: '2026-04-29 13:58:02' },
  // Route 2
  { id: 'DEF-04901', line: '2', sev: 'low',      type: 'Flaking',    lat: 45.481133049331, lon: -122.70096568556, mp: '5+200',   conf: 0.62, capturedAt: '2026-04-29 12:22:54' },
  { id: 'DEF-04902', line: '2', sev: 'med',      type: 'Shelling',     lat: 45.3641692562368, lon: -122.77610371523, mp: '12+800',  conf: 0.74, capturedAt: '2026-04-29 12:35:11' },
  { id: 'DEF-04903', line: '2', sev: 'med',      type: 'Shelling',           lat: 45.2498456668544, lon: -122.846386058153, mp: '24+100',  conf: 0.71, capturedAt: '2026-04-29 12:48:29' },
  { id: 'DEF-04904', line: '2', sev: 'high',     type: 'Crack', lat: 45.1347882259873, lon: -122.917737304252, mp: '38+550',  conf: 0.85, capturedAt: '2026-04-29 13:02:17' },
  { id: 'DEF-04905', line: '2', sev: 'med',      type: 'Spalling',   lat: 44.9433104308447, lon: -123.034526780817, mp: '52+200',  conf: 0.78, capturedAt: '2026-04-29 13:16:02' },
  { id: 'DEF-04906', line: '2', sev: 'low',      type: 'Squats',    lat: 44.8366873716684, lon: -123.060326931778, mp: '63+780',  conf: 0.65, capturedAt: '2026-04-29 13:29:14' },
  { id: 'DEF-04907', line: '2', sev: 'med',      type: 'Flaking',       lat: 44.7559685534488, lon: -123.078142644209, mp: '74+910',  conf: 0.73, capturedAt: '2026-04-29 13:44:20' },
  { id: 'DEF-04908', line: '2', sev: 'resolved', type: 'Spalling',       lat: 44.6768604516378, lon: -123.096817275967, mp: '85+440',  conf: 0.69, capturedAt: '2026-04-29 13:58:36' },
  { id: 'DEF-04909', line: '2', sev: 'high',     type: 'Shelling',lat: 44.5042773377162, lon: -123.251808229303, mp: '105+180', conf: 0.84, capturedAt: '2026-04-29 14:03:48' },
  { id: 'DEF-04910', line: '2', sev: 'med',      type: 'Spalling',     lat: 44.3246255593085, lon: -123.220953825424, mp: '120+360', conf: 0.71, capturedAt: '2026-04-29 14:10:53' },
  { id: 'DEF-04911', line: '2', sev: 'low',      type: 'Spalling',         lat: 44.1833172021144, lon: -123.177356659748, mp: '140+200', conf: 0.66, capturedAt: '2026-04-29 14:13:55' },
  { id: 'DEF-04912', line: '2', sev: 'high',     type: 'Squats',        lat: 44.0524927965281, lon: -123.08689970304, mp: '155+880', conf: 0.79, capturedAt: '2026-04-29 14:18:31' },
  // Route 3
  { id: 'DEF-04921', line: '3', sev: 'med',  type: 'Shelling',     lat: 44.8593784195786, lon: -122.893915605473, mp: '14+580',  conf: 0.73, capturedAt: '2026-04-29 12:10:42' },
  { id: 'DEF-04922', line: '3', sev: 'high', type: 'Crack', lat: 44.7708260247919, lon: -122.491849034632, mp: '32+040',  conf: 0.83, capturedAt: '2026-04-29 12:24:08' },
  { id: 'DEF-04923', line: '3', sev: 'med',  type: 'Shelling',           lat: 44.752161132088, lon: -122.301430396917, mp: '48+750',  conf: 0.71, capturedAt: '2026-04-29 12:39:54' },
  { id: 'DEF-04925', line: '3', sev: 'med',  type: 'Flaking',       lat: 44.5312621334757, lon: -121.952726063615, mp: '85+300',  conf: 0.74, capturedAt: '2026-04-29 12:59:16' },
  { id: 'DEF-04926', line: '3', sev: 'low',  type: 'Spalling',         lat: 44.3889625221229, lon: -121.775755894048, mp: '102+440', conf: 0.65, capturedAt: '2026-04-29 13:11:22' },
  { id: 'DEF-04927', line: '3', sev: 'high', type: 'Shelling',lat: 44.3515037781356, lon: -121.68805145067, mp: '125+880', conf: 0.84, capturedAt: '2026-04-29 13:25:03' },
  // Route 4
  { id: 'DEF-04931', line: '4', sev: 'low',  type: 'Flaking', lat: 47.560, lon: -122.342, mp: '4+200',  conf: 0.64, capturedAt: '2026-04-29 11:33:09' },
  { id: 'DEF-04932', line: '4', sev: 'med',  type: 'Shelling',  lat: 47.480, lon: -122.355, mp: '12+700', conf: 0.74, capturedAt: '2026-04-29 11:47:26' },
  { id: 'DEF-04933', line: '4', sev: 'high', type: 'Crack',      lat: 47.380, lon: -122.380, mp: '24+880', conf: 0.81, capturedAt: '2026-04-29 12:03:15' },
  { id: 'DEF-04934', line: '4', sev: 'med',  type: 'Shelling',        lat: 47.290, lon: -122.420, mp: '38+040', conf: 0.72, capturedAt: '2026-04-29 12:15:44' }
];

export const FALLBACK_PINS = FALLBACK_PINS_BASE.map((pin, i) => ({
  ...pin,
  type: displayDefectCategory(pin.type, pin.id),
  imageUrl: `/defect_${String((i % 8) + 1).padStart(2, '0')}.jpg`
}));

export const FOCUS_PIN = {
  id: 'DEF-04891', line: '1', sev: 'crit',
  type: 'Crack', lat: 44.6268666785878, lon: -123.126360560348, mp: '24+340', conf: 0.87,
  capturedAt: '2026-04-29 14:23:11'
};

const JETSON_STREAM_URL = import.meta.env.VITE_JETSON_STREAM_URL || '';

export const CAMERAS = [
  {
    id: 'JET-0',
    label: 'JET-0 Inspection Cam',
    streamUrl: JETSON_STREAM_URL,
    streamKind: JETSON_STREAM_URL ? 'mjpeg' : 'unavailable',
    source: JETSON_STREAM_URL ? 'Jetson live stream' : 'Stream unavailable',
    line: '1'
  },
  {
    id: 'JET-1',
    label: 'JET-1 Inspection Cam',
    streamUrl: '',
    streamKind: 'unavailable',
    source: 'Stream unavailable',
    line: '3'
  }
];

// Key-free raster providers only. CartoDB basemaps now watermark tiles with
// "API KEY REQUIRED" unless a Carto key is supplied, so OSM is used with a
// CSS dark filter (see .tiles-dark in index.css) to keep the dark UI.
export const TILE_PROVIDERS = [
  {
    name: 'OpenStreetMap (dark)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { attribution: '© OpenStreetMap contributors', maxZoom: 19, className: 'tiles-dark' }
  },
  {
    name: 'OpenStreetMap DE (dark)',
    url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
    options: { attribution: '© OpenStreetMap contributors', maxZoom: 18, className: 'tiles-dark' }
  }
];

