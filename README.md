## CRM SmartIdea

ระบบจัดการลูกค้าสัมพันธ์ (CRM) แบบ Full-Stack สำหรับธุรกิจที่ต้องการติดตามลูกค้า บริการโฆษณา (Google/Facebook/เว็บไซต์) การเงิน และบัตรเติมเงิน

---

## สรุปความสามารถหลัก
- ติดตามข้อมูลลูกค้าและบริการ (Service)
- บันทึกและจัดการธุรกรรมการเงิน (Transactions)
- ระบบบัตรเติมเงินและสมุดบัญชี (Card / Ledger)
- แจ้งเตือนแบบเรียลไทม์ผ่าน WebSocket
- การยืนยันตัวตนด้วย JWT และบทบาทผู้ใช้

---

## สแต็คเทคโนโลยี (โดยย่อ)

Frontend: React, React Router, Axios, Chart.js, Bootstrap, socket.io-client

Backend: Node.js, Express, MongoDB (Mongoose), JWT, bcryptjs, multer, Cloudinary, socket.io

รายละเอียดรุ่นแพ็กเกจอาจอยู่ใน `package.json` แต่ละโฟลเดอร์ (backend/frontend)

---

## บทบาทผู้ใช้ (ตัวอย่าง)
- `user` — เข้าถึงข้อมูลลูกค้าและบริการของตนเอง
- `admin` — สิทธิ์จัดการระบบทั้งหมด
- `google_manager`, `facebook_manager` — ขอบเขตการเข้าถึงเฉพาะแพลตฟอร์มโฆษณา
- `account` — ทีมบัญชีสำหรับอนุมัติ/จัดการธุรกรรม

---

## โครงสร้างโปรเจกต์ (ย่อ)

See project tree: backend/ (API, models, routes, utils), frontend/ (React app), docs/, render.yaml

ไฟล์สำคัญ:
- `backend/server.js` — entry point ของ backend
- `backend/config/database.js` — การเชื่อมต่อ MongoDB
- `backend/routes/*` — จุดเชื่อมต่อ API
- `frontend/src/` — โค้ดฝั่ง client

---

## ติดตั้งและรัน (สำหรับพัฒนาแบบ Local)

1) โคลนรีโพ

```bash
git clone https://github.com/dev-smartidea/crm_smartidea.git
cd crm_smartidea
```

2) ติดตั้ง dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

3) ตั้งค่า Environment (สร้าง `backend/.env`)

ตัวอย่าง `backend/.env`:

```env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/crm_smartidea
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
FRONTEND_URL=http://localhost:3000
# (ถ้าต้องการ) ALLOWED_ORIGINS=http://192.168.x.x:3000
```

4) รันแอป

```bash
# Terminal 1 — backend
cd backend
npm start

# Terminal 2 — frontend
cd frontend
npm start
```

เข้าที่: http://localhost:3000

หากต้องการรันหน้า frontend ให้เข้าถึงจาก LAN:

```bash
cd frontend
npm run start:lan
```

---

## Endpoints ที่ใช้บ่อย (ตัวอย่าง)

- POST `/api/auth/login` — เข้าสู่ระบบ
- GET `/api/auth/me` — ข้อมูลผู้ใช้ปัจจุบัน
- GET `/api/customers` — รายชื่อลูกค้า
- GET `/api/customers/:id/services` — บริการของลูกค้า
- GET `/api/services` — บริการทั้งหมด
- GET `/api/transactions` — ธุรกรรม
- GET `/api/ledger` — บัญชีเดินสะพัด
- GET `/api/dashboard/summary` — สถิติ dashboard
- GET `/api/cards` — บัตรเติมเงิน
- GET `/api/notifications` — แจ้งเตือน

เอกสาร API แบบละเอียดอยู่ที่: [docs/API_REFERENCE.md](./docs/API_REFERENCE.md)

---

## Deploy (Render.com)

โปรเจกต์มี `render.yaml` สำหรับใช้งานกับ Render Blueprints — ขั้นตอนโดยย่อ:
1. Push โค้ดขึ้น GitHub
2. Import repository ใน Render → Blueprints
3. ตั้ง Environment Variables ใน Render (เช่น `MONGODB_URI`, `JWT_SECRET`, `CLOUDINARY_*`, `FRONTEND_URL`)

---

## เอกสารเพิ่มเติม
- [backend/models/README.md](./backend/models/README.md) — รายละเอียด schema
- [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) — API ทั้งหมด
- [docs/ROLES_PERMISSIONS.md](./docs/ROLES_PERMISSIONS.md) — สิทธิ์ผู้ใช้
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — คู่มือ deploy

---

## ปัญหาทั่วไป และวิธีแก้ไขสั้น ๆ

- หากพอร์ต 5000 ถูกใช้งาน (Windows):

```bash
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

- หากติดตั้ง dependencies ล้มเหลว:

```bash
rm -rf node_modules package-lock.json
npm install
```

- หากเชื่อมต่อ MongoDB ไม่ได้: ตรวจสอบ `MONGODB_URI` และ IP whitelist ใน MongoDB Atlas
- หากมี CORS error: เพิ่ม URL frontend ใน `ALLOWED_ORIGINS` ของ backend

---

Repository: https://github.com/dev-smartidea/crm_smartidea
