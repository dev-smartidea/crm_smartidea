# โครงสร้างโปรเจค CRM SmartIdea

> อัปเดตล่าสุด: พฤษภาคม 2026

## โครงสร้างโฟลเดอร์

```
crm_smartidea/
├── backend/                          # Backend Node.js/Express
│   ├── config/
│   │   ├── database.js              # เชื่อมต่อ MongoDB + auto-reconnect
│   │   └── cloudinary.js            # ตั้งค่า Cloudinary สำหรับ upload รูป
│   ├── middleware/
│   │   └── auth.js                  # JWT authentication middleware
│   ├── models/                      # Mongoose schemas
│   │   ├── User.js                  # ผู้ใช้งาน (role: user/admin/account)
│   │   ├── Customer.js              # ลูกค้า
│   │   ├── Service.js               # บริการของลูกค้า (Google Ads / Facebook Ads)
│   │   ├── Transaction.js           # การโอนเงิน/ชำระค่าบริการ
│   │   ├── Activity.js              # กิจกรรมที่บันทึกไว้
│   │   ├── AuditLog.js              # บันทึก audit (admin action log)
│   │   ├── Card.js                  # บัตรเครดิต/ระบบตัดเงิน
│   │   ├── CardLedger.js            # สมุดบัญชีบัตร
│   │   ├── Notification.js          # การแจ้งเตือน
│   │   └── Image.js                 # รูปภาพที่อัปโหลด
│   ├── routes/                      # API route handlers
│   │   ├── authRoutes.js            # /api/auth — login, register, users
│   │   ├── customerRoutes.js        # /api/customers
│   │   ├── serviceRoutes.js         # /api/services + due-monthly
│   │   ├── transactionRoutes.js     # /api/transactions
│   │   ├── activityRoutes.js        # /api/activities
│   │   ├── auditRoutes.js           # /api/audit
│   │   ├── backupRoutes.js          # /api/backup
│   │   ├── cardRoutes.js            # /api/cards
│   │   ├── dashboardRoutes.js       # /api/dashboard
│   │   ├── imageRoutes.js           # /api/images
│   │   ├── ledgerRoutes.js          # /api/ledger
│   │   └── notificationRoutes.js   # /api/notifications
│   ├── uploads/                     # ไฟล์ที่อัปโหลดเก็บ local
│   │   ├── avatars/
│   │   ├── images/
│   │   └── slips/
│   ├── utils/
│   │   ├── auditLogger.js           # helper บันทึก AuditLog
│   │   └── statusScheduler.js       # cron อัปเดตสถานะ Service อัตโนมัติ
│   ├── server.js                    # Entry point
│   └── package.json
│
├── frontend/                        # Frontend React (CRA)
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.js                   # Router หลัก + route guards
│       ├── index.js
│       ├── assets/
│       │   └── styles/
│       │       ├── App.css
│       │       └── index.css
│       ├── components/              # Shared components
│       │   ├── DashboardLayout.js   # Sidebar layout สำหรับ user role
│       │   ├── AccountDashboardLayout.js  # Sidebar layout สำหรับ account role
│       │   ├── ProfileNavbar.js     # Top navbar
│       │   ├── ImpersonationBanner.js
│       │   ├── ActivityForm.js
│       │   ├── ActivityList.js
│       │   ├── BaseNotificationPage.js
│       │   ├── EditTransactionModal.js
│       │   └── ErrorBoundary.js
│       ├── context/
│       │   └── AuthContext.js       # JWT auth context
│       ├── hooks/
│       │   └── useNotificationSocket.js  # Socket.IO notification hook
│       ├── pages/
│       │   ├── auth/
│       │   │   └── LoginPage.js
│       │   ├── admin/               # เฉพาะ admin role
│       │   │   ├── AdminDashboardPage.js
│       │   │   └── AuditLogPage.js
│       │   ├── account/             # เฉพาะ account role
│       │   │   ├── AccountLedgerPage.js
│       │   │   ├── AccountCardsPage.js
│       │   │   ├── AccountCardLedgerPage.js
│       │   │   ├── AccountCardDailySummaryPage.js
│       │   │   ├── AccountFacebookPage.js
│       │   │   ├── AccountTransactionsPage.js
│       │   │   ├── AccountNotificationPage.js
│       │   │   ├── ApprovedTransactionsPage.js
│       │   │   └── RejectedTransactionsPage.js
│       │   ├── user/                # user + admin + account (shared)
│       │   │   ├── CustomerListPage.js
│       │   │   ├── CustomerDetailPage.js
│       │   │   ├── AddCustomerPage.js
│       │   │   ├── CustomerServicesPage.js
│       │   │   ├── CustomerActivitiesPage.js
│       │   │   ├── TransactionHistoryPage.js
│       │   │   ├── AllTransactionPage.js
│       │   │   ├── AllActivitiesPage.js
│       │   │   ├── SubmittedTransactionsPage.js
│       │   │   ├── DueCustomersPage.js  # ลูกค้าครบกำหนด (ทุก role)
│       │   │   ├── UserDetailPage.js
│       │   │   └── ProfilePage.js
│       │   └── shared/
│       └── utils/
│           ├── imageHelper.js
│           ├── toast.js
│           └── transactionHelpers.js
│
├── docs/                            # เอกสารประกอบ
│   ├── API_REFERENCE.md             # คู่มือ API endpoints ทั้งหมด
│   ├── DATA_MODELS.md               # โครงสร้าง data models และความสัมพันธ์
│   ├── ROLES_PERMISSIONS.md         # สิทธิ์การเข้าถึงของแต่ละ role
│   ├── DEPLOYMENT.md                # คู่มือ deploy ขึ้น Render.com
│   ├── LOGIN_FIX.md
│   └── NETWORK_SETUP.md
│
├── render.yaml                      # Render.com blueprint config
├── .gitignore
├── package.json
└── README.md
```

