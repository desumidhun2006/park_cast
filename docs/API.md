# ParkCast API (v0)

Base: `http://localhost:4000`

## `GET /health`
`{ ok, service, at }`

## `GET /api/zones?lat=&lng=&radius=`
Nearby zones with current + predicted status.
```json
{ "count": 6, "at": "ISO", "zones": [{ "id": "zone-mall-gateway", "name": "Gateway Mall Lot", "center": {"lat": 1, "lng": 2}, "current": {"probability": 0.12, "confidence": 0.8, "status": "low"} }] }
```
`status`: `high` (≥0.6) / `medium` (≥0.35) / `low`.

## `GET /api/zones/:id/forecast?arrival=ISO`
Time-series for planned arrival. Prefers ML service if `ML_URL` reachable.
```json
{ "zone": {...}, "arrival": "ISO", "source": "ml-service|local-v0-forecaster", "series": [{ "horizonMin": 15, "time": "ISO", "probability": 0.3, "confidence": 0.75 }] }
```
Horizons: 0, 15, 30, 60, 120, 180.

## `POST /api/reports`
```json
{ "zoneId": "zone-mall-gateway", "signal": "found|full|circling", "note": "optional" }
```
→ `201 { id, zoneId, signal, at, pointsAwarded: 10 }`. Feeds back into forecasts (crowd adjustment).

## `GET /api/route?origin=&destination=&time=`
```json
{ "destination": "...", "arrival": "ISO", "ranked": [{ "zoneId": "...", "probability": 0.8, "status": "high", "walkMinutes": 3, "expectedSearchMin": 4, "score": 1.2 }], "suggestedWindows": [...], "searchTimeSavedMin": 8 }
```
