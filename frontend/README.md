# Parkistics frontend (v3 — Stitch UI, fully live)

Mobile-first UI generated in Stitch (Tailwind + Material Symbols + Inter),
rebuilt as one working page: `index.html` (shell + 4 views + bottom nav) driven
by `app.js`. **Zero mock data** — every number comes from the backend API or
the device GPS. The backend must be running; failures show a retry banner.

## Views

| View (nav) | Content, all live |
|---|---|
| Forecast (map) | Leaflet + OpenStreetMap with zone pills as map markers, geolocation blue dot + 📍 recenter, horizon slider (per-zone `/forecast` refetch), zone chips, top-recommendation card from `/api/route` |
| Zones | Detail sheet per zone: live probability chart, pattern, price/capacity/walk, confidence, Google-Maps-directions link with real coords, arrival alert (local) |
| Planner | Origin/destination/arrival + max-walk filter, ranked zones from `/api/route`, per-window probabilities for each suggested arrival time, saved-time banner |
| Badges | Tier/progress from confirmed-report points, one-tap `POST /reports`, live community stream from `GET /api/reports` |

## Points (real)

+10 pts per confirmed `POST /api/reports` (uses the server's `pointsAwarded`).
Confirmed reports persist in `localStorage` (`ps_my_reports`); ranks
Rookie → Reporter (10) → Contributor (50) → Scout (100).

## Run

```bash
cd backend && npm install && npm start   # :4000
cd frontend && npx serve . -l 5173       # :5173, ?api= to point at backend
```

## Tests

`node tests/playwright.smoke.mjs` drives every button across all 4 views
(33 checks, incl. real map-tile load and granted/denied geolocation paths).
