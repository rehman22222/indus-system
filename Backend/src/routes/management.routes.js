import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
    getManagementDashboard,
    getOperationalAppointments,
} from '../controllers/management.controller.js';
import {
    listSystemSettings,
    updateSystemSetting,
    upsertSystemSetting,
} from '../controllers/admin.controller.js';

const router = express.Router();

router.use(authMiddleware, requireRole(['management', 'admin']));

router.get('/dashboard', asyncHandler(getManagementDashboard));
router.get('/appointments', asyncHandler(getOperationalAppointments));
router.get('/system-settings', asyncHandler(listSystemSettings));
router.post('/system-settings', asyncHandler(upsertSystemSetting));
router.patch('/system-settings/:id', asyncHandler(updateSystemSetting));

export default router;
