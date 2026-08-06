const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

router.get('/announcements', authMiddleware, announcementController.getAllAnnouncements);
router.post('/announcements', authMiddleware, adminMiddleware, announcementController.createAnnouncement);
router.put('/announcements/:id', authMiddleware, adminMiddleware, announcementController.updateAnnouncement);
router.delete('/announcements/:id', authMiddleware, adminMiddleware, announcementController.deleteAnnouncement);

module.exports = router;
