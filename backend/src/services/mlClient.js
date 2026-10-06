// Calls Python ML microservice if ML_URL is set; falls back to local forecaster.
const ML_URL = process.env.ML_URL || '';

async function mlPredict(zoneId, arrivalISO) {
  if (!ML_URL) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${ML_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone_id: zoneId, arrival: arrivalISO }),
      signal: ctrl.signal
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

module.exports = { mlPredict, getMlUrl: () => ML_URL };
