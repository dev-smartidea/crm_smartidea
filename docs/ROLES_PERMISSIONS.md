# สิทธิ์การเข้าถึงตาม Role (Roles & Permissions)

> อัปเดตล่าสุด: พฤษภาคม 2026

ระบบมี 3 role ที่กำหนดใน `User.role`:

| Role | คำอธิบาย |
|---|---|
| `user` | พนักงานขาย — จัดการลูกค้าและบริการของตัวเองเท่านั้น |
| `admin` | ผู้ดูแลระบบ — เข้าถึงข้อมูลทุกคน + จัดการ users |
| `account` | ทีมบัญชี — เห็นข้อมูลทุกคน + อนุมัติ/ปฏิเสธ transaction |

---

## สรุปสิทธิ์แต่ละหน้า

### หน้าที่ทุก role เข้าได้

| หน้า | Path | หมายเหตุ |
|---|---|---|
| Login | `/login` | - |
| Profile | `/dashboard/profile` | เห็นเฉพาะข้อมูลตัวเอง |
| ลูกค้าครบกำหนด | `/dashboard/due-customers` | user เห็นเฉพาะบริการตัวเอง |

### user role

**Path prefix:** `/dashboard`  
**Layout:** `DashboardLayout` (sidebar)

| หน้า | สิทธิ์ |
|---|---|
| รายชื่อลูกค้า | เห็นเฉพาะลูกค้าที่ตัวเองสร้าง |
| รายละเอียดลูกค้า | เห็นเฉพาะของตัวเอง |
| เพิ่มลูกค้า | ได้ทุกคน |
| บริการของลูกค้า | เห็น/แก้เฉพาะบริการที่ตัวเองเป็นเจ้าของ |
| ประวัติ Transaction | เห็นเฉพาะของตัวเอง |
| การเติมเงิน (รายการทั้งหมด) | เห็นเฉพาะของตัวเอง |
| รายการที่ส่งบัญชี | เห็นเฉพาะของตัวเอง |
| กิจกรรม | เห็นเฉพาะของตัวเอง |
| การแจ้งเตือน | เห็นเฉพาะของตัวเอง |
| ลูกค้าครบกำหนด | เห็นเฉพาะบริการตัวเอง, ไม่มีตัวกรองผู้ดูแล |

### admin role

**Path prefix:** `/dashboard/admin`  
**Layout:** ไม่มี sidebar (standalone pages)

| หน้า | สิทธิ์พิเศษ |
|---|---|
| Admin Dashboard | ภาพรวมระบบ, สร้าง user, export backup |
| ลูกค้าครบกำหนด | เห็นทุกบริการ, มีตัวกรองผู้ดูแล/ประเภท/สถานะ |
| Audit Log | เห็น action log ทุกรายการ |
| รายชื่อลูกค้า (ผ่าน `/dashboard`) | เห็นของทุกคน |
| เพิ่มบริการให้ลูกค้า | **เฉพาะ admin เท่านั้น** |
| แก้ไข/ลบบริการ | เข้าถึงทุก service ไม่จำกัด userId |

**API ที่ต้องการ admin:**
- `POST /api/auth/admin/create-user`
- `PATCH /api/auth/users/:id/role`
- `PATCH /api/auth/users/:id/reset-password`
- `DELETE /api/auth/users/:id`
- `POST /api/auth/impersonate/:userId`
- `GET /api/backup`
- `POST /api/customers/:customerId/services` (admin only)

### account role

**Path prefix:** `/dashboard/account`  
**Layout:** `AccountDashboardLayout` (sidebar)

| หน้า | สิทธิ์ |
|---|---|
| ยอดเดินบัญชี (Ledger) | เห็น transaction ที่ submitted ทุกคน |
| รายการรอพิจารณา | เห็น transaction `submitted` ทุกคน |
| รายการที่อนุมัติแล้ว | เห็น transaction `approved` ทุกคน |
| รายการที่ปฏิเสธ | เห็น transaction `rejected` ทุกคน |
| บัตรเครดิต (Cards) | จัดการ card balance/topup/charge |
| สมุดบัญชีบัตร | ดู ledger ของแต่ละบัตร |
| บริการ Facebook | ดู/จัดการ Facebook Ads flow |
| ลูกค้าครบกำหนด | เห็นทุกบริการ, มีตัวกรองครบ |
| การแจ้งเตือน | เห็นเฉพาะของตัวเอง |

**API ที่ต้องการ account:**
- `PUT /api/transactions/:id/approve`
- `PUT /api/transactions/:id/reject`
- `GET/PATCH /api/ledger`
- `GET/POST /api/cards/*`

---

## ตรรกะการกรองข้อมูล Backend

ทุก route จะตรวจ role จาก JWT token:

```js
// Pattern ที่ใช้ใน routes
const user = getUserFromReq(req);

// user role — กรองเฉพาะของตัวเอง
if (user.role !== 'admin' && user.role !== 'account') {
  filter.userId = user.id;
}
// admin/account — ดูทั้งหมด ไม่กรอง userId
```

---

## Impersonation (admin only)

Admin สามารถ "เข้าแทน" user คนอื่นได้ผ่าน `POST /api/auth/impersonate/:userId`  
- JWT ที่ได้จะมี `impersonatedBy` field
- Frontend จะแสดง `ImpersonationBanner` สีแดง
- ออกจาก impersonation ด้วยปุ่ม "หยุด Impersonate"
