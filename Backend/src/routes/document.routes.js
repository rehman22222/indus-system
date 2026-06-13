import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/auth.js';
import { uploadDocument, listDocuments, getDocument } from '../controllers/document.controller.js';

const router = express.Router();

router.get('/', authMiddleware, asyncHandler(listDocuments));
router.get('/:id', authMiddleware, asyncHandler(getDocument));
router.post('/', authMiddleware, asyncHandler(uploadDocument));

export default router;
