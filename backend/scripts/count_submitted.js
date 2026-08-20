require('dotenv').config();
const connectDB = require('../config/database');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');

async function main() {
  await connectDB();
  try {
    // Count transactions with submissionStatus 'submitted'
    const count = await Transaction.countDocuments({ submissionStatus: 'submitted' });
    console.log(`Found ${count} transaction(s) with submissionStatus='submitted' (sent to account, not approved)`);

    // List basic info (limit 50)
    const list = await Transaction.find({ submissionStatus: 'submitted' })
      .sort({ transactionDate: -1 })
      .limit(50)
      .select('serviceId customerId amount transactionDate bank slipImage slipVerification submittedBy submittedAt');

    if (list.length > 0) {
      console.log('\nSample transactions (up to 50):');
      list.forEach(tx => {
        console.log(`- id=${tx._id} amount=${tx.amount} bank=${tx.bank} date=${tx.transactionDate.toISOString().split('T')[0]} slip=${tx.slipImage ? 'yes' : 'no'} verification=${tx.slipVerification?.status || 'none'}`);
      });
    }
  } catch (e) {
    console.error('Error querying transactions:', e.message);
  } finally {
    mongoose.connection.close(false, () => process.exit(0));
  }
}

main();
