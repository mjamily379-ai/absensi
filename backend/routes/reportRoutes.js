const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

router.post('/export-excel', authMiddleware, adminMiddleware, reportController.exportExcel);
router.get('/export-personal-excel', authMiddleware, reportController.exportPersonalExcel);

module.exports = router;
