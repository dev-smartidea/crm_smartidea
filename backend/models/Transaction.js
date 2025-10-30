const mongoose = require('mongoose');

// ประวัติการโอนเงินสำหรับแต่ละบริการ
const transactionSchema = new mongoose.Schema({
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // เจ้าของ
  amount: { type: Number, required: true }, // จำนวนเงิน
  transactionDate: { type: Date, required: true }, // วันที่โอน
  notes: { type: String }, // หมายเหตุ
  slipImage: { type: String }, // path ของรูปสลิป/หลักฐาน (optional)
  bank: { type: String, enum: ['KBANK', 'SCB', 'BBL'], required: true } // บัญชีธนาคาร (จำกัดเฉพาะ 3 ธนาคารที่ใช้งาน)
}, { timestamps: true });

// Indexes to speed up typical queries (by service/user and recent first)
transactionSchema.index({ serviceId: 1, transactionDate: -1 });
transactionSchema.index({ userId: 1, transactionDate: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
