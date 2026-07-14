# Data Models

รวม Mongoose schema ทั้งหมดของระบบ CRM SmartIdea

---

## ภาพรวมความสัมพันธ์

```
User
 └── Customer (userIds)
      ├── Service (customerId, userId)
      │    └── Transaction (serviceId, customerId, userId)
      ├── Activity (customerId)
      ├── Notification (userId)
      ├── Image (userId)
      └── AuditLog (userId)

Card
 └── CardLedger (cardId, serviceId)
      └── Transaction (cardChargedCardId, fbTopupCardId)
```

---

## User

ไฟล์: `User.js`  
Collection: `users`

| Field | Type | Required | หมายเหตุ |
|---|---|---|---|
| `username` | String | ✓ | unique |
| `name` | String | ✓ | ชื่อจริง |
| `email` | String | ✓ | unique, lowercase |
| `password` | String | ✓ | bcrypt hash |
| `role` | String | — | `user` / `admin` / `google_manager` / `facebook_manager` / `account`  (default: `user`) |
| `phone` | String | — | |
| `avatar` | String | — | URL รูปโปรไฟล์ (Cloudinary) |
| `avatarCloudinaryId` | String | — | public_id สำหรับลบ |
| `createdAt` / `updatedAt` | Date | — | auto |

**สิทธิ์บทบาท:**
- `user` — เห็นเฉพาะ customer/service ของตัวเอง
- `admin` — เห็นและจัดการทุกอย่าง
- `google_manager` — เห็นเฉพาะ Google Ads scope
- `facebook_manager` — เห็นเฉพาะ Facebook Ads scope
- `account` — ทีมบัญชี อนุมัติ/ปฏิเสธ transaction

---

## Customer

ไฟล์: `Customer.js`  
Collection: `customers`

| Field | Type | Required | หมายเหตุ |
|---|---|---|---|
| `customerCode` | String | ✓ | unique, รหัสลูกค้า |
| `name` | String | ✓ | |
| `customerType` | String | ✓ | `บุคคลธรรมดา` / `นิติบุคคล` |
| `address` | String | ✓ | |
| `phone` | String | ✓ | |
| `email` | String | ✓ | |
| `taxId` | String | ✓ | เลขผู้เสียภาษี |
| `businessSize` | String | ✓ | `ธุรกิจขนาดเล็ก` / `ธุรกิจขนาดกลาง` |
| `productService` | String | ✓ | สินค้า/บริการของลูกค้า |
| `contactPerson` | String | ✓ | ผู้ติดต่อ |
| `lineId` | String | — | |
| `facebook` | String | — | |
| `website` | String | — | |
| `userIds` | ObjectId[] → User | ✓ | เจ้าของ/ผู้รับผิดชอบ (หลายคน) |
| `service` | String | — | legacy (deprecated) |
| `createdAt` / `updatedAt` | Date | — | auto |

---

## Service

ไฟล์: `Service.js`  
Collection: `services`

| Field | Type | Required | หมายเหตุ |
|---|---|---|---|
| `customerId` | ObjectId → Customer | ✓ | |
| `userId` | ObjectId → User | ✓ | เจ้าของ |
| `serviceType` | String | — | `Google Ads` / `Facebook Ads` / `เว็บไซต์` |
| `name` | String | — | ชื่อบริการ (legacy, sync กับ serviceType) |
| `cid` | String | — | Customer ID / บัญชีโฆษณา |
| `customerIdField` | String | — | legacy alias ของ `cid` |
| `acquisitionRole` | String | — | `sale` / `admin` |
| `acquisitionPerson` | String | — | ชื่อผู้ขาย |
| `caretaker` | String | — | ชื่อผู้ดูแลรายบัญชี |
| `ownership` | String | — | `ลูกค้า` / `website ภายใต้บริษัท` |
| `pageUrl` | String | — | URL หน้าเพจ/บัญชีโฆษณา |
| `domain` | String | — | สำหรับบริการเว็บไซต์ |
| `hosting` | String | — | สำหรับบริการเว็บไซต์ |
| `startDate` | Date | — | วันเริ่มบริการ |
| `dueDate` | Date | — | วันครบกำหนด |
| `price` | Number | — | ค่าบริการ (บาท) |
| `notes` | String | — | หมายเหตุ |
| `status` | String | — | ดูด้านล่าง (default: `อยู่ระหว่างบริการ`) |
| `previousDurationMonths` | Number | — | ระยะเวลาสัญญาก่อนหน้า (เดือน) |
| `transferStatus` | String | — | `active` / `transferred` |
| `transferredTo` / `transferredFrom` | ObjectId → Service | — | ข้อมูลการโอนบัญชี |
| `transferDate` | Date | — | |
| `createdAt` / `updatedAt` | Date | — | auto |

