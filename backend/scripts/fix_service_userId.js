/**
 * fix_service_userId.js
 * 
 * Script แก้ไข service เก่าที่ userId ไม่ตรงกับ caretaker
 * สาเหตุ: ตอนสร้าง service เดิม userId fallback เป็น customer.userIds[0]
 *         แทนที่จะเป็น userId ของ caretaker จริง
 * 
 * วิธีใช้:
 *   node scripts/fix_service_userId.js --dry-run   (ดูก่อนไม่บันทึก)
 *   node scripts/fix_service_userId.js              (แก้จริง)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Service = require('../models/Service');
const User = require('../models/User');

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  console.log(isDryRun ? '=== DRY RUN MODE ===' : '=== LIVE MODE ===');

  // ดึง service ทั้งหมดที่มี caretaker
  const services = await Service.find({ caretaker: { $exists: true, $ne: '' } })
    .populate('userId', 'name username')
    .lean();

  // ดึง user ทั้งหมด เพื่อ lookup ชื่อ
  const allUsers = await User.find({}, '_id name username').lean();
  const userByName = {};
  const userByUsername = {};
  for (const u of allUsers) {
    if (u.name) userByName[u.name] = u._id;
    if (u.username) userByUsername[u.username] = u._id;
  }

  let fixCount = 0;
  let skipCount = 0;
  let notFoundCount = 0;

  for (const svc of services) {
    const caretakerName = svc.caretaker;
    const correctUserId = userByName[caretakerName] || userByUsername[caretakerName];

    if (!correctUserId) {
      console.log(`[NOT FOUND] Service ${svc._id} | caretaker="${caretakerName}" | ไม่พบ user ที่ตรงกัน`);
      notFoundCount++;
      continue;
    }

    const currentUserId = svc.userId?._id?.toString() || svc.userId?.toString();
    const correctUserIdStr = correctUserId.toString();

    if (currentUserId === correctUserIdStr) {
      skipCount++;
      continue; // ถูกต้องแล้ว
    }

    const currentUserName = svc.userId?.name || svc.userId?.username || currentUserId;
    console.log(`[FIX] Service ${svc._id} | caretaker="${caretakerName}" | userId: "${currentUserName}" => "${caretakerName}"`);

    if (!isDryRun) {
      await Service.updateOne({ _id: svc._id }, { $set: { userId: correctUserId } });
    }
    fixCount++;
  }

  console.log('\n=== สรุปผล ===');
  console.log(`แก้ไข: ${fixCount} รายการ${isDryRun ? ' (dry-run ยังไม่บันทึก)' : ''}`);
  console.log(`ถูกต้องแล้ว: ${skipCount} รายการ`);
  console.log(`หา user ไม่เจอ: ${notFoundCount} รายการ`);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
