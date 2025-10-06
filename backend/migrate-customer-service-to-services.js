// สคริปต์ Migration: ย้ายค่า customer.service (string เดิม) ไปยัง collection Service ใหม่
const mongoose = require('mongoose');
require('dotenv').config();
const Customer = require('./models/Customer');
const Service = require('./models/Service');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    const customers = await Customer.find({ service: { $exists: true, $ne: '' } });
    console.log(`พบลูกค้าที่มี field service เดิม: ${customers.length} รายการ`);

    let created = 0;
    for (const c of customers) {
      // ตรวจสอบว่ามี service record แล้วหรือยัง (ป้องกันซ้ำ)
      const exists = await Service.findOne({ customerId: c._id, name: c.service });
      if (exists) continue;
      await Service.create({
        customerId: c._id,
        userId: c.userId,
        name: c.service,
        status: 'active'
      });
      created++;
    }
    console.log(`✅ สร้าง Service documents ใหม่จำนวน: ${created}`);
    console.log('เสร็จสิ้น');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