**ค่า status ที่รองรับ:**

| ค่า | ความหมาย |
|---|---|
| `อยู่ระหว่างบริการ` | กำลังให้บริการ |
| `ครบกำหนด` | ถึงวัน dueDate แล้ว (≤ 30 วัน) |
| `เกินกำหนดมากกว่า 30 วัน` | เลยกำหนดเกิน 30 วัน |
| `กำลังรันโฆษณา`, `รอคิวทำเว็บ`, ฯลฯ | สถานะ manual เดิม |

> **หมายเหตุ**: `toJSON`/`toObject` transform จะคำนวณ status จาก `dueDate` ทุกครั้งที่ serialize  
> ส่วน `statusScheduler.js` เขียนลง DB ทุกชั่วโมง — route ที่ใช้ `.lean()` จะเห็นค่าจาก DB

---

## Transaction

ไฟล์: `Transaction.js`  
Collection: `transactions`

| Field | Type | Required | หมายเหตุ |
|---|---|---|---|
| `serviceId` | ObjectId → Service | ✓ | |
| `customerId` | ObjectId → Customer | ✓ | |
| `userId` | ObjectId → User | ✓ | เจ้าของ |
| `amount` | Number | ✓ | ยอดเงินรวม (บาท) |
| `transactionDate` | Date | ✓ | วันที่โอน |
| `transactionTime` | String | — | เวลาที่โอน เช่น `"10:30"` |
| `bank` | String | ✓ | `KBANK` / `SCB` / `BBL` / `KTB` / `TTB` / `BAY` / `BAY-4396` / `BAY-7146` / `Cr.-8508` / `BBL-ส่วนตัว` |
| `cardNumber` | String | — | บัตรเลขที่ |
| `cardTime` | String | — | เวลาที่ตัดบัตร |
| `notes` | String | — | หมายเหตุ |
| `prepaid` | Number | — | สำรอง (override) |
| `coupon` | Number | — | คูปอง (override) |
| `invGG` / `invFB` | Number | — | Invoice Google/Facebook (override) |
| `slipImage` | String | — | URL สลิป (Cloudinary หรือ local) |
| `cloudinaryId` | String | — | public_id สำหรับลบ |
| `breakdowns` | Array | — | รายการย่อย `{ code, amount, statusNote, isAutoVat }` |
| `submissionStatus` | String | — | `none` / `submitted` / `approved` / `rejected` |
| `submittedBy` | ObjectId → User | — | |
| `submittedAt` | Date | — | |
| `cardCharged` | Boolean | — | ตัดบัตรแล้ว (Google Ads flow) |
| `cardChargedAt` | Date | — | |
| `cardChargedBy` | ObjectId → User | — | |
| `cardChargedCardId` | ObjectId → Card | — | |
| `fbToppedUp` | Boolean | — | เติมเงินเข้าบัตรแล้ว รอ FB ตัด |
| `fbTopupCardId` | ObjectId → Card | — | |
| `fbChargedDate` | Date | — | วันที่ FB ตัดจริง |
| `fbChargedAmount` | Number | — | ยอดที่ FB ตัดจริง |
| `createdAt` / `updatedAt` | Date | — | auto |

