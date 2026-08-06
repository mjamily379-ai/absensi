const express = require('express');
const router = express.Router();
const leaveRequestController = require('../controllers/leaveRequestController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

router.get('/leave-requests/my', authMiddleware, leaveRequestController.getMyLeaveRequests);
router.get('/leave-requests', authMiddleware, adminMiddleware, leaveRequestController.getAllLeaveRequests);
router.post('/leave-requests', authMiddleware, leaveRequestController.createLeaveRequest);
router.put('/leave-requests/:id', authMiddleware, adminMiddleware, leaveRequestController.updateLeaveRequest);

module.exports = router;
