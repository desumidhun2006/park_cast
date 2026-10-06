require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true, service: 'parkcast-backend', at: new Date().toISOString() }));
app.use('/api/zones', require('./routes/zones'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/route', require('./routes/route'));

app.get('/', (req, res) => res.json({
  service: 'ParkCast backend v0',
  endpoints: ['GET /health', 'GET /api/zones', 'GET /api/zones/:id/forecast?arrival=', 'POST /api/reports', 'GET /api/route?destination=&time=']
}));

if (require.main === module) {
  app.listen(PORT, () => console.log(`ParkCast backend listening on http://localhost:${PORT}`));
}
module.exports = app;
