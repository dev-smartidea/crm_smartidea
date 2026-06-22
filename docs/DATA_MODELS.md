# Data Models — CRM SmartIdea

> อัปเดตล่าสุด: มิถุนายน 2026

---

## ความสัมพันธ์ระหว่าง Models

```
User
 ├── Customer (userId)          ลูกค้าที่ user เป็นเจ้าของ
 │    └── Service (customerId, userId)    บริการของลูกค้า
 │         └── Transaction (serviceId, customerId, userId)
 │                └── Card (cardChargedCardId)   บัตรที่ตัดเงิน
 │
 ├── Activity (userId)          กิจกรรมที่บันทึก
 ├── Notification (userId)      การแจ้งเตือน
 ├── AuditLog                   action log ของ admin
 └── Image (customerId)         รูปภาพที่อัปโหลด

Card
 └── CardLedger (cardId)        รายการเคลื่อนไหวของบัตร
```

---

## User

**Collection:** `users`

| Field | Type | Required | คำอธิบาย |
|---|---|---|---|
| `username` | String | ✅ | ชื่อล็อกอิน (unique) |
| `password` | String | ✅ | bcrypt hash |
| `name` | String | ✅ | ชื่อแสดง |
| `role` | String | - | `user` / `admin` / `account` (default: `user`) |
| `avatar` | String | - | URL รูปโปรไฟล์ |
| `createdAt` | Date | auto | - |

---

## Customer

**Collection:** `customers`

| Field | Type | Required | คำอธิบาย |
|---|---|---|---|
| `customerCode` | String | ✅ | รหัสลูกค้า (unique) |
| `name` | String | ✅ | ชื่อลูกค้า/บริษัท |
| `customerType` | String | ✅ | `บุคคลธรรมดา` / `นิติบุคคล` |
| `address` | String | ✅ | ที่อยู่ |
| `phone` | String | ✅ | เบอร์โทร |
| `email` | String | ✅ | อีเมล |
| `taxId` | String | ✅ | เลขประจำตัวผู้เสียภาษี |
| `businessSize` | String | ✅ | `ธุรกิจขนาดเล็ก` / `ธุรกิจขนาดกลาง` |
| `productService` | String | ✅ | สินค้า/บริการของลูกค้า |
| `contactPerson` | String | ✅ | ผู้ติดต่อ |
| `lineId` | String | - | Line ID |
| `facebook` | String | - | Facebook Page |
| `website` | String | - | เว็บไซต์ |
| `userId` | ObjectId→User | ✅ | เจ้าของ record |

**Index:** `{ userId, name }`

---

## Service

**Collection:** `services`

| Field | Type | Required | คำอธิบาย |
|---|---|---|---|
| `customerId` | ObjectId→Customer | ✅ | ลูกค้าเจ้าของบริการ |
| `userId` | ObjectId→User | ✅ | พนักงานที่รับผิดชอบ |
| `cid` / `customerIdField` | String | - | รหัสอ้างอิงที่ผู้ใช้กำหนดเอง (cid เป็นฟิลด์ใหม่, customerIdField เพื่อความเข้ากันได้ย้อนหลัง) |
| `serviceType` | String | - | `Google Ads` / `Facebook Ads` / `เว็บไซต์` |
| `acquisitionRole` | String | - | `sale` / `admin` (ช่องทางการได้มา) |
| `acquisitionPerson` | String | - | ชื่อผู้ขาย |
| `caretaker` | String | - | **ผู้ดูแล** (เลือกจาก users role `user` ในระบบ) |
| `ownership` | String | - | `ลูกค้า` / `website ภายใต้บริษัท` |
| `pageUrl` | String | - | URL หรือ Facebook Page |
| `domain` | String | - | Domain (เฉพาะบริการเว็บไซต์) |
| `hosting` | String | - | Hosting (เฉพาะบริการเว็บไซต์) |
| `startDate` | Date | - | วันเริ่มบริการ |
| `dueDate` | Date | - | วันครบกำหนด |
| `price` | Number | - | ราคาค่าบริการ |
| `notes` | String | - | หมายเหตุ |
| `status` | String | - | สถานะ (คำนวณอัตโนมัติจาก dueDate) |
| `previousDurationMonths` | Number | - | ระยะเวลาสัญญาก่อนต่ออายุ (บันทึกอัตโนมัติ) |
| `transferStatus` | String | - | `active` / `transferred` |
| `transferredTo` | ObjectId→Service | - | service ที่โอนไป |
| `transferredFrom` | ObjectId→Service | - | service ที่โอนมาจาก |
| `transferDate` | Date | - | วันที่โอน |

### รายชื่อผู้ขายตามช่องทางการได้มา

| ช่องทาง | รายชื่อผู้ขาย |
|---|---|
| **sale** (ขายโดย sale) | จิมมี่, นุช, โบ, นุก, ก้อย, เอ๋ |
| **admin** (ขายโดย admin) | บิว, น้ำ, ครีม, มิกซ์, ปาน, อุ้ม |

> ผู้ซื้อ (`acquisitionPerson`) จะเปลี่ยนไปตาม `acquisitionRole` ที่เลือก โดยค่าเริ่มต้นของ sale คือ "จิมมี่" และของ admin คือ "บิว"

### ผู้ดูแล (`caretaker`)

