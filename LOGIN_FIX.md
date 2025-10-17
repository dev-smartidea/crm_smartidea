# คำแนะนำแก้ไขปัญหา Login

## ปัญหาที่พบ
Frontend ไม่สามารถเชื่อมต่อกับ Backend ผ่าน network IP (192.168.1.228:5000) ได้

## สาเหตุ
1. Windows Firewall บล็อก port 5000
2. Backend ต้องการสิทธิ์ admin เพื่อเปิด firewall

## วิธีแก้ไข (เลือก 1 วิธี)

### วิธีที่ 1: ใช้งานแค่เครื่องเดียว (แนะนำ)
1. แก้ไขไฟล์ `frontend/.env` ให้เป็น:
   ```
   REACT_APP_API_URL=http://localhost:5000
   ```

2. Restart frontend:
   ```bash
   cd C:\Users\ThisPC\Desktop\crm_smartidea\frontend
   npm start
   ```

3. เข้าใช้งานที่ `http://localhost:3000`

### วิธีที่ 2: ให้คนอื่นในเครือข่ายเข้าได้
1. เปิด Command Prompt หรือ PowerShell **ในฐานะ Administrator**

2. รันคำสั่งเปิด firewall:
   ```powershell
   netsh advfirewall firewall add rule name="Node.js Backend Port 5000" dir=in action=allow protocol=TCP localport=5000
   netsh advfirewall firewall add rule name="React Frontend Port 3000" dir=in action=allow protocol=TCP localport=3000
   ```

3. Restart backend:
   ```bash
   cd C:\Users\ThisPC\Desktop\crm_smartidea\backend
   node server.js
   ```

4. แก้ไข `frontend/.env` กลับเป็น:
   ```
   REACT_APP_API_URL=http://192.168.1.228:5000
   ```

5. Restart frontend:
   ```bash
   cd C:\Users\ThisPC\Desktop\crm_smartidea\frontend
   npm start
   ```

## บัญชีทดสอบ
- Username: `user` Password: `123456`
- Username: `admin` Password: `123456`
- Username: `demo` Password: `demo`

## การตรวจสอบ
1. ทดสอบ backend: เปิด browser ไปที่ `http://localhost:5000` ควรเห็น "🎉 Backend CRM is working"
2. ทดสอบ frontend: เปิด browser ไปที่ `http://localhost:3000`
3. Login ด้วยบัญชีทดสอบ
