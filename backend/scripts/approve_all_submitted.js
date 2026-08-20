require('dotenv').config();
const connectDB = require('../config/database');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');

async function main() {
  await connectDB();
  try {
    const result = await Transaction.updateMany(
      { submissionStatus: 'submitted' },
      { $set: { submissionStatus: 'approved' } }
    );
    console.log(`Successfully updated transactions:`, result);
  } catch (e) {
    console.error('Error updating transactions:', e.message);
  } finally {
    // Close connection properly
    await mongoose.connection.close();
    process.exit(0);
  }
}

main();
