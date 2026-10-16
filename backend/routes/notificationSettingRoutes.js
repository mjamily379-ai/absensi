const express = require('express');
const router = express.Router();
const notificationSettingController = require('../controllers/notificationSettingController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware, adminMiddleware);

router.get('/notification-settings', notificationSettingController.getSettings);
router.put('/notification-settings', notificationSettingController.updateSettings);
router.post('/notification-settings/test', notificationSettingController.sendTestNotification);

module.exports = router;
