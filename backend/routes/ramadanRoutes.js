const express = require('express');
const router = express.Router();
const ramadanController = require('../controllers/ramadanController');

router.get('/ramadan', ramadanController.getRamadanPeriods);
router.post('/ramadan', ramadanController.updateRamadanPeriod);
router.delete('/ramadan/:id', ramadanController.deleteRamadanPeriod);

module.exports = router;
