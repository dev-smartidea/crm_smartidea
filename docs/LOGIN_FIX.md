# คำแนะนำแก้ไขปัญหา Login

## ปัญหาที่พบ
Frontend ไม่สามารถเชื่อมต่อกับ Backend ได้ (เช่น Login ไม่ผ่าน, API error)

## สาเหตุที่เป็นไปได้
1. Windows Firewall บล็อก port 5000 หรือ 3000
2. `REACT_APP_API_URL` ใน `frontend/.env` ไม่ตรงกับที่ backend รันอยู่
3. Backend ยังไม่ได้รัน หรือ crash ไป
4. CORS ไม่อนุญาต origin ของ frontend (ดู `allowedOrigins` ใน `backend/server.js`)

## วิธีแก้ไข (เลือก 1 วิธี)

### วิธีที่ 1: ใช้งานแค่เครื่องเดียว (แนะนำ)
1. แก้ไขไฟล์ `frontend/.env` ให้เป็น:
   ```
   REACT_APP_API_URL=http://localhost:5000
   ```

2. Restart frontend:
   ```bash
   cd d:\CRM\crm_smartidea\frontend
   npm start
   ```

3. เข้าใช้งานที่ `http://localhost:3000`

### วิธีที่ 2: ให้คนอื่นในเครือข่ายเข้าได้
1. เปิด PowerShell **ในฐานะ Administrator**

2. รันคำสั่งเปิด firewall:
   ```powershell
   netsh advfirewall firewall add rule name="Node.js Backend Port 5000" dir=in action=allow protocol=TCP localport=5000
   netsh advfirewall firewall add rule name="React Frontend Port 3000" dir=in action=allow protocol=TCP localport=3000
   ```

3. ตรวจสอบ IP ปัจจุบันของเครื่อง:
   ```powershell
   ipconfig | findstr "IPv4"
   ```

4. แก้ไข `frontend/.env` ให้ตรงกับ IP ที่ได้:
   ```
   REACT_APP_API_URL=http://<YOUR_IP>:5000
   ```

5. เพิ่ม IP ใน `allowedOrigins` ที่ `backend/server.js` (ถ้ายังไม่มี):
   ```js
   'http://<YOUR_IP>:3000'
   ```

6. Restart ทั้ง backend และ frontend:
   ```bash
   # Terminal 1
   cd d:\CRM\crm_smartidea\backend
   node server.js

   # Terminal 2
   cd d:\CRM\crm_smartidea\frontend
   npm start
   ```

## การตรวจสอบ
1. ทดสอบ backend: เปิด browser ไปที่ `http://localhost:5000/health` ควรได้ response สำเร็จ
2. ทดสอบ frontend: เปิด browser ไปที่ `http://localhost:3000`
3. เปิด DevTools (F12) > Console ดู error ถ้ามี CORS หรือ Network error
4. Login ด้วยบัญชีที่สมัครไว้
