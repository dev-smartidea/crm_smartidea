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

  // Define the exact correct balances we calculated chronologically
  const correctBalances = [
    { time: '2026-07-02T04:14:48.789Z', balance: 27877.47 },
    { time: '2026-07-02T04:16:43.254Z', balance: 26942.89882 },
    { time: '2026-07-02T04:17:00.012Z', balance: 16442.89882 },
    { time: '2026-07-02T04:17:11.510Z', balance: 15442.89882 },
    { time: '2026-07-02T04:17:44.933Z', balance: 14508.31882 },
    { time: '2026-07-02T04:20:08.798Z', balance: 102708.31882 }, // 14508.31882 + 88200 (topup)
    { time: '2026-07-02T04:35:26.107Z', balance: 97708.31882 },  // - 5000
    { time: '2026-07-02T08:22:05.787Z', balance: 94208.31882 },  // - 3500
    { time: '2026-07-02T08:22:35.142Z', balance: 91404.57882 },  // - 2803.74
    { time: '2026-07-02T08:28:51.466Z', balance: 89404.57882 }   // - 2000
  ];

  for (const item of correctBalances) {
    const entry = await CardLedger.findOne({
      cardId,
      createdAt: new Date(item.time)
    });
    if (entry) {
      console.log(`Updating Ledger for ${item.time} from ${entry.balanceAfter} to ${item.balance}`);
      entry.balanceAfter = item.balance;
      await entry.save();
    } else {
      console.log(`Warning: Ledger entry not found for time ${item.time}`);
    }
  }

  // Update card balance to the final correct balance
  const finalBalance = correctBalances[correctBalances.length - 1].balance;
  console.log(`Updating Card Balance from ${card.balance.toString()} to ${finalBalance}`);
  card.balance = mongoose.Types.Decimal128.fromString(finalBalance.toString());
  await card.save();

  console.log('Database restore and correction completed successfully!');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Failed:', err);
  mongoose.disconnect();
});