## Routes ใน App.js

| Path | Role | Component |
|---|---|---|
| `/login` | ทุกคน | LoginPage |
| `/dashboard` | user | DashboardLayout → pages/user/* |
| `/dashboard/due-customers` | user | DueCustomersPage |
| `/dashboard/admin` | admin | AdminDashboardPage |
| `/dashboard/admin/due-customers` | admin | DueCustomersPage |
| `/dashboard/admin/audit-log` | admin | AuditLogPage |
| `/dashboard/account` | account | AccountDashboardLayout → pages/account/* |
| `/dashboard/account/due-customers` | account | DueCustomersPage |

## การจัดโครงสร้างตามหมวดหมู่

### Backend
- **config/**: database connection + cloud storage config
- **middleware/**: JWT auth middleware
- **models/**: Mongoose schemas — ดูรายละเอียดใน [DATA_MODELS.md](docs/DATA_MODELS.md)
- **routes/**: REST API handlers — ดูรายละเอียดใน [API_REFERENCE.md](docs/API_REFERENCE.md)
- **utils/**: audit logger + cron scheduler

### Frontend
- **components/**: Layout + shared UI components
- **context/**: Auth state (JWT)
- **hooks/**: Custom hooks (socket notifications)
- **pages/admin/**: หน้าเฉพาะ admin
- **pages/account/**: หน้าเฉพาะ account
- **pages/user/**: หน้าที่ทุก role ใช้ร่วมกัน

### เอกสาร
- [README.md](README.md) — ติดตั้ง + รันโปรเจกต์
- [docs/ROLES_PERMISSIONS.md](docs/ROLES_PERMISSIONS.md) — สิทธิ์แต่ละ role
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md) — API endpoints
- [docs/DATA_MODELS.md](docs/DATA_MODELS.md) — โครงสร้าง data
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — deploy Render.com
