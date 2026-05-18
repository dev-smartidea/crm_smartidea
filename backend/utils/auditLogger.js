const AuditLog = require('../models/AuditLog');

/**
 * บันทึก audit log — ไม่ throw error เพื่อไม่กระทบ main request
 * @param {Object} opts
 * @param {string|null} opts.userId
 * @param {string} opts.username
 * @param {string} opts.action
 * @param {string} [opts.target]
 * @param {string} [opts.detail]
 * @param {string} [opts.ip]
 */
async function createAuditLog({ userId, username, action, target = '', detail = '', ip = '' }) {
  try {
    await AuditLog.create({ userId: userId || null, username, action, target, detail, ip });
  } catch (err) {
    console.error('[AuditLog] write error:', err.message);
  }
}

module.exports = { createAuditLog };
