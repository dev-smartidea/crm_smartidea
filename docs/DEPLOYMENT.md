# คู่มือ Deploy — CRM SmartIdea บน Render.com

> อัปเดตล่าสุด: พฤษภาคม 2026

โปรเจกต์นี้ deploy เป็น 2 service บน Render.com:
- **crm-backend** — Node.js/Express API (Web Service)
- **crm-frontend** — React (Static Site)

---

## ขั้นตอนที่ 1: เตรียม MongoDB Atlas

1. ไปที่ [https://cloud.mongodb.com](https://cloud.mongodb.com)
2. สร้าง Cluster ใหม่ (Free tier M0 ได้)
3. สร้าง Database User → จดชื่อ/รหัสผ่านไว้
4. ไปที่ **Network Access** → Add IP Address → `0.0.0.0/0` (allow all)
5. ไปที่ **Database** → Connect → Drivers → Copy connection string
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/crm_smartidea?retryWrites=true&w=majority
   ```

---

## ขั้นตอนที่ 2: เตรียม Cloudinary (สำหรับอัปโหลดรูป)

1. ไปที่ [https://cloudinary.com](https://cloudinary.com) → สมัคร free account
2. Dashboard → Copy `Cloud Name`, `API Key`, `API Secret`

---

## ขั้นตอนที่ 3: Deploy ด้วย Blueprint (แนะนำ)

### 3.1 Push `render.yaml` ขึ้น GitHub

ไฟล์ `render.yaml` อยู่ที่ root ของโปรเจกต์แล้ว

```bash
git add render.yaml
git commit -m "add render blueprint"
git push origin main
```

### 3.2 Import Blueprint ใน Render

1. ไปที่ [https://dashboard.render.com](https://dashboard.render.com)
2. คลิก **New** → **Blueprint**
3. เลือก repository `crm_smartidea`
4. Render จะอ่าน `render.yaml` และสร้าง 2 services อัตโนมัติ

---

## ขั้นตอนที่ 4: ตั้งค่า Environment Variables

ไปที่แต่ละ service → **Environment** → เพิ่มตัวแปรดังนี้:

### Backend (crm-backend)

| Variable | ค่า | หมายเหตุ |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://...` | จาก MongoDB Atlas |
| `JWT_SECRET` | random string ยาว | เช่น `openssl rand -base64 64` |
| `SESSION_SECRET` | random string ยาว | - |
| `CLOUDINARY_CLOUD_NAME` | จาก Cloudinary | - |
| `CLOUDINARY_API_KEY` | จาก Cloudinary | - |
| `CLOUDINARY_API_SECRET` | จาก Cloudinary | - |
| `FRONTEND_URL` | URL ของ crm-frontend | เพื่อตั้ง CORS |
| `NODE_ENV` | `production` | ตั้งไว้ใน render.yaml แล้ว |
| `PORT` | `5000` | optional — Render กำหนดให้อัตโนมัติ |

### Frontend (crm-frontend)

| Variable | ค่า | หมายเหตุ |
|---|---|---|
| `REACT_APP_API_URL` | URL ของ crm-backend | เช่น `https://crm-backend.onrender.com` |

> **หมายเหตุ:** `REACT_APP_API_URL` ต้องตั้งก่อน build — ถ้าตั้งหลัง build จะต้อง redeploy ใหม่

---

## ขั้นตอนที่ 5: Deploy Manual (ถ้าไม่ใช้ Blueprint)

### Backend

1. Render Dashboard → **New** → **Web Service**
2. Connect GitHub repo → เลือก `crm_smartidea`
3. ตั้งค่า:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Region:** Singapore
   - **Plan:** Free
4. เพิ่ม Environment Variables ตามตารางข้างต้น

### Frontend

1. Render Dashboard → **New** → **Static Site**
2. Connect GitHub repo → เลือก `crm_smartidea`
3. ตั้งค่า:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Publish Directory:** `build`
4. เพิ่ม **Rewrite Rule:** `/* → /index.html` (สำหรับ React Router)
5. เพิ่ม Environment Variable: `REACT_APP_API_URL`

---

## Auto Deploy

`render.yaml` ตั้ง `autoDeploy: true` — ทุกครั้งที่ `git push origin main` ระบบจะ deploy ให้อัตโนมัติ

ดู log การ deploy ได้ที่ Render Dashboard → service → **Logs**

---

## Health Check

Backend มี health check endpoint:
```
GET /health → 200 OK
```
Render ใช้ path นี้ตรวจสอบว่า service ยังทำงานอยู่

---

## ปัญหาที่พบบ่อย

### Frontend โหลดหน้าอื่นแล้ว 404
ตรวจสอบว่า Rewrite Rule ถูกตั้งไว้: `/* → /index.html`  
ใน `render.yaml` มีการตั้งค่านี้ไว้แล้วในส่วน `routes`

### Backend ติดต่อ MongoDB ไม่ได้
- ตรวจสอบ `MONGODB_URI` ว่าถูกต้อง
- ตรวจสอบ MongoDB Atlas Network Access ว่า allow `0.0.0.0/0`
- ดู log ใน Render → backend service → Logs

### CORS Error
- ตรวจสอบว่า `FRONTEND_URL` ใน backend ตรงกับ URL จริงของ frontend บน Render
- URL ต้องไม่มี trailing slash

### Frontend ไม่ connect API
- ตรวจสอบ `REACT_APP_API_URL` — ต้องเป็น URL ของ backend บน Render
- ต้องตั้งค่าก่อน build (environment variable ถูก embed ตอน `npm run build`)

---

## Render Free Tier ข้อจำกัด

| ข้อจำกัด | รายละเอียด |
|---|---|
| Spin down | Web service (free) จะ sleep หลังไม่มี request 15 นาที → request แรกอาจช้า ~30 วินาที |
| Build minutes | 500 นาที/เดือน |
| Bandwidth | 100 GB/เดือน |

> หากต้องการให้ไม่ sleep ควรอัปเกรดเป็น Starter plan ($7/เดือน)
