const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

async function resetUserPassword() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Reset password for user 'devsmart'
    const hash = await bcrypt.hash('123456', 10);
    const result = await User.updateOne(
      { username: 'devsmart' },
      { password: hash }
    );
    
    if (result.matchedCount > 0) {
      console.log('✅ Password reset successfully for user: devsmart');
      console.log('New password: 123456');
    } else {
      console.log('❌ User not found: devsmart');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetUserPassword();