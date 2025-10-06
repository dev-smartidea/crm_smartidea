const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  lineId: String,
  facebook: String,
  website: String,
  // เดิมใช้ service (string เดี่ยว) ตอนนี้จะย้ายไปเก็บใน collection Service แยก
  service: { type: String }, // คงไว้ชั่วคราว (deprecated) เพื่อ migration / compatibility
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
