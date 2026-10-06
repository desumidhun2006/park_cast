"""ParkCast ML microservice (v0 rule-based placeholder for LightGBM/XGBoost + LSTM/GRU).

Mirrors backend/src/services/forecastService.js so /predict agrees with local fallback.
v1 roadmap: train on parking_events + user_reports, output calibrated probability + confidence.
"""
from datetime import datetime, timedelta
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="ParkCast ML service", version="0.1.0")

ZONE_PEAKS = {
    "zone-mall-gateway": "Weekdays 17-19 full, empties after 20",
    "zone-campus-north": "Weekdays 9-15 busy",
    "zone-telegraph": "Fri/Sat 19-23 scarce",
    "zone-station": "Commute 7-9, 16-18 tight",
    "zone-residential-south": "Sun evening tight",
    "zone-hospital-east": "Weekdays 10-16 busy",
}

class PredictRequest(BaseModel):
    zone_id: str
    arrival: Optional[str] = None

class HorizonPoint(BaseModel):
    horizonMin: int
    time: str
    probability: float
    confidence: float

class PredictResponse(BaseModel):
    zone_id: str
    arrival: str
    series: List[HorizonPoint]
    source: str = "ml-service-v0-rule-based"
    model: str = "rule-based-v0 (LightGBM/LSTM roadmap)"

def clamp01(x: float) -> float:
    return max(0.02, min(0.97, x))

def base_probability(zone_id: str, dt: datetime) -> float:
    h = dt.hour + dt.minute / 60.0
    day = (dt.weekday() + 1) % 7  # Sun=0 like JS
    is_weekday = 1 <= day <= 5
    weekend_night = day in (5, 6) and 19 <= h <= 23
    p = 0.55
    if zone_id == "zone-mall-gateway":
        if is_weekday and 17 <= h < 19: p = 0.12
        elif is_weekday and 19 <= h < 20: p = 0.30
        elif h >= 20 or h < 8: p = 0.82
        elif is_weekday and 11 <= h < 16: p = 0.35
    elif zone_id == "zone-campus-north":
        if is_weekday and 9 <= h < 15: p = 0.22
        elif h >= 18 or h < 7: p = 0.85
    elif zone_id == "zone-telegraph":
        if weekend_night: p = 0.15
        elif 12 <= h < 14: p = 0.40
        elif h >= 23 or h < 9: p = 0.75
    elif zone_id == "zone-station":
        if is_weekday and ((7 <= h < 9) or (16 <= h < 18)): p = 0.18
        elif h >= 20 or h < 6: p = 0.80
    elif zone_id == "zone-residential-south":
        if day == 0 and 17 <= h < 22: p = 0.25
        elif h >= 22 or h < 7: p = 0.90
        else: p = 0.60
    elif zone_id == "zone-hospital-east":
        if is_weekday and 10 <= h < 16: p = 0.25
        else: p = 0.70
    rush = 0.12 if (8 <= h < 9.5 or 17 <= h < 19) else 0.0
    p -= rush * (1.2 if zone_id in ("zone-mall-gateway", "zone-station") else 0.6)
    return p

@app.get("/health")
def health():
    return {"ok": True, "service": "parkcast-ml", "at": datetime.utcnow().isoformat()}

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    arrival = datetime.fromisoformat(req.arrival.replace("Z", "+00:00")) if req.arrival else datetime.utcnow()
    # strip tz for pattern logic
    arrival = arrival.replace(tzinfo=None)
    out = []
    for h in [0, 15, 30, 60, 120, 180]:
        t = arrival + timedelta(minutes=h)
        p = clamp01(base_probability(req.zone_id, t))
        conf = clamp01(0.55 + (0.85 - 0.55) * min(1, abs(0.5 - p) * 2) - (0.1 if h > 30 else 0))
        out.append(HorizonPoint(horizonMin=h, time=t.isoformat(), probability=round(p, 2), confidence=round(conf, 2)))
    return PredictResponse(zone_id=req.zone_id, arrival=arrival.isoformat(), series=out)

@app.post("/train")
def train_placeholder():
    return {"ok": True, "message": "v1 roadmap: train LightGBM + LSTM on parking_events + user_reports"}
