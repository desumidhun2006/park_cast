const express = require('express');
const { forecastAt, forecastSeries, currentStatus, confidenceFor } = require('../services/forecastService');
const { mlPredict } = require('../services/mlClient');

const router = express.Router();

// GET /api/zones?lat=&lng=&radius= — nearby zones with current + predicted status
router.get('/', async (req, res) => {
  const now = new Date();
  const { seedZones } = require('../services/forecastService');
  const zones = seedZones.map(z => {
    const f = forecastAt(z, now);
    const confidence = confidenceFor(z, now, 15);
    return {
      id: z.id, name: z.name, kind: z.kind, center: z.center,
      capacity: z.capacity, pricePerHour: z.pricePerHour, walkTo: z.walkTo,
      peakHours: z.peakHours, poiTags: z.poiTags,
      current: { probability: f.probability, confidence: Math.round(confidence * 100) / 100, status: currentStatus(f.probability) }
    };
  });
  res.json({ count: zones.length, at: now.toISOString(), zones });
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
