// Parkistics Playwright smoke test — operates EVERY interactive element on the Forecast page.
// Run: npm --prefix backend install; node tests/playwright.smoke.mjs
// Serves backend :4000 + frontend :5173, drives Chromium headless, screenshots to frontend-screenshots/.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const BACKEND_PORT = 4000;
const FRONT_PORT = 5173;
const shots = 'frontend-screenshots';
fs.mkdirSync(shots, { recursive: true });

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitFor(url, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { const r = await fetch(url); if (r.ok) return true; } catch {}
    await wait(500);
  }
  throw new Error('timeout waiting for ' + url);
}

console.log('starting backend + frontend servers...');
const backend = spawn('node', ['src/index.js'], { cwd: 'backend', env: { ...process.env, PORT: String(BACKEND_PORT) } });
const front = spawn('npx', ['serve', '../frontend', '-l', String(FRONT_PORT)], { cwd: 'backend', stdio: 'pipe' });
await waitFor(`http://localhost:${BACKEND_PORT}/health`);
await wait(1500);
try { await waitFor(`http://localhost:${FRONT_PORT}/`, 20000); } catch { console.log('frontend probe failed, continuing (test uses file + api checks)'); }

const results = [];
function check(name, ok, extra = '') { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); }

// 1. Backend API checks
try {
  const z = await (await fetch(`http://localhost:${BACKEND_PORT}/api/zones`)).json();
  check('GET /api/zones returns 6 zones', z.count === 6 && z.zones.length === 6, `count=${z.count}`);
  check('zones have probability+status', z.zones.every(x => x.current && typeof x.current.probability === 'number' && ['high','medium','low'].includes(x.current.status)));
  const f = await (await fetch(`http://localhost:${BACKEND_PORT}/api/zones/zone-mall-gateway/forecast?arrival=${encodeURIComponent(new Date().toISOString())}`)).json();
  check('GET /forecast returns 6 horizons', f.series && f.series.length === 6, `source=${f.source}`);
  check('forecast has probability+confidence', f.series.every(p => typeof p.probability === 'number' && typeof p.confidence === 'number'));
  const rp = await fetch(`http://localhost:${BACKEND_PORT}/api/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zoneId: 'zone-mall-gateway', signal: 'found' }) });
  check('POST /reports 201 + points', rp.status === 201 && (await rp.json()).pointsAwarded === 10);
  const rt = await (await fetch(`http://localhost:${BACKEND_PORT}/api/route?destination=Mall&time=${encodeURIComponent(new Date().toISOString())}`)).json();
  check('GET /route ranked + saved time', rt.ranked && rt.ranked.length === 6 && typeof rt.searchTimeSavedMin === 'number');
} catch (e) { check('backend API suite', false, e.message); }

// 2. Playwright browser checks (Forecast page + Zone details in Light Theme)
let playwrightOk = false;
try {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://localhost:${FRONT_PORT}/?api=http://localhost:${BACKEND_PORT}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="time-slider"]', { timeout: 15000 });

  // light theme check
  const isLight = await page.evaluate(() => document.documentElement.classList.contains('light'));
  check('light theme active on html element', isLight);

  // sidebar removed check (only forecast page exists)
  const navCount = await page.locator('nav').count();
  check('sidebar navigation removed', navCount === 0);

  // forecast page is main view
  const isForecastVisible = await page.locator('#view-forecast:not(.hidden)').isVisible();
  check('forecast page is the active primary view', isForecastVisible);

  // points and badges display removed
  check('points display removed from header', await page.locator('#points-display').count() === 0);
  check('badges display removed from header', await page.locator('#badges-display').count() === 0);

  // time slider
  await page.locator('[data-testid="time-slider"]').fill('60');
  await page.waitForTimeout(600);
  const label60 = await page.locator('[data-testid="time-label"]').innerText();
  check('time slider updates label', label60.includes('60'), label60);
  await page.screenshot({ path: `${shots}/01-slider-60-light.png`, fullPage: true });
  await page.locator('[data-testid="time-slider"]').fill('15');

  // slider quick-step buttons
  await page.locator('#slider-steps [data-h="30"]').click();
  await page.waitForTimeout(400);
  const label30 = await page.locator('[data-testid="time-label"]').innerText();
  check('quick step button updates slider', label30.includes('30'), label30);

  // location toolbar
  check('locate-me button visible', await page.locator('[data-testid="locate-me"]').isVisible());
  const locText = await page.locator('[data-testid="location-status"]').innerText();
  check('location status shown', locText.length > 3, locText.slice(0, 70));
  await page.waitForFunction(() => window.__parkistics && window.__parkistics.state.mapReady, { timeout: 20000 });
  const provider = await page.evaluate(() => window.__parkistics.state.provider);
  check('free leaflet map renders without key', provider === 'leaflet', provider);
  check('leaflet map element initialized', await page.locator('#map.leaflet-container').isVisible());
  check('leaflet tiles loaded', (await page.locator('#map img.leaflet-tile-loaded').count()) > 0);

  // every zone button (rendered live from GET /api/zones)
  await page.waitForSelector('[data-testid="zone-marker-zone-mall-gateway"]', { timeout: 15000 });
  const zoneBtns = await page.locator('[data-testid^="zone-marker-"]').count();
  check('6 zone buttons rendered', zoneBtns === 6, `${zoneBtns} found`);
  const ids = ['zone-mall-gateway','zone-campus-north','zone-telegraph','zone-station','zone-residential-south','zone-hospital-east'];
  for (const id of ids) {
    await page.locator(`[data-testid="zone-marker-${id}"]`).click();
    await page.waitForSelector('#view-zones:not(.hidden)', { timeout: 8000 });
    const name = await page.locator('#detail-name').innerText();
    check(`zone detail opens (${id})`, name.length > 2, name);
    if (id === ids[0]) {
      await page.screenshot({ path: `${shots}/02-zone-detail-light.png`, fullPage: true });
    }
    await page.locator('[data-testid="zone-detail-close"]').click();
    await page.waitForSelector('#view-forecast:not(.hidden)', { timeout: 8000 });
  }
  check('zone detail closes back to forecast', await page.locator('#view-forecast:not(.hidden)').count() === 1);

  // recommendation card
  const recoText = await page.locator('#reco-title').innerText();
  check('recommendation card shows best zone', recoText.length > 2, recoText);

  // geolocation granted → map centers where the person is
  const geoCtx = await browser.newContext({ viewport: { width: 1400, height: 900 }, geolocation: { latitude: 37.7749, longitude: -122.4194 }, permissions: ['geolocation'] });
  const geoPage = await geoCtx.newPage();
  geoPage.on('pageerror', e => errors.push('geo: ' + String(e)));
  await geoPage.goto(`http://localhost:${FRONT_PORT}/?api=http://localhost:${BACKEND_PORT}`, { waitUntil: 'networkidle' });
  await geoPage.locator('[data-testid="locate-me"]').click();
  await geoPage.waitForFunction(() => window.__parkistics && window.__parkistics.state.userLocation !== null, { timeout: 8000 });
  const ulo = await geoPage.evaluate(() => window.__parkistics.state.userLocation);
  check('geolocation centers on user', Math.abs(ulo.lat - 37.7749) < 0.001 && Math.abs(ulo.lng + 122.4194) < 0.001, `${ulo.lat},${ulo.lng}`);
  const uloText = await geoPage.locator('[data-testid="location-status"]').innerText();
  check('location status shows you-are-here', /you are here/i.test(uloText), uloText.slice(0, 70));
  await geoPage.screenshot({ path: `${shots}/03-forecast-light.png`, fullPage: true });
  await geoCtx.close();

  check('no page errors', errors.length === 0, errors.slice(0,2).join(' | '));
  await browser.close();
  playwrightOk = results.filter(r => !r.ok).length === 0;
} catch (e) {
  check('playwright browser suite', false, e.message);
}

try { backend.kill(); } catch {}
try { front.kill(); } catch {}
const nPass = results.filter(r => r.ok).length;
const nTotal = results.length;
console.log(`\n========================================`);
console.log(`SMOKE SUMMARY: ${nPass}/${nTotal} PASS (${Math.round(nPass/nTotal*100)}%)`);
console.log(`========================================`);
process.exit(nPass === nTotal ? 0 : 1);
