const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

async function createTestUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // ลบ test user เดิมถ้ามี
    await User.deleteOne({ username: 'devsmart1' });
    
    // สร้าง test user ใหม่
    const hash = await bcrypt.hash('123456', 10);
    const testUser = new User({
      username: 'devsmart1',
      name: 'Dev SmartIdea',
      email: 'dev@smartidea.com',
      password: hash,
      role: 'admin'
    });
    
    await testUser.save();
    console.log('✅ Test user created successfully!');
    console.log('Username: devsmart1');
    console.log('Password: 123456');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createTestUser();