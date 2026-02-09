const mongoose = require('mongoose');

let isConnecting = false;

const connectDB = async () => {
  if (isConnecting) {
    console.log('⏳ MongoDB connection already in progress...');
    return;
  }

  try {
    isConnecting = true;
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_smartidea', {
      serverSelectionTimeoutMS: 30000, // เพิ่มเวลา timeout
      socketTimeoutMS: 75000, // เพิ่มเวลา socket timeout
      maxPoolSize: 10, // จำนวน connection pool
      minPoolSize: 2,
      maxIdleTimeMS: 10000,
      heartbeatFrequencyMS: 10000, // ตรวจสอบ connection ทุก 10 วินาที
    });
    console.log('✅ MongoDB connected successfully');
    isConnecting = false;

    // เพิ่ม event handlers สำหรับ MongoDB connection
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected! Attempting to reconnect in 5 seconds...');
      isConnecting = false;
      // Auto reconnect หลัง 5 วินาที
      setTimeout(() => {
        if (mongoose.connection.readyState === 0) {
          console.log('🔄 Reconnecting to MongoDB...');
          connectDB().catch(err => console.error('Reconnection failed:', err));
        }
      }, 5000);
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully');
    });

    mongoose.connection.on('close', () => {
      console.log('🔌 MongoDB connection closed');
      isConnecting = false;
    });

  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    isConnecting = false;
    // ลอง reconnect อีกครั้งหลัง 10 วินาที แทนการ exit
    console.log('🔄 Retrying connection in 10 seconds...');
    setTimeout(() => {
      connectDB().catch(e => console.error('Reconnection attempt failed:', e));
    }, 10000);
  }
};

module.exports = connectDB;
