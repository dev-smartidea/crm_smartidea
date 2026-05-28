# backend/config

โฟลเดอร์นี้เก็บไฟล์ configuration สำหรับ service ภายนอกที่ backend ใช้งาน

---

## ไฟล์ทั้งหมด

### `cloudinary.js`
กำหนดค่าและ export helper function สำหรับอัปโหลดไฟล์ไปยัง **Cloudinary**

**Environment Variables ที่ต้องกำหนด:**
| ตัวแปร | คำอธิบาย |
|--------|-----------|
| `CLOUDINARY_CLOUD_NAME` | ชื่อ Cloud ของบัญชี Cloudinary |
| `CLOUDINARY_API_KEY` | API Key จาก Cloudinary Dashboard |
| `CLOUDINARY_API_SECRET` | API Secret จาก Cloudinary Dashboard |

**Export:**
- `uploadToCloudinary(buffer, options)` — อัปโหลดไฟล์จาก Buffer ไปยัง Cloudinary
  - `options.folder` — โฟลเดอร์ปลายทางใน Cloudinary (default: `crm_smartidea`)
- `cloudinary` — instance ของ Cloudinary v2 (สำหรับใช้งานต่อ)

---

### `database.js`
เชื่อมต่อ **MongoDB** ผ่าน Mongoose พร้อม connection pooling และ auto-reconnect

**Environment Variables ที่ต้องกำหนด:**
| ตัวแปร | คำอธิบาย |
|--------|-----------|
| `MONGODB_URI` | MongoDB connection string (default: `mongodb://localhost:27017/crm_smartidea`) |

**Connection Options:**
| Option | ค่า | คำอธิบาย |
|--------|-----|-----------|
| `serverSelectionTimeoutMS` | 30,000 | timeout การเลือก server |
| `socketTimeoutMS` | 75,000 | timeout ของ socket |
| `maxPoolSize` | 10 | connection pool สูงสุด |
| `minPoolSize` | 2 | connection pool ขั้นต่ำ |
| `maxIdleTimeMS` | 30,000 | เวลา idle สูงสุดก่อนปิด connection |
| `heartbeatFrequencyMS` | 30,000 | ความถี่ตรวจสอบ connection |

**Export:**
- `connectDB()` — เชื่อมต่อ MongoDB, ป้องกัน duplicate connection ด้วย `isConnecting` flag

---

## การใช้งาน

```js
// database.js
const connectDB = require('./config/database');
await connectDB();

// cloudinary.js
const { uploadToCloudinary } = require('./config/cloudinary');
const result = await uploadToCloudinary(fileBuffer, { folder: 'avatars' });
```
