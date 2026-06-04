import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
    getNoShowPrediction,
    getDiseasePrediction,
    getPatientVolumeForecast,
    getRiskExplanation,
    getLiveStats,
    triggerRetraining
} from '../controllers/analytics.controller.js';

const router = express.Router();

/**
 * POST /api/v1/analytics/predict/noshow
 * Get no-show risk prediction
 */
router.post(
    '/predict/noshow',
    authMiddleware,
    requireRole(['admin', 'doctor', 'management']),
    asyncHandler(getNoShowPrediction)
);

/**
 * POST /api/v1/analytics/predict/disease
 * Get disease prediction
 */
router.post(
    '/predict/disease',
    authMiddleware,
    requireRole(['doctor']),
    asyncHandler(getDiseasePrediction)
);

/**
 * GET /api/v1/analytics/forecast/volume
 * Get patient volume forecast
 */
router.get(
    '/forecast/volume',
    authMiddleware,
    requireRole(['admin', 'management']),
    asyncHandler(getPatientVolumeForecast)
);

/**
 * POST /api/v1/analytics/explain/risk
 * Get SHAP explanation for risk score
 */
router.post(
    '/explain/risk',
    authMiddleware,
    requireRole(['admin', 'doctor']),
    asyncHandler(getRiskExplanation)
);

/**
 * GET /api/v1/analytics/stats/live
 * Get live statistics
 */
router.get(
    '/stats/live',
    authMiddleware,
    asyncHandler(getLiveStats)
);

/**
 * POST /api/v1/analytics/train
 * Trigger model retraining
 */
router.post(
    '/train',
    authMiddleware,
    requireRole(['admin']),
    asyncHandler(triggerRetraining)
);

export default router;
