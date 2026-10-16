const express = require('express');
const router = express.Router();
const leaveRequestController = require('../controllers/leaveRequestController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { validateRequest, validateQuery, validateParams, schemas } = require('../middleware/validationMiddleware');

router.get('/leave-requests/my', authMiddleware, leaveRequestController.getMyLeaveRequests);
router.get('/leave-requests', authMiddleware, adminMiddleware, leaveRequestController.getAllLeaveRequests);
router.post('/leave-requests', authMiddleware, leaveRequestController.createLeaveRequest);
router.post('/leave-requests/bulk', authMiddleware, adminMiddleware, validateRequest(schemas.bulkLeaveRequests), leaveRequestController.bulkUpdateLeaveRequests);
router.put('/leave-requests/:id', authMiddleware, adminMiddleware, validateParams(schemas.params.objectId), leaveRequestController.updateLeaveRequest);
router.get('/leave-requests/:id/attachment', authMiddleware, validateParams(schemas.params.objectId), leaveRequestController.getLeaveAttachment);
router.get('/export-leave-requests', authMiddleware, adminMiddleware, validateQuery(schemas.query.exportRequests), leaveRequestController.exportLeaveRequests);

module.exports = router;
