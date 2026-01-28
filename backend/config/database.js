const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/crm_smartidea';
    
    // ตั้งค่า connection options เพื่อความปลอดภัย
    const options = {
      // ใช้ parser และ engine ตัวใหม่
      // useNewUrlParser และ useUnifiedTopology เป็น default ใน Mongoose 6+
    };

    const conn = await mongoose.connect(mongoURI, options);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // ตรวจสอบการเชื่อมต่อสำเร็จ
    mongoose.connection.on('connected', () => {
      console.log('📡 Mongoose connected to MongoDB');
    });

    // ตรวจจับข้อผิดพลาดหลังเชื่อมต่อ
    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err);
    });

    // ตรวจจับการตัดการเชื่อมต่อ
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  Mongoose disconnected from MongoDB');
    });

    // ปิดการเชื่อมต่อเมื่อ process สิ้นสุด
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔌 Mongoose connection closed due to app termination');
      process.exit(0);
    });

  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('💡 Hint: ตรวจสอบว่า MongoDB กำลังทำงานหรือไม่ และ connection string ถูกต้อง');
    process.exit(1);
  }
};

module.exports = connectDB;
