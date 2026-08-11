# Backend Scripts

โฟลเดอร์นี้เก็บ utility scripts สำหรับการจัดการและบำรุงรักษาระบบ CRM รวมถึง scripts สำหรับแก้ไขข้อมูล, ตรวจสอบข้อมูล และงานที่รันเป็นระยะ

---

## 📁 รายการ Scripts

### 🧹 Maintenance & Cleanup

#### [`cleanup_old_slips.js`](cleanup_old_slips.js)
**ลบรูปสลิปโอนเงินที่มีอายุเกิน 90 วัน**

- ⏰ รันอัตโนมัติทุกวันเวลา 02:00 น. (เริ่มพร้อม server)
- ☁️ ลบรูปสลิปจาก Cloudinary
- 🖼️ ลบรูปจาก Image gallery
- 🗄️ Clear `slipImage`, `slipImage2` ใน Transaction (เก็บข้อมูลอื่นไว้)
- 📝 แสดง log รายละเอียดการลบ

**วิธีใช้:**
```bash
# รันด้วยตัวเอง (manual)
node scripts/cleanup_old_slips.js

# จะรันอัตโนมัติเมื่อ server start
```

---

### 🔍 Inspection & Debugging

#### [`check_specific_tx.js`](check_specific_tx.js)
**ตรวจสอบ Transaction เฉพาะรายการ**

ใช้สำหรับดีบั๊กและตรวจสอบรายละเอียดของ transaction ที่มีปัญหา (เช่น อนุมัติไม่ได้)

**วิธีใช้:**
```bash
node scripts/check_specific_tx.js
```

**หมายเหตุ:** แก้ไข `TX_IDS` ใน script เพื่อระบุ transaction ID ที่ต้องการตรวจสอบ

---

#### [`check_tx_temp.js`](check_tx_temp.js)
**ตรวจสอบ Transaction ชั่วคราว**

Script สำหรับค้นหาและตรวจสอบ transaction รายการเดียว (temporary debug script)

**วิธีใช้:**
```bash
node scripts/check_tx_temp.js
```

**หมายเหตุ:** แก้ไข `TX_ID` ใน script เพื่อระบุ transaction ID

---

#### [`inspect_card.js`](inspect_card.js)
**ตรวจสอบข้อมูลบัตร prepaid card**

แสดงข้อมูล Card และ CardLedger entries (ล่าสุด 50 รายการ)

**วิธีใช้:**
```bash
node scripts/inspect_card.js
```

**หมายเหตุ:** แก้ไข `cardId` ใน script เพื่อระบุบัตรที่ต้องการตรวจสอบ

---

#### [`inspect_all_topups.js`](inspect_all_topups.js)
**ตรวจสอบการเติมเงินบัตรทั้งหมด**

หา topup transactions ที่มีความผิดปกติ (เช่น balance ไม่ตรง)

**วิธีใช้:**
```bash
node scripts/inspect_all_topups.js
```

---

### 🔧 Data Repair & Fix

#### [`fix_service_userId.js`](fix_service_userId.js)
**แก้ไข Service ที่ userId ไม่ตรงกับ caretaker**

แก้ไขปัญหา service เก่าที่ `userId` fallback เป็น `customer.userIds[0]` แทนที่จะเป็น userId ของ caretaker จริง

**วิธีใช้:**
```bash
# ดูก่อน ไม่บันทึก (Dry run)
node scripts/fix_service_userId.js --dry-run

# แก้ไขจริง
node scripts/fix_service_userId.js
```

---

#### [`repair_card_balance.js`](repair_card_balance.js)
**คำนวณและแก้ไข balance ของ Card Ledger**

คำนวณ balance ของ card ใหม่จาก ledger entries ทั้งหมดตั้งแต่ต้น

**วิธีใช้:**
```bash
node scripts/repair_card_balance.js
```

**หมายเหตุ:** แก้ไข `cardId` ใน script เพื่อระบุบัตรที่ต้องการซ่อม

---

#### [`restore_and_correct_balance.js`](restore_and_correct_balance.js)
**กู้คืนและแก้ไข balance ของ Card**

ใส่ค่า balance ที่ถูกต้องลงใน CardLedger ตาม timestamp ที่กำหนด

**วิธีใช้:**
```bash
node scripts/restore_and_correct_balance.js
```

**หมายเหตุ:** แก้ไข `cardId` และ `correctBalances` array ใน script

---

### 👥 User Configuration

#### [`setFacebookScope.js`](setFacebookScope.js)
**กำหนด serviceTypeScope = 'Facebook Ads' ให้ admin**

ตั้งค่า scope สำหรับ Facebook Ads admins (2 คน)

**วิธีใช้:**
```bash
node scripts/setFacebookScope.js
```

---

#### [`setGoogleScope.js`](setGoogleScope.js)
**กำหนด serviceTypeScope = 'Google Ads' ให้ admin**

ตั้งค่า scope สำหรับ Google Ads admins (3 คน)

**วิธีใช้:**
```bash
node scripts/setGoogleScope.js
```

---

## 📋 หมายเหตุทั่วไป

### Environment Variables
Scripts ทั้งหมดต้องการไฟล์ `.env` ใน `backend/` directory พร้อมค่าต่อไปนี้:
- `MONGODB_URI` - MongoDB connection string
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name (สำหรับ cleanup script)
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret

### Database Connection
Scripts จะเชื่อมต่อกับ MongoDB โดยอัตโนมัติผ่าน `process.env.MONGODB_URI`

### Backup ก่อนใช้
⚠️ **คำเตือน:** Scripts ที่แก้ไขข้อมูล (repair/fix scripts) ควร backup database ก่อนรัน

### Development vs Production
- ใช้ `--dry-run` flag (ถ้ามี) เพื่อทดสอบก่อนรันจริง
- ตรวจสอบ environment variables ให้แน่ใจว่าชี้ไปที่ database ที่ถูกต้อง

---

## 🚀 การสร้าง Script ใหม่

เมื่อสร้าง script ใหม่ ควรมีโครงสร้างดังนี้:

```javascript
/**
 * script_name.js
 * คำอธิบายสั้นๆ ว่า script นี้ทำอะไร
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to Database');
  
  // ทำงานหลักที่นี่
  
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
```

อย่าลืมอัพเดท README.md ไฟล์นี้เมื่อเพิ่ม script ใหม่! 📝
