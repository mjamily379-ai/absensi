const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateRequest, schemas } = require('../middleware/validationMiddleware');

router.post('/login', validateRequest(schemas.login), authController.login);
router.post('/register', validateRequest(schemas.register), authController.register);
router.post('/logout', authController.logout);

module.exports = router;
