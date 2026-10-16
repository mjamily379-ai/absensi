const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateRequest, schemas } = require('../middleware/validationMiddleware');
const { softAuthMiddleware } = require('../middleware/authMiddleware');

router.post('/login', validateRequest(schemas.login), authController.login);
router.post('/logout', softAuthMiddleware, authController.logout);

module.exports = router;