const jwt = require('jsonwebtoken');

// ตรวจสอบว่า JWT_SECRET ถูกตั้งค่าหรือไม่
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your_jwt_secret_key_here') {
  console.error('⚠️  WARNING: JWT_SECRET is not set or using default value! This is a security risk!');
  console.error('⚠️  Please set a strong JWT_SECRET in your .env file');
  process.exit(1); // หยุดการทำงานถ้าไม่ได้ตั้ง JWT_SECRET
}

// Middleware สำหรับตรวจสอบ JWT token
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { authMiddleware };
