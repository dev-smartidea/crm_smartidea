# CRM SmartIdea

ระบบจัดการลูกค้าสัมพันธ์ (CRM) แบบ Full-Stack สำหรับติดตามลูกค้า บริการโฆษณา (Google Ads / Facebook Ads / เว็บไซต์) ธุรกรรมการเงิน และบัตรเติมเงิน

---

## เทคโนโลยี

### Frontend

| Package | Version | หน้าที่ |
|---|---|---|
| React | 19.1.0 | UI Library |
| React Router DOM | 7.x | Routing |
| Axios | 1.x | HTTP Client |
| Chart.js + react-chartjs-2 | 4.x | กราฟสถิติ |
| Bootstrap | 5.x | UI Framework |
| react-bootstrap-icons | 1.x | Icons |
| socket.io-client | 4.x | Real-time notifications |

### Backend

| Package | Version | หน้าที่ |
|---|---|---|
| Express | 5.1.0 | Web Server |
| Mongoose | 8.x | MongoDB ODM |
| jsonwebtoken | 9.x | JWT Authentication |
| bcryptjs | 3.x | เข้ารหัสรหัสผ่าน |
| Multer | 2.x | รับไฟล์ upload |
| Cloudinary | 2.x | เก็บรูปภาพ |
| socket.io | 4.x | Real-time events |
| helmet | 8.x | Security headers |
| express-rate-limit | 8.x | Rate limiting |
| express-validator | 7.x | Input validation |

---

## บทบาทผู้ใช้ (Roles)

| Role | สิทธิ์ |
|---|---|
| `user` | เห็นเฉพาะ customer / service ของตัวเอง |
| `admin` | เห็นและจัดการทุกอย่าง |
| `google_manager` | เห็นเฉพาะ Google Ads scope |
| `facebook_manager` | เห็นเฉพาะ Facebook Ads scope |
| `account` | ทีมบัญชี — อนุมัติ/ปฏิเสธ transaction |

---

## โครงสร้างโปรเจกต์

```
crm_smartidea/
├── backend/
│   ├── config/
│   │   ├── cloudinary.js       # Cloudinary setup
│   │   └── database.js         # MongoDB connection
│   ├── middleware/
│   │   └── auth.js             # JWT auth middleware
│   ├── models/                 # Mongoose schemas (ดู models/README.md)
│   │   ├── README.md
│   │   ├── User.js
│   │   ├── Customer.js
│   │   ├── Service.js
│   │   ├── Transaction.js
│   │   ├── Card.js
│   │   ├── CardLedger.js
│   │   ├── Activity.js
│   │   ├── Notification.js
│   │   ├── Image.js
│   │   └── AuditLog.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── customerRoutes.js
│   │   ├── serviceRoutes.js
│   │   ├── transactionRoutes.js
│   │   ├── ledgerRoutes.js
│   │   ├── cardRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── notificationRoutes.js
│   │   ├── activityRoutes.js
│   │   ├── imageRoutes.js
│   │   ├── auditRoutes.js
│   │   └── backupRoutes.js
│   ├── utils/
│   │   ├── auditLogger.js
│   │   └── statusScheduler.js  # อัปเดต service status ทุก 1 ชั่วโมง
│   ├── uploads/                # ไฟล์ legacy (avatar, slip)
│   ├── socket.js               # Socket.io setup
│   └── server.js               # Entry point
│
├── frontend/
│   └── src/
│       ├── components/         # Shared components
│       ├── context/
│       │   └── AuthContext.js
│       ├── hooks/
│       │   └── useNotificationSocket.js
│       ├── pages/
│       │   ├── admin/          # หน้า admin
│       │   ├── account/        # หน้าทีมบัญชี
│       │   ├── user/           # หน้า user ทั่วไป
│       │   ├── auth/           # Login
│       │   └── shared/         # หน้าร่วม
│       ├── utils/
│       ├── App.js
│       └── index.js
│
├── docs/                       # เอกสารเพิ่มเติม
├── render.yaml                 # Render.com deployment config
└── README.md
```

