# ParkCast ML service

Python FastAPI microservice. v0 is a transparent rule-based forecaster mirroring `backend/src/services/forecastService.js`.

```bash
pip install -r requirements.txt
uvicorn app:app --port 8001
```

- `GET /health`
- `POST /predict` `{ zone_id, arrival }` → `{ series: [{ horizonMin, time, probability, confidence }] }`
- `POST /train` → placeholder for v1 LightGBM/XGBoost + LSTM/GRU training
