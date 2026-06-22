# CRM SmartIdea — Backend

ระบบ API สำหรับจัดการลูกค้าสัมพันธ์ (CRM) สร้างด้วย Node.js + Express + MongoDB

## เทคโนโลยีที่ใช้

- **Express** 5.1 — Web framework
- **MongoDB** + **Mongoose** — ฐานข้อมูลและ ODM
- **JWT** (jsonwebtoken) — ยืนยันตัวตน
- **Socket.IO** — การแจ้งเตือนแบบ real-time
- **Cloudinary** — เก็บรูปภาพ (avatar, slip, gallery)
- **Multer** — อัปโหลดไฟล์
- **Helmet** + **express-rate-limit** — ความปลอดภัย

## โครงสร้างโปรเจค

```
backend/
├── server.js              # Entry point, middleware, routes
├── socket.js              # Socket.IO setup + JWT auth
├── config/
│   ├── database.js        # MongoDB connection + auto-reconnect
│   └── cloudinary.js      # Cloudinary upload/delete
├── middleware/
│   └── auth.js            # JWT authentication middleware
├── models/                # Mongoose schemas (9 models)
├── routes/                # Express route handlers (10 files)
├── utils/
│   └── statusScheduler.js # อัปเดตสถานะบริการอัตโนมัติทุก 1 ชม.
└── uploads/               # ไฟล์ที่อัปโหลด (avatars, images, slips)
```

## คำสั่งที่ใช้ได้

```bash
npm start       # รันเซิร์ฟเวอร์
npm run dev     # รันเซิร์ฟเวอร์ (เหมือนกัน)
```

เซิร์ฟเวอร์จะรันที่ `http://0.0.0.0:5000` (หรือ port ที่กำหนดใน `.env`)

## ตั้งค่า Environment

สร้างไฟล์ `.env` ใน `backend/`:

```env
# เซิร์ฟเวอร์
PORT=5000
NODE_ENV=production

# ฐานข้อมูล
MONGODB_URI=mongodb://localhost:27017/crm_smartidea

# JWT (ต้องตั้งค่า ไม่งั้นเซิร์ฟเวอร์จะไม่ทำงาน)
JWT_SECRET=<random-string-ที่แข็งแกร่ง>

# Cloudinary (เก็บรูปภาพ)
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>

# Frontend URL (สำหรับ CORS)
FRONTEND_URL=http://localhost:3000

# ALLOWED_ORIGINS: เพิ่ม origins อื่นๆ (LAN IP, staging) คั่นด้วย comma ไม่มีเว้นวรรค
# ตัวอย่าง: ALLOWED_ORIGINS=http://192.168.1.65:3000,http://192.168.1.189:3000
# ALLOWED_ORIGINS=

# Rate Limiting (ไม่บังคับ)
RATE_LIMIT_MAX=100
DISABLE_RATE_LIMIT=1
```

## Middleware (ลำดับการทำงาน)

1. **Helmet** — ตั้ง security headers
2. **CORS** — อนุญาต origins: localhost, LAN IPs, Vercel
3. **Rate Limit** — จำกัด 100 requests / 15 นาที / IP
4. **NoSQL Sanitizer** — ป้องกัน injection (ลบ key ที่ขึ้นต้นด้วย `$`)
5. **Body Parser** — JSON (max 10MB) + URL-encoded
6. **Static Files** — `/uploads/avatars`, `/uploads/images`, `/uploads/slips`

## บทบาทผู้ใช้ (Roles)

| Role | สิทธิ์ |
|------|--------|
| **user** | จัดการลูกค้า, บริการ, กิจกรรม, สร้างธุรกรรม ของตัวเอง |
| **account** | ดูธุรกรรมทั้งหมด, อนุมัติ/ปฏิเสธ, จัดการบัตร, Ledger |
| **admin** | ทุกอย่างของ account + จัดการผู้ใช้, กำหนด role |

## Data Models (9 ตัว)

