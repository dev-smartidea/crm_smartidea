# API Reference — CRM SmartIdea

> อัปเดตล่าสุด: พฤษภาคม 2026  
> Base URL: `http://localhost:5000/api` (dev) หรือ Render URL (prod)  
> ทุก endpoint ที่ไม่ใช่ `/auth/login` และ `/auth/register` ต้องส่ง Header:  
> `Authorization: Bearer <JWT_TOKEN>`

---

## Auth Routes (`/api/auth`)

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| POST | `/auth/register` | ทุกคน | สมัครสมาชิก |
| POST | `/auth/login` | ทุกคน | เข้าสู่ระบบ → คืน JWT |
| GET | `/auth/profile` | ทุกคน | ดูโปรไฟล์ตัวเอง |
| PATCH | `/auth/profile` | ทุกคน | แก้ไขโปรไฟล์ |
| GET | `/auth/users` | admin | ดูรายชื่อ users ทั้งหมด |
| POST | `/auth/admin/create-user` | admin | สร้าง user ใหม่ |
| PATCH | `/auth/users/:id/role` | admin | เปลี่ยน role |
| PATCH | `/auth/users/:id/reset-password` | admin | reset รหัสผ่าน |
| DELETE | `/auth/users/:id` | admin | ลบ user |
| POST | `/auth/impersonate/:userId` | admin | เข้าระบบแทน user |
| POST | `/auth/upload-avatar` | ทุกคน | อัปโหลดรูปโปรไฟล์ |
| GET | `/auth/count` | ทุกคน | จำนวน users |

### POST `/auth/login`
```json
// Request body
{ "username": "string", "password": "string" }

// Response 200
{ "token": "JWT_TOKEN", "user": { "id", "name", "role" } }
```

---

## Customer Routes (`/api/customers`)

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/customers` | ทุกคน | รายชื่อลูกค้า (user=ของตัวเอง, admin/account=ทั้งหมด) |
| POST | `/customers` | ทุกคน | เพิ่มลูกค้าใหม่ |
| GET | `/customers/:id` | ทุกคน | ดูรายละเอียดลูกค้า |
| PUT | `/customers/:id` | ทุกคน | แก้ไขลูกค้า |
| DELETE | `/customers/:id` | ทุกคน | ลบลูกค้า (user ลบได้เฉพาะของตัวเอง) |
| GET | `/customers/preview` | ทุกคน | preview รายชื่อลูกค้า (ใช้ใน dropdown) |

---

## Service Routes (`/api/services`)

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| **GET** | `/services/due-monthly` | ทุกคน | **ลูกค้าครบกำหนด** (ดูรายละเอียดด้านล่าง) |
| GET | `/services` | ทุกคน | บริการทั้งหมด |
| GET | `/customers/:customerId/services` | ทุกคน | บริการของลูกค้า |
| POST | `/customers/:customerId/services` | **admin เท่านั้น** | เพิ่มบริการ |
| GET | `/services/:id` | ทุกคน | ดูบริการเดียว |
| PUT | `/services/:id` | ทุกคน | แก้ไขบริการ (บันทึก `previousDurationMonths` อัตโนมัติ) |
| DELETE | `/services/:id` | ทุกคน | ลบบริการ |
| POST | `/services/:id/transfer` | ทุกคน | โอน service ไป account อื่น |

### GET `/services/due-monthly` ⭐

Query params: `?month=5&year=2026` (month = 1–12)

**Logic:**
1. หา transaction ที่ `submissionStatus = approved`, `breakdowns.code ∈ SERVICE_FEE_CODES`, และ `transactionDate` อยู่ในเดือนที่เลือก → ได้ `paidServiceIds`
2. Query services ที่ตรงเงื่อนไขใดเงื่อนไขหนึ่ง:
   - `dueDate` อยู่ในเดือนที่เลือก (ยังไม่ได้ต่ออายุ)
   - `_id ∈ paidServiceIds` (ต่ออายุแล้ว dueDate ย้ายไปแล้ว แต่ต้องแสดงในเดือนนี้)
3. user role → กรองเฉพาะ `userId` ของตัวเอง

**SERVICE_FEE_CODES:** `['13','14','15','17','18','19','20']`  
(ไม่รวมค่าคลิก: 11, 12, 16)

**Response fields เพิ่มเติม (computed):**
```json
{
  "customerName": "string",
  "customerCode": "string",
  "ownerName": "string",       // ชื่อผู้ดูแล (userId.name)
  "ownerRole": "string",       // role ของผู้ดูแล
  "durationMonths": 3,         // ระยะเวลา startDate → dueDate (เดือน)
  "isDueThisMonth": true,      // dueDate อยู่ในเดือนที่เลือก (false = ต่ออายุแล้ว)
  "lastTransaction": {         // transaction ล่าสุดในเดือนนั้น (null ถ้ายังไม่ชำระ)
    "transactionDate": "ISO",
    "bank": "KBANK",
    "amount": 5000,
    "notes": "string"
  }
}
```

**`previousDurationMonths`:** ฟิลด์ใน Service ที่ถูกบันทึกอัตโนมัติเมื่อมีการแก้ไข `dueDate` — เก็บระยะเวลาสัญญาเดิมก่อน update ครั้งล่าสุด ใช้แสดงคอลัมน์ "ระยะเวลา #1" ในหน้าลูกค้าครบกำหนด

---

## Transaction Routes (`/api/transactions`)

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/transactions` | ทุกคน | รายการทั้งหมด (user=ของตัวเอง) |
| GET | `/services/:serviceId/transactions` | ทุกคน | transactions ของ service |
| POST | `/services/:serviceId/transactions` | ทุกคน | เพิ่ม transaction (รองรับ slip upload) |
| PUT | `/transactions/:id` | ทุกคน | แก้ไข transaction |
| PUT | `/transactions/:id/submit` | ทุกคน | ส่งให้บัญชีพิจารณา |
| PUT | `/transactions/:id/approve` | account | อนุมัติ |
| PUT | `/transactions/:id/reject` | account | ปฏิเสธ |
| DELETE | `/transactions/:id/slip` | ทุกคน | ลบรูปสลิป |
| DELETE | `/transactions/:id` | ทุกคน | ลบ transaction |

