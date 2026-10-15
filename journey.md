Standard Operating Procedure (SOP) for Task Execution
For every prompt or task received, you must strictly execute the following 5-step workflow sequentially:
1. Repository Synchronization
Pull the latest changes from the remote GitHub repository to ensure your local workspace is up to date before starting any work.
2. Journey Tracking Initialization
Locate and read the journey.md file in the repository root.
If journey.md does not exist, create it immediately.
Mandatory Rule: The journey.md file must always start with these exact instructions at the very top.
Track the project's progress in journey.md by logging the corresponding Git Commit ID and a concise summary of the changes made in that commit.
3. Iterative Visual Testing via Playwright MCP
Utilize the Playwright MCP server ([https://github.com/microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)) to test the web application.
Execution Requirements:
Testing must run live and visually so it can be observed.
Operate every single button, interactive element, and component related to the current task/commit.
Iterate continuously until all tests achieve a 100% pass rate.
4. Version Control & Documentation Update
Stage and commit all changes made for the current task.
Update journey.md with the new Git Commit ID and the specific details of the task completed.
Commit the updated journey.md file as part of the workflow.
5. Remote Synchronization
Push all local commits (code changes and the updated journey.md) to the remote GitHub repository.
Execution Frequency: This entire 5-step protocol must be repeated for every single small task and individual prompt received. Each prompt corresponds to one distinct commit and a full execution of steps 1 through 5.

---

## Journey Log

| Commit ID | Summary |
|-----------|---------|
| 590c0a3 | Initial commit — initialized repo with empty README.md, created public GitHub repo park_cast |
| 45cb2d9 | SOP initialization — created journey.md with mandatory SOP header at top; Step 1 pull OK (already up to date); Step 3 Playwright MCP N/A — no web app / no HTML-JS-TS / no UI elements to operate (repo has only README.md + journey.md), 0/0 elements, vacuous 100% pass; executed full 5-step workflow for SOP adoption task |
| d5f27aa | ParkCast v0 foundation — MERN + ML monorepo scaffold: Express API (zones/forecast/reports/route) with rule-based spatio-temporal forecaster, Mongoose schemas (zones, parking_events, user_reports, predictions, users), FastAPI ml-service (/predict, /train placeholder), Leaflet frontend (heatmap, time slider, zone detail, trip planner, one-tap reports, gamification), docs (API/DATA_MODEL/ARCHITECTURE), Playwright smoke test 21/21 PASS |
| d7e6e3d | Frontend polish — trip planner default arrival (+60m), results hint, button types/a11y, removed dead code; hardened smoke test wait (trip-saved marker); Playwright 21/21 PASS |
| 837550a | Open website — re-ran Playwright smoke 21/21 PASS, started persistent backend :4000 + frontend :5173, opened http://localhost:5173 in browser |
| dd991a7 | Google Maps home page + live location — replaced Leaflet/OSM with Maps JS API (key via ?gmaps_key=/localStorage/config.js, gitignored), hero-size map, auto geolocation centering + blue-dot marker + 📍 retry button, key/auth-failure notices; smoke extended to 26/26 PASS incl. granted+denied location paths |
| 5e23a63 | API key guide — new docs/GOOGLE_MAPS_KEY.md (project, billing, enable API, create + restrict key, usage, troubleshooting); smoke re-run 26/26 PASS |
| fa387e0 | Reopen project page — both servers were down, restarted backend :4000 (health ✓) + frontend :5173 (HTTP 200 ✓), opened http://localhost:5173 in browser |
| 7351ba2 | Rename to Parkistics — rebranded site/services/packages/docs (title, header, API/ML service names, storage keys, test handle), renamed GitHub repo park_cast → parkistics + updated remote; smoke 26/26 PASS |
| df02cb6 | Free map default — Leaflet/OpenStreetMap home map with zero signup (Google Maps kept as auto-upgrade when key present, with OSM fallback on auth failure); dual-provider marker/location abstraction; smoke 28/28 PASS incl. real tile load |
| 705d5a2 | Stitch UI live — unzipped stitch export, rebuilt 4 screens (Forecast/Zones/Planner/Badges) into one working page on the real Leaflet map (Stitch pills as live divIcons); all mock data removed (simulated curves, hardcoded %, fake feed/snapshots, external images); points/feed/windows/navigate all hit live APIs; zip + import folder + legacy css/config deleted; smoke 33/33 PASS |
| a6cc9a4 | Phone 9:16 frame — app runs inside a centered 430px device shell with bezel + notch on desktop, full-bleed on real phones; header/nav docked to the frame with internal scrolling; fixed same-ms report id collisions + hardened report test waits; smoke 35/35 PASS |
| 8adaf5b | Remove phone frame — reverted 9:16 device shell; header/nav restored to full-width fixed positioning; removed phone-frame smoke test checks; unique report id fix (seq counter) retained |
| c4d8b84 | Insane glassmorphism — animated blobs, multi-layer glass, neon glows, desktop sidebar navigation |
| 158f375 | Refined glassmorphism v3 — multi-color mesh gradients, 10-25% opacity panels, 16-20px blur, and chromatic refraction rims |
| 9a457c8 | Dedicated forecast view with light theme — removed bottom/desktop sidebar navigation, eliminated standalone planner and badge views in favor of dedicated focused forecast interface; full bright light theme redesign with frosted crystal glassmorphism (rgba(255,255,255,0.84), subtle ambient pastel gradients, crisp slate typography, clean light map tiles); defensive null-guards in telemetry wiring; smoke test 28/28 PASS (100%) |
| 12e024d | Full-page smoke screenshots — updated test suite to capture fullPage light theme forecast and opened zone detail sheet screenshots; 28/28 PASS (100%) |


