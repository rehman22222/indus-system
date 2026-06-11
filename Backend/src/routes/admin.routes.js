import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
    createAuditLog,
    getAdminDashboard,
    listAuditLogs,
    listSystemSettings,
    updateSystemSetting,
    upsertSystemSetting,
} from '../controllers/admin.controller.js';

const router = express.Router();

router.use(authMiddleware, requireRole(['admin']));

router.get('/dashboard', asyncHandler(getAdminDashboard));
router.get('/audit-logs', asyncHandler(listAuditLogs));
router.post('/audit-logs', asyncHandler(createAuditLog));
router.get('/system-settings', asyncHandler(listSystemSettings));
router.post('/system-settings', asyncHandler(upsertSystemSetting));
router.patch('/system-settings/:id', asyncHandler(updateSystemSetting));

export default router;
