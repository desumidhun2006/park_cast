const express = require('express');
const { forecastAt, currentStatus } = require('../services/forecastService');
const { seedZones } = require('../services/forecastService');

const router = express.Router();

// GET /api/route?origin=&destination=&time= — ranked zones + arrival windows
router.get('/', (req, res) => {
  const { destination, time } = req.query;
  const arrival = time ? new Date(time) : new Date();
  const ranked = seedZones.map(z => {
    const f = forecastAt(z, arrival);
    const walk = (z.walkTo[0] && z.walkTo[0].minutes) || 5;
    // Score: availability first, then walk, then price.
    const score = f.probability * 100 - walk * 2 - (z.pricePerHour || 0) * 1.5;
    const expectedSearchMin = Math.round((1 - f.probability) * 14 + 2);
    return {
      zoneId: z.id, name: z.name, center: z.center,
      probability: f.probability, status: currentStatus(f.probability),
      walkMinutes: walk, pricePerHour: z.pricePerHour,
      expectedSearchMin, score: Math.round(score * 10) / 10
    };
  }).sort((a, b) => b.score - a.score);

  const naiveSearchMin = 12;
  const best = ranked[0];
  res.json({
    destination: destination || 'downtown',
    arrival: arrival.toISOString(),
    ranked,
    suggestedWindows: [
      { label: 'Arrive 30 min earlier', time: new Date(arrival.getTime() - 30 * 60000).toISOString() },
      { label: 'Arrive as planned', time: arrival.toISOString() },
      { label: 'Arrive 30 min later', time: new Date(arrival.getTime() + 30 * 60000).toISOString() }
    ],
    searchTimeSavedMin: Math.max(0, naiveSearchMin - (best ? best.expectedSearchMin : naiveSearchMin))
  });
});

module.exports = router;
