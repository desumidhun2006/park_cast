# ParkCast – Predictive, Community-Driven Parking Availability Platform

ParkCast is a **software-only, MERN-stack smart parking platform** that predicts **where and when free spots are likely available**, instead of just showing current occupancy from hardware sensors.

> Parking as a spatio-temporal forecasting problem: for every zone (street block, lot, cluster) estimate **probability of finding a free spot** + **confidence** for multiple future windows (15/30/60 min).

Drivers use an interactive map + trip planner to choose **which area** and **when to arrive**, reducing search time, fuel, and congestion.

## Why not sensors?

No per-slot sensors, cameras, or hardware. ParkCast uses **open/proxy data** (city open-data, OSM geometries, POIs, traffic indices, weather/transit optionally) + **sparse crowdsourced signals** (`found spot` / `no luck` / `circling > 5 min`) to infer availability. Immediately deployable in any city with basic open data.

## Monorepo layout

```
park_cast/
  backend/       Node + Express REST API (zones, forecasts, reports, route)
  ml-service/    Python FastAPI microservice (LightGBM/XGBoost + LSTM/GRU placeholder, rule-based v0)
  frontend/      Web app v0 — static Leaflet prototype (maps to React/Next.js component plan)
  docs/          API, data model, architecture
  tests/         Playwright smoke test (all buttons / interactive elements)
```

## Quickstart (v0, no DB required)

```bash
# 1. Backend (mock forecasting, in-memory + Mongoose schemas ready)
cd backend && npm install && npm start
# -> http://localhost:4000/health, /api/zones, /api/zones/:id/forecast, /api/reports, /api/route

# 2. ML service (optional, backend falls back to local mock if offline)
cd ml-service && pip install -r requirements.txt && uvicorn app:app --port 8001
# -> http://localhost:8001/health, /predict

# 3. Frontend (static, works with or without backend)
cd frontend && npx serve . -l 5173
# -> http://localhost:5173  (set ?api=http://localhost:4000 to force backend)
```

## Key API endpoints

- `GET /api/zones?lat=&lng=&radius=` — nearby zones with current + predicted status
- `GET /api/zones/:id/forecast?arrival=ISO` — time-series of predicted availability for planned arrival
- `POST /api/reports` — `{ zoneId, signal: found|full|circling, note? }` anonymous crowd feedback
- `GET /api/route?origin=&destination=&time=` — ranked parking zones + arrival windows along a trip

See `docs/API.md` for full contracts.

## Data (MongoDB collections)

`zones` (geo polygons/points + metadata), `parking_events` (historical/inferred occupancy), `user_reports` (crowd signals), `predictions` (model outputs per zone/time window), `users` (profiles, preferences, gamification). See `docs/DATA_MODEL.md`.

## ML approach (v0 → v1)

- **v0 (this commit):** transparent rule-based forecaster encoding patterns like “mall zone full weekdays 17–19, empties after 20h” + traffic proxy correlation. Served by both `backend/src/services/forecastService.js` and `ml-service/app.py` so outputs agree.
- **v1 roadmap:** LightGBM/XGBoost on tabular zone×time features + LSTM/GRU on occupancy sequences, trained on `parking_events` + `user_reports`, calibrated probabilities + confidence, stored in `predictions`, cached by backend.

## Frontend (v0)

Leaflet map with zones color-coded (green = high chance, red = low), time slider for heatmap evolution, zone detail panel (probability curve, peak hours, walk distance, price), Trip Planner (ranked zones + arrival windows + “search time saved”), one-tap Crowd Report (`Found spot` / `No spots` / `Circling > 5 min`), points/badges in `localStorage`. React/Next.js migration maps 1:1 to `app.js` sections — see `frontend/README.md`.

## Pilot

University campus → commercial district → mid-size city. Accumulating reports/history enables parking-pulse heatmaps, planner dashboards, nav-app integration.

## SOP + Journey

This repo follows the SOP defined at the top of `journey.md` (pull → journey log → Playwright visual test → commit → push) for every task.
