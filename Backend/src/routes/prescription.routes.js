import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
    createPrescription,
    getPrescriptionById,
    listPrescriptions,
    updatePrescription,
} from '../controllers/prescription.controller.js';

const router = express.Router();

router.get('/', authMiddleware, asyncHandler(listPrescriptions));
router.post('/', authMiddleware, asyncHandler(createPrescription));
router.get('/:id', authMiddleware, asyncHandler(getPrescriptionById));
router.patch('/:id', authMiddleware, asyncHandler(updatePrescription));

export default router;
