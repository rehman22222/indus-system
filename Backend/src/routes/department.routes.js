import express from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';
import {
    createDepartment,
    getDepartmentById,
    getDepartments,
} from '../controllers/department.controller.js';

const router = express.Router();

router.get('/', asyncHandler(getDepartments));
router.get('/:id', asyncHandler(getDepartmentById));

router.post(
    '/',
    authMiddleware,
    requireRole(['admin', 'management']),
    [body('name').notEmpty().withMessage('Department name is required'), validate],
    asyncHandler(createDepartment),
);

export default router;