**Breakdown codes:**

| Code | ความหมาย |
|---|---|
| `11` | ค่าคลิก |
| `12` | VAT ค่าคลิก |
| `13` | VAT ค่าบริการ Google |
| `14` | ค่าบริการ Google |
| `15` | โดนเบิกล่วงหน้า |
| `16` | คูปอง |
| `17` | VAT ค่าบริการ Facebook |
| `18` | ค่าบริการ Facebook |
| `19` | VAT Hosting/Domain |
| `20` | ค่า Hosting/Domain |

| breakdown field | Type | หมายเหตุ |
|---|---|---|
| `statusNote` | String | `รอบันทึกบัญชี` / `ค่าคลิกที่ยังไม่ต้องเติม` |
| `isAutoVat` | Boolean | เงิน parcial ที่ถูกสร้างอัตโนมัติจากการคำนวณ VAT |

---

## Card

ไฟล์: `Card.js`  
Collection: `cards`

| Field | Type | Required | หมายเหตุ |
|---|---|---|---|
| `displayName` | String | ✓ | ชื่อบัตรที่แสดง เช่น `GG 1000` |
| `last4` | String | ✓ | 4 หลักสุดท้ายของบัตร |
| `channels` | String[] | — | `Google Ads` / `Facebook Ads` |
| `balance` | Decimal128 | — | ยอดคงเหลือปัจจุบัน (default: 0.00, รองรับทศนิยม) |
| `currency` | String | — | default: `THB` |
| `status` | String | — | `active` / `inactive` |
| `remarks` | String | — | หมายเหตุ |
| `createdBy` | ObjectId → User | — | |
| `createdAt` / `updatedAt` | Date | — | auto |

**ความพิเศษ - Shared Balance Group:**

บัตร `1000`, `1018`, `1026` ใช้วงเงินร่วมกัน:
- เมื่อเติมเงิน/ตัดยอดบัตรใดใบหนึ่งแล้ว ระบบจะซิงค์ยอดเงินไปให้บัตรอีก 2 ใบโดยอัตโนมัติ
- ฟังก์ชัน `syncSharedBalanceGroup()` ใน `routes/cardRoutes.js` ทำการซิงค์นี้
- ตัวอย่าง: เติมเงินบัตร `1000` จำนวน 100 บาท → บัตร `1018` และ `1026` ก็จะเพิ่มไป 100 บาทด้วย

---

## CardLedger

ไฟล์: `CardLedger.js`  
Collection: `cardledgers`

| Field | Type | Required | หมายเหตุ |
|---|---|---|---|
| `cardId` | ObjectId → Card | ✓ | |
| `serviceId` | ObjectId → Service | — | |
| `type` | String | ✓ | `topup` / `charge` / `adjust` |
| `amount` | Number | ✓ | ยอดเงิน (บวกเสมอ) |
| `direction` | String | ✓ | `credit` / `debit` |
| `channel` | String | — | `Google Ads` / `Facebook Ads` / `Other` |
| `reference` | String | — | campaign/billing reference |
| `note` | String | — | |
| `breakdowns` | Array | — | `{ code, label, amount }` |
| `chargeTime` | String | — | เวลาที่ตัด เช่น `"14:30"` |
| `balanceAfter` | Number | — | ยอดคงเหลือหลังทำรายการ |
| `createdBy` | ObjectId → User | ✓ | |
| `createdAt` / `updatedAt` | Date | — | auto |

---

## Activity

ไฟล์: `Activity.js`  
Collection: `activities`

