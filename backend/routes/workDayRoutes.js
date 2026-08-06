const express = require('express');
const router = express.Router();
const workDayController = require('../controllers/workDayController');

router.get('/workday', workDayController.getWorkDay);
router.post('/workday', workDayController.updateWorkDay);
router.get('/workday/all', workDayController.getAllWorkDays);

module.exports = router;
