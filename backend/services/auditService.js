const AuditLog = require('../models/auditLogModel');

/**
 * Log an administrative action to the AuditLog collection.
 * @param {Object} params
 * @param {string|ObjectId} params.adminId - ID of admin user performing the action
 * @param {string} params.adminName - Name or username of admin
 * @param {string} params.action - Action identifier e.g. 'CREATE_USER', 'DELETE_RECORD'
 * @param {string} [params.targetType] - 'User', 'Record', 'Attendance', etc.
 * @param {string} [params.targetId] - ID of modified entity
 * @param {string} [params.targetName] - Name/label of modified entity
 * @param {string} params.description - Human readable summary of the action
 * @param {Object} [params.details] - Additional contextual data or payload
 * @param {Object} [params.req] - Express request object for IP extraction
 */
const logAction = async ({
  adminId,
  adminName,
  action,
  targetType,
  targetId,
  targetName,
  description,
  details,
  req
}) => {
  try {
    let resolvedAdminId = adminId;
    let resolvedAdminName = adminName;
    let ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') : '';

    if (req && req.user) {
      resolvedAdminId = resolvedAdminId || req.user._id || req.user.id;
      resolvedAdminName = resolvedAdminName || req.user.name || req.user.username;
    }

    await AuditLog.create({
      adminId: resolvedAdminId,
      adminName: resolvedAdminName || 'Admin',
      action,
      targetType,
      targetId: targetId ? targetId.toString() : undefined,
      targetName,
      description,
      details,
      ip: ip ? ip.toString().split(',')[0].trim() : undefined,
      createdAt: new Date()
    });
  } catch (err) {
    console.error('AuditLog logging error (non-fatal):', err.message);
  }
};

module.exports = { logAction };
