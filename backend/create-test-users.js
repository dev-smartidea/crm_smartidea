const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createTestUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // ลบ user ทดสอบเก่า (ถ้ามี)
    await User.deleteOne({ email: 'admin@test.com' });
    await User.deleteOne({ email: 'user@test.com' });
    await User.deleteOne({ username: 'admin' });
    await User.deleteOne({ username: 'testuser' });
    
    // สร้าง admin user
    const adminPassword = await bcrypt.hash('123456', 10);
    const admin = new User({
      username: 'admin',
      name: 'ผู้ดูแลระบบ',
      email: 'admin@test.com',
      password: adminPassword,
      role: 'admin'
    });
    await admin.save();
    
    // สร้าง user ทดสอบ
    const userPassword = await bcrypt.hash('123456', 10);
    const user = new User({
      username: 'user',
      name: 'ผู้ใช้ทดสอบ',
      email: 'user@test.com',
      password: userPassword,
      role: 'user'
    });
    await user.save();
    
    // สร้าง user สำหรับ demo
    const demoPassword = await bcrypt.hash('demo', 10);
    const demo = new User({
      username: 'demo',
      name: 'ผู้ใช้สาธิต',
      email: 'demo@test.com',
      password: demoPassword,
      role: 'user'
    });
    await demo.save();
    
    console.log('✅ สร้าง test users เรียบร้อย:');
    console.log('   Admin: admin / 123456 (role: admin)');
    console.log('   User:  user / 123456 (role: user)');
    console.log('   Demo:  demo / demo (role: user)');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createTestUser();