# ParkCast architecture (v0)

```
[open data: city portals, OSM, POIs, traffic/weather (optional)]
        + [crowd: found / full / circling via frontend]
            |
            v
[ml-service :8001  FastAPI]  --rule-based v0-->  probability + confidence per zone/horizon
   POST /predict {zone_id, arrival} -> {series[0,15,30,60,120,180]}   (v1: LightGBM/XGBoost + LSTM/GRU)
            |
            v
[backend :4000  Node+Express]  caching, aggregation, orchestration
  GET /api/zones | GET /api/zones/:id/forecast | POST /api/reports | GET /api/route
  Mongo: zones, parking_events, user_reports, predictions, users (schemas ready; v0 runs in-memory)
            |
            v
[frontend :5173  Leaflet v0 -> React/Next.js]  heatmap, time slider, detail, trip planner, one-tap reports
```

Forecasting = spatio-temporal: P(free spot | zone, arrival + horizon). Confidence shrinks with horizon, grows with pattern strength + report volume. Backend prefers ML service when `ML_URL` reachable, else local `forecastService.js` (same rules).
