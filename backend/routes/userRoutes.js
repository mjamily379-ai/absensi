const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { validateRequest, schemas } = require('../middleware/validationMiddleware');

router.get('/users', authMiddleware, adminMiddleware, userController.getAllUsers);
router.post('/users', authMiddleware, adminMiddleware, validateRequest(schemas.createUser), userController.createUser);
router.put('/users/change-password', authMiddleware, validateRequest(schemas.changePassword), userController.changePassword);
router.put('/users/:id', authMiddleware, adminMiddleware, validateRequest(schemas.updateUser), userController.updateUser);
router.delete('/users/:id', authMiddleware, adminMiddleware, userController.deleteUser);

router.get('/staff', authMiddleware, adminMiddleware, userController.getAllStaff);

module.exports = router;