| Field | Type | Required | หมายเหตุ |
|---|---|---|---|
| `customerId` | ObjectId → Customer | ✓ | |
| `serviceCode` | String | ✓ | รหัสบริการ |
| `activityType` | String | ✓ | `งานใหม่` / `งานแก้ไข / ปรับปรุงบัญชี` |
| `projectName` | String | ✓ | |
| `projectStatus` | String | ✓ | `รอข้อมูล / รูปภาพ ลูกค้า` / `อยู่ระหว่างทำกราฟฟิก` / `อยู่ระหว่างสร้างบัญชี` / `เสร็จสิ้น` |
| `dueDate` | Date | ✓ | กำหนดแล้วเสร็จ |
| `createdAt` / `updatedAt` | Date | — | auto |

---

## Notification

ไฟล์: `Notification.js`  
Collection: `notifications`

| Field | Type | Required | หมายเหตุ |
|---|---|---|---|
| `userId` | ObjectId → User | ✓ | ผู้รับ |
| `type` | String | ✓ | ดูด้านล่าง |
| `title` | String | ✓ | หัวข้อ |
| `message` | String | ✓ | เนื้อหา |
| `link` | String | — | URL ที่เกี่ยวข้อง |
| `relatedServiceId` | ObjectId → Service | — | |
| `relatedCustomerId` | ObjectId → Customer | — | |
| `relatedTransactionId` | ObjectId → Transaction | — | |
| `isRead` | Boolean | — | default: `false` |
| `readAt` | Date | — | |
| `createdAt` / `updatedAt` | Date | — | auto |

**ประเภท notification:**
`service_overdue`, `service_due_soon`, `new_customer`, `new_transaction`, `card_low_balance`, `card_inactive`, `card_active`, `transaction_success`, `transaction_failed`

---

## Image

ไฟล์: `Image.js`  
Collection: `images`

| Field | Type | Required | หมายเหตุ |
|---|---|---|---|
| `customerName` | String | ✓ | ชื่อลูกค้า (ใช้ string ไม่ใช่ ref) |
| `service` | String | ✓ | `Google Ads` / `Facebook Ads` |
| `imageUrl` | String | ✓ | Cloudinary URL |
| `cloudinaryId` | String | — | public_id สำหรับลบ |
| `description` | String | — | |
| `userId` | ObjectId → User | ✓ | เจ้าของ |
| `createdAt` / `updatedAt` | Date | — | auto |

---

## AuditLog

ไฟล์: `AuditLog.js`  
Collection: `auditlogs`

| Field | Type | Required | หมายเหตุ |
|---|---|---|---|
| `userId` | ObjectId → User | — | null ถ้าเป็น system |
| `username` | String | — | default: `system` |
| `action` | String | ✓ | ดูด้านล่าง |
| `target` | String | — | ชื่อ/id object ที่ถูกกระทำ |
| `detail` | String | — | รายละเอียดเพิ่มเติม |
| `ip` | String | — | IP ของผู้ทำรายการ |
| `createdAt` / `updatedAt` | Date | — | auto |

**ค่า action ที่รองรับ:**
`login`, `logout`, `create_user`, `delete_user`, `reset_password`, `change_role`, `create_customer`, `delete_customer`, `reassign_customer`, `create_service`, `update_service`, `delete_service`, `create_transaction`, `update_transaction`, `delete_transaction`, `approve_transaction`, `reject_transaction`, `impersonate`, `backup`

แก้ไข md / เพิ่มลูกค้าหน้า ledgar / เพิ่ม invGg / แก้ acc ledgar ให้ fix column / แก้ไข acc หน้า approve ให้ ปุ่มแก้ไขได้ / เพิ่มช่องค้นหาตาม cid หน้า approve acc / ทำให้สามารถใส่ . แทน  : / / ทำให้สามารถใส่ . แทน  : หน้า AccountFacebookPage.js และ AccountGooglePage.js / แก้ไขยอดเงินในบัตรคงเหลือรวม / เพิ่ม สัปดาห์ นี้ สัปดาห์ที่แล้ว แล้วก็เดือนนี้ กับเดือนที่แล้ว หน้า CardDailySummary / เพิ่มปุ่ม export customer / คำนวนยอดสถานะธุรกรรมใหม่
