const express = require('express');
const { forecastAt, forecastSeries, currentStatus, confidenceFor } = require('../services/forecastService');
const { mlPredict } = require('../services/mlClient');

const router = express.Router();

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// GET /api/zones?lat=&lng=&radius= — nearby zones with current + predicted status
router.get('/', async (req, res) => {
  const now = new Date();
  const { seedZones } = require('../services/forecastService');
  const { lat, lng, radius } = req.query;
  const targetLat = lat !== undefined ? parseFloat(lat) : null;
  const targetLng = lng !== undefined ? parseFloat(lng) : null;
  const searchRadius = radius !== undefined ? parseFloat(radius) : 1.0; // default 1 km

  let zones = seedZones.map(z => {
    const f = forecastAt(z, now);
    const confidence = confidenceFor(z, now, 15);
    const availableSpots = Math.max(0, Math.round(z.capacity * f.probability));
    const obj = {
      id: z.id, name: z.name, kind: z.kind, center: z.center,
      capacity: z.capacity, pricePerHour: z.pricePerHour, walkTo: z.walkTo,
      peakHours: z.peakHours, poiTags: z.poiTags,
      availableSpots,
      current: { probability: f.probability, confidence: Math.round(confidence * 100) / 100, status: currentStatus(f.probability) }
    };
    if (targetLat !== null && targetLng !== null && !isNaN(targetLat) && !isNaN(targetLng)) {
      const d = haversineKm(targetLat, targetLng, z.center.lat, z.center.lng);
      obj.distanceKm = Math.round(d * 100) / 100;
      obj.distanceMeters = Math.round(d * 1000);
      obj.walkMinutes = Math.max(1, Math.round(d * 12));
    }
    return obj;
  });

  if (targetLat !== null && targetLng !== null && !isNaN(targetLat) && !isNaN(targetLng)) {
    zones = zones.filter(z => z.distanceKm <= searchRadius);
    zones.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  res.json({
    count: zones.length,
    at: now.toISOString(),
    searchRadius: (targetLat !== null && targetLng !== null) ? searchRadius : null,
    target: (targetLat !== null && targetLng !== null) ? { lat: targetLat, lng: targetLng } : null,
    zones
  });
});

// GET /api/zones/:id/forecast?arrival=ISO — time-series for planned arrival
router.get('/:id/forecast', async (req, res) => {
  const { id } = req.params;
  const { arrival } = req.query;
  // Prefer ML microservice when available, else local forecaster.
  const ml = await mlPredict(id, arrival || new Date().toISOString());
  const local = forecastSeries(id, arrival);
  if (!local) return res.status(404).json({ error: 'unknown zone', id });
  if (ml && ml.series) return res.json({ ...local, series: ml.series, source: 'ml-service' });
  res.json({ ...local, source: 'local-v0-forecaster' });
});

module.exports = router;
