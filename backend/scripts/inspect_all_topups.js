const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Card = require('../models/Card');
const CardLedger = require('../models/CardLedger');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to Database');

  const ledgers = await CardLedger.find({ type: 'topup' }).sort({ createdAt: -1 });
  console.log(`Found ${ledgers.length} topups`);

  for (const ledger of ledgers) {
    const card = await Card.findById(ledger.cardId);
    if (!card) continue;
    // Let's get the ledger entry immediately preceding this topup (the one before it in time)
    const prevLedger = await CardLedger.findOne({
      cardId: ledger.cardId,
      createdAt: { $lt: ledger.createdAt }
    }).sort({ createdAt: -1 });

    const prevBal = prevLedger ? prevLedger.balanceAfter : 0;
    const diff = ledger.balanceAfter - prevBal;
    // If the difference does not match the topup amount, we have an issue!
    // But note, sometimes they are not exact due to other things, but here the difference should be close to ledger.amount.
    // In our bug, diff is close to 0 (or rather, string concatenated, so balanceAfter is basically prevBal plus string concat)
    if (Math.abs(diff - ledger.amount) > 1) {
      console.log(`Anomalous Topup Found!`);
      console.log(`Ledger ID: ${ledger._id}`);
      console.log(`Card: ${card.displayName} (${card.last4}) - ID: ${card._id}`);
      console.log(`Date: ${ledger.createdAt.toISOString()}`);
      console.log(`Amount: ${ledger.amount}`);
      console.log(`Prev BalAfter: ${prevBal}`);
      console.log(`This BalAfter: ${ledger.balanceAfter} (Expected: ${prevBal + ledger.amount})`);
      console.log(`Diff: ${diff}`);
      console.log('---');
    }
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  mongoose.disconnect();
});
