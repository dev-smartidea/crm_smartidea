const test = require('node:test');
const assert = require('node:assert/strict');
const LineWebhookEvent = require('./LineWebhookEvent');

test('LINE webhook inbox has a unique event key and persistent retry state', () => {
  const indexes = LineWebhookEvent.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => keys.eventKey === 1 && options.unique));
  assert.ok(indexes.some(([keys, options]) => keys.expireAt === 1 && options.expireAfterSeconds === 0));
  assert.ok(LineWebhookEvent.schema.path('event'));
  assert.ok(LineWebhookEvent.schema.path('attempts'));
  assert.ok(LineWebhookEvent.schema.path('nextAttemptAt'));
  assert.ok(LineWebhookEvent.schema.path('pendingData'));
});
