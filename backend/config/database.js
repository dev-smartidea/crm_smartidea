const mongoose = require('mongoose');

let isConnecting = false;
let listenersRegistered = false;

const connectDB = async () => {
  if (isConnecting) {
    console.log('⏳ MongoDB connection already in progress...');
    return;
  }

  try {
    isConnecting = true;
    if (!process.env.MONGODB_URI) {
      console.warn('⚠️  MONGODB_URI not set — connecting to localhost fallback. Set MONGODB_URI in production!');
    }
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_smartidea', {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 75000,
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      heartbeatFrequencyMS: 30000,
    });
    console.log('✅ MongoDB connected successfully'); 
    isConnecting = false;
 
    // Register event handlers only once
    if (!listenersRegistered) {
      listenersRegistered = true;

      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err.message);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected! Attempting to reconnect in 5 seconds...');
        isConnecting = false;
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
    }

  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    isConnecting = false;
    console.log('🔄 Retrying connection in 10 seconds...');
    setTimeout(() => {
      connectDB().catch(e => console.error('Reconnection attempt failed:', e));
    }, 10000);
  }
};

module.exports = connectDB;
