const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLogController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// All audit log routes require admin authentication
router.use(authMiddleware, adminMiddleware);

router.get('/audit-logs', auditLogController.getAuditLogs);
router.get('/audit-logs/filters', auditLogController.getAuditLogFilters);

module.exports = router;
