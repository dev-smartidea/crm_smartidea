const mongoose = require('mongoose');

// บริการหนึ่งรายการที่ลูกค้าทำกับเรา (เช่น Google Ads, Facebook Ads ฯลฯ)
const serviceSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // เจ้าของ (อิงจาก customer.userId เพื่อความสะดวกในการ query / auth)
  name: { type: String, required: true }, // เช่น 'Google Ads', 'Facebook Ads'
  // รองรับสถานะทั้งแบบอังกฤษ (ใช้ในหน้าตารางแก้ไข) และแบบภาษาไทย (ใช้ในฟอร์มสร้าง)
  status: { 
    type: String, 
    enum: [
      'active', 'paused', 'completed',
      // เดิม
      'รอกำเนิด', 'รอตั้งค่าทิพย์', 'รอคลิกเข้าข้อมูล',
      // ให้ตรงกับตัวเลือกใน UI
      'รอคิวทำเว็บ', 'รอคิวสร้างบัญชี', 'รอลูกค้าส่งข้อมูล'
    ], 
    default: 'รอกำเนิด' 
  },
  notes: { type: String },
  // เพิ่มฟิลด์ใหม่ตาม requirement
  pageUrl: { type: String }, // Website หรือ Facebook Page
  startDate: { type: Date },
  dueDate: { type: Date },
  customerIdField: { type: String } // Customer ID ที่ผู้ใช้กรอกเอง (แยกจาก customerId ที่เป็น ObjectId)
}, { timestamps: true });

// Indexes to speed up lookups by customer/user and name
serviceSchema.index({ customerId: 1 });
serviceSchema.index({ userId: 1, name: 1 });

module.exports = mongoose.model('Service', serviceSchema);
