const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { validateQuery, schemas } = require('../middleware/validationMiddleware');

// Phase 5 — server-side analytics (admin) & personal analytics parity (auth).
router.get('/analytics/overview', authMiddleware, adminMiddleware, validateQuery(schemas.query.analytics), analyticsController.getOverview);
router.get('/analytics/roles', authMiddleware, adminMiddleware, validateQuery(schemas.query.analytics), analyticsController.getRoles);
router.get('/analytics/lateness', authMiddleware, adminMiddleware, validateQuery(schemas.query.analytics), analyticsController.getLateness);
router.get('/analytics/personal', authMiddleware, validateQuery(schemas.query.analytics), analyticsController.getPersonal);

module.exports = router;