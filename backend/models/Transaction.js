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
  bank: { type: String, enum: ['KBANK', 'SCB', 'BBL'], required: true }, // บัญชีธนาคาร (จำกัดเฉพาะ 3 ธนาคารที่ใช้งาน)
  // แยกสัดส่วนการโอนเงินตามรายการที่ผู้ใช้เลือก (optional)
  breakdowns: [{
    code: { type: String, enum: ['11', '12', '13', '14', '15', '16'], required: true }, // รหัส
    amount: { type: Number, required: true }, // ยอดเงินของรายการย่อย
    statusNote: { type: String, enum: ['รอบันทึกบัญชี', 'ค่าคลิกที่ยังไม่ต้องเติม'], required: true }, // สถานะ/หมายเหตุ
    isAutoVat: { type: Boolean, default: false } // ระบุว่ารายการนี้ถูกสร้างอัตโนมัติจากการคำนวณ VAT หรือไม่
  }],
  // สถานะการส่งให้ทีมบัญชี
  submissionStatus: { type: String, enum: ['none', 'submitted', 'approved', 'rejected'], default: 'none' },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  submittedAt: { type: Date }
}, { timestamps: true });

// Indexes to speed up typical queries (by service/user and recent first)
transactionSchema.index({ serviceId: 1, transactionDate: -1 });
transactionSchema.index({ userId: 1, transactionDate: -1 });
transactionSchema.index({ customerId: 1, transactionDate: -1 });
transactionSchema.index({ transactionDate: -1 }); // For sorting all transactions by date
transactionSchema.index({ submissionStatus: 1, transactionDate: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
