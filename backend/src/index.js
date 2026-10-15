require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, isDBConnected } = require('./db');
const { initializePastWeekFeedIfEmpty, startDailyFeedScheduler } = require('./services/feedService');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/health', (req, res) => res.json({
  ok: true,
  service: 'parkistics-backend',
  mongoConnected: isDBConnected(),
  at: new Date().toISOString()
}));

app.use('/api/zones', require('./routes/zones'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/route', require('./routes/route'));
app.use('/api/feed', require('./routes/feed'));

app.get('/', (req, res) => res.json({
  service: 'Parkistics backend v0',
  mongoConnected: isDBConnected(),
  endpoints: [
    'GET /health',
    'GET /api/zones',
    'GET /api/zones/:id/forecast?arrival=',
    'POST /api/reports',
    'GET /api/route?destination=&time=',
    'GET /api/feed?days=7&zoneId=&date=',
    'GET /api/feed/stats',
    'GET /api/feed/retention',
    'POST /api/feed/sync'
  ]
}));

async function startServer() {
  try {
    await connectDB();
    await initializePastWeekFeedIfEmpty();
    startDailyFeedScheduler();
  } catch (err) {
    console.error('[Startup] MongoDB setup warning:', err.message);
  }

  if (require.main === module) {
    app.listen(PORT, () => console.log(`Parkistics backend listening on http://localhost:${PORT}`));
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;

