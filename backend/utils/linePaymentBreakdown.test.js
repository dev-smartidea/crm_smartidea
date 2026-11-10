const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLinePaymentBreakdown } = require('./linePaymentBreakdown');

const validCases = [
  {
    name: 'Google service fee with 2% withholding',
    serviceType: 'google',
    slipAmount: 98,
    messageText: 'ค่าบริการ Google ก่อนหัก: 100.00 บาท\nหัก ณ ที่จ่าย 2%: 2.00 บาท\nยอดโอนจริง: 98.00 บาท',
    expectedCodes: ['14', '8'],
  },
  {
    name: 'Google service fee with 3% withholding',
    serviceType: 'google',
    slipAmount: 80,
    messageText: 'ค่าบริการ Google Ads ก่อนหัก: 82.47 บาท\nหัก ณ ที่จ่าย 3%: 2.47 บาท\nยอดโอนจริงตามสลิป: 80.00 บาท',
    expectedCodes: ['14', '10'],
  },
  {
    name: 'English WHT wording with a Google service type',
    serviceType: 'google',
    slipAmount: 97,
    messageText: 'Google service fee gross amount: 100 THB\nWHT 3%: 3 THB\nNet transfer amount: 97 THB',
    expectedCodes: ['14', '10'],
  },
  {
    name: 'Shorthand Thai withholding wording',
    serviceType: 'google',
    slipAmount: 97,
    messageText: 'ค่าบริการ Google ก่อนหัก: 100 บาท\nหัก 3%: 3 บาท\nยอดโอนจริง: 97 บาท',
    expectedCodes: ['14', '10'],
  },
  {
    name: 'Facebook service fee with 2% withholding',
    serviceType: 'facebook',
    slipAmount: 98,
    messageText: 'ค่าบริการ Facebook ก่อนหัก: 100 บาท\nหัก ณ ที่จ่าย 2%: 2 บาท\nยอดโอนจริง: 98 บาท',
    expectedCodes: ['18', '8'],
  },
  {
    name: 'Facebook service fee with 3% withholding',
    serviceType: 'facebook',
    slipAmount: 97,
    messageText: 'ค่าบริการ Facebook ก่อนหัก: 100 บาท\nหัก ณ ที่จ่าย 3%: 3 บาท\nยอดโอนจริง: 97 บาท',
    expectedCodes: ['18', '10'],
  },
  {
    name: 'Partial service fee with 2% withholding',
    serviceType: 'other',
    slipAmount: 98,
    messageText: 'ค่าบริการบางส่วน ก่อนหัก: 100 บาท\nหัก ณ ที่จ่าย 2%: 2 บาท\nยอดโอนจริง: 98 บาท',
    expectedCodes: ['15', '8'],
  },
  {
    name: 'Click fee with 2% withholding',
    serviceType: 'google',
    slipAmount: 98,
    messageText: 'ค่าคลิก Google ก่อนหัก: 100 บาท\nหัก ณ ที่จ่าย 2%: 2 บาท\nยอดโอนจริง: 98 บาท',
    expectedCodes: ['11', '9'],
  },
  {
    name: 'Click fee with 3% withholding',
    serviceType: 'google',
    slipAmount: 97,
    messageText: 'ค่าคลิก Google ก่อนหัก: 100 บาท\nหัก ณ ที่จ่าย 3%: 3 บาท\nยอดโอนจริง: 97 บาท',
    expectedCodes: ['11', '7'],
  },
  {
    name: 'Thai ad fee wording with 2% withholding',
    serviceType: 'google',
    slipAmount: 98,
    messageText: 'ค่าแอด Google ก่อนหัก: 100 บาท\nหัก ณ ที่จ่าย 2%: 2 บาท\nยอดโอนจริง: 98 บาท',
    expectedCodes: ['11', '9'],
  },
  {
    name: 'Domain fee with 2% withholding',
    serviceType: 'domain',
    slipAmount: 98,
    messageText: 'ค่า Domain ก่อนหัก: 100 บาท\nหัก ณ ที่จ่าย 2%: 2 บาท\nยอดโอนจริง: 98 บาท',
    expectedCodes: ['20', '22'],
  },
  {
    name: 'Domain fee with 3% withholding',
    serviceType: 'domain',
    slipAmount: 97,
    messageText: 'ค่า Hosting ก่อนหัก: 100 บาท\nหัก ณ ที่จ่าย 3%: 3 บาท\nยอดโอนจริง: 97 บาท',
    expectedCodes: ['20', '21'],
  },
];

for (const item of validCases) {
  test(item.name, () => {
    const result = parseLinePaymentBreakdown(item);
    assert.equal(result.valid, true);
    assert.equal(result.isAmountMatched, true);
    assert.deepEqual(result.breakdowns.map((row) => row.code), item.expectedCodes);
    assert.equal(result.breakdowns.reduce((sum, row) => sum + row.amount, 0), item.slipAmount);
  });
}

test('rejects withholding when the stated deduction does not equal the calculated rate', () => {
  const result = parseLinePaymentBreakdown({
    serviceType: 'google',
    slipAmount: 80,
    messageText: 'ค่าบริการ Google ก่อนหัก: 82.47 บาท\nหัก ณ ที่จ่าย 3%: 3.00 บาท\nยอดโอนจริง: 80 บาท',
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'withholding_amount_mismatch');
});

test('rejects a slip amount that does not match the calculated net amount', () => {
  const result = parseLinePaymentBreakdown({
    serviceType: 'google',
    slipAmount: 82.47,
    messageText: 'ค่าบริการ Google ก่อนหัก: 82.47 บาท\nหัก ณ ที่จ่าย 3%: 2.47 บาท\nยอดโอนจริง: 80 บาท',
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'net_amount_mismatch');
});

test('rejects ambiguous rates and unsupported categories', () => {
  const ambiguousRate = parseLinePaymentBreakdown({
    serviceType: 'google',
    slipAmount: 100,
    messageText: 'ค่าบริการ Google 100 บาท หัก ณ ที่จ่าย 2% หรือ 3%',
  });
  const unknownCategory = parseLinePaymentBreakdown({
    serviceType: 'other',
    slipAmount: 98,
    messageText: 'ค่าใช้จ่ายก่อนหัก: 100 บาท หัก ณ ที่จ่าย 2%',
  });
  assert.equal(ambiguousRate.valid, false);
  assert.equal(unknownCategory.valid, false);
});

test('normalizes Thai numerals when calculating withholding', () => {
  const result = parseLinePaymentBreakdown({
    serviceType: 'google',
    slipAmount: 98,
    messageText: 'ค่าบริการ Google ก่อนหัก: ๑๐๐ บาท\nหัก ณ ที่จ่าย ๒%: ๒ บาท\nยอดโอนจริง: ๙๘ บาท',
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.breakdowns.map((row) => row.code), ['14', '8']);
});
