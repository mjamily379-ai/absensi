const express = require('express');
const router = express.Router();
const workDayController = require('../controllers/workDayController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { validateQuery, validateRequest, schemas } = require('../middleware/validationMiddleware');

router.get('/workday', authMiddleware, validateQuery(schemas.query.role), workDayController.getWorkDay);
router.post('/workday', authMiddleware, adminMiddleware, workDayController.updateWorkDay);
router.post('/workday/bulk', authMiddleware, adminMiddleware, validateRequest(schemas.bulkWorkDayUpdate), workDayController.bulkUpdateWorkDay);
router.get('/workday/all', authMiddleware, adminMiddleware, workDayController.getAllWorkDays);

module.exports = router;