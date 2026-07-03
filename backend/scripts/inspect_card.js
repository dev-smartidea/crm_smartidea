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

  console.log('Card info:');
  console.log(JSON.stringify({
    _id: card._id,
    displayName: card.displayName,
    last4: card.last4,
    balance: card.balance ? card.balance.toString() : '0',
    createdAt: card.createdAt,
    updatedAt: card.updatedAt
  }, null, 2));

  console.log('\nLedger entries (latest 50):');
  const ledgers = await CardLedger.find({ cardId }).sort({ createdAt: -1 }).limit(50);
  ledgers.reverse().forEach(l => {
    console.log(`${l.createdAt.toISOString()} | ID: ${l._id} | Type: ${l.type} | Amount: ${l.amount} | Dir: ${l.direction} | BalAfter: ${l.balanceAfter} | Ref: ${l.reference} | Note: ${l.note}`);
  });

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  mongoose.disconnect();
});
