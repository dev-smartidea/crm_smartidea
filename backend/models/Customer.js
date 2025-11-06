const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  // ฟิลด์ใหม่ (ข้อมูลหลัก)
  customerCode: { type: String, required: true, trim: true, unique: true, sparse: true },
  name: { type: String, required: true, trim: true },
  customerType: { 
    type: String, 
    enum: ['บุคคลธรรมดา', 'บริษัทจำกัด', 'หจก.'],
    required: true
  },
  address: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  taxId: { type: String, required: true, trim: true },
  businessSize: {
    type: String,
    enum: ['ธุรกิจขนาดเล็ก', 'ธุรกิจขนาดกลาง'],
    required: true
  },
  productService: { type: String, trim: true, required: true }, // สินค้า/บริการของลูกค้า (บังคับกรอก)

  // ฟิลด์เดิม (คงไว้เพื่อความเข้ากันได้ของฟีเจอร์อื่น เช่น คลังรูปภาพ)
  lineId: { type: String, trim: true },
  facebook: { type: String, trim: true },
  website: { type: String, trim: true },
  // เดิมใช้ service (string เดี่ยว) ตอนนี้ย้ายไป collection Service แยก (deprecated)
  service: { type: String },

  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// ดัชนีช่วยค้นหาเพิ่มเติม
customerSchema.index({ userId: 1, name: 1 });

module.exports = mongoose.model('Customer', customerSchema);
