const express = require('express');
const { addCrowdSignal } = require('../services/forecastService');

const router = express.Router();
const reports = []; // in-memory v0; persisted to user_reports in Mongo when configured

// POST /api/reports — { zoneId, signal: found|full|circling, note? }
router.post('/', (req, res) => {
  const { zoneId, signal, note } = req.body || {};
  if (!zoneId || !['found', 'full', 'circling'].includes(signal)) {
    return res.status(400).json({ error: 'expected { zoneId, signal: found|full|circling }' });
  }
  const report = { id: `r${Date.now()}`, zoneId, signal, note: note || '', at: new Date().toISOString() };
  reports.unshift(report);
  addCrowdSignal(zoneId, signal); // feed back into predictions
  res.status(201).json({ ...report, pointsAwarded: 10 });
});

router.get('/', (req, res) => res.json({ count: reports.length, reports: reports.slice(0, 50) }));

module.exports = router;
