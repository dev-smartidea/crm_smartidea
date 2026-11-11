const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canPairTextAndSlip,
  findUniquePendingMatch,
} = require('./lineEventMatching');

const cardAdminId = '6aed34fdfe6fdbd73573fd03';

test('pairs valid withholding payment using parsed net even when extractor amount is missing', () => {
  assert.equal(canPairTextAndSlip({
    crmUserId: cardAdminId,
    messageText: 'ค่าบริการ Google ก่อนหัก 100 บาท\nหัก ณ ที่จ่าย 3% 3 บาท',
    textAmount: null,
    slipAmount: 97,
    serviceType: 'google',
  }), true);
});

test('does not pair a regular payment without an extracted amount', () => {
  assert.equal(canPairTextAndSlip({
    crmUserId: cardAdminId,
    messageText: 'เติมเงิน Google Ads ลูกค้า CID 1234',
    textAmount: null,
    slipAmount: 97,
    serviceType: 'google',
  }), false);
});

test('does not pair invalid withholding unless an explicit amount matches the slip', () => {
  assert.equal(canPairTextAndSlip({
    crmUserId: cardAdminId,
    messageText: 'ค่าบริการ Google ก่อนหัก 100 บาท หัก 3% 2 บาท',
    textAmount: 100,
    slipAmount: 97,
    serviceType: 'google',
  }), false);
});

test('does not select a pending event when multiple candidates match', () => {
  const events = [{ id: 'a', amount: 100 }, { id: 'b', amount: 100 }];
  const result = findUniquePendingMatch(events, (event) => event.amount === 100);
  assert.equal(result.event, null);
  assert.equal(result.ambiguous, true);
  assert.equal(events.length, 2);
});

test('selects and removes the only matching pending event', () => {
  const events = [{ id: 'a', amount: 100 }, { id: 'b', amount: 200 }];
  const result = findUniquePendingMatch(events, (event) => event.amount === 200);
  assert.equal(result.event.id, 'b');
  assert.equal(result.ambiguous, false);
  assert.deepEqual(events, [{ id: 'a', amount: 100 }]);
});
