// ParkCast frontend v0 — Leaflet prototype (maps 1:1 to React component plan).
// Tries backend API, falls back to embedded mock so it works offline / in tests.
(function () {
  const params = new URLSearchParams(location.search);
  const API_BASE = params.get('api') || 'http://localhost:4000';

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

  const state = { zones: LOCAL_ZONES, horizonMin: 15, selectedId: null, apiOk: false, points: parseInt(localStorage.getItem('pc_points') || '0', 10) };

  const $ = (id) => document.getElementById(id);
  const mapEl = $('map');

  let map = null, markers = {};
  try {
    map = L.map('map').setView([37.8715, -122.273], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
  } catch (e) { console.warn('Leaflet init failed (offline?), continuing', e); }

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
    Object.values(markers).forEach(m => { try { m.remove(); } catch {} });
    markers = {};
    state.zones.forEach(z => {
      const p = probAt(z, state.horizonMin);
      const s = z.current && state.horizonMin === 15 && z.current.status ? z.current.status : statusOf(p);
      if (map) {
        try {
          const m = L.circleMarker([z.center.lat, z.center.lng], { radius: 14, color: colorOf(s), fillColor: colorOf(s), fillOpacity: 0.7 }).addTo(map);
          m.bindTooltip(`${z.name} — ${Math.round(p * 100)}%`);
          m.on('click', () => selectZone(z.id));
          markers[z.id] = m;
        } catch {}
      }
      const b = document.createElement('button');
      b.textContent = `${z.name} ${Math.round(p * 100)}%`;
      b.setAttribute('data-testid', `zone-marker-${z.id}`);
      b.addEventListener('click', () => selectZone(z.id));
      wrap.appendChild(b);
      const o = document.createElement('option');
      o.value = z.id; o.textContent = z.name;
      sel.appendChild(o);
    });
    $('time-label').textContent = `+${state.horizonMin} min`;
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
    if (map) { try { map.setView([z.center.lat, z.center.lng], 15); } catch {} }
  }

  $('zone-detail-close').addEventListener('click', () => $('zone-detail').classList.add('hidden'));
  $('time-slider').addEventListener('input', (e) => { state.horizonMin = parseInt(e.target.value, 10); renderZones(); });

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
    localStorage.setItem('pc_points', String(state.points));
    renderPoints();
    fetchZones();
  }
  $('report-found').addEventListener('click', () => report('found'));
  $('report-full').addEventListener('click', () => report('full'));
  $('report-circling').addEventListener('click', () => report('circling'));

  // expose for Playwright
  window.__parkcast = { state, selectZone, report, fetchZones };

  renderPoints();
  renderZones();
  fetchZones();
})();
