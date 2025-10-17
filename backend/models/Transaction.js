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
  paymentMethod: { type: String, enum: ['โอนผ่านธนาคาร', 'เงินสด', 'บัตรเครดิต', 'อื่นๆ'], default: 'โอนผ่านธนาคาร' }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
