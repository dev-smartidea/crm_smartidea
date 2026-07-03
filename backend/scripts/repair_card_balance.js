const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Card = require('../models/Card');
const CardLedger = require('../models/CardLedger');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to Database');

  const cardId = '6a140d9957ed84fd89d38929';
  const card = await Card.findById(cardId);
  if (!card) {
    console.log('Card not found');
    await mongoose.disconnect();
    return;
  }

  // Get all ledger entries for this card sorted by createdAt ascending
  const ledgers = await CardLedger.find({ cardId }).sort({ createdAt: 1 });
  console.log(`Found ${ledgers.length} total ledger entries for card ${card.displayName} (${card.last4})`);

  let currentBalance = 0;
  // We want to find the first ledger entry that has an issue, or we can just recalculate from the very beginning.
  // Let's recalculate from the first entry to ensure absolute consistency!
  for (let i = 0; i < ledgers.length; i++) {
    const entry = ledgers[i];
    const change = entry.direction === 'credit' ? entry.amount : -entry.amount;
    
    // Calculate expected balance after this entry
    const previousBalance = currentBalance;
    currentBalance = Number((currentBalance + change).toFixed(5)); // round to 5 decimal places to avoid floating point issues

    console.log(`Entry ${i+1}: Date: ${entry.createdAt.toISOString()} | Type: ${entry.type} | Amount: ${entry.amount} | Dir: ${entry.direction} | Old BalAfter: ${entry.balanceAfter} | New BalAfter: ${currentBalance}`);
    
    // Update the ledger entry in DB
    entry.balanceAfter = currentBalance;
    await entry.save();
  }

  // Finally update the card's balance to match the latest ledger's balanceAfter
  console.log(`Updating card balance from ${card.balance.toString()} to ${currentBalance}`);
  card.balance = mongoose.Types.Decimal128.fromString(currentBalance.toString());
  await card.save();

  console.log('Database repair completed successfully!');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Repair failed:', err);
  mongoose.disconnect();
});
