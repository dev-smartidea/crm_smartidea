const cron = require('node-cron');
const Transaction = require('../models/Transaction');
const Image = require('../models/Image');
const { deleteFromCloudinary } = require('../config/cloudinary');

/**
 * Cleanup Script: ลบรูปสลิปที่อายุเกิน 90 วัน
 * - ลบรูปจาก Cloudinary
 * - ลบรูปจาก Image gallery
 * - Clear ข้อมูลใน Transaction (แต่เก็บข้อมูล transaction ไว้)
 */

// ฟังก์ชันหลักสำหรับลบรูปสลิปเก่า
async function cleanupOldSlips() {
  try {
    console.log('\n🧹 [Cleanup] Starting slip cleanup process...');
    
    // คำนวณวันที่ 90 วันที่แล้ว
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    console.log(`📅 [Cleanup] Looking for transactions older than: ${ninetyDaysAgo.toISOString()}`);
    
    // ค้นหา Transaction ที่มีอายุเกิน 90 วัน และยังมีรูปสลิปอยู่
    const oldTransactions = await Transaction.find({
      createdAt: { $lt: ninetyDaysAgo },
      $or: [
        { slipImage: { $ne: null } },
        { slipImage2: { $ne: null } }
      ]
    }).select('_id slipImage slipImage2 cloudinaryId cloudinaryId2 amount createdAt');
    
    if (oldTransactions.length === 0) {
      console.log('✅ [Cleanup] No old slips to clean up');
      return;
    }
    
    console.log(`🔍 [Cleanup] Found ${oldTransactions.length} transactions with old slips`);
    
    // รวบรวม IDs และ URLs สำหรับ batch operations
    const cloudinaryIds = [];
    const imageUrls = [];
    const transactionIds = [];
    
    for (const tx of oldTransactions) {
      if (tx.cloudinaryId) cloudinaryIds.push(tx.cloudinaryId);
      if (tx.cloudinaryId2) cloudinaryIds.push(tx.cloudinaryId2);
      if (tx.slipImage) imageUrls.push(tx.slipImage);
      if (tx.slipImage2) imageUrls.push(tx.slipImage2);
      transactionIds.push(tx._id);
    }
    
    let deletedCount = 0;
    let errorCount = 0;
    
    // 1. ลบรูปจาก Cloudinary (ทีละรูปเพราะ API ไม่รองรับ batch)
    console.log(`\n🗑️  [Cleanup] Deleting ${cloudinaryIds.length} images from Cloudinary...`);
    for (const cloudinaryId of cloudinaryIds) {
      try {
        await deleteFromCloudinary(cloudinaryId);
        deletedCount++;
      } catch (cloudError) {
        console.warn(`  ⚠️  Cloudinary delete failed for ${cloudinaryId}: ${cloudError.message}`);
        errorCount++;
      }
    }
    console.log(`  ✅ Deleted ${deletedCount} images from Cloudinary`);
    
    // 2. ลบรูปจาก Image gallery (batch operation - ครั้งเดียว)
    if (imageUrls.length > 0) {
      console.log(`\n🗑️  [Cleanup] Deleting images from gallery...`);
      try {
        const deletedImages = await Image.deleteMany({ imageUrl: { $in: imageUrls } });
        console.log(`  ✅ Deleted ${deletedImages.deletedCount} image(s) from gallery`);
      } catch (imgError) {
        console.warn(`  ⚠️  Gallery delete failed: ${imgError.message}`);
        errorCount++;
      }
    }
    
    // 3. Clear ข้อมูลรูปสลิปใน Transaction (batch update - ครั้งเดียว)
    console.log(`\n🔄 [Cleanup] Updating ${transactionIds.length} transactions...`);
    try {
      const updateResult = await Transaction.updateMany(
        { _id: { $in: transactionIds } },
        { 
          $set: { 
            slipImage: null, 
            slipImage2: null, 
            cloudinaryId: null, 
            cloudinaryId2: null 
          } 
        }
      );
      console.log(`  ✅ Updated ${updateResult.modifiedCount} transactions`);
    } catch (updateError) {
      console.error(`  ❌ Transaction update failed:`, updateError.message);
      errorCount++;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 [Cleanup] Cleanup completed!');
    console.log(`✅ Successfully cleaned: ${deletedCount} transactions`);
    if (errorCount > 0) {
      console.log(`⚠️  Errors encountered: ${errorCount} transactions`);
    }
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ [Cleanup] Fatal error during cleanup:', error);
  }
}

// ตั้งเวลาให้รันทุกวันเวลา 02:00 น. (เวลาที่ระบบใช้งานน้อย)
// Format: นาที ชั่วโมง วัน เดือน วันในสัปดาห์
// '0 2 * * *' = ทุกวันเวลา 02:00
function startCleanupScheduler() {
  console.log('🕒 [Cleanup] Scheduler initialized - will run daily at 02:00');
  
  cron.schedule('0 2 * * *', () => {
    console.log('\n⏰ [Cleanup] Scheduled cleanup triggered at:', new Date().toLocaleString('th-TH'));
    cleanupOldSlips();
  }, {
    timezone: "Asia/Bangkok" // ใช้เวลาไทย
  });
  
  console.log('✅ [Cleanup] Scheduler is active');
}

// Export ฟังก์ชันสำหรับใช้งาน
module.exports = {
  startCleanupScheduler,
  cleanupOldSlips // Export เพื่อให้สามารถรันด้วยตัวเองได้
};

// ถ้ารันไฟล์นี้โดยตรง (ไม่ใช่ import)
if (require.main === module) {
  console.log('🚀 Running cleanup manually...\n');
  
  // เชื่อมต่อ database
  const mongoose = require('mongoose');
  require('dotenv').config();
  
  mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
      console.log('✅ Connected to database');
      await cleanupOldSlips();
      console.log('\n✅ Manual cleanup completed. Exiting...');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Database connection error:', err);
      process.exit(1);
    });
}