### User
ผู้ใช้ระบบ — `username`, `email`, `password` (bcrypt), `role`, `phone`, `avatar`

### Customer
ลูกค้า — `customerCode` (unique), `name`, `customerType`, `address`, `phone`, `email`, `taxId`, `businessSize`, `contactPerson`, `userId` (เจ้าของ)

### Service
บริการ — `customerId`, `serviceType` (Google Ads / Facebook Ads / เว็บไซต์), `pageUrl`, `startDate`, `dueDate`, `price`, `status` (คำนวณอัตโนมัติจาก dueDate), `acquisitionRole` (sale/admin), `acquisitionPerson` (ผู้ขาย), `caretaker` (ผู้ดูแล), `domain`, `hosting`

### Activity
กิจกรรม — `customerId`, `serviceCode`, `activityType`, `projectName`, `projectStatus`, `dueDate`

### Transaction
ธุรกรรม — `serviceId`, `amount`, `bank`, `breakdowns[]`, `slipImage`, `submissionStatus` (none → submitted → approved/rejected)

### Card
บัตรเติมเงิน — `displayName`, `last4` (unique), `channels[]`, `balance`, `status` (มี 9 บัตรเริ่มต้น)

### CardLedger
ประวัติบัตร — `cardId`, `type` (topup/charge/adjust), `amount`, `direction` (credit/debit), `balanceAfter`

### Image
รูปภาพแกลเลอรี่ — `customerName`, `service`, `imageUrl`, `cloudinaryId`, `userId`

### Notification
การแจ้งเตือน — `userId`, `type`, `title`, `message`, `link`, `isRead` (ส่งผ่าน Socket.IO แบบ real-time)

## API Endpoints

### Auth (`/api/auth`)

| Method | Path | คำอธิบาย | Auth |
|--------|------|----------|------|
| POST | `/register` | สมัครสมาชิก (จำกัด 3 ครั้ง/ชม.) | - |
| POST | `/login` | เข้าสู่ระบบ (จำกัด 5 ครั้ง/15 นาที) | - |
| GET | `/profile` | ดูโปรไฟล์ | JWT |
| PATCH | `/profile` | แก้ไขโปรไฟล์ + อัปโหลด avatar | JWT |
| GET | `/users` | ดูผู้ใช้ทั้งหมด | Admin |
| GET | `/users/list` | ดูรายชื่อ users ทั้งหมด (ใช้ใน frontend สำหรับ dropdown ผู้ดูแล ผู้ขาย) | JWT |
| PATCH | `/users/:id/role` | เปลี่ยน role | Admin |
| DELETE | `/users/:id` | ลบผู้ใช้ | Admin |

### Customers (`/api/customers`)

| Method | Path | คำอธิบาย | Auth |
|--------|------|----------|------|
| GET | `/` | ดูลูกค้า (รองรับค้นหา) | JWT |
| GET | `/preview` | สร้าง ID + Code ล่วงหน้า | - |
| GET | `/:id` | ดูลูกค้ารายเดียว | JWT |
| POST | `/` | เพิ่มลูกค้า (สร้าง notification) | JWT |
| DELETE | `/:id` | ลบลูกค้า + ข้อมูลที่เกี่ยวข้องทั้งหมด | JWT |

### Services (`/api`)

| Method | Path | คำอธิบาย | Auth |
|--------|------|----------|------|
| GET | `/services` | ดูบริการทั้งหมด | JWT |
| GET | `/services/due-monthly` | ดูบริการที่ครบกำหนดในเดือนที่ระบุ (พร้อมข้อมูลการชำระล่าสุด) | JWT |
| GET | `/customers/:id/services` | ดูบริการของลูกค้า | JWT |
| POST | `/customers/:id/services` | เพิ่มบริการ (เฉพาะ Admin/Manager) | JWT |
| GET | `/services/:id` | ดูบริการรายเดียว | JWT |
| PUT | `/services/:id` | แก้ไขบริการ (ฟิลด์: serviceType, status, notes, pageUrl, startDate, dueDate, price, cid, acquisitionRole, acquisitionPerson, caretaker, ownership, domain, hosting) | JWT |
| DELETE | `/services/:id` | ลบบริการ + cascade ลบ Transaction, Activity | JWT |
| POST | `/services/:id/transfer` | โอนบัญชี FB Ads ให้ลูกค้าใหม่ (Account/Admin) | JWT |

