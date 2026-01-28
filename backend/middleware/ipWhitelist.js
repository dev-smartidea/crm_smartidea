// IP Whitelist Middleware
// ใช้สำหรับจำกัดการเข้าถึงเฉพาะ IP ภายในบริษัท

const allowedIPs = (process.env.ALLOWED_IPS || '').split(',').map(ip => ip.trim()).filter(ip => ip);

function ipWhitelist(req, res, next) {
  // ถ้าไม่ได้ตั้งค่า ALLOWED_IPS ให้ผ่านทุก request
  if (allowedIPs.length === 0) {
    return next();
  }

  // ดึง IP จาก request
  const clientIP = req.ip || 
                   req.headers['x-forwarded-for']?.split(',')[0].trim() || 
                   req.connection.remoteAddress;

  // ลบ ::ffff: prefix ถ้ามี (IPv6-mapped IPv4)
  const normalizedIP = clientIP.replace('::ffff:', '');

  // ตรวจสอบว่า IP อยู่ใน whitelist หรือไม่
  if (allowedIPs.includes(normalizedIP) || allowedIPs.includes('*')) {
    return next();
  }

  // บล็อก IP ที่ไม่ได้รับอนุญาต
  console.warn(`🚫 Blocked access from IP: ${normalizedIP}`);
  res.status(403).json({ 
    error: 'การเข้าถึงถูกปิดกั้น - IP ของคุณไม่ได้รับอนุญาต' 
  });
}

module.exports = ipWhitelist;
