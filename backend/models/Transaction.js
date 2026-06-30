const mongoose = require('mongoose');

// ประวัติการโอนเงินสำหรับแต่ละบริการ
const transactionSchema = new mongoose.Schema({
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // เจ้าของ
  amount: { type: Number, required: true }, // จำนวนเงิน
  transactionDate: { type: Date, required: true }, // วันที่โอน
  transactionTime: { type: String }, // เวลาที่โอน (เช่น "10:30")
  cardNumber: { type: String }, // บัตรเลขที่
  cardTime: { type: String }, // เวลาที่ตัดบัตร
  notes: { type: String }, // หมายเหตุ
  prepaid: { type: Number }, // สำรอง (override)
  coupon: { type: Number }, // คูปอง (override)
  invGG: { type: Number }, // Inv. Gg (override)
  invFB: { type: Number }, // Inv. Fb (override)
  slipImage: { type: String }, // URL ของรูปสลิป/หลักฐาน (Cloudinary หรือ local path)
  cloudinaryId: { type: String }, // Cloudinary public_id สำหรับลบภายหลัง
  bank: { type: String, enum: ['KBANK', 'SCB', 'BBL', 'KTB', 'TTB', 'BAY', 'BAY-4396', 'BAY-7146', 'Cr.-8508', 'BBL-ส่วนตัว'], required: true }, // บัญชีธนาคาร
  // แยกสัดส่วนการโอนเงินตามรายการที่ผู้ใช้เลือก (optional)
  breakdowns: [{
    code: { type: String, enum: ['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'], required: true }, // รหัส
    amount: { type: Number, required: true }, // ยอดเงินของรายการย่อย
    statusNote: { type: String, enum: ['รอบันทึกบัญชี', 'ค่าคลิกที่ยังไม่ต้องเติม'], required: true }, // สถานะ/หมายเหตุ
    isAutoVat: { type: Boolean, default: false } // ระบุว่ารายการนี้ถูกสร้างอัตโนมัติจากการคำนวณ VAT หรือไม่
  }],
  // สถานะการส่งให้ทีมบัญชี
  submissionStatus: { type: String, enum: ['none', 'submitted', 'approved', 'rejected'], default: 'none' },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  submittedAt: { type: Date },
  // สถานะการตัดเงินจากบัตร
  cardCharged: { type: Boolean, default: false },
  cardChargedAt: { type: Date },
  cardChargedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cardChargedCardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card' },
  // Facebook Ads flow
  fbToppedUp: { type: Boolean, default: false },       // เติมเงินเข้าบัตรแล้ว รอ FB ตัด
  fbTopupCardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card' }, // บัตรที่เติมเงิน
  fbChargedDate: { type: Date },                        // วันที่ FB ตัดเงิน
  fbChargedAmount: { type: Number }                     // ยอดที่ FB ตัดจริง
}, { timestamps: true });

// Indexes to speed up typical queries (by service/user and recent first)
transactionSchema.index({ serviceId: 1, transactionDate: -1 });
transactionSchema.index({ userId: 1, transactionDate: -1 });
transactionSchema.index({ customerId: 1, transactionDate: -1 });
transactionSchema.index({ transactionDate: -1 }); // For sorting all transactions by date
transactionSchema.index({ submissionStatus: 1, transactionDate: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
