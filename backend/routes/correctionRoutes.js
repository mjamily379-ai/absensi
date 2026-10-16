const express = require('express');
const router = express.Router();
const correctionController = require('../controllers/correctionController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { validateQuery, validateParams, schemas } = require('../middleware/validationMiddleware');

// User routes
router.post('/correction-requests', authMiddleware, correctionController.createCorrectionRequest);
router.get('/correction-requests/my', authMiddleware, correctionController.getMyCorrectionRequests);

// Admin routes
router.get('/correction-requests', authMiddleware, adminMiddleware, validateQuery(schemas.query.correctionList), correctionController.getAllCorrectionRequests);
router.put('/correction-requests/:id/review', authMiddleware, adminMiddleware, validateParams(schemas.params.objectId), correctionController.reviewCorrectionRequest);
router.get('/export-corrections', authMiddleware, adminMiddleware, validateQuery(schemas.query.exportRequests), correctionController.exportCorrectionRequests);

module.exports = router;