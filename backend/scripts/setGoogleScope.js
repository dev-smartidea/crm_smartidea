/**
 * Script: setGoogleScope.js
 * Sets serviceTypeScope = 'Google Ads' for the 3 google-admin users
 * Usage: node scripts/setGoogleScope.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const targetEmails = [
    'mail4@smartidea.co.th', // ครีม
    'mail5@smartidea.co.th', // น้ำ
    'mail6@smartidea.co.th', // บิว
  ];

  const result = await User.updateMany(
    { email: { $in: targetEmails } },
    { $set: { serviceTypeScope: 'Google Ads' } }
  );

  console.log(`Updated: ${result.modifiedCount} user(s)`);

  const updated = await User.find({ email: { $in: targetEmails } }, 'name email role serviceTypeScope');
  updated.forEach(u => console.log(`  - ${u.name} (${u.email}) | role: ${u.role} | serviceTypeScope: ${u.serviceTypeScope}`));

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
