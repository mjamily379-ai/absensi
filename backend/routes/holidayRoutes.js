const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/holidayController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { validateQuery, validateParams, schemas } = require('../middleware/validationMiddleware');

router.get('/holidays', authMiddleware, validateQuery(schemas.query.year), holidayController.getHolidays);
router.post('/holidays', authMiddleware, adminMiddleware, holidayController.createHoliday);
router.delete('/holidays/:id', authMiddleware, adminMiddleware, validateParams(schemas.params.objectId), holidayController.deleteHoliday);
router.post('/holidays/sync', authMiddleware, adminMiddleware, validateQuery(schemas.query.year), holidayController.syncHolidays);

module.exports = router;