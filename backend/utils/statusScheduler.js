const Service = require('../models/Service');

function computeWindows(now) {
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return { now, thirtyDaysAgo };
}

async function recomputeServiceStatuses() {
  const now = new Date();
  const { thirtyDaysAgo } = computeWindows(now);

  // เกินกำหนดมากกว่า 30 วัน
  await Service.updateMany(
    { dueDate: { $lt: thirtyDaysAgo } },
    { $set: { status: 'เกินกำหนดมากกว่า 30 วัน' } }
  );

  // ครบกำหนด (เลยกำหนด แต่ไม่เกิน 30 วัน)
  await Service.updateMany(
    { dueDate: { $gte: thirtyDaysAgo, $lt: now } },
    { $set: { status: 'ครบกำหนด' } }
  );

  // อยู่ระหว่างบริการ (ยังไม่ถึงกำหนด หรือไม่มี dueDate)
  await Service.updateMany(
    { $or: [ { dueDate: { $gte: now } }, { dueDate: { $exists: false } } ] },
    { $set: { status: 'อยู่ระหว่างบริการ' } }
  );
}

function initStatusScheduler() {
  // รันครั้งแรกหลังเซิร์ฟเวอร์สตาร์ท
  recomputeServiceStatuses().catch(() => {});

  // ตั้งเวลาให้รันทุกชั่วโมง (เพื่อลด latency ของสถานะ)
  const ONE_HOUR = 60 * 60 * 1000;
  setInterval(() => {
    recomputeServiceStatuses().catch(() => {});
  }, ONE_HOUR);
}

module.exports = { initStatusScheduler, recomputeServiceStatuses };