### Transactions (`/api`)

| Method | Path | คำอธิบาย | Auth |
|--------|------|----------|------|
| GET | `/transactions` | ดูธุรกรรม (แบ่งหน้า, กรอง status) | JWT |
| GET | `/services/:id/transactions` | ดูธุรกรรมของบริการ | JWT |
| POST | `/services/:id/transactions` | สร้างธุรกรรม (อัปโหลด slip) | JWT |
| PUT | `/transactions/:id/submit` | ส่งอนุมัติ | JWT |
| PUT | `/transactions/:id/approve` | อนุมัติ | Account/Admin |
| PUT | `/transactions/:id/reject` | ปฏิเสธ | Account/Admin |

### Cards (`/api/cards`)

| Method | Path | คำอธิบาย | Auth |
|--------|------|----------|------|
| GET | `/` | ดูบัตรทั้งหมด (สร้าง default ถ้ายังไม่มี) | Account/Admin |
| POST | `/topup` | เติมเงิน | Account/Admin |
| POST | `/charge` | ตัดเงิน (เช็คยอดพอ, กัน double-charge, atomic via MongoDB session) | Account/Admin |
| GET | `/charge-history/:txId` | ดูประวัติ charge | Account/Admin |
| POST | `/` | สร้างบัตรใหม่ | Account/Admin |
| PUT | `/:id` | แก้ไขบัตร | Account/Admin |
| DELETE | `/:id` | ลบบัตร + ประวัติ | Account/Admin |
| GET | `/:id/ledger` | ดูรายการบัตร (50 รายการล่าสุด) | Account/Admin |
| GET | `/:id/ledger/export` | Export CSV | Account/Admin |

### Dashboard (`/api/dashboard`)

| Method | Path | คำอธิบาย | Auth |
|--------|------|----------|------|
| GET | `/summary` | สรุป: จำนวนลูกค้า, บริการ, รายได้, กราฟ 30 วัน | JWT |

### Notifications (`/api/notifications`)

| Method | Path | คำอธิบาย | Auth |
|--------|------|----------|------|
| GET | `/` | ดูการแจ้งเตือน (max 100) | JWT |
| PUT | `/:id/read` | ทำเครื่องหมายอ่านแล้ว | JWT |
| PUT | `/read-all` | อ่านทั้งหมด | JWT |
| DELETE | `/:id` | ลบการแจ้งเตือน | JWT |
| DELETE | `/batch` | ลบหลายรายการ | JWT |

### Images (`/api/images`)

| Method | Path | คำอธิบาย | Auth |
|--------|------|----------|------|
| GET | `/` | ดูแกลเลอรี่ (แบ่งหน้า, กรอง) | JWT |
| POST | `/` | อัปโหลดรูป (max 10MB) → Cloudinary | JWT |
| DELETE | `/:id` | ลบรูป (ลบจาก Cloudinary ด้วย) | JWT |

### Activities (`/api/activities`)

| Method | Path | คำอธิบาย | Auth |
|--------|------|----------|------|
| GET | `/` | ดูกิจกรรมทั้งหมดของ user | JWT |
| GET | `/customers/:id/activities` | ดูกิจกรรมของลูกค้า | JWT |
| POST | `/customers/:id/activities` | เพิ่มกิจกรรม | JWT |
| PUT | `/:id` | แก้ไขกิจกรรม | JWT |
| PUT | `/:id/complete` | ทำเครื่องหมายเสร็จสิ้น | JWT |
| DELETE | `/:id` | ลบกิจกรรม | JWT |

### Ledger (`/api/ledger`)

