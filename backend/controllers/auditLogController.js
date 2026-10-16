const AuditLog = require('../models/auditLogModel');

/**
 * Get paginated and filtered audit logs (Admin only)
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 30, search, action, targetType, startDate, endDate } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { adminName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { targetName: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } }
      ];
    }

    if (action && action !== 'all') {
      query.action = action;
    }

    if (targetType && targetType !== 'all') {
      query.targetType = targetType;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('adminId', 'name username role'),
      AuditLog.countDocuments(query)
    ]);

    res.json({
      logs,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      limit: limitNum
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Gagal mengambil data audit log.' });
  }
};

/**
 * Get distinct actions and target types for filter dropdowns
 */
exports.getAuditLogFilters = async (req, res) => {
  try {
    const [actions, targetTypes] = await Promise.all([
      AuditLog.distinct('action'),
      AuditLog.distinct('targetType')
    ]);

    res.json({
      actions: actions.filter(Boolean),
      targetTypes: targetTypes.filter(Boolean)
    });
  } catch (error) {
    console.error('Error fetching audit filters:', error);
    res.status(500).json({ message: 'Gagal mengambil data filter audit log.' });
  }
};
