const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/holidayController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

router.get('/holidays', authMiddleware, holidayController.getHolidays);
router.post('/holidays', authMiddleware, adminMiddleware, holidayController.createHoliday);
router.delete('/holidays/:id', authMiddleware, adminMiddleware, holidayController.deleteHoliday);
router.post('/holidays/sync', authMiddleware, adminMiddleware, holidayController.syncHolidays);

module.exports = router;
