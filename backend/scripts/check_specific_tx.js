/**
 * check_specific_tx.js
 * ตรวจสอบรายการโอนเงินที่อนุมัติไม่ได้ 2 รายการ
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

// Minimal schemas
const transactionSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const serviceSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const userSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema, 'transactions');
const Service = mongoose.model('Service', serviceSchema, 'services');
const User = mongoose.model('User', userSchema, 'users');

const TX_IDS = [
  '6a6c14d6ee1fe3c470661746', // Pkgroup-pest.com Google Ads 3,000
  '6a6323bc0269aedc7f7ee443', // มาสเตอร์กรีน Facebook Ads 3,745
];

async function main() {
  console.log('🔌 เชื่อมต่อ MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ เชื่อมต่อสำเร็จ\n');

  for (const txId of TX_IDS) {
    console.log('='.repeat(60));
    console.log(`🔍 ตรวจสอบ TX: ${txId}`);
    console.log('='.repeat(60));

    let tx;
    try {
      tx = await Transaction.findById(txId).lean();
    } catch (e) {
      console.log(`  ❌ ไม่สามารถหา Transaction ได้: ${e.message}`);
      continue;
    }

    if (!tx) {
      console.log(`  ❌ ไม่พบ Transaction ID นี้ในฐานข้อมูล!\n`);
      continue;
    }

    console.log('\n📋 ข้อมูล Transaction:');
    console.log(`  _id:              ${tx._id}`);
    console.log(`  amount:           ${tx.amount?.toLocaleString()} บาท`);
    console.log(`  bank:             ${tx.bank}`);
    console.log(`  transactionDate:  ${tx.transactionDate ? new Date(tx.transactionDate).toLocaleString('th-TH') : '-'}`);
    console.log(`  submissionStatus: ${tx.submissionStatus || 'null/undefined'}`);
    console.log(`  submittedAt:      ${tx.submittedAt ? new Date(tx.submittedAt).toLocaleString('th-TH') : '-'}`);
    console.log(`  serviceId:        ${tx.serviceId}`);
    console.log(`  customerId:       ${tx.customerId}`);
    console.log(`  userId:           ${tx.userId}`);
    console.log(`  submittedBy:      ${tx.submittedBy}`);
    console.log(`  slipImage:        ${tx.slipImage ? '✅ มีสลิป' : '❌ ไม่มีสลิป'}`);
    console.log(`  slipImage2:       ${tx.slipImage2 ? '✅ มีสลิป2' : '-'}`);
    console.log(`  createdAt:        ${tx.createdAt ? new Date(tx.createdAt).toLocaleString('th-TH') : '-'}`);
    console.log(`  updatedAt:        ${tx.updatedAt ? new Date(tx.updatedAt).toLocaleString('th-TH') : '-'}`);
    console.log(`  breakdowns:       ${JSON.stringify(tx.breakdowns || [])}`);

    // ตรวจสอบ Service
    if (tx.serviceId) {
      let svc;
      try {
        svc = await Service.findById(tx.serviceId).lean();
      } catch(e) {}
      if (svc) {
        console.log('\n🔧 ข้อมูล Service:');
        console.log(`  _id:        ${svc._id}`);
        console.log(`  cid:        ${svc.cid || svc.customerIdField || '-'}`);
        console.log(`  name:       ${svc.name || '-'}`);
        console.log(`  serviceType:${svc.serviceType || '-'}`);
        console.log(`  userId:     ${svc.userId}`);
        console.log(`  status:     ${svc.status || '-'}`);
        console.log(`  dueDate:    ${svc.dueDate ? new Date(svc.dueDate).toLocaleString('th-TH') : '-'}`);
      } else {
        console.log('\n🔧 Service: ❌ ไม่พบ Service (serviceId อาจไม่ถูกต้อง)');
      }
    }

    // ตรวจสอบ User ที่ submit
    if (tx.submittedBy) {
      let submitter;
      try {
        submitter = await User.findById(tx.submittedBy).lean();
      } catch(e) {}
      if (submitter) {
        console.log('\n👤 ผู้ส่ง (submittedBy):');
        console.log(`  name:     ${submitter.name}`);
        console.log(`  username: ${submitter.username}`);
        console.log(`  role:     ${submitter.role}`);
        console.log(`  isActive: ${submitter.isActive !== false ? '✅' : '❌ ถูก deactivate'}`);
      }
    }

    // วิเคราะห์ว่าทำไมอนุมัติไม่ได้
    console.log('\n🩺 วิเคราะห์ปัญหา:');
    
    if (!tx.submissionStatus || tx.submissionStatus === 'none') {
      console.log('  ⚠️  submissionStatus เป็น none/null → รายการนี้ยังไม่ถูก submit อย่างเป็นทางการ');
    } else if (tx.submissionStatus === 'approved') {
      console.log('  ✅ รายการนี้ถูกอนุมัติไปแล้ว (approved) → ไม่ควรแสดงในหน้า "รออนุมัติ" อีกต่อไป');
      console.log('  → ปัญหาอาจเป็นที่ frontend ดึง cache เก่ามาแสดง');
    } else if (tx.submissionStatus === 'submitted') {
      console.log('  ✅ submissionStatus = submitted → ควรอนุมัติได้ปกติ');
      console.log('  → ปัญหาน่าจะเกิดจาก error ใน backend ตอนกด approve หรือ network error');
    } else if (tx.submissionStatus === 'rejected') {
      console.log('  ⚠️  submissionStatus = rejected → รายการถูกปฏิเสธแล้ว ต้องส่งใหม่ก่อน');
    }

    if (!tx.slipImage && !tx.slipImage2) {
      console.log('  ⚠️  ไม่มีสลิป → bulk-approve จะข้ามรายการนี้ (approvableItems เช็คจาก slipImage)');
      console.log('  → แต่ single approve (ปุ่มอนุมัติทีละรายการ) ไม่มีเงื่อนไขเรื่องสลิป');
    }

    console.log('');
  }

  // ตรวจสอบว่า approve route มีปัญหา permission ไหม
  console.log('='.repeat(60));
  console.log('🔐 ตรวจสอบ User account ในระบบที่มีสิทธิ์อนุมัติ');
  console.log('='.repeat(60));
  const accountUsers = await User.find({ role: { $in: ['account', 'admin'] }, isActive: { $ne: false } }).lean();
  for (const u of accountUsers) {
    console.log(`  ${u.name} (${u.username}) - role: ${u.role} - isActive: ${u.isActive !== false ? '✅' : '❌'}`);
  }

  await mongoose.disconnect();
  console.log('\n🔌 ปิดการเชื่อมต่อเรียบร้อย');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
