const mongoose = require('mongoose');

// บริการหนึ่งรายการที่ลูกค้าทำกับเรา (เช่น Google Ads, Facebook Ads ฯลฯ)
const serviceSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // เจ้าของ (อิงจาก customer.userId เพื่อความสะดวกในการ query / auth)
  name: { type: String, required: true }, // เช่น 'Google Ads', 'Facebook Ads'
  status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active' },
  notes: { type: String },
  // เพิ่มฟิลด์ใหม่ตาม requirement
  pageUrl: { type: String }, // Website หรือ Facebook Page
  startDate: { type: Date },
  dueDate: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
