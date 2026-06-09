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


---

## 🚀 เทคโนโลยีที่ใช้

### Frontend
* **React** (v19.1.0) - UI Library
* **React Router DOM** - การจัดการเส้นทาง
* **Axios** - HTTP Client
* **Chart.js & Recharts** - แสดงกราฟและสถิติ
* **Bootstrap** - UI Framework
* **JWT Decode** - การจัดการ Authentication

### Backend
* **Node.js & Express.js** (v5.1.0) - Web Server
* **MongoDB & Mongoose** - ฐานข้อมูล
* **JWT (jsonwebtoken)** - Authentication
* **bcryptjs** - เข้ารหัสรหัสผ่าน
* **Multer** - อัพโหลดไฟล์
* **CORS** - Cross-Origin Resource Sharing

---

## 📋 ความต้องการของระบบ (Prerequisites)

ก่อนเริ่มติดตั้ง ต้องมีโปรแกรมเหล่านี้ติดตั้งในเครื่องของคุณ:

- **Node.js** (เวอร์ชัน 14.x ขึ้นไปแนะนำ) - [ดาวน์โหลด](https://nodejs.org/)
- **MongoDB** - [ดาวน์โหลด](https://www.mongodb.com/try/download/community) หรือใช้ MongoDB Atlas (Cloud)
- **Git** - [ดาวน์โหลด](https://git-scm.com/)
- **npm** หรือ **yarn** (มาพร้อม Node.js)

---

## ⚙️ วิธีการติดตั้งและรันโปรเจกต์

### 1. Clone Repository

```bash
git clone https://github.com/dev-smartidea/crm_smartidea.git
cd crm_smartidea
```

### 2. ติดตั้ง Dependencies

#### ติดตั้ง Root Dependencies (ถ้ามี)
```bash
npm install
```

#### ติดตั้ง Backend Dependencies
```bash
cd backend
npm install
```

#### ติดตั้ง Frontend Dependencies
```bash
cd ../frontend
npm install
```

### 3. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` ในโฟลเดอร์ `backend` และตั้งค่าตามที่ต้องการ:

```env
# Database Configuration
MONGODB_URI=your_mongodb_connection_string

# Server Configuration
PORT=5000

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# Session Configuration
SESSION_SECRET=your_session_secret_key
```

> **หมายเหตุ:** กรุณาติดต่อผู้ดูแลระบบเพื่อขอค่า configuration ที่ถูกต้อง หรือตั้งค่าของคุณเองสำหรับการพัฒนา

### 4. เริ่มต้น MongoDB

ตรวจสอบให้แน่ใจว่า MongoDB service กำลังทำงานอยู่ ตามวิธีการติดตั้งของคุณ

### 5. รันแอปพลิเคชัน

#### วิธีที่ 1: รันแยกกัน (แนะนำสำหรับการพัฒนา)

เปิด Terminal 2 หน้าต่าง:

**Terminal 1 - รัน Backend:**
```bash
cd backend
npm start
```
Backend จะรันที่ `http://localhost:5000`

**Terminal 2 - รัน Frontend:**
```bash
cd frontend
npm start
```
Frontend จะรันที่ `http://localhost:3000` และเปิดในเบราว์เซอร์โดยอัตโนมัติ

#### วิธีที่ 2: รันพร้อมกัน (ถ้ามี script)

```bash
# ที่ root directory
npm start
```

### 6. เข้าใช้งานแอปพลิเคชัน

เปิดเบราว์เซอร์และไปที่:
- **Frontend:** `http://localhost:3000`
- **Backend API:** `http://localhost:5000`

---

## 🎯 ฟีเจอร์หลัก

- 👤 **การจัดการผู้ใช้:** ลงทะเบียน, เข้าสู่ระบบ, โปรไฟล์
- 👥 **การจัดการลูกค้า:** เพิ่ม, แก้ไข, ลบ, ดูรายละเอียดลูกค้า
- 🛠️ **การจัดการบริการ:** บริการที่ให้กับลูกค้าแต่ละราย
- 💰 **ประวัติธุรกรรม:** บันทึกและติดตามธุรกรรมทางการเงิน
- 🖼️ **แกลเลอรีรูปภาพ:** อัพโหลดและจัดการรูปภาพ
- 📊 **Dashboard:** สรุปสถิติและข้อมูลสำคัญ
- 🔔 **การแจ้งเตือน:** ระบบแจ้งเตือนภายในแอป
- 🔐 **ความปลอดภัย:** JWT Authentication & Authorization

---

## 📁 โครงสร้างโปรเจกต์

```
crm_smartidea/
├── backend/
│   ├── config/         # การตั้งค่าฐานข้อมูล
│   ├── middleware/     # Authentication middleware
│   ├── models/         # MongoDB Models (User, Customer, Service, etc.)
│   ├── routes/         # API Routes
│   ├── uploads/        # ไฟล์ที่อัพโหลด (avatars, images)
│   ├── utils/          # Helper functions
│   └── server.js       # Express server entry point
│
├── frontend/
│   ├── public/         # Static files
│   └── src/
│       ├── components/ # React Components (Sidebar, Navbar, etc.)
│       ├── pages/      # React Pages
│       ├── context/    # React Context (AuthContext)
│       ├── assets/     # Images, styles
│       ├── App.js      # Main App component
│       └── index.js    # Entry point
│
└── docs/              # เอกสารเพิ่มเติม
```

---

## 🔧 คำสั่งที่ใช้บ่อย

### Backend
```bash
# รัน Backend server
npm start

# รัน Backend ในโหมด development (ถ้ามี nodemon)
npm run dev
```

### Frontend
```bash
# รัน Frontend development server
npm start

# Build สำหรับ production
npm run build

# รัน tests
npm test
```

---

## 🛑 หยุดการทำงาน

กด `Ctrl + C` ใน Terminal ที่รัน Backend/Frontend

---

## 🐛 แก้ไขปัญหาที่พบบ่อย

### ปัญหา: Port ถูกใช้งานอยู่แล้ว
```bash
# ค้นหา process ที่ใช้ port (Windows)
netstat -ano | findstr :3000
netstat -ano | findstr :5000

# Kill process (แทน PID ด้วยเลข process ID)
taskkill /PID <PID> /F
```

### ปัญหา: ติดตั้ง dependencies ไม่สำเร็จ
```bash
# ลบ node_modules และติดตั้งใหม่
rm -rf node_modules package-lock.json
npm install
```

### ปัญหา: เชื่อมต่อ MongoDB ไม่ได้
- ตรวจสอบว่า MongoDB service ทำงานอยู่
- ตรวจสอบค่า configuration ในไฟล์ `.env`
- ตรวจสอบสิทธิ์การเข้าถึงฐานข้อมูล

### ปัญหา: CORS Error
- ตรวจสอบการตั้งค่า CORS ในฝั่ง Backend
- ตรวจสอบ URL ที่ Frontend เรียก API

---

## 📚 เอกสารเพิ่มเติม

- [LOGIN_FIX.md](./docs/LOGIN_FIX.md) - คำแนะนำการแก้ไขปัญหา Login
- [NETWORK_SETUP.md](./docs/NETWORK_SETUP.md) - การตั้งค่าเครือข่าย

---

## 🤝 การมีส่วนร่วม (Contributing)

หากต้องการมีส่วนร่วมในโปรเจกต์:

1. Fork โปรเจกต์
2. สร้าง Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit การเปลี่ยนแปลง (`git commit -m 'Add some AmazingFeature'`)
4. Push ไปยัง Branch (`git push origin feature/AmazingFeature`)
5. เปิด Pull Request

---

## 📄 License

This project is licensed under the ISC License

---

## 👨‍💻 ผู้พัฒนา

- **GitHub:** [dev-smartidea](https://github.com/dev-smartidea)
- **Repository:** [crm_smartidea](https://github.com/dev-smartidea/crm_smartidea)

---

## 📧 ติดต่อ & สนับสนุน

หากมีคำถามหรือพบปัญหา สามารถเปิด Issue ใน GitHub Repository หรือติดต่อผ้พัฒนาโดยตรง

---

**Happy Coding! 🚀**