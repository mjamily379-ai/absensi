const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { validateRequest, validateQuery, validateParams, schemas } = require('../middleware/validationMiddleware');

// Publicly protected (requires login)
router.get('/attendance', authMiddleware, attendanceController.getAllAttendance);
router.get('/attendance/today', authMiddleware, attendanceController.getTodayAttendance);
router.get('/attendance/matrix', authMiddleware, adminMiddleware, validateQuery(schemas.query.matrix), attendanceController.getAttendanceMatrix);
router.post('/attendance', authMiddleware, validateRequest(schemas.submitAttendance), attendanceController.submitAttendance);
router.post('/records', authMiddleware, validateRequest(schemas.createRecord), attendanceController.createRecord);

// Admin only
router.put('/attendance/:id', authMiddleware, adminMiddleware, validateParams(schemas.params.objectId), attendanceController.updateAttendance);
router.delete('/attendance/:id', authMiddleware, adminMiddleware, validateParams(schemas.params.objectId), attendanceController.deleteAttendance);

router.get('/records/today', authMiddleware, adminMiddleware, attendanceController.getTodayRecords);
router.get('/records/by-date', authMiddleware, adminMiddleware, validateQuery(schemas.query.byDate), attendanceController.getRecordsByDate);
router.get('/records/all-records', authMiddleware, adminMiddleware, attendanceController.getAllRecords);

// Parameterized route should be after more specific routes
router.get('/attendance/ranking', authMiddleware, validateQuery(schemas.query.ranking), attendanceController.getRanking);
router.get('/ranking', authMiddleware, attendanceController.getRanking); // Keep old one for compatibility
router.get('/records/:id', authMiddleware, validateParams(schemas.params.objectId), attendanceController.getRecordsByStaffId);

router.post('/records/manual', authMiddleware, adminMiddleware, attendanceController.addManualAttendance);
router.put('/records/:id/koreksi', authMiddleware, adminMiddleware, validateParams(schemas.params.objectId), attendanceController.correctRecord);
router.post('/records/add-clock-out', authMiddleware, adminMiddleware, attendanceController.addClockOut);
router.delete('/records/:id', authMiddleware, adminMiddleware, validateParams(schemas.params.objectId), attendanceController.deleteRecord);
router.get('/records/:id/photo', authMiddleware, validateParams(schemas.params.objectId), attendanceController.serveRecordPhoto);

module.exports = router;