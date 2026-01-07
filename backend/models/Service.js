const mongoose = require('mongoose');

// บริการของลูกค้าหนึ่งรายการ
const serviceSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // รหัสอ้างอิงที่ผู้ใช้กำหนดเอง (เดิมใช้ customerIdField)
  cid: { type: String },
  customerIdField: { type: String }, // เพื่อความเข้ากันได้ย้อนหลัง

  // ประเภทบริการ
  serviceType: { type: String, enum: ['Google Ads', 'Facebook Ads'] },
  // ชื่อบริการเดิม (คงไว้เพื่อเข้ากันได้) — จะ sync กับ serviceType ถ้าไม่กำหนด
  name: { type: String },

  // ช่องทางการได้มา
  acquisitionRole: { type: String, enum: ['sale', 'admin'] },
  acquisitionPerson: { type: String, enum: ['นายก', 'นายข'] },

  // สิทธิการเป็นเจ้าของ
  ownership: { type: String, enum: ['ลูกค้า', 'website ภายใต้บริษัท'] },

  // URL / Facebook Page
  pageUrl: { type: String },

  // วันที่เริ่ม-ครบกำหนด
  startDate: { type: Date },
  dueDate: { type: Date },

  // ราคาและบันทึกเพิ่มเติม
  price: { type: Number },
  notes: { type: String },

  // สถานะใหม่ + คงค่าเดิมเพื่อความเข้ากันได้
  status: {
    type: String,
    enum: [
      // ใหม่
      'อยู่ระหว่างบริการ', 'เกินกำหนดมากกว่า 30 วัน', 'ครบกำหนด',
      // อังกฤษเดิม
      'active', 'paused', 'completed',
      // ไทยเดิม
      'รอกำเนิด', 'รอตั้งค่าทิพย์', 'รอคลิกเข้าข้อมูล',
      'รอคิวทำเว็บ', 'รอคิวสร้างบัญชี', 'รอลูกค้าส่งข้อมูล', 'กำลังรันโฆษณา'
    ],
    default: 'อยู่ระหว่างบริการ'
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      // คำนวณสถานะอัตโนมัติตามวันที่ครบกำหนด
      try {
        if (ret && ret.dueDate) {
          const now = new Date();
          const due = new Date(ret.dueDate);
          if (!Number.isNaN(due.getTime())) {
            const diffMs = now - due;
            if (diffMs > 0) {
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              if (diffDays > 30) {
                ret.status = 'เกินกำหนดมากกว่า 30 วัน';
              } else {
                ret.status = 'ครบกำหนด';
              }
            } else {
              // ยังไม่ครบกำหนด ให้เป็นสถานะระหว่างบริการถ้าไม่ได้ตั้งค่าอื่นไว้
              if (!ret.status || ['ครบกำหนด','เกินกำหนดมากกว่า 30 วัน'].includes(ret.status)) {
                ret.status = 'อยู่ระหว่างบริการ';
              }
            }
          }
        }
      } catch (_) { /* noop */ }
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: (doc, ret) => {
      try {
        if (ret && ret.dueDate) {
          const now = new Date();
          const due = new Date(ret.dueDate);
          if (!Number.isNaN(due.getTime())) {
            const diffMs = now - due;
            if (diffMs > 0) {
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              if (diffDays > 30) {
                ret.status = 'เกินกำหนดมากกว่า 30 วัน';
              } else {
                ret.status = 'ครบกำหนด';
              }
            } else {
              if (!ret.status || ['ครบกำหนด','เกินกำหนดมากกว่า 30 วัน'].includes(ret.status)) {
                ret.status = 'อยู่ระหว่างบริการ';
              }
            }
          }
        }
      } catch (_) { /* noop */ }
      return ret;
    }
  }
});

// Virtual: ระยะเวลาเดือน (คำนวณจาก startDate - dueDate)
serviceSchema.virtual('months').get(function () {
  if (!this.startDate || !this.dueDate) return null;
  const ms = this.dueDate - this.startDate;
  if (Number.isNaN(ms) || ms < 0) return 0;
  const days = ms / (1000 * 60 * 60 * 24);
  return Math.ceil(days / 30); // ปัดขึ้นเป็นเดือน
});

// ให้เข้ากันได้: sync ค่าบางฟิลด์ก่อนบันทึก/อัปเดต
serviceSchema.pre('save', function (next) {
  if (this.cid && !this.customerIdField) this.customerIdField = this.cid;
  if (this.serviceType && !this.name) this.name = this.serviceType;
  next();
});

serviceSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() || {};
  if (update.cid && !update.customerIdField) update.customerIdField = update.cid;
  if (update.serviceType && !update.name) update.name = update.serviceType;
  this.setUpdate(update);
  next();
});

// Indexes
serviceSchema.index({ customerId: 1 });
serviceSchema.index({ userId: 1, serviceType: 1 });

module.exports = mongoose.model('Service', serviceSchema);
