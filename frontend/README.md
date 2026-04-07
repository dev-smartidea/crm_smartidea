# CRM SmartIdea — Frontend

ระบบจัดการลูกค้าสัมพันธ์ (CRM) สร้างด้วย React 19 + Bootstrap 5

## เทคโนโลยีที่ใช้

- **React** 19.1.0 + React Router 7
- **Bootstrap** 5.3 + React Bootstrap Icons
- **Chart.js** + react-chartjs-2 (กราฟ Dashboard)
- **Axios** (เรียก API)
- **Socket.io Client** (การแจ้งเตือนแบบ real-time)

## โครงสร้างโปรเจค

```
src/
├── assets/          # รูปภาพ, CSS หลัก
├── components/      # Component ที่ใช้ร่วมกัน
│   ├── BaseNotificationPage.js
│   ├── DashboardLayout.js
│   ├── AccountDashboardLayout.js
│   ├── EditTransactionModal.js
│   ├── ProfileNavbar.js
│   ├── ActivityForm.js
│   └── ActivityList.js
├── context/         # React Context (AuthContext)
├── hooks/           # Custom Hooks (useNotificationSocket)
├── pages/
│   ├── auth/        # Login, Register
│   ├── admin/       # จัดการผู้ใช้ (Admin)
│   ├── account/     # จัดการบัตร, Ledger, ธุรกรรม (Account)
│   ├── shared/      # Dashboard, แจ้งเตือน, แกลเลอรี่ (ใช้ร่วม)
│   └── user/        # ลูกค้า, บริการ, ธุรกรรม (User)
├── utils/           # Helpers (toast, imageHelper, transactionHelpers)
├── App.js           # Routes + Auth
└── index.js         # Entry point
```

## บทบาทผู้ใช้ (Roles)

| Role | เข้าถึง |
|------|---------|
| **admin** | จัดการผู้ใช้, กำหนด role |
| **account** | บัตร, Ledger, อนุมัติ/ปฏิเสธธุรกรรม, สรุปรายวัน |
| **user** | ลูกค้า, บริการ, สร้างธุรกรรม, กิจกรรม |

## คำสั่งที่ใช้ได้

### `npm start`
รันในโหมด development ที่ [http://localhost:3000](http://localhost:3000)

### `npm run start:lan`
รันแบบเปิดให้เครื่องอื่นในวง LAN เข้าถึงได้

### `npm run build`
Build สำหรับ production ไปที่โฟลเดอร์ `build/`

### `npm test`
รัน test runner

## ตั้งค่า Environment

สร้างไฟล์ `.env` ใน `frontend/`:

```
REACT_APP_API_URL=http://localhost:5000
```