- ฟอร์มเพิ่มบริการใหม่และแก้ไขใน modal รายละเอียด เลือกผู้ดูแลได้จาก users ในระบบที่กรองเฉพาะ `role === 'user'`
- แสดงเป็น `ชื่อ (username)`
- กรณีชื่อเดิมที่ไม่อยู่ในระบบแล้ว จะแสดงเป็น `ชื่อ (ข้อมูลเดิม)`

**Virtual (computed on toJSON):**
- `status` — คำนวณจาก `dueDate` vs ปัจจุบัน:
  - เกิน 30 วัน → `เกินกำหนดมากกว่า 30 วัน`
  - เกินกำหนด → `ครบกำหนด`
  - ยังไม่ถึง → `อยู่ระหว่างบริการ`

**หมายเหตุ `previousDurationMonths`:**  
เมื่อ PUT `/services/:id` มีการเปลี่ยน `dueDate` หรือ `startDate` — ระบบจะคำนวณ `(oldDueDate - oldStartDate)` เป็นจำนวนเดือน แล้วบันทึกลงฟิลด์นี้อัตโนมัติ ก่อนที่ dueDate ใหม่จะเขียนทับ

---

## Transaction

**Collection:** `transactions`

| Field | Type | Required | คำอธิบาย |
|---|---|---|---|
| `serviceId` | ObjectId→Service | ✅ | บริการที่ชำระ |
| `customerId` | ObjectId→Customer | ✅ | ลูกค้า |
| `userId` | ObjectId→User | ✅ | พนักงานเจ้าของ |
| `amount` | Number | ✅ | ยอดรวม |
| `transactionDate` | Date | ✅ | วันที่โอน |
| `bank` | String | ✅ | บัญชีธนาคาร: `KBANK/SCB/BBL/BAY-4396/BAY-7146/Cr.-8508/BBL-ส่วนตัว` |
| `breakdowns` | Array | - | แจกแจงรายการย่อย |
| `breakdowns[].code` | String | ✅ | รหัส 11–20 |
| `breakdowns[].amount` | Number | ✅ | ยอดย่อย |
| `breakdowns[].statusNote` | String | ✅ | `รอบันทึกบัญชี` / `ค่าคลิกที่ยังไม่ต้องเติม` |
| `slipImage` | String | - | URL สลิป (Cloudinary หรือ local) |
| `submissionStatus` | String | - | `none/submitted/approved/rejected` |
| `submittedBy` | ObjectId→User | - | ผู้ส่งให้บัญชี |
| `cardCharged` | Boolean | - | ตัดบัตรแล้ว |
| `cardChargedCardId` | ObjectId→Card | - | บัตรที่ตัด |
| `fbToppedUp` | Boolean | - | เติมเงิน FB แล้ว |
| `fbTopupCardId` | ObjectId→Card | - | บัตรที่ใช้เติม FB |
| `fbChargedDate` | Date | - | วันที่ FB ตัด |
| `fbChargedAmount` | Number | - | ยอดที่ FB ตัดจริง |

**Breakdown Codes:**

| Code | ความหมาย | ประเภท |
|---|---|---|
| 11 | ค่าคลิก Google Ads | ค่าคลิก |
| 12 | ค่าคลิก Facebook Ads | ค่าคลิก |
| 13 | ค่าบริการ Google Ads | **ค่าบริการ** |
| 14 | ค่าบริการ Facebook Ads | **ค่าบริการ** |
| 15 | ค่าบริการ อื่นๆ | **ค่าบริการ** |
| 16 | ค่าคลิก Facebook (ประเภท 2) | ค่าคลิก |
| 17–20 | ค่าบริการเพิ่มเติม | **ค่าบริการ** |

> `SERVICE_FEE_CODES = ['13','14','15','17','18','19','20']` — ใช้ในการระบุว่า transaction นี้เป็นการชำระค่าบริการ (ใช้ใน due-monthly)

**Indexes:** `{ serviceId, transactionDate }`, `{ userId, transactionDate }`, `{ customerId, transactionDate }`, `{ submissionStatus, transactionDate }`

---

## Card

**Collection:** `cards`

| Field | Type | Required | คำอธิบาย |
|---|---|---|---|
| `displayName` | String | ✅ | ชื่อแสดง เช่น `GG 1000` |
| `last4` | String | ✅ | เลข 4 หลักท้าย |
| `channels` | [String] | - | `Google Ads` / `Facebook Ads` |
| `balance` | Number | - | ยอดเงินคงเหลือ (default 0) |
| `currency` | String | - | สกุลเงิน (default `THB`) |
| `status` | String | - | `active` / `inactive` |
| `remarks` | String | - | หมายเหตุ |
| `createdBy` | ObjectId→User | - | ผู้สร้าง |

---

## CardLedger

**Collection:** `cardledgers`

> บันทึกการเคลื่อนไหวของยอดเงินในบัตรแต่ละใบ (topup / charge / adjustment)

---

## Activity

**Collection:** `activities`

> บันทึกกิจกรรมที่พนักงานทำกับลูกค้า (นัดหมาย, ติดตาม, หมายเหตุ ฯลฯ)

---

## AuditLog

**Collection:** `auditlogs`

> บันทึก action ของ admin เช่น สร้าง/ลบ user, เปลี่ยน role ใช้แสดงในหน้า Audit Log

---

## Notification

**Collection:** `notifications`

> การแจ้งเตือนแบบ real-time ผ่าน Socket.IO

---

## Image

**Collection:** `images`

> รูปภาพที่อัปโหลดเข้าระบบ เก็บ URL (Cloudinary หรือ local) และ metadata ของลูกค้า
