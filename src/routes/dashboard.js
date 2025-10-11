// =====================================================
// RUTAS PARA DASHBOARD PÚBLICO
// src/routes/dashboard.js
// =====================================================

import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import dashboardController from '../controllers/dashboardController.js';

const router = Router();

/**
 * @route   GET /api/dashboard/public
 * @desc    Obtener datos del dashboard público
 * @access  Public (con info adicional si está autenticado)
 */
router.get('/public', optionalAuth, dashboardController.getPublicDashboard);

export default router;