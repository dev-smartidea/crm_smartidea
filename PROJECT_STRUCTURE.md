# โครงสร้างโปรเจค CRM SmartIdea

## โครงสร้างโฟลเดอร์

```
crm_smartidea/
├── backend/                    # Backend Node.js/Express
│   ├── config/                # ไฟล์ configuration
│   │   └── database.js       # การเชื่อมต่อ MongoDB
│   ├── middleware/            # Express middlewares
│   │   └── auth.js           # Authentication middleware
│   ├── models/                # Mongoose models
│   │   ├── Customer.js
│   │   ├── Service.js
│   │   ├── Transaction.js
│   │   ├── User.js
│   │   ├── Image.js
│   │   └── NotificationRead.js
│   ├── routes/                # API routes
│   │   ├── authRoutes.js
│   │   ├── customerRoutes.js
│   │   ├── serviceRoutes.js
│   │   ├── transactionRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── notificationRoutes.js
│   │   └── imageRoutes.js
│   ├── uploads/               # ไฟล์ที่อัพโหลด
│   │   ├── avatars/
│   │   └── images/
│   ├── utils/                 # Helper functions
│   ├── .env                   # Environment variables
│   ├── package.json
│   └── server.js              # Entry point
│
├── frontend/                   # Frontend React
│   ├── public/                # Static files
│   └── src/
│       ├── assets/            # Assets (images, styles)
│       │   ├── images/       # รูปภาพ
│       │   └── styles/       # CSS files
│       │       ├── App.css
│       │       └── index.css
│       ├── components/        # React components
│       │   ├── DashboardLayout.js
│       │   ├── Sidebar.js
│       │   ├── ProfileNavbar.js
│       │   ├── CustomerList.js
│       │   ├── CustomerDetail.js
│       │   └── CustomerForm.js
│       ├── context/           # React Context
│       │   └── AuthContext.js
│       ├── pages/             # Page components
│       │   ├── LoginPage.js
│       │   ├── DashboardPage.js
│       │   ├── CustomerListPage.js
│       │   ├── CustomerServicesPage.js
│       │   ├── TransactionHistoryPage.js
│       │   ├── ImageGalleryPage.js
│       │   ├── NotificationPage.js
│       │   └── ProfilePage.js
│       ├── App.js             # Main App component
│       └── index.js           # Entry point
│
├── docs/                       # เอกสารประกอบ
│   ├── LOGIN_FIX.md
│   └── NETWORK_SETUP.md
│
├── .gitignore
├── package.json                # Root package.json
└── README.md                   # คู่มือหลัก
```

## การจัดโครงสร้างตามหมวดหมู่

### Backend
- **config/**: ไฟล์ configuration และการตั้งค่า
- **middleware/**: Express middleware functions
- **models/**: Database models (Mongoose schemas)
- **routes/**: API endpoint handlers
- **uploads/**: ไฟล์ที่ผู้ใช้อัพโหลด
- **utils/**: Helper functions และ utilities

### Frontend
- **assets/**: Static assets (รูปภาพ, CSS, fonts)
- **components/**: Reusable React components
- **context/**: React Context สำหรับ state management
- **pages/**: Page-level components
- **App.js**: Main application component
- **index.js**: Application entry point

### Root
- **docs/**: เอกสารประกอบและคู่มือ
- **README.md**: คู่มือหลักของโปรเจค
