const express = require('express');
const router = express.Router();
const ramadanController = require('../controllers/ramadanController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { validateParams, schemas } = require('../middleware/validationMiddleware');

router.get('/ramadan', authMiddleware, ramadanController.getRamadanPeriods);
router.post('/ramadan', authMiddleware, adminMiddleware, ramadanController.updateRamadanPeriod);
router.delete('/ramadan/:id', authMiddleware, adminMiddleware, validateParams(schemas.params.objectId), ramadanController.deleteRamadanPeriod);

module.exports = router;