---

## ติดตั้งและรัน (Local Development)

### 1. Clone

```bash
git clone https://github.com/dev-smartidea/crm_smartidea.git
cd crm_smartidea
```

### 2. ติดตั้ง dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. ตั้งค่า Environment Variables

สร้างไฟล์ `backend/.env`:

```env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/crm_smartidea

PORT=5000
NODE_ENV=development

JWT_SECRET=your_jwt_secret_here

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

FRONTEND_URL=http://localhost:3000
# ALLOWED_ORIGINS=http://192.168.x.x:3000   # เพิ่ม IP LAN ถ้าต้องการ

# ปิด rate limit ใน dev (optional)
# DISABLE_RATE_LIMIT=1
```

### 4. รัน

เปิด 2 terminal:

```bash
# Terminal 1 — Backend (port 5000)
cd backend
npm start

# Terminal 2 — Frontend (port 3000)
cd frontend
npm start
```

เข้าใช้งานที่ `http://localhost:3000`

### รันใน LAN (เข้าจากมือถือหรือเครื่องอื่นในวง)

```bash
cd frontend
npm run start:lan
```

---

## API Endpoints หลัก

| Method | Path | หน้าที่ |
|---|---|---|
| POST | `/api/auth/login` | เข้าสู่ระบบ |
| GET | `/api/auth/me` | ข้อมูล user ปัจจุบัน |
| GET | `/api/customers` | รายชื่อลูกค้า |
| GET | `/api/customers/:id/services` | บริการของลูกค้า |
| GET | `/api/services` | บริการทั้งหมด |
| GET | `/api/transactions` | รายการธุรกรรม |
| GET | `/api/ledger` | บัญชีเดินสะพัด (approved) |
| GET | `/api/dashboard/summary` | สรุปสถิติ dashboard |
| GET | `/api/cards` | บัตรเติมเงิน |
| GET | `/api/notifications` | การแจ้งเตือน |

> เอกสาร API เต็ม: [docs/API_REFERENCE.md](./docs/API_REFERENCE.md)

---

## Deploy (Render.com)

โปรเจกต์นี้ตั้งค่า `render.yaml` ไว้แล้ว ใช้ Blueprint deploy:

1. Push code ขึ้น GitHub
2. Render Dashboard → **Blueprints** → Import Repository
3. ตั้ง Environment Variables ใน Render Dashboard:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
   - `FRONTEND_URL` (URL ของ frontend service บน Render)

Services ที่ deploy:
- **crm-backend** — Node.js Web Service (Singapore)
- **crm-frontend** — Static Site (Singapore)

---

## เอกสารเพิ่มเติม

| ไฟล์ | เนื้อหา |
|---|---|
| [backend/models/README.md](./backend/models/README.md) | Schema ทุก model พร้อม field reference |
| [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) | API endpoints ทั้งหมด |
| [docs/ROLES_PERMISSIONS.md](./docs/ROLES_PERMISSIONS.md) | สิทธิ์แต่ละ role |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | คู่มือ deploy |
| [docs/NETWORK_SETUP.md](./docs/NETWORK_SETUP.md) | ตั้งค่าเครือข่าย LAN |

---

## แก้ปัญหาที่พบบ่อย

**Port ถูกใช้งานแล้ว (Windows)**
```bash
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

**ติดตั้ง dependencies ไม่ได้**
```bash
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install
```

**เชื่อมต่อ MongoDB ไม่ได้**
- ตรวจสอบ `MONGODB_URI` ใน `.env`
- ตรวจสอบ IP Whitelist ใน MongoDB Atlas (Network Access)

**CORS Error**
- เพิ่ม URL ใน `ALLOWED_ORIGINS` ใน `.env` ของ backend

---

**Repository:** [github.com/dev-smartidea/crm_smartidea](https://github.com/dev-smartidea/crm_smartidea)