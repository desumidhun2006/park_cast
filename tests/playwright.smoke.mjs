// ParkCast Playwright smoke test — operates EVERY interactive element.
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
// frontend via serve may take a moment; probe root
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

// 2. Playwright browser checks (every button / interactive element)
let playwrightOk = false;
try {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://localhost:${FRONT_PORT}/?api=http://localhost:${BACKEND_PORT}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="time-slider"]', { timeout: 15000 });

  // time slider
  await page.locator('[data-testid="time-slider"]').fill('60');
  await page.waitForTimeout(600);
  const label60 = await page.locator('[data-testid="time-label"]').innerText();
  check('time slider updates label', label60.includes('60'), label60);
  await page.screenshot({ path: `${shots}/01-slider-60.png` });
  await page.locator('[data-testid="time-slider"]').fill('15');

  // every zone button
  const zoneBtns = await page.locator('[data-testid^="zone-marker-"]').count();
  check('6 zone buttons rendered', zoneBtns === 6, `${zoneBtns} found`);
  const ids = ['zone-mall-gateway','zone-campus-north','zone-telegraph','zone-station','zone-residential-south','zone-hospital-east'];
  for (const id of ids) {
    await page.locator(`[data-testid="zone-marker-${id}"]`).click();
    await page.waitForSelector('#zone-detail:not(.hidden)', { timeout: 8000 });
    const name = await page.locator('#detail-name').innerText();
    check(`zone detail opens (${id})`, name.length > 2, name);
  }
  await page.screenshot({ path: `${shots}/02-zone-detail.png` });
  await page.locator('[data-testid="zone-detail-close"]').click();
  check('zone detail closes', await page.locator('#zone-detail.hidden').count() === 1);

  // trip planner (hint text shows first; wait for search-completion marker)
  await page.locator('[data-testid="trip-origin"]').fill('Campus');
  await page.locator('[data-testid="trip-destination"]').fill('Gateway Mall');
  await page.locator('[data-testid="trip-search"]').click();
  await page.waitForSelector('[data-testid="trip-saved"]', { timeout: 8000 });
  const nResults = await page.locator('#trip-results .result').count();
  check('trip planner returns results', nResults >= 5, `${nResults} rows`);
  await page.screenshot({ path: `${shots}/03-trip.png` });

  // crowd reports (all three)
  for (const sig of ['found','full','circling']) {
    await page.locator('[data-testid="report-zone-select"]').selectOption('zone-station');
    await page.locator(`[data-testid="report-${sig}"]`).click();
    await page.waitForTimeout(800);
    const st = await page.locator('[data-testid="report-status"]').innerText();
    check(`report button (${sig})`, /thanks|saved locally/i.test(st), st.slice(0, 60));
  }
  const pts = await page.locator('[data-testid="points-display"]').innerText();
  check('gamification points accrue', parseInt(pts) >= 30, pts);
  await page.screenshot({ path: `${shots}/04-reported.png` });

  check('no page errors', errors.length === 0, errors.slice(0,2).join(' | '));
  await browser.close();
  playwrightOk = results.filter(r => !r.ok).length === 0;
} catch (e) {
  check('playwright browser suite', false, e.message);
}

backend.kill(); front.kill();
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) { console.log('FAILED:', failed.map(f => f.name).join(', ')); process.exit(1); }
console.log(playwrightOk ? 'ALL TESTS 100% PASS' : 'API passed, browser partial — see above');