| Method | Path | คำอธิบาย | Auth |
|--------|------|----------|------|
| GET | `/` | Export ข้อมูล ledger (กรอง, แบ่งหน้า, คำนวณ VAT) | JWT |

## ระบบอัตโนมัติ

### Status Scheduler
- รันทุก **1 ชั่วโมง** ตั้งแต่เซิร์ฟเวอร์เริ่มทำงาน
- คำนวณสถานะบริการจาก `dueDate`:
  - เกินกำหนด > 30 วัน → `"เกินกำหนดมากกว่า 30 วัน"`
  - เกินกำหนด ≤ 30 วัน → `"ครบกำหนด"`
  - ยังไม่ถึงกำหนด → `"อยู่ระหว่างบริการ"`

### Service Status Transform (toJSON)
- คำนวณสถานะอัตโนมัติทุกครั้งที่อ่านข้อมูลผ่าน Mongoose `toJSON()` และ `toObject()`
- logic เดียวกับ Status Scheduler แต่ทำงานแบบ real-time ทันทีที่ดึงข้อมูล

### Socket.IO Notifications
- เชื่อมต่อด้วย JWT token
- แต่ละ user เข้า room `user:{userId}`
- ส่ง notification แบบ real-time เมื่อ:
  - สร้างลูกค้าใหม่
  - ส่งธุรกรรมเพื่ออนุมัติ
  - ยอดบัตรต่ำ (< 3,000 บาท)
  - เปลี่ยนสถานะบัตร

## Error Handling

- **Unhandled Rejection** — log error แล้วปิดเซิร์ฟเวอร์อย่างสุภาพ
- **Uncaught Exception** — log error แล้วปิดเซิร์ฟเวอร์ทันที
- **SIGTERM / SIGINT** — graceful shutdown (timeout 15 วินาที)
- **MongoDB disconnect** — auto-reconnect ทุก 5 วินาที

## Scripts

### แก้ไขข้อมูลผู้ขาย/ผู้ดูแลในฐานข้อมูล (`scripts/fixServiceAcquisition.js`)
รันเมื่อ: `node backend/scripts/fixServiceAcquisition.js`

ตรวจสอบและแก้ไขข้อมูล `acquisitionRole` / `acquisitionPerson` ใน Service collection ให้ตรงกับรายชื่อที่ถูกต้อง:

| ช่องทาง | รายชื่อผู้ขาย |
|---|---|
| **sale** | จิมมี่, นุช, โบ, นุก, ก้อย, เอ๋ |
| **admin** | บิว, น้ำ, ครีม, มิกซ์, ปาน, อุ้ม |

การทำงาน:
1. หาบริการที่ `acquisitionPerson` ไม่อยู่ในรายชื่อที่ถูกต้อง → แก้เป็นค่า default ตาม role
2. หาบริการที่ `acquisitionRole` กับ `acquisitionPerson` ไม่ตรงกัน → แก้ role ให้ตรงตามชื่อ

## Data Integrity — Card Charge (MongoDB Session Transaction)

การตัดเงินบัตร (`POST /api/cards/charge`) ใช้ **MongoDB session transaction** เพื่อรับประกันว่า 3 operations เกิดขึ้นพร้อมกันแบบ atomic:

```
[1] Card.findOneAndUpdate  — หัก balance บัตร
[2] CardLedger.create      — บันทึก ledger entry
[3] Transaction.update     — mark cardCharged = true
```

ถ้า operation ใดล้มเหลว MongoDB จะ **rollback ทั้ง 3** อัตโนมัติ ป้องกัน balance หักแต่ transaction ไม่ถูก update (double-charge bug)

> **หมายเหตุ:** ต้องใช้ MongoDB Replica Set หรือ Atlas ถึงจะรองรับ multi-document transactions ได้
> Local standalone MongoDB ไม่รองรับ transaction — รันได้แต่ `withTransaction()` จะ error
> แก้: ตั้ง local replica set หรือใช้ MongoDB Atlas ในการพัฒนา
