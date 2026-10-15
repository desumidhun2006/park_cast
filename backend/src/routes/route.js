const express = require('express');
const { forecastAt, currentStatus } = require('../services/forecastService');
const { seedZones } = require('../services/forecastService');

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

// GET /api/route?origin=&destination=&time=&lat=&lng=&radius= — ranked zones + arrival windows
router.get('/', (req, res) => {
  const { destination, time, lat, lng, radius } = req.query;
  const arrival = time ? new Date(time) : new Date();
  const targetLat = lat !== undefined ? parseFloat(lat) : null;
  const targetLng = lng !== undefined ? parseFloat(lng) : null;
  const searchRadius = radius !== undefined ? parseFloat(radius) : 1.0;

  let candidateZones = seedZones;
  if (targetLat !== null && targetLng !== null && !isNaN(targetLat) && !isNaN(targetLng)) {
    const nearby = seedZones.filter(z => haversineKm(targetLat, targetLng, z.center.lat, z.center.lng) <= searchRadius);
    if (nearby.length > 0) candidateZones = nearby;
  }

  const ranked = candidateZones.map(z => {
    const f = forecastAt(z, arrival);
    let walk = (z.walkTo[0] && z.walkTo[0].minutes) || 5;
    let distKm = null;
    if (targetLat !== null && targetLng !== null && !isNaN(targetLat) && !isNaN(targetLng)) {
      distKm = Math.round(haversineKm(targetLat, targetLng, z.center.lat, z.center.lng) * 100) / 100;
      walk = Math.max(1, Math.round(distKm * 12));
    }
    // Score: availability first, then proximity/walk, then price.
    const score = f.probability * 100 - walk * 2.5 - (z.pricePerHour || 0) * 1.5;
    const expectedSearchMin = Math.round((1 - f.probability) * 14 + 2);
    const availableSpots = Math.max(0, Math.round(z.capacity * f.probability));
    return {
      zoneId: z.id, name: z.name, center: z.center, kind: z.kind,
      capacity: z.capacity, availableSpots,
      probability: f.probability, status: currentStatus(f.probability),
      walkMinutes: walk, distanceKm: distKm, pricePerHour: z.pricePerHour,
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
