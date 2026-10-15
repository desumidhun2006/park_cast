import assert from 'node:assert';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

async function runTests() {
  console.log(`\n🧪 Running MongoDB 7-Day Parking Feed Tests against ${BACKEND_URL}...\n`);

  // 1. Health check
  const healthRes = await fetch(`${BACKEND_URL}/health`);
  const health = await healthRes.json();
  assert.strictEqual(health.ok, true, 'Backend health must be ok');
  assert.strictEqual(health.mongoConnected, true, 'MongoDB connection must be active');
  console.log('✓ 1. Backend health & MongoDB connection verified');

  // 2. Feed endpoint past 1 week
  const feedRes = await fetch(`${BACKEND_URL}/api/feed?days=7`);
  const feedData = await feedRes.json();
  assert.strictEqual(feedData.success, true, 'Feed request must succeed');
  assert.strictEqual(feedData.retentionPolicy, '7_days_rolling_only', 'Retention policy must be 7_days_rolling_only');
  assert.strictEqual(feedData.dailySummaries.length, 7, 'Must have 7 days of daily summaries in the past week');
  assert.ok(feedData.count >= 168, 'Must have at least 168 records across 24 zones for 7 days');
  console.log(`✓ 2. Past 1 week feed retrieved: ${feedData.dailySummaries.length} days, ${feedData.count} zone records`);

  // Verify daily summaries contain required metrics
  feedData.dailySummaries.forEach(day => {
    assert.ok(day.date, 'Day must have date');
    assert.ok(day.dayOfWeek, 'Day must have dayOfWeek');
    assert.ok(day.zoneCount > 0, 'Day must have zoneCount');
    assert.ok(day.avgProbability >= 0 && day.avgProbability <= 1, 'Avg probability must be between 0 and 1');
    assert.ok(day.avgOccupancyRate >= 0 && day.avgOccupancyRate <= 1, 'Avg occupancy must be between 0 and 1');
  });
  console.log('✓ 3. Daily breakdown metrics verified across all 7 days');

  // 4. Test retention endpoint
  const retentionRes = await fetch(`${BACKEND_URL}/api/feed/retention`);
  const retention = await retentionRes.json();
  assert.strictEqual(retention.retentionDays, 7, 'Retention days must be 7');
  assert.strictEqual(retention.isRetentionStrictlyCompliant, true, 'Must strictly comply with 7-day retention');
  assert.strictEqual(retention.expiredRecordsAwaitingPrune, 0, 'No expired records should be present');
  console.log(`✓ 4. 7-Day retention audit passed: ${retention.validRecent7DaysRecords} valid records, 0 expired`);

  // 5. Zone filter query
  const sampleZone = feedData.feed[0].zoneId;
  const zoneFeedRes = await fetch(`${BACKEND_URL}/api/feed?zoneId=${sampleZone}`);
  const zoneFeed = await zoneFeedRes.json();
  assert.strictEqual(zoneFeed.success, true);
  assert.ok(zoneFeed.feed.length > 0 && zoneFeed.feed.length <= 7, 'Single zone must have <= 7 daily entries');
  zoneFeed.feed.forEach(item => {
    assert.strictEqual(item.zoneId, sampleZone, 'All returned items must match requested zoneId');
  });
  console.log(`✓ 5. Zone-specific 7-day history verified for ${sampleZone} (${zoneFeed.feed.length} days)`);

  // 6. Feed Stats
  const statsRes = await fetch(`${BACKEND_URL}/api/feed/stats`);
  const stats = await statsRes.json();
  assert.strictEqual(stats.success, true);
  assert.ok(stats.overall.totalRecords >= 168);
  assert.ok(stats.topZonesByAvailability.length > 0);
  console.log(`✓ 6. 7-Day MongoDB aggregation analytics verified (${stats.topZonesByAvailability.length} ranked zones)`);

  // 7. Manual daily sync
  const syncRes = await fetch(`${BACKEND_URL}/api/feed/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const syncData = await syncRes.json();
  assert.strictEqual(syncData.success, true);
  assert.ok(syncData.updatedZones > 0);
  console.log(`✓ 7. Daily feed sync execution verified: ${syncData.updatedZones} zones updated`);

  console.log('\n🎉 ALL 7 MONGODB PARKING FEED TESTS PASSED (100%)\n');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
