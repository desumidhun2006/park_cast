// Parkistics frontend v2 — free OpenStreetMap home page + live user location.
// Google Maps is an optional upgrade when an API key is configured.
// Tries backend API, falls back to embedded mock so it works offline / in tests.
// Map layer: Leaflet + OSM tiles by default (no key, no signup);
//   Google Maps JavaScript API when a key is present (via ?gmaps_key=, localStorage, or config.js).
// Location layer: navigator.geolocation centers the map where the person is right now.
(function () {
  const params = new URLSearchParams(location.search);
  const API_BASE = params.get('api') || 'http://localhost:4000';

  const DEFAULT_CENTER = { lat: 37.8715, lng: -122.273 };
  const DEFAULT_ZOOM = 14;
  const PLACEHOLDER_KEYS = new Set(['', 'PASTE_YOUR_KEY_HERE', 'YOUR_API_KEY']);
  const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

  const LOCAL_ZONES = [
    { id: 'zone-mall-gateway', name: 'Gateway Mall Lot', center: { lat: 37.8725, lng: -122.2715 }, capacity: 220, pricePerHour: 2.5, walkTo: [{ label: 'Gateway Mall', minutes: 3 }], peakHours: 'Weekdays 17-19 full, empties after 20', poiTags: ['mall'] },
    { id: 'zone-campus-north', name: 'Campus North St Block', center: { lat: 37.8745, lng: -122.2735 }, capacity: 45, pricePerHour: 1.5, walkTo: [{ label: 'North Gate', minutes: 2 }], peakHours: 'Weekdays 9-15 busy', poiTags: ['university'] },
    { id: 'zone-telegraph', name: 'Telegraph Commercial Strip', center: { lat: 37.8685, lng: -122.2585 }, capacity: 60, pricePerHour: 2.0, walkTo: [{ label: 'Cafes', minutes: 1 }], peakHours: 'Fri/Sat 19-23 scarce', poiTags: ['food'] },
    { id: 'zone-station', name: 'Downtown Station Lot', center: { lat: 37.8705, lng: -122.2685 }, capacity: 150, pricePerHour: 3.0, walkTo: [{ label: 'BART', minutes: 2 }], peakHours: 'Commute 7-9, 16-18 tight', poiTags: ['transit'] },
    { id: 'zone-residential-south', name: 'South Residential Cluster', center: { lat: 37.8655, lng: -122.2715 }, capacity: 80, pricePerHour: 0, walkTo: [{ label: 'South Campus', minutes: 10 }], peakHours: 'Overnight ample', poiTags: ['residential'] },
    { id: 'zone-hospital-east', name: 'Hospital East Lot', center: { lat: 37.8735, lng: -122.2645 }, capacity: 120, pricePerHour: 4.0, walkTo: [{ label: 'Hospital', minutes: 3 }], peakHours: 'Weekdays 10-16 busy', poiTags: ['hospital'] }
  ];

  function localProb(zone, date) {
    const h = date.getHours() + date.getMinutes() / 60;
    const day = date.getDay();
    const wd = day >= 1 && day <= 5;
    let p = 0.55;
    if (zone.id === 'zone-mall-gateway') {
      if (wd && h >= 17 && h < 19) p = 0.12;
      else if (wd && h >= 19 && h < 20) p = 0.3;
      else if (h >= 20 || h < 8) p = 0.82;
      else if (wd && h >= 11 && h < 16) p = 0.35;
    } else if (zone.id === 'zone-campus-north') {
      if (wd && h >= 9 && h < 15) p = 0.22; else if (h >= 18 || h < 7) p = 0.85;
    } else if (zone.id === 'zone-telegraph') {
      if ((day === 5 || day === 6) && h >= 19 && h <= 23) p = 0.15;
      else if (h >= 23 || h < 9) p = 0.75;
    } else if (zone.id === 'zone-station') {
      if (wd && ((h >= 7 && h < 9) || (h >= 16 && h < 18))) p = 0.18;
      else if (h >= 20 || h < 6) p = 0.8;
    } else if (zone.id === 'zone-residential-south') {
      if (day === 0 && h >= 17 && h < 22) p = 0.25; else if (h >= 22 || h < 7) p = 0.9; else p = 0.6;
    } else if (zone.id === 'zone-hospital-east') {
      if (wd && h >= 10 && h < 16) p = 0.25; else p = 0.7;
    }
    return Math.max(0.02, Math.min(0.97, p));
  }

  function statusOf(p) { return p >= 0.6 ? 'high' : p >= 0.35 ? 'medium' : 'low'; }
  function colorOf(s) { return s === 'high' ? '#22c55e' : s === 'medium' ? '#eab308' : '#ef4444'; }

  const state = { zones: LOCAL_ZONES, horizonMin: 15, selectedId: null, apiOk: false, points: parseInt(localStorage.getItem('ps_points') || '0', 10), userLocation: null, mapReady: false, provider: null, keySource: null };

  const $ = (id) => document.getElementById(id);

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.defer = true;
      s.onload = resolve; s.onerror = () => reject(new Error('script load failed: ' + src));
      document.head.appendChild(s);
    });
  }
  function loadCss(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    document.head.appendChild(l);
  }

  // ---- Google Maps key resolution: ?gmaps_key= > localStorage > config.js ----
  function resolveApiKey() {
    const urlKey = params.get('gmaps_key');
    if (urlKey !== null) {
      if (urlKey && !PLACEHOLDER_KEYS.has(urlKey)) {
        try { localStorage.setItem('ps_gmaps_key', urlKey); } catch {}
        state.keySource = 'url';
        return urlKey;
      }
      try { localStorage.removeItem('ps_gmaps_key'); } catch {}
      state.keySource = null;
      return null;
    }
    try {
      const stored = localStorage.getItem('ps_gmaps_key');
      if (stored && !PLACEHOLDER_KEYS.has(stored)) { state.keySource = 'stored'; return stored; }
    } catch {}
    const cfg = (window.PARKCAST_CONFIG && window.PARKCAST_CONFIG.GOOGLE_MAPS_API_KEY) || '';
    if (cfg && !PLACEHOLDER_KEYS.has(cfg)) { state.keySource = 'config'; return cfg; }
    state.keySource = null;
    return null;
  }

  function showMapNotice(html) {
    const el = $('map');
    el.innerHTML = `<div class="map-notice" data-testid="map-notice">${html}</div>`;
  }

  // ---- Map providers: Leaflet/OSM (free default) + Google (optional upgrade) ----
  let map = null;
  let circles = {};        // google.maps.Circle per zone
  let leafletMarkers = {}; // L.circleMarker per zone
  let youMarker = null;
  let accuracyCircle = null;

  function zoneStatus(z) {
    const p = probAt(z, state.horizonMin);
    const s = z.current && state.horizonMin === 15 && z.current.status ? z.current.status : statusOf(p);
    return { p, s, color: colorOf(s) };
  }

  // Google
  window.__psInitMap = function () {
    try {
      map = new google.maps.Map($('map'), { center: state.userLocation || DEFAULT_CENTER, zoom: DEFAULT_ZOOM, mapTypeControl: false, streetViewControl: false });
      state.provider = 'google';
      state.mapReady = true;
      if (state.userLocation) placeYouMarker(state.userLocation);
      renderZones();
    } catch (e) {
      initLeaflet(); // fall back to the free map
    }
  };

  window.gm_authFailure = function () {
    // Invalid/restricted key — fall back to the free map instead of a dead page.
    if (!state.provider) initLeaflet();
  };

  function initGoogle(key) {
    window.__psInitMapRef = window.__psInitMap;
    loadScript(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__psInitMap&loading=async`)
      .catch(() => { if (!state.provider) initLeaflet(); });
  }

  function syncGoogleCircles() {
    Object.keys(circles).forEach(id => {
      if (!state.zones.find(z => z.id === id)) { circles[id].setMap(null); delete circles[id]; }
    });
    state.zones.forEach(z => {
      const { color } = zoneStatus(z);
      if (!circles[z.id]) {
        const c = new google.maps.Circle({
          map, center: { lat: z.center.lat, lng: z.center.lng }, radius: 120,
          strokeColor: color, strokeWeight: 2, fillColor: color, fillOpacity: 0.55
        });
        c.addListener('click', () => selectZone(z.id));
        circles[z.id] = c;
      } else {
        circles[z.id].setOptions({ strokeColor: color, fillColor: color });
      }
    });
  }

  // Leaflet / OpenStreetMap (free, no key)
  async function initLeaflet() {
    if (state.provider) return;
    try {
      if (!window.L) {
        loadCss(LEAFLET_CSS);
        await loadScript(LEAFLET_JS);
      }
      map = L.map('map').setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], DEFAULT_ZOOM);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      state.provider = 'leaflet';
      state.mapReady = true;
      if (state.userLocation) placeYouMarker(state.userLocation);
      renderZones();
    } catch (e) {
      showMapNotice('Map tiles could not load (you may be offline). Zone list, forecasts, trip planner and reports below still work.');
    }
  }

  function syncLeafletMarkers() {
    Object.keys(leafletMarkers).forEach(id => {
      if (!state.zones.find(z => z.id === id)) { leafletMarkers[id].remove(); delete leafletMarkers[id]; }
    });
    state.zones.forEach(z => {
      const { p, color } = zoneStatus(z);
      if (!leafletMarkers[z.id]) {
        const m = L.circleMarker([z.center.lat, z.center.lng], { radius: 14, color, fillColor: color, fillOpacity: 0.7 }).addTo(map);
        m.bindTooltip(`${z.name} — ${Math.round(p * 100)}%`);
        m.on('click', () => selectZone(z.id));
        leafletMarkers[z.id] = m;
      } else {
        leafletMarkers[z.id].setStyle({ color, fillColor: color });
        leafletMarkers[z.id].setTooltipContent(`${z.name} — ${Math.round(p * 100)}%`);
      }
    });
  }

  function syncMarkers() {
    if (!state.mapReady) return;
    if (state.provider === 'google') syncGoogleCircles();
    else if (state.provider === 'leaflet') syncLeafletMarkers();
  }

  function centerMap(lat, lng, zoom) {
    if (!state.mapReady || !map) return;
    try {
      if (state.provider === 'google') { map.panTo({ lat, lng }); map.setZoom(zoom); }
      else if (state.provider === 'leaflet') { map.setView([lat, lng], zoom); }
    } catch {}
  }

  // ---- Live user location ----
  function fmt(n) { return Math.round(n * 10000) / 10000; }

  function placeYouMarker(loc) {
    if (!state.mapReady) return;
    try {
      if (state.provider === 'google') {
        const pos = { lat: loc.lat, lng: loc.lng };
        if (!youMarker) {
          youMarker = new google.maps.Marker({
            map, position: pos, title: 'You are here',
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#2563eb', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 }
          });
        } else youMarker.setPosition(pos);
        if (loc.accuracy && isFinite(loc.accuracy)) {
          if (!accuracyCircle) accuracyCircle = new google.maps.Circle({ map, fillColor: '#2563eb', fillOpacity: 0.15, strokeColor: '#2563eb', strokeOpacity: 0.4 });
          accuracyCircle.setCenter(pos);
          accuracyCircle.setRadius(Math.min(loc.accuracy, 2000));
        }
      } else if (state.provider === 'leaflet') {
        if (!youMarker) {
          youMarker = L.circleMarker([loc.lat, loc.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(map);
          youMarker.bindTooltip('You are here');
        } else youMarker.setLatLng([loc.lat, loc.lng]);
        if (loc.accuracy && isFinite(loc.accuracy)) {
          if (!accuracyCircle) accuracyCircle = L.circle([loc.lat, loc.lng], { color: '#2563eb', weight: 1, opacity: 0.4, fillColor: '#2563eb', fillOpacity: 0.15 }).addTo(map);
          accuracyCircle.setLatLng([loc.lat, loc.lng]);
          accuracyCircle.setRadius(Math.min(loc.accuracy, 2000));
        }
      }
    } catch {}
  }

  function locateMe() {
    const statusEl = $('location-status');
    if (!('geolocation' in navigator)) {
      statusEl.textContent = 'Geolocation not supported — showing default area.';
      return;
    }
    statusEl.textContent = 'Locating you…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        state.userLocation = loc;
        statusEl.textContent = `You are here ✓ (${fmt(loc.lat)}, ${fmt(loc.lng)})`;
        centerMap(loc.lat, loc.lng, 15);
        placeYouMarker(loc);
      },
      (err) => {
        const why = err && err.code === 1 ? 'permission denied' : 'unavailable';
        statusEl.textContent = `Location ${why} — showing default area. Tap 📍 to retry.`;
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function renderPoints() {
    $('points-display').textContent = `${state.points} pts`;
    const badges = [];
    if (state.points >= 10) badges.push('Reporter');
    if (state.points >= 50) badges.push('Contributor');
    if (state.points >= 100) badges.push('Scout');
    $('badges-display').textContent = badges.length ? badges.join(' • ') : 'No badges yet';
  }

  function probAt(zone, horizonMin) {
    const t = new Date(Date.now() + horizonMin * 60000);
    // prefer already-fetched current probabilities when horizon matches
    const z = state.zones.find(z => z.id === zone.id);
    if (z && z.current && horizonMin === 15 && z.current.probability != null) return z.current.probability;
    return Math.round(localProb(zone, t) * 100) / 100;
  }

  function renderZones() {
    const wrap = $('zone-buttons');
    wrap.innerHTML = '';
    const sel = $('report-zone-select');
    sel.innerHTML = '';
    state.zones.forEach(z => {
      const p = probAt(z, state.horizonMin);
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${z.name} ${Math.round(p * 100)}%`;
      b.setAttribute('data-testid', `zone-marker-${z.id}`);
      b.addEventListener('click', () => selectZone(z.id));
      wrap.appendChild(b);
      const o = document.createElement('option');
      o.value = z.id; o.textContent = z.name;
      sel.appendChild(o);
    });
    $('time-label').textContent = `+${state.horizonMin} min`;
    syncMarkers();
  }

  async function fetchZones() {
    try {
      const r = await fetch(`${API_BASE}/api/zones`);
      if (!r.ok) throw new Error('bad');
      const j = await r.json();
      if (j.zones && j.zones.length) {
        state.zones = j.zones.map(z => ({ ...z, center: z.center }));
        state.apiOk = true;
      }
    } catch { state.apiOk = false; }
    $('api-status').textContent = state.apiOk ? `API: ${API_BASE} ✓` : 'API: local mock (backend offline)';
    renderZones();
  }

  async function selectZone(id) {
    state.selectedId = id;
    const z = state.zones.find(z => z.id === id) || LOCAL_ZONES.find(z => z.id === id);
    const card = $('zone-detail');
    card.classList.remove('hidden');
    $('detail-name').textContent = z.name;
    $('detail-meta').textContent = `${z.kind || ''} • cap ${z.capacity} • $${z.pricePerHour}/h • walk ${(z.walkTo[0] && z.walkTo[0].minutes) || '?'} min • ${z.peakHours || ''}`;
    let series = null;
    try {
      const arrival = new Date(Date.now() + state.horizonMin * 60000).toISOString();
      const r = await fetch(`${API_BASE}/api/zones/${id}/forecast?arrival=${encodeURIComponent(arrival)}`);
      if (r.ok) { const j = await r.json(); series = j.series; }
    } catch {}
    if (!series) {
      series = [0, 15, 30, 60, 120, 180].map(h => {
        const t = new Date(Date.now() + h * 60000);
        const p = Math.round(localProb(z, t) * 100) / 100;
        return { horizonMin: h, probability: p, confidence: 0.75 };
      });
    }
    const bars = $('detail-bars');
    bars.innerHTML = '';
    series.forEach(pt => {
      const d = document.createElement('div');
      d.className = 'bar';
      const pct = Math.round(pt.probability * 100);
      d.innerHTML = `<i style="height:${pct * 0.6}px;background:${colorOf(statusOf(pt.probability))}"></i><span>+${pt.horizonMin}<br>${pct}%</span>`;
      bars.appendChild(d);
    });
    $('detail-extra').textContent = `Confidence ${(series[1] && series[1].confidence) || '—'} • Probability of finding a spot over next hours.`;
    centerMap(z.center.lat, z.center.lng, 15);
  }

  $('zone-detail-close').addEventListener('click', () => $('zone-detail').classList.add('hidden'));
  $('time-slider').addEventListener('input', (e) => { state.horizonMin = parseInt(e.target.value, 10); renderZones(); });
  $('locate-me').addEventListener('click', locateMe);

  $('trip-search').addEventListener('click', async () => {
    const dest = $('trip-destination').value || 'downtown';
    const timeVal = $('trip-time').value;
    const time = timeVal ? new Date(timeVal).toISOString() : new Date().toISOString();
    let data = null;
    try {
      const r = await fetch(`${API_BASE}/api/route?destination=${encodeURIComponent(dest)}&time=${encodeURIComponent(time)}`);
      if (r.ok) data = await r.json();
    } catch {}
    if (!data) {
      const arr = new Date(time);
      const ranked = LOCAL_ZONES.map(z => {
        const p = localProb(z, arr);
        const walk = (z.walkTo[0] && z.walkTo[0].minutes) || 5;
        return { zoneId: z.id, name: z.name, probability: Math.round(p * 100) / 100, status: statusOf(p), walkMinutes: walk, pricePerHour: z.pricePerHour, expectedSearchMin: Math.round((1 - p) * 14 + 2), score: 0 };
      }).sort((a, b) => b.probability - a.probability);
      data = { ranked, searchTimeSavedMin: Math.max(0, 12 - ranked[0].expectedSearchMin), arrival: time };
    }
    const box = $('trip-results');
    box.innerHTML = '';
    data.ranked.slice(0, 4).forEach(r => {
      const d = document.createElement('div');
      d.className = 'result';
      d.textContent = `${r.name} — ${Math.round(r.probability * 100)}% (${r.status}), walk ${r.walkMinutes} min, $${r.pricePerHour}/h, search ~${r.expectedSearchMin} min`;
      box.appendChild(d);
    });
    const s = document.createElement('div');
    s.className = 'result';
    s.setAttribute('data-testid', 'trip-saved');
    s.textContent = `Estimated search time saved vs naive: ${data.searchTimeSavedMin} min`;
    box.appendChild(s);
  });

  async function report(signal) {
    const zoneId = $('report-zone-select').value || (state.zones[0] && state.zones[0].id);
    try {
      const r = await fetch(`${API_BASE}/api/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zoneId, signal }) });
      if (r.ok) { const j = await r.json(); $('report-status').textContent = `Thanks! Report ${j.id} recorded (+${j.pointsAwarded} pts).`; }
      else throw new Error();
    } catch { $('report-status').textContent = `Saved locally (backend offline): ${signal} @ ${zoneId} (+10 pts).`; }
    state.points += 10;
    localStorage.setItem('ps_points', String(state.points));
    renderPoints();
    fetchZones();
  }
  $('report-found').addEventListener('click', () => report('found'));
  $('report-full').addEventListener('click', () => report('full'));
  $('report-circling').addEventListener('click', () => report('circling'));

  // expose for Playwright
  window.__parkistics = { state, selectZone, report, fetchZones, locateMe };

  // Default arrival = now + 60 min (rounded to 5 min) so Trip Planner works in one click.
  try {
    const t = new Date(Date.now() + 60 * 60000);
    t.setMinutes(Math.round(t.getMinutes() / 5) * 5, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    $('trip-time').value = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
  } catch {}

  renderPoints();
  renderZones();
  fetchZones();

  // Map boot: free Leaflet/OSM by default; Google Maps when a key is configured.
  const gkey = resolveApiKey();
  if (gkey) initGoogle(gkey);
  else initLeaflet();

  // Ask for the person's location right away (map centers on it once granted).
  locateMe();
})();
