const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const transactionSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const serviceSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const Transaction = mongoose.model('Transaction', transactionSchema, 'transactions');
const Service = mongoose.model('Service', serviceSchema, 'services');

const TX_ID = '6a2fb586b96b19556ef40c8c';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ เชื่อมต่อ MongoDB สำเร็จ\n');
  
  // ลองหาด้วย ObjectId
  let tx = null;
  try {
    tx = await Transaction.findById(TX_ID).lean();
  } catch (e) {
    console.log('ลอง format อื่น...');
  }
  
  // ถ้ายังไม่เจอ ลองค้นหาใน field อื่น
  if (!tx) {
    tx = await Transaction.findOne({
      $or: [
        { transactionId: TX_ID },
        { txId: TX_ID },
        { referenceId: TX_ID }
      ]
    }).lean();
  }
  
  // ถ้ายังไม่เจอ แสดง transaction ล่าสุด 5 รายการ
  if (!tx) {
    console.log('❌ ไม่พบ Transaction ID นี้\n');
    console.log('🔍 Transaction ล่าสุด 5 รายการ:');
    const recent = await Transaction.find().sort({ createdAt: -1 }).limit(5).lean();
    recent.forEach(t => {
      console.log('  -', t._id.toString(), '| Amount:', t.amount, '| Date:', t.createdAt?.toISOString().split('T')[0]);
    });
    await mongoose.connection.close();
    process.exit(1);
  }
  
  console.log('✅ พบ Transaction!\n');
  console.log('📋 Transaction Details:');
  console.log('  ID:', tx._id);
  console.log('  Amount:', tx.amount?.toLocaleString(), 'บาท');
  console.log('  ServiceId:', tx.serviceId);
  console.log('  CustomerId:', tx.customerId);
  console.log('  Transaction Date:', tx.transactionDate);
  console.log('  Status:', tx.submissionStatus);
  console.log('  Created:', tx.createdAt);
  
  if (tx.serviceId) {
    console.log('\n🔍 กำลังค้นหา Service...');
    const svc = await Service.findById(tx.serviceId).lean();
    if (svc) {
      console.log('\n🔧 Service Details:');
      console.log('  📌 CID:', svc.cid || svc.customerIdField || 'N/A');
      console.log('  Name:', svc.name);
      console.log('  Type:', svc.serviceType);
      console.log('  Status:', svc.status);
      console.log('  User ID:', svc.userId);
    } else {
      console.log('\n❌ ไม่พบ Service ที่เชื่อมโยง');
    }
  } else {
    console.log('\n⚠️ Transaction นี้ไม่มี serviceId');
  }
  
  await mongoose.connection.close();
}

check().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
