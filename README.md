# 🏢 CRM SmartIdea

ระบบจัดการลูกค้าสัมพันธ์ (Customer Relationship Management) แบบ Full-Stack สำหรับการจัดการข้อมูลลูกค้า บริการ ธุรกรรม และรูปภาพ

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