---

## Card Routes (`/api/cards`)

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/cards` | account | รายการบัตรทั้งหมด |
| POST | `/cards` | account | เพิ่มบัตรใหม่ |
| PUT | `/cards/:id` | account | แก้ไขบัตร |
| DELETE | `/cards/:id` | account | ลบบัตร |
| POST | `/cards/topup` | account | เติมเงินเข้าบัตร |
| POST | `/cards/charge` | account | ตัดเงินจากบัตร |
| GET | `/cards/charge-history/:transactionId` | account | ประวัติการตัดบัตร |
| GET | `/cards/:id/ledger` | account | สมุดบัญชีบัตร |
| GET | `/cards/:id/ledger/export` | account | export ledger บัตร |
| GET | `/cards/ledger/all` | account | ledger ทุกบัตร |
| GET | `/cards/daily-summary` | account | สรุปรายวัน |

---

## Ledger Routes (`/api/ledger`)

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/ledger` | account | ยอดเดินบัญชี (query: month, year, bank, userId) |
| PATCH | `/ledger/:id` | account | อัปเดตรายการ ledger |
| GET | `/ledger/export` | account | export Excel |

---

## Dashboard Routes (`/api/dashboard`)

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/dashboard/summary` | admin | สรุปภาพรวมระบบ |

---

## Activity Routes (`/api/activities`)

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET/POST | `/activities` | ทุกคน | รายการกิจกรรม |

---

## Notification Routes (`/api/notifications`)

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET/POST/PUT | `/notifications/*` | ทุกคน | การแจ้งเตือน |

---

## Audit Routes (`/api/audit`)

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/audit` | admin | ดู audit log |

---

## Backup Routes (`/api/backup`)

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/backup` | admin | export ข้อมูลทั้งหมด |

---

## Image Routes (`/api/images`)

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET/POST/DELETE | `/images/*` | ทุกคน | จัดการรูปภาพ |

---

## Error Responses

```json
// 401 Unauthorized
{ "error": "Unauthorized" }

// 403 Forbidden
{ "error": "เฉพาะ Admin เท่านั้น..." }

// 404 Not Found
{ "error": "Not found" }

// 400 Bad Request
{ "error": "ข้อความอธิบายข้อผิดพลาด" }

// 500 Server Error
{ "error": "Server error" }
```
