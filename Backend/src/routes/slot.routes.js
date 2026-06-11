import express from 'express';
import { authMiddleware, optionalAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createSlot, getSlotById, listSlots, updateSlot } from '../controllers/slot.controller.js';

const router = express.Router();

router.get('/', optionalAuth, asyncHandler(listSlots));
router.get('/:id', optionalAuth, asyncHandler(getSlotById));
router.post('/', authMiddleware, requireRole(['admin', 'management']), asyncHandler(createSlot));
router.patch('/:id', authMiddleware, requireRole(['admin', 'management']), asyncHandler(updateSlot));

export default router;
