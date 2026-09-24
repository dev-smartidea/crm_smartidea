const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');

console.log('Testing Transaction model validation with negative breakdown amount...');

const testTx = new Transaction({
  serviceId: new mongoose.Types.ObjectId(),
  customerId: new mongoose.Types.ObjectId(),
  userId: new mongoose.Types.ObjectId(),
  amount: 312,
  transactionDate: new Date(),
  bank: 'KBANK',
  breakdowns: [
    { code: '11', amount: 300, statusNote: 'รอบันทึกบัญชี' },
    { code: '12', amount: 21, statusNote: 'รอบันทึกบัญชี' },
    { code: '7', amount: -9, statusNote: 'รอบันทึกบัญชี' }
  ]
});

const err = testTx.validateSync();
if (err) {
  console.error('Validation FAILED:', err.message);
  process.exit(1);
} else {
  console.log('Validation PASSED successfully!');
}
