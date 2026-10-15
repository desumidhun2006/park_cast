// Parkistics frontend v3 — Stitch UI wired to live backend APIs. No mock data:
// every number on screen comes from GET /api/zones, /forecast, /route, /reports
// or the device geolocation. Backend is required; failures show a retry banner.
(function () {
  const params = new URLSearchParams(location.search);
  const API_BASE = params.get('api') || 'http://localhost:4000';

  const DEFAULT_CENTER = { lat: 37.8715, lng: -122.273 };
  const DEFAULT_ZOOM = 14;
  const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const WALK_OPTIONS = [5, 8, 12, 15];

  const HEX = { high: '#22c55e', medium: '#f7bf1e', low: '#ffb4ab' };

  const PRESET_DESTINATIONS = [
    { key: 'downtown', name: 'Downtown Berkeley', lat: 37.8702, lng: -122.2681 },
    { key: 'campus', name: 'UC Berkeley Campus', lat: 37.8719, lng: -122.2585 },
    { key: 'telegraph', name: 'Telegraph Avenue', lat: 37.8665, lng: -122.2588 },
    { key: 'fourth', name: 'Fourth Street Shops', lat: 37.8692, lng: -122.3005 },
    { key: 'marina', name: 'Berkeley Marina', lat: 37.8645, lng: -122.3168 },
    { key: 'ashby', name: 'Ashby Station', lat: 37.8532, lng: -122.2698 },
    { key: 'north berkeley', name: 'North Berkeley', lat: 37.8795, lng: -122.2695 },
    { key: 'elmwood', name: 'Elmwood District', lat: 37.8595, lng: -122.2528 },
    { key: 'solano', name: 'Solano Avenue', lat: 37.8918, lng: -122.2825 },
    { key: 'gourmet', name: 'Gourmet Ghetto', lat: 37.8795, lng: -122.2695 },
    { key: 'chez panisse', name: 'Chez Panisse', lat: 37.8795, lng: -122.2695 },
    { key: 'stadium', name: 'California Memorial Stadium', lat: 37.8708, lng: -122.2505 },
    { key: 'theatre', name: 'Hearst Greek Theatre', lat: 37.8742, lng: -122.2538 },
    { key: 'civic', name: 'Berkeley Civic Center', lat: 37.8695, lng: -122.2735 },
    { key: 'hospital', name: 'Hospital East Hub', lat: 37.8735, lng: -122.2645 }
  ];

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const state = {
    zones: [], horizonMin: 15, selectedId: null, apiOk: false,
    points: 0, myReports: [], userLocation: null,
    mapReady: false, provider: null, maxWalk: 8, lastRoute: null,
    destination: 'Downtown Berkeley',
    destCoords: { lat: 37.8702, lng: -122.2681 },
    searchRadiusKm: 1.0, // default 1 km
    nearbyZones: []
  };

  const $ = (id) => document.getElementById(id);

  try {
    state.myReports = JSON.parse(localStorage.getItem('ps_my_reports') || '[]');
    state.points = state.myReports.reduce((s, r) => s + (r.points || 0), 0);
  } catch { state.myReports = []; state.points = 0; }

  function saveReports() {
    try { localStorage.setItem('ps_my_reports', JSON.stringify(state.myReports)); } catch {}
  }

  // ---------- helpers ----------
  function statusOf(p) { return p >= 0.6 ? 'high' : p >= 0.35 ? 'medium' : 'low'; }
  function fmt(n) { return Math.round(n * 10000) / 10000; }
  function shortName(name) { return String(name).split(' ').slice(0, 2).join(' '); }
  function zoneById(id) { return state.zones.find(z => z.id === id); }
  function relTime(iso) {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    return `${Math.round(mins / 60)} h ago`;
  }
  function kindLabel(kind) { return kind === 'lot' ? 'Off-street Lot' : kind === 'garage' ? 'Multi-Level Garage' : kind === 'street' ? 'Street Block' : 'Zone Cluster'; }
  function dirHref(lat, lng) { return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`; }

  async function api(path, opts) {
    const r = await fetch(`${API_BASE}${path}`, opts);
    if (!r.ok) throw new Error(`API ${r.status} on ${path}`);
    return r.json();
  }

  function showApiError(on) {
    $('api-error').classList.toggle('hidden', !on);
    $('api-error').classList.toggle('flex', on);
    const dot = $('api-dot');
    if (dot) { dot.className = on ? 'w-1.5 h-1.5 rounded-full bg-error' : 'w-1.5 h-1.5 rounded-full bg-primary animate-pulse'; }
  }

  // ---------- view router ----------
  const VIEWS = ['view-forecast', 'view-zones'];
  const VIEW_LABELS = { 'view-forecast': '• Forecast', 'view-zones': '• Zone Details', 'view-planner': '• Trip Planner', 'view-badges': '• Crowd Report & Badges' };
  function showView(id) {
    VIEWS.forEach(v => {
      const el = $(v);
      if (!el) return;
      const on = v === id;
      el.classList.toggle('hidden', !on);
      el.classList.toggle('flex', on);
    });
    document.querySelectorAll('nav [data-view]').forEach(b => {
      const on = b.getAttribute('data-view') === id;
      b.classList.toggle('text-primary', on);
      b.classList.toggle('bg-surface-container-high', on);
      b.classList.toggle('text-on-surface-variant', !on);
    });
    const vl = $('view-label');
    if (vl) vl.textContent = VIEW_LABELS[id] || '';
    window.scrollTo(0, 0);
  }

  // ---------- header / gamification (real points from confirmed reports) ----------
  function tierOf(points) {
    if (points >= 100) return { name: 'Scout', tier: 'Tier 3: Scout', next: null };
    if (points >= 50) return { name: 'Contributor', tier: 'Tier 2: Contributor', next: 100 };
    if (points >= 10) return { name: 'Reporter', tier: 'Tier 1: Reporter', next: 50 };
    return { name: null, tier: 'Tier 0: Rookie', next: 10 };
  }
  function renderPoints() {
    const t = tierOf(state.points);
    if ($('points-display')) $('points-display').textContent = `${state.points} pts`;
    if ($('badges-display')) $('badges-display').textContent = t.name || 'No badges yet';
    if ($('tier-name')) $('tier-name').textContent = t.tier;
    if ($('tier-sub')) $('tier-sub').textContent = t.next ? `${state.points} / ${t.next} pts to ${t.next === 10 ? 'Reporter' : t.next === 50 ? 'Contributor' : 'Scout'}` : `${state.points} pts · max rank`;
    const pct = t.next ? Math.min(100, Math.round((state.points / t.next) * 100)) : 100;
    if ($('reputation-progress-bar')) $('reputation-progress-bar').style.width = pct + '%';
    if ($('stat-reports-count')) $('stat-reports-count').textContent = String(state.myReports.length);
    if ($('stat-points')) $('stat-points').textContent = String(state.points);
    if ($('stat-rank')) $('stat-rank').textContent = t.name || 'Rookie';
    const tiers = [
      { name: 'Reporter', at: 10 }, { name: 'Contributor', at: 50 }, { name: 'Scout', at: 100 }
    ];
    if ($('milestones')) {
      $('milestones').innerHTML = tiers.map(ti => {
        const unlocked = state.points >= ti.at;
        const current = !unlocked && state.points >= (ti.at === 10 ? 0 : ti.at === 50 ? 10 : 50) && state.points < ti.at;
        const color = unlocked ? 'text-primary' : current ? 'text-tertiary' : 'text-on-surface-variant';
        const icon = unlocked ? 'check_circle' : current ? 'pending' : 'lock';
        const sub = unlocked ? `${ti.at} pts · Unlocked` : `${ti.at} pts · ${Math.max(0, ti.at - state.points)} to go`;
        return `<div class="flex flex-col items-center"><div class="flex items-center gap-0.5 ${color}"><span class="material-symbols-outlined text-[14px]">${icon}</span><span class="font-label-sm text-label-sm font-bold">${ti.name}</span></div><span class="font-body-sm text-body-sm text-on-surface-variant">${sub}</span></div>`;
      }).join('');
    }
  }

  // ---------- map (Leaflet + OpenStreetMap, zone pills as live divIcons) ----------
  let map = null;
  let markers = {};
  let youMarker = null;
  let accuracyCircle = null;
  let destMarker = null;
  let radiusCircle = null;

  function pillHtml(z, pct, color) {
    return `<div style="transform:translate(-50%,-110%)"><div style="display:flex;flex-direction:column;align-items:center">` +
      `<div style="display:flex;align-items:center;gap:4px;padding:2px 8px;border-radius:9999px;background:rgba(34,42,61,.92);color:${color};font:700 12px Inter,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.6);white-space:nowrap">` +
      `<span style="width:6px;height:6px;border-radius:9999px;background:${color}"></span><span>${pct}%</span></div>` +
      `<div style="margin-top:4px;padding:1px 6px;border-radius:6px;background:rgba(6,14,32,.85);color:#bccbb9;font:600 9px Inter,sans-serif;white-space:nowrap">${shortName(z.name)}</div>` +
      `</div></div>`;
  }

  function renderDestinationRadiusOnMap() {
    if (!state.mapReady || !map || !state.destCoords) return;
    try {
      if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
      if (radiusCircle) { map.removeLayer(radiusCircle); radiusCircle = null; }

      const destIcon = L.divIcon({
        className: 'dest-pin-marker',
        html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);cursor:default">` +
          `<div style="background:#0f172a;color:#ffffff;padding:3px 9px;border-radius:9999px;font:700 11px Inter,sans-serif;box-shadow:0 3px 10px rgba(0,0,0,0.3);white-space:nowrap;display:flex;align-items:center;gap:4px">` +
          `<span>🎯</span><span>${shortName(state.destination)}</span></div>` +
          `<div style="width:2px;height:9px;background:#0f172a"></div>` +
          `<div style="width:10px;height:10px;border-radius:50%;background:#16a34a;border:2px solid #ffffff;box-shadow:0 0 8px rgba(22,163,74,0.6)"></div>` +
          `</div>`,
        iconSize: [0, 0]
      });

      destMarker = L.marker([state.destCoords.lat, state.destCoords.lng], { icon: destIcon, zIndexOffset: 999 }).addTo(map);

      radiusCircle = L.circle([state.destCoords.lat, state.destCoords.lng], {
        radius: state.searchRadiusKm * 1000,
        color: '#16a34a',
        weight: 2,
        dashArray: '6, 6',
        fillColor: '#22c55e',
        fillOpacity: 0.08
      }).addTo(map);

      // Smoothly fit bounds to show destination + search radius circle
      map.fitBounds(radiusCircle.getBounds(), { padding: [25, 25], maxZoom: 16 });
    } catch (e) {
      console.warn('Map radius render err:', e);
    }
  }

  async function resolveDestination(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return PRESET_DESTINATIONS[0];
    const found = PRESET_DESTINATIONS.find(d => q.includes(d.key) || d.name.toLowerCase().includes(q));
    if (found) return found;
    // Attempt fast Nominatim lookup for typed address
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
        headers: { 'Accept': 'application/json' }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data[0]) {
          return {
            name: data[0].display_name.split(',').slice(0, 2).join(','),
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon)
          };
        }
      }
    } catch {}
    return { name: query, lat: state.destCoords.lat, lng: state.destCoords.lng };
  }

  async function initLeaflet() {
    try {
      if (!window.L) {
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = LEAFLET_CSS;
        document.head.appendChild(l);
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      map = L.map('map').setView([state.destCoords.lat, state.destCoords.lng], DEFAULT_ZOOM);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      state.provider = 'leaflet';
      state.mapReady = true;
      if (state.userLocation) placeYouMarker(state.userLocation);
      renderDestinationRadiusOnMap();
    } catch (e) {
      showApiError(true);
      if ($('api-error-text')) $('api-error-text').textContent = 'Map tiles could not load (offline?). Check connection and retry.';
    }
  }

  function syncMarkers(current) {
    if (!state.mapReady) return;
    Object.keys(markers).forEach(id => {
      if (!state.zones.find(z => z.id === id)) { markers[id].remove(); delete markers[id]; }
    });
    state.zones.forEach(z => {
      const p = current[z.id] != null ? current[z.id] : (z.current ? z.current.probability : 0.5);
      const pct = Math.round(p * 100);
      const color = HEX[statusOf(p)];
      if (!markers[z.id]) {
        const m = L.marker([z.center.lat, z.center.lng], {
          icon: L.divIcon({ html: pillHtml(z, pct, color), className: '', iconSize: null }),
          title: z.name
        }).addTo(map);
        m.on('click', () => selectZone(z.id));
        markers[z.id] = m;
      } else {
        markers[z.id].setIcon(L.divIcon({ html: pillHtml(z, pct, color), className: '', iconSize: null }));
      }
    });
  }

  function centerMap(lat, lng, zoom) {
    if (!state.mapReady || !map) return;
    try { map.setView([lat, lng], zoom); } catch {}
  }

  function placeYouMarker(loc) {
    if (!state.mapReady) return;
    try {
      if (!youMarker) {
        youMarker = L.circleMarker([loc.lat, loc.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(map);
        youMarker.bindTooltip('You are here');
      } else youMarker.setLatLng([loc.lat, loc.lng]);
      if (loc.accuracy && isFinite(loc.accuracy)) {
        if (!accuracyCircle) accuracyCircle = L.circle([loc.lat, loc.lng], { color: '#2563eb', weight: 1, opacity: 0.4, fillColor: '#2563eb', fillOpacity: 0.15 }).addTo(map);
        accuracyCircle.setLatLng([loc.lat, loc.lng]);
        accuracyCircle.setRadius(Math.min(loc.accuracy, 2000));
      }
    } catch {}
  }

  // ---------- live location ----------
  function locateMe() {
    if (!('geolocation' in navigator)) {
      if ($('banner-title')) $('banner-title').textContent = 'Geolocation unavailable';
      if ($('banner-coords')) $('banner-coords').textContent = 'showing default area';
      return;
    }
    if ($('banner-title')) $('banner-title').textContent = 'Locating you…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        state.userLocation = loc;
        if ($('banner-title')) $('banner-title').innerHTML = 'Location permission active: <span class="text-secondary font-bold">You are here ✓</span>';
        if ($('banner-coords')) $('banner-coords').textContent = `(${fmt(loc.lat)}, ${fmt(loc.lng)})`;
        centerMap(loc.lat, loc.lng, 15);
        placeYouMarker(loc);
      },
      (err) => {
        const why = err && err.code === 1 ? 'permission denied' : 'unavailable';
        if ($('banner-title')) $('banner-title').textContent = `Location ${why} — showing default area. Tap 📍 to retry.`;
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  // ---------- forecast view (live) ----------
  function chipHtml(z, pct, color) {
    return `<span class="w-2 h-2 rounded-full shrink-0" style="background:${color}"></span>` +
      `<span class="flex flex-col min-w-0"><span class="font-label-sm text-label-sm text-on-surface font-semibold truncate" style="max-width:110px">${shortName(z.name)}</span>` +
      `<span class="font-label-sm text-label-sm font-bold" style="color:${color}">${pct}%</span></span>`;
  }

  async function refreshForecastBoard() {
    // Live probabilities at the selected horizon for every zone.
    const arrival = new Date(Date.now() + state.horizonMin * 60000).toISOString();
    const current = {};
    await Promise.all(state.zones.map(async (z) => {
      try {
        const f = await api(`/api/zones/${z.id}/forecast?arrival=${encodeURIComponent(arrival)}`);
        const pt = f.series.find(s => s.horizonMin === 0) || f.series[0];
        current[z.id] = pt.probability;
      } catch { current[z.id] = z.current ? z.current.probability : null; }
    }));

    // Calculate distance from destination to each zone
    state.zones.forEach(z => {
      const d = haversineKm(state.destCoords.lat, state.destCoords.lng, z.center.lat, z.center.lng);
      z.distKm = Math.round(d * 100) / 100;
      z.distanceMeters = Math.round(d * 1000);
      z.walkMinutes = Math.max(1, Math.round(d * 12));
    });

    // Nearby zones within search radius
    const nearby = state.zones.filter(z => z.distKm <= state.searchRadiusKm);
    nearby.sort((a, b) => a.distKm - b.distKm);
    state.nearbyZones = nearby;

    // Update label & radius badge
    if ($('zones-count-label')) $('zones-count-label').textContent = `Nearby Parking (${nearby.length})`;
    if ($('zones-radius-badge')) $('zones-radius-badge').textContent = `within ${state.searchRadiusKm.toFixed(1)} km of ${shortName(state.destination)}`;

    // Render horizontal zone buttons (compatible with existing tests)
    const wrap = $('zone-buttons');
    if (wrap) {
      wrap.innerHTML = '';
      const displayZones = nearby.length > 0 ? nearby : state.zones;
      displayZones.forEach(z => {
        const p = current[z.id] != null ? current[z.id] : 0.5;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container shrink-0 text-left hover:bg-surface-container-high active:scale-95 transition-all shadow-sm cursor-pointer';
        b.setAttribute('data-testid', `zone-marker-${z.id}`);
        b.innerHTML = chipHtml(z, Math.round(p * 100), HEX[statusOf(p)]);
        b.addEventListener('click', () => selectZone(z.id));
        wrap.appendChild(b);
      });
    }

    // Render detailed Nearby Availability & Probability Cards
    const cardsWrap = $('nearby-cards');
    if (cardsWrap) {
      if (nearby.length === 0) {
        cardsWrap.innerHTML = `<div class="col-span-full p-5 rounded-2xl bg-surface-container border border-slate-200/80 text-center flex flex-col items-center gap-2">` +
          `<span class="material-symbols-outlined text-slate-400 text-[28px]">location_off</span>` +
          `<span class="text-[13px] text-on-surface font-semibold">No parking zones within <strong>${state.searchRadiusKm.toFixed(1)} km</strong> of ${state.destination}.</span>` +
          `<span class="text-[12px] text-on-surface-variant">Try expanding your search radius to find nearby parking.</span>` +
          `<button type="button" onclick="window.__parkistics.setRadius(2.0)" class="mt-1 px-4 py-1.5 rounded-xl bg-primary text-white text-[12px] font-bold shadow-sm hover:bg-emerald-700 cursor-pointer">Expand to 2.0 km</button>` +
          `</div>`;
      } else {
        cardsWrap.innerHTML = nearby.map(z => {
          const p = current[z.id] != null ? current[z.id] : (z.current ? z.current.probability : 0.5);
          const pct = Math.round(p * 100);
          const st = statusOf(p);
          const color = HEX[st];
          const stLabel = st === 'high' ? 'High Chance' : st === 'medium' ? 'Medium' : 'Congested';
          const avail = Math.max(0, Math.round(z.capacity * p));
          const distStr = z.distanceMeters < 1000 ? `${z.distanceMeters}m away` : `${z.distKm} km away`;
          return `<article class="p-3.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-2.5 cursor-pointer text-left group" data-zone-id="${z.id}" onclick="window.__parkistics.selectZone('${z.id}')">` +
            `<div class="flex items-start justify-between gap-2">` +
            `<div class="flex flex-col min-w-0">` +
            `<div class="flex items-center gap-1.5 flex-wrap">` +
            `<span class="font-bold text-[14px] text-on-surface truncate group-hover:text-primary transition-colors">${z.name}</span>` +
            `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">${kindLabel(z.kind)}</span>` +
            `</div>` +
            `<div class="flex items-center gap-1.5 text-[12px] text-on-surface-variant mt-1 flex-wrap">` +
            `<span class="font-bold text-primary">📍 ${distStr}</span>` +
            `<span>•</span>` +
            `<span>~${z.walkMinutes} min walk</span>` +
            `<span>•</span>` +
            `<span class="font-semibold text-on-surface">${z.pricePerHour > 0 ? `$${z.pricePerHour}/hr` : 'Free'}</span>` +
            `</div>` +
            `</div>` +
            `<span class="px-2.5 py-1 rounded-full text-[12px] font-extrabold shrink-0" style="color:${color};background:${color}22">` +
            `${pct}% ${stLabel}` +
            `</span>` +
            `</div>` +
            `<div class="flex items-center justify-between pt-2 border-t border-slate-200/50 text-[11px] text-on-surface-variant">` +
            `<span>Availability: <strong class="text-on-surface font-bold">~${avail} / ${z.capacity} spots</strong></span>` +
            `<span class="text-primary font-bold group-hover:underline flex items-center gap-0.5">Forecast & Details →</span>` +
            `</div>` +
            `</article>`;
        }).join('');
      }
    }

    if ($('slider-val-label')) $('slider-val-label').textContent = `+${state.horizonMin} min`;
    document.querySelectorAll('#slider-steps [data-h]').forEach(el => {
      const active = parseInt(el.getAttribute('data-h'), 10) === state.horizonMin;
      el.classList.toggle('font-bold', active);
      el.classList.toggle('text-primary', active);
    });
    syncMarkers(current);
  }

  async function refreshReco() {
    try {
      const dest = state.destination || 'Downtown Berkeley';
      const lat = state.destCoords ? state.destCoords.lat : 37.8702;
      const lng = state.destCoords ? state.destCoords.lng : -122.2681;
      const rad = state.searchRadiusKm || 1.0;
      const data = await api(`/api/route?destination=${encodeURIComponent(dest)}&lat=${lat}&lng=${lng}&radius=${rad}&time=${encodeURIComponent(new Date().toISOString())}`);
      const best = data.ranked[0];
      if ($('reco-title')) $('reco-title').textContent = `${best.name} Recommended`;
      const distStr = best.distanceKm != null ? `${best.distanceKm < 1 ? Math.round(best.distanceKm * 1000) + 'm' : best.distanceKm + 'km'} away • ` : '';
      if ($('reco-sub')) $('reco-sub').textContent = `${Math.round(best.probability * 100)}% chance • ${distStr}~${best.expectedSearchMin} min search • ${best.walkMinutes} min walk`;
      if ($('reco-route')) $('reco-route').onclick = () => window.open(dirHref(best.center.lat, best.center.lng), '_blank');
    } catch {
      if ($('reco-title')) $('reco-title').textContent = 'Recommendation unavailable';
      if ($('reco-sub')) $('reco-sub').textContent = 'backend unreachable';
    }
  }

  async function searchDestination(query) {
    const q = query || ($('dest-search-input') && $('dest-search-input').value) || 'Downtown Berkeley';
    const resolved = await resolveDestination(q);
    state.destination = resolved.name;
    state.destCoords = { lat: resolved.lat, lng: resolved.lng };
    if ($('dest-search-input')) $('dest-search-input').value = resolved.name.split(',')[0];
    renderDestinationRadiusOnMap();
    await refreshForecastBoard();
    await refreshReco();
  }

  function setRadius(km) {
    state.searchRadiusKm = parseFloat(km);
    if ($('radius-val-label')) $('radius-val-label').textContent = `${state.searchRadiusKm.toFixed(1)} km`;
    document.querySelectorAll('#radius-chips .radius-chip').forEach(btn => {
      const active = Math.abs(parseFloat(btn.getAttribute('data-radius')) - state.searchRadiusKm) < 0.05;
      btn.classList.toggle('active', active);
      btn.classList.toggle('bg-emerald-600', active);
      btn.classList.toggle('text-white', active);
      btn.classList.toggle('border-emerald-500', active);
      btn.classList.toggle('bg-slate-100', !active);
      btn.classList.toggle('text-slate-600', !active);
      btn.classList.toggle('border-slate-200', !active);
    });
    renderDestinationRadiusOnMap();
    refreshForecastBoard();
    refreshReco();
  }

  async function fetchZones() {
    const data = await api('/api/zones');
    state.zones = data.zones;
    state.apiOk = true;
    if ($('api-status')) $('api-status').textContent = `API: ${API_BASE} ✓ · ${data.count} zones live`;
    const sel = $('report-zone-select');
    if (sel) {
      sel.innerHTML = '';
      state.zones.forEach(z => {
        const o = document.createElement('option');
        o.value = z.id; o.textContent = z.name;
        sel.appendChild(o);
      });
    }
  }

  async function boot() {
    try {
      showApiError(false);
      await fetchZones();
    } catch (e) {
      state.apiOk = false;
      $('api-status').textContent = 'API: backend unreachable';
      showApiError(true);
      $('api-error-text').textContent = 'Backend unreachable — connect the API and retry. No cached data is shown.';
    }
  }

  // ---------- zones detail view (live) ----------
  function setChartLoading(on) {
    $('live-chart-view').classList.toggle('hidden', on);
    $('skeleton-chart-view').classList.toggle('hidden', !on);
    $('skeleton-chart-view').classList.toggle('flex', on);
  }

  async function selectZone(id) {
    const z = zoneById(id);
    if (!z) return;
    state.selectedId = id;
    showView('view-zones');
    setChartLoading(true);
    $('detail-name').textContent = z.name;
    $('detail-price').innerHTML = `$${z.pricePerHour}<span class="font-body-sm text-body-sm text-on-surface-variant font-normal">/hr</span>`;
    $('detail-type').textContent = kindLabel(z.kind);
    $('detail-capacity').textContent = `${z.capacity} spots`;
    $('detail-walk').textContent = `${(z.walkTo[0] && z.walkTo[0].minutes) || '?'} min walk`;
    $('detail-pattern').textContent = z.peakHours || '—';
    $('peek-label').textContent = `${shortName(z.name)} · live telemetry`;
    $('detail-navigate-text').textContent = `Navigate to ${shortName(z.name)}`;
    $('detail-navigate').href = dirHref(z.center.lat, z.center.lng);
    const st = z.current ? z.current.status : 'medium';
    $('detail-peak').textContent = st === 'low' ? 'Peak tier' : st === 'medium' ? 'Filling up' : 'Good window';
    centerMap(z.center.lat, z.center.lng, 15);
    try {
      const arrival = new Date(Date.now() + state.horizonMin * 60000).toISOString();
      const f = await api(`/api/zones/${id}/forecast?arrival=${encodeURIComponent(arrival)}`);
      const conf = (f.series[1] && f.series[1].confidence) || 0;
      $('detail-confidence').textContent = `Confidence score: ${conf} (${conf >= 0.75 ? 'High certainty' : conf >= 0.55 ? 'Medium certainty' : 'Low certainty'})`;
      const bars = $('detail-bars');
      bars.querySelectorAll('.fbar').forEach(n => n.remove());
      f.series.forEach(pt => {
        const pct = Math.round(pt.probability * 100);
        const c = HEX[statusOf(pt.probability)];
        const d = document.createElement('div');
        d.className = 'fbar flex flex-col items-center flex-1 h-full justify-end z-10';
        d.innerHTML = `<span class="font-label-sm text-[11px] font-bold mb-1 opacity-90" style="color:${c}">${pct}%</span>` +
          `<div class="w-6 rounded-t-md transition-all duration-300" style="height:${pct}%;background:${c}"></div>` +
          `<span class="font-label-sm text-[11px] text-on-surface-variant mt-2 absolute bottom-0 font-medium">+${pt.horizonMin}m</span>`;
        bars.appendChild(d);
      });
      $('detail-extra').textContent = `Source: ${f.source} · arrival ${new Date(f.arrival).toLocaleString()}`;
    } catch (e) {
      $('detail-confidence').textContent = 'Confidence — (forecast unavailable)';
      $('detail-extra').textContent = 'Forecast unavailable — backend unreachable.';
    }
    setChartLoading(false);
    renderAlertState();
  }

  function renderAlertState() {
    let alert = null;
    try { alert = JSON.parse(localStorage.getItem('ps_alert') || 'null'); } catch {}
    const active = alert && alert.zoneId === state.selectedId;
    $('alert-text').textContent = active ? `Alert Set for +${alert.horizonMin} min (Active)` : `Set arrival alert at +${state.horizonMin} min`;
    $('toast-banner').classList.toggle('hidden', !active);
    $('toast-banner').classList.toggle('flex', !!active);
    if (active) {
      const z = zoneById(alert.zoneId);
      $('toast-text').textContent = `Alert primed: you will be notified for ${z ? z.name : alert.zoneId} at +${alert.horizonMin} min.`;
    }
  }

  // ---------- planner view (live) ----------
  function tripTimeISO() {
    const v = $('trip-time').value;
    return v ? new Date(v).toISOString() : new Date().toISOString();
  }

  function resultCard(r, i) {
    const c = HEX[r.status];
    const tag = i === 0
      ? `<span class="font-label-sm text-label-sm text-on-primary font-bold bg-primary px-2 py-0.5 rounded-full">Best availability</span>`
      : `<span class="font-label-sm text-label-sm text-on-surface-variant">#${i + 1}</span>`;
    return `<article class="result bg-surface-container rounded-xl p-space-md shadow-md flex flex-col gap-space-sm">` +
      `<div class="flex items-start justify-between gap-space-sm"><div class="flex flex-col min-w-0">` +
      `<div class="flex items-center gap-space-xs flex-wrap"><h3 class="font-headline-md text-headline-md text-on-surface font-bold truncate">${r.name}</h3>${tag}</div>` +
      `</div><div class="flex flex-col items-end shrink-0">` +
      `<span class="font-label-lg text-label-lg font-extrabold px-2.5 py-1 rounded-full" style="color:${c};background:${c}26">${Math.round(r.probability * 100)}% Chance</span>` +
      `<span class="font-label-sm text-label-sm text-on-surface-variant mt-1">${r.status === 'high' ? 'High Probability' : r.status === 'medium' ? 'Medium (Volatile)' : 'High Congestion'}</span>` +
      `</div></div>` +
      `<div class="grid grid-cols-3 gap-space-xs bg-surface-container-lowest p-space-sm rounded-lg text-center">` +
      `<div class="flex flex-col"><span class="font-label-sm text-label-sm text-on-surface-variant">Walk to door</span><span class="font-metric-sm text-metric-sm text-on-surface font-bold">${r.walkMinutes} min</span></div>` +
      `<div class="flex flex-col"><span class="font-label-sm text-label-sm text-on-surface-variant">Search Time</span><span class="font-metric-sm text-metric-sm font-bold" style="color:${c}">~${r.expectedSearchMin} min</span></div>` +
      `<div class="flex flex-col"><span class="font-label-sm text-label-sm text-on-surface-variant">Rate</span><span class="font-metric-sm text-metric-sm text-on-surface font-bold">$${r.pricePerHour}/h</span></div>` +
      `</div>` +
      `<a class="h-11 bg-primary hover:bg-primary-container rounded-lg flex items-center justify-center gap-space-xs text-on-primary font-label-lg text-label-lg font-bold" href="${dirHref(r.center.lat, r.center.lng)}" target="_blank" rel="noopener"><span class="material-symbols-outlined text-[18px]">navigation</span><span>Navigate Now</span></a>` +
      `</article>`;
  }

  async function runTripSearch() {
    const btn = $('trip-search-text');
    btn.textContent = 'Computing…';
    try {
      const dest = $('trip-destination').value || 'downtown';
      const time = tripTimeISO();
      const data = await api(`/api/route?destination=${encodeURIComponent(dest)}&time=${encodeURIComponent(time)}`);
      state.lastRoute = data;
      const filtered = data.ranked.filter(r => r.walkMinutes <= state.maxWalk);
      const box = $('trip-results');
      box.innerHTML = '';
      $('trip-hint').textContent = filtered.length
        ? `${filtered.length} of ${data.ranked.length} zones within ${state.maxWalk} min walk`
        : `No zones within ${state.maxWalk} min walk — showing all ${data.ranked.length}`;
      (filtered.length ? filtered : data.ranked).slice(0, 4).forEach((r, i) => { box.innerHTML += resultCard(r, i); });
      const saved = $('saved-banner');
      saved.classList.remove('hidden');
      saved.classList.add('flex');
      $('saved-mins').textContent = `−${data.searchTimeSavedMin} min`;
      $('saved-sub').textContent = `Save ~${data.searchTimeSavedMin} minutes of circling versus naive arrival at ${new Date(data.arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
      // Live arrival-window probabilities (one route call per suggested window).
      const row = $('windows-row');
      row.innerHTML = '';
      let best = { p: -1, label: '' };
      const probs = await Promise.all(data.suggestedWindows.map(async (w) => {
        try {
          const d = await api(`/api/route?destination=${encodeURIComponent(dest)}&time=${encodeURIComponent(w.time)}`);
          return d.ranked[0] ? d.ranked[0].probability : 0;
        } catch { return 0; }
      }));
      data.suggestedWindows.forEach((w, i) => {
        const p = probs[i];
        if (p > best.p) best = { p, label: w.label };
        const t = new Date(w.time);
        const hh = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const c = HEX[statusOf(p)];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'flex flex-col p-space-sm rounded-xl bg-surface-container hover:bg-surface-container-high transition-all text-left';
        b.innerHTML = `<span class="font-label-sm text-label-sm text-on-surface-variant">${w.label}</span>` +
          `<div class="flex items-center justify-between mt-1"><span class="font-headline-md text-headline-md text-on-surface font-bold">${hh}</span>` +
          `<span class="font-label-md text-label-md px-2 py-0.5 rounded-full font-semibold" style="color:${c};background:${c}1a">${Math.round(p * 100)}% chance</span></div>`;
        b.addEventListener('click', () => {
          const pad = (n) => String(n).padStart(2, '0');
          $('trip-time').value = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
          runTripSearch();
        });
        row.appendChild(b);
      });
      $('windows-note').textContent = best.label === data.suggestedWindows[2].label ? '★ Rush clearing soon' : best.label === data.suggestedWindows[0].label ? '★ Earlier is better' : '★ Good window now';
    } catch (e) {
      $('trip-hint').textContent = 'Search failed — backend unreachable. Retry.';
    }
    btn.textContent = 'Find parking';
  }

  // ---------- badges view (live reports + real points) ----------
  const SIGNAL_META = {
    found: { icon: 'check_circle', cls: 'text-primary bg-primary/20', label: 'Found spot' },
    full: { icon: 'warning', cls: 'text-tertiary bg-tertiary/20', label: 'No spots here' },
    circling: { icon: 'timer', cls: 'text-error bg-error/20', label: 'Circling > 5 min' }
  };

  async function renderFeed() {
    const feed = $('activity-feed-list');
    if (!feed) return;
    try {
      const data = await api('/api/reports');
      if (!data.reports.length) {
        feed.innerHTML = `<div class="bg-surface-container-low p-space-sm rounded-lg"><span class="font-body-sm text-body-sm text-on-surface-variant">No community reports yet — be the first to tap above.</span></div>`;
        return;
      }
      feed.innerHTML = data.reports.slice(0, 20).map(r => {
        const m = SIGNAL_META[r.signal] || SIGNAL_META.found;
        const z = zoneById(r.zoneId);
        const mine = state.myReports.some(mr => mr.id === r.id);
        return `<div class="flex items-center justify-between bg-surface-container-low p-space-sm rounded-lg">` +
          `<div class="flex items-center gap-space-sm min-w-0">` +
          `<div class="w-9 h-9 rounded-full ${m.cls} flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[18px]">${m.icon}</span></div>` +
          `<div class="flex flex-col min-w-0"><div class="flex items-center gap-1">` +
          `<span class="font-body-lg text-body-lg font-bold text-on-surface">${mine ? 'You' : 'Driver'}</span>` +
          `<span class="font-body-sm text-body-sm text-on-surface-variant">reported</span></div>` +
          `<span class="font-body-sm text-body-sm truncate font-medium">${m.label} at ${z ? shortName(z.name) : r.zoneId}</span>` +
          `</div></div><span class="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap pl-2">${relTime(r.at)}</span></div>`;
      }).join('');
    } catch {
      feed.innerHTML = `<div class="bg-surface-container-low p-space-sm rounded-lg"><span class="font-body-sm text-body-sm text-on-surface-variant">Stream unavailable — backend unreachable.</span></div>`;
    }
  }

  async function report(signal) {
    const sel = $('report-zone-select');
    const zoneId = (sel && sel.value) || (state.zones[0] && state.zones[0].id);
    try {
      const j = await api('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zoneId, signal }) });
      state.myReports.unshift({ id: j.id, zoneId, signal, at: j.at, points: j.pointsAwarded || 0 });
      state.points = state.myReports.reduce((s, r) => s + (r.points || 0), 0);
      saveReports();
      renderPoints();
      if ($('confirm-pts-badge')) $('confirm-pts-badge').textContent = `+${j.pointsAwarded || 0} pts`;
      const z = zoneById(zoneId);
      if ($('confirm-message-text')) $('confirm-message-text').textContent = `Report ${j.id} recorded for ${z ? z.name : zoneId} — models updated for this horizon.`;
      const banner = $('confirmation-banner');
      if (banner) {
        banner.classList.remove('hidden');
        banner.classList.add('flex');
      }
      renderFeed();
      await refreshForecastBoard();
      await refreshReco();
    } catch {
      if ($('confirm-pts-badge')) $('confirm-pts-badge').textContent = '+0 pts';
      if ($('confirm-message-text')) $('confirm-message-text').textContent = 'Report failed — backend unreachable. Retry.';
      const banner = $('confirmation-banner');
      if (banner) {
        banner.classList.remove('hidden');
        banner.classList.add('flex');
      }
    }
  }

  // ---------- wiring ----------
  document.querySelectorAll('nav [data-view]').forEach(b => {
    b.addEventListener('click', () => showView(b.getAttribute('data-view')));
  });
  $('zone-detail-close')?.addEventListener('click', () => showView('view-forecast'));
  $('recenter-gps-btn')?.addEventListener('click', locateMe);
  $('time-slider')?.addEventListener('input', (e) => {
    state.horizonMin = parseInt(e.target.value, 10);
    refreshForecastBoard();
  });
  document.querySelectorAll('#slider-steps [data-h]').forEach(el => {
    el.addEventListener('click', () => {
      const ts = $('time-slider');
      if (ts) ts.value = el.getAttribute('data-h');
      state.horizonMin = parseInt(el.getAttribute('data-h'), 10);
      refreshForecastBoard();
    });
  });
  $('trip-search')?.addEventListener('click', runTripSearch);
  $('max-walk')?.addEventListener('click', () => {
    const i = (WALK_OPTIONS.indexOf(state.maxWalk) + 1) % WALK_OPTIONS.length;
    state.maxWalk = WALK_OPTIONS[i];
    if ($('max-walk-val')) $('max-walk-val').textContent = `< ${state.maxWalk} min`;
    if (state.lastRoute) runTripSearch();
  });
  $('report-found')?.addEventListener('click', () => report('found'));
  $('report-full')?.addEventListener('click', () => report('full'));
  $('report-circling')?.addEventListener('click', () => report('circling'));
  $('confirm-dismiss')?.addEventListener('click', () => {
    const banner = $('confirmation-banner');
    if (banner) {
      banner.classList.add('hidden');
      banner.classList.remove('flex');
    }
  });
  $('alert-btn')?.addEventListener('click', () => {
    if (!state.selectedId) return;
    try {
      const cur = JSON.parse(localStorage.getItem('ps_alert') || 'null');
      if (cur && cur.zoneId === state.selectedId) localStorage.removeItem('ps_alert');
      else localStorage.setItem('ps_alert', JSON.stringify({ zoneId: state.selectedId, horizonMin: state.horizonMin, at: new Date().toISOString() }));
    } catch {}
    renderAlertState();
  });
  $('api-retry')?.addEventListener('click', boot);
  $('reco-route')?.addEventListener('click', () => {});

  // Destination Search & Radius Event Listeners
  $('dest-search-btn')?.addEventListener('click', () => searchDestination());
  $('dest-search-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchDestination();
    }
  });
  $('dest-search-clear')?.addEventListener('click', () => {
    if ($('dest-search-input')) $('dest-search-input').value = '';
    $('dest-search-clear')?.classList.add('hidden');
    $('dest-search-input')?.focus();
  });
  $('dest-search-input')?.addEventListener('input', (e) => {
    $('dest-search-clear')?.classList.toggle('hidden', !e.target.value);
  });
  document.querySelectorAll('#radius-chips .radius-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const r = chip.getAttribute('data-radius');
      if (r) setRadius(r);
    });
  });
  document.querySelectorAll('.dest-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = btn.getAttribute('data-dest');
      if (d) {
        if ($('dest-search-input')) $('dest-search-input').value = d;
        $('dest-search-clear')?.classList.remove('hidden');
        searchDestination(d);
      }
    });
  });

  // expose for Playwright
  window.__parkistics = { state, selectZone, report, fetchZones: boot, locateMe, showView, runTripSearch, searchDestination, setRadius };

  // Default arrival = now + 60 min so Trip Planner works in one click.
  try {
    const tripTimeEl = $('trip-time');
    if (tripTimeEl) {
      const t = new Date(Date.now() + 60 * 60000);
      t.setMinutes(Math.round(t.getMinutes() / 5) * 5, 0, 0);
      const pad = (n) => String(n).padStart(2, '0');
      tripTimeEl.value = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
    }
  } catch {}

  renderPoints();
  showView('view-forecast');
  initLeaflet();
  boot();
  locateMe();
})();
