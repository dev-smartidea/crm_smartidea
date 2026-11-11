const test = require('node:test');
const assert = require('node:assert/strict');
const Customer = require('../models/Customer');
const Service = require('../models/Service');
const { formatTransferTime, resolveCustomerContext } = require('./sheetsLogger');

test('formats compact and colon-separated slip transfer times', () => {
  assert.equal(formatTransferTime('1121'), '11:21');
  assert.equal(formatTransferTime('805'), '08:05');
  assert.equal(formatTransferTime('8:05'), '08:05');
});

test('rejects invalid slip transfer times', () => {
  assert.equal(formatTransferTime('2461'), '');
  assert.equal(formatTransferTime('not a time'), '');
  assert.equal(formatTransferTime(null), '');
});

test('resolves a customer and its only service CID from the extracted customer name', async () => {
  const originalCustomerFind = Customer.find;
  const originalServiceFind = Service.find;
  const customer = { _id: 'customer-1', name: 'บริษัท เอ จำกัด' };
  Customer.find = async () => [customer];
  Service.find = async () => [{ cid: '123-456-7890', serviceType: 'Google Ads' }];

  try {
    const result = await resolveCustomerContext({
      customerName: 'เอ',
      messageText: 'เติมเงิน',
      serviceType: 'Google Ads',
    });

    assert.equal(result.customerName, 'เอ');
    assert.equal(result.cid, '123-456-7890');
    assert.match(result.messageText, /CID: 123-456-7890/);
  } finally {
    Customer.find = originalCustomerFind;
    Service.find = originalServiceFind;
  }
});

test('does not infer a CID when the customer has multiple matching services', async () => {
  const originalCustomerFind = Customer.find;
  const originalServiceFind = Service.find;
  Customer.find = async () => [{ _id: 'customer-1', name: 'Customer One' }];
  Service.find = async () => [
    { cid: 'cid-one', serviceType: 'Google Ads' },
    { cid: 'cid-two', serviceType: 'Facebook Ads' },
  ];

  try {
    const result = await resolveCustomerContext({
      customerName: 'Customer One',
      messageText: 'เติมเงิน',
    });

    assert.equal(result.cid, null);
  } finally {
    Customer.find = originalCustomerFind;
    Service.find = originalServiceFind;
  }
});

test('extracts a CID from the message even when the customer name is already supplied', async () => {
  const originalCustomerFind = Customer.find;
  const originalServiceFindOne = Service.findOne;
  Customer.find = async () => [];
  Service.findOne = () => ({ populate: async () => null });

  try {
    const result = await resolveCustomerContext({
      customerName: 'Customer One',
      messageText: 'เติมเงิน CID: ABC-123',
    });

    assert.equal(result.cid, 'ABC-123');
    assert.match(result.messageText, /CID: ABC-123/);
  } finally {
    Customer.find = originalCustomerFind;
    Service.findOne = originalServiceFindOne;
  }
});
