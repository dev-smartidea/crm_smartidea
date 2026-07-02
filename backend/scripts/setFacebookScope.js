/**
 * Script: setFacebookScope.js
 * Sets serviceTypeScope = 'Facebook Ads' for the 2 facebook-admin users
 * Usage: node scripts/setFacebookScope.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const targetEmails = [
    'mail2@smartidea.co.th', // มิ๊ก-admin facebook
    'mail3@smartidea.co.th', // อุ้ม-admin facebook
  ];

  const result = await User.updateMany(
    { email: { $in: targetEmails } },
    { $set: { serviceTypeScope: 'Facebook Ads' } }
  );

  console.log(`Updated: ${result.modifiedCount} user(s)`);

  const updated = await User.find({ email: { $in: targetEmails } }, 'name email role serviceTypeScope');
  updated.forEach(u => console.log(`  - ${u.name} (${u.email}) | role: ${u.role} | serviceTypeScope: ${u.serviceTypeScope}`));

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
