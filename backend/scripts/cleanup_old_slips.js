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
    
    let deletedCount = 0;
    let errorCount = 0;
    
    // ลบรูปสลิปทีละรายการ
    for (const tx of oldTransactions) {
      try {
        const txDate = new Date(tx.createdAt).toLocaleDateString('th-TH');
        console.log(`\n📝 [Cleanup] Processing Transaction ID: ${tx._id} (${txDate})`);
        
        // ลบรูปสลิปหลัก (slipImage)
        if (tx.slipImage) {
          if (tx.cloudinaryId) {
            try {
              await deleteFromCloudinary(tx.cloudinaryId);
              console.log(`  ✅ Deleted from Cloudinary: ${tx.cloudinaryId}`);
            } catch (cloudError) {
              console.warn(`  ⚠️  Cloudinary delete failed: ${cloudError.message}`);
            }
          }
          
          // ลบจาก Image gallery
          try {
            const deletedImages = await Image.deleteMany({ imageUrl: tx.slipImage });
            if (deletedImages.deletedCount > 0) {
              console.log(`  ✅ Deleted ${deletedImages.deletedCount} image(s) from gallery`);
            }
          } catch (imgError) {
            console.warn(`  ⚠️  Gallery delete failed: ${imgError.message}`);
          }
        }
        
        // ลบรูปสลิปที่ 2 (slipImage2)
        if (tx.slipImage2) {
          if (tx.cloudinaryId2) {
            try {
              await deleteFromCloudinary(tx.cloudinaryId2);
              console.log(`  ✅ Deleted from Cloudinary (2nd): ${tx.cloudinaryId2}`);
            } catch (cloudError) {
              console.warn(`  ⚠️  Cloudinary delete failed (2nd): ${cloudError.message}`);
            }
          }
          
          // ลบจาก Image gallery
          try {
            const deletedImages2 = await Image.deleteMany({ imageUrl: tx.slipImage2 });
            if (deletedImages2.deletedCount > 0) {
              console.log(`  ✅ Deleted ${deletedImages2.deletedCount} image(s) from gallery (2nd)`);
            }
          } catch (imgError) {
            console.warn(`  ⚠️  Gallery delete failed (2nd): ${imgError.message}`);
          }
        }
        
        // Clear ข้อมูลรูปสลิปใน Transaction (แต่เก็บข้อมูลอื่นไว้)
        tx.slipImage = null;
        tx.slipImage2 = null;
        tx.cloudinaryId = null;
        tx.cloudinaryId2 = null;
        await tx.save();
        
        console.log(`  ✅ Transaction updated - slip data cleared`);
        deletedCount++;
        
      } catch (txError) {
        console.error(`  ❌ Error processing transaction ${tx._id}:`, txError.message);
        errorCount++;
      }
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
