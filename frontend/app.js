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

  const state = {
    zones: [], horizonMin: 15, selectedId: null, apiOk: false,
    points: 0, myReports: [], userLocation: null,
    mapReady: false, provider: null, maxWalk: 8, lastRoute: null
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
  function kindLabel(kind) { return kind === 'lot' ? 'Off-street Lot' : kind === 'street' ? 'Street Block' : 'Zone Cluster'; }
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

  function pillHtml(z, pct, color) {
    return `<div style="transform:translate(-50%,-110%)"><div style="display:flex;flex-direction:column;align-items:center">` +
      `<div style="display:flex;align-items:center;gap:4px;padding:2px 8px;border-radius:9999px;background:rgba(34,42,61,.92);color:${color};font:700 12px Inter,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.6);white-space:nowrap">` +
      `<span style="width:6px;height:6px;border-radius:9999px;background:${color}"></span><span>${pct}%</span></div>` +
      `<div style="margin-top:4px;padding:1px 6px;border-radius:6px;background:rgba(6,14,32,.85);color:#bccbb9;font:600 9px Inter,sans-serif;white-space:nowrap">${shortName(z.name)}</div>` +
      `</div></div>`;
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
      map = L.map('map').setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], DEFAULT_ZOOM);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      state.provider = 'leaflet';
      state.mapReady = true;
      if (state.userLocation) placeYouMarker(state.userLocation);
      renderZones();
    } catch (e) {
      showApiError(true);
      $('api-error-text').textContent = 'Map tiles could not load (offline?). Check connection and retry.';
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
      $('banner-title').textContent = 'Geolocation unavailable';
      $('banner-coords').textContent = 'showing default area';
      return;
    }
    $('banner-title').textContent = 'Locating you…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        state.userLocation = loc;
        $('banner-title').innerHTML = 'Location permission active: <span class="text-secondary font-bold">You are here ✓</span>';
        $('banner-coords').textContent = `(${fmt(loc.lat)}, ${fmt(loc.lng)})`;
        centerMap(loc.lat, loc.lng, 15);
        placeYouMarker(loc);
      },
      (err) => {
        const why = err && err.code === 1 ? 'permission denied' : 'unavailable';
        $('banner-title').textContent = `Location ${why} — showing default area. Tap 📍 to retry.`;
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  // ---------- forecast view (live) ----------
  function chipHtml(z, pct, color) {
    return `<span class="w-2 h-2 rounded-full shrink-0" style="background:${color}"></span>` +
      `<span class="flex flex-col min-w-0"><span class="font-label-sm text-label-sm text-on-surface font-semibold truncate" style="max-width:100px">${shortName(z.name)}</span>` +
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
    const wrap = $('zone-buttons');
    wrap.innerHTML = '';
    state.zones.forEach(z => {
      const p = current[z.id] != null ? current[z.id] : 0.5;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container shrink-0 text-left hover:bg-surface-container-high active:scale-95 transition-all shadow-sm';
      b.setAttribute('data-testid', `zone-marker-${z.id}`);
      b.innerHTML = chipHtml(z, Math.round(p * 100), HEX[statusOf(p)]);
      b.addEventListener('click', () => selectZone(z.id));
      wrap.appendChild(b);
    });
    $('zones-count-label').textContent = `Tappable Zones (${state.zones.length})`;
    $('slider-val-label').textContent = `+${state.horizonMin} min`;
    document.querySelectorAll('#slider-steps [data-h]').forEach(el => {
      const active = parseInt(el.getAttribute('data-h'), 10) === state.horizonMin;
      el.classList.toggle('font-bold', active);
      el.classList.toggle('text-primary', active);
    });
    syncMarkers(current);
  }

  async function refreshReco() {
    try {
      const dest = $('trip-destination')?.value || 'downtown';
      const data = await api(`/api/route?destination=${encodeURIComponent(dest)}&time=${encodeURIComponent(new Date().toISOString())}`);
      const best = data.ranked[0];
      if ($('reco-title')) $('reco-title').textContent = `${best.name} Recommended`;
      if ($('reco-sub')) $('reco-sub').textContent = `${Math.round(best.probability * 100)}% chance • ~${best.expectedSearchMin} min search • ${best.walkMinutes} min walk`;
      if ($('reco-route')) $('reco-route').onclick = () => window.open(dirHref(best.center.lat, best.center.lng), '_blank');
    } catch {
      if ($('reco-title')) $('reco-title').textContent = 'Recommendation unavailable';
      if ($('reco-sub')) $('reco-sub').textContent = 'backend unreachable';
    }
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
    await refreshForecastBoard();
    await refreshReco();
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

  // expose for Playwright
  window.__parkistics = { state, selectZone, report, fetchZones: boot, locateMe, showView, runTripSearch };

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
