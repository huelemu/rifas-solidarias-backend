// =====================================================
// RUTAS DE RESERVAS
// src/routes/reservas.js
// =====================================================

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import reservasController from '../controllers/reservasController.js';
import { body, param, validationResult } from 'express-validator';

const router = Router();

// =====================================================
// MIDDLEWARE DE VALIDACIÓN
// =====================================================

const validarResultado = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Errores de validación',
      errors: errors.array()
    });
  }
  next();
};

// Validaciones para crear reserva
const validacionesCrearReserva = [
  body('rifa_id')
    .isInt({ min: 1 })
    .withMessage('ID de rifa inválido'),
  
  body('numeros')
    .isArray({ min: 1, max: 20 })
    .withMessage('Debe proporcionar entre 1 y 20 números'),
  
  body('numeros.*')
    .isInt({ min: 0 })
    .withMessage('Los números deben ser enteros positivos'),
  
  validarResultado
];

// Validaciones para confirmar venta
const validacionesConfirmarVenta = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID de reserva inválido'),
  
  body('metodo_pago')
    .optional()
    .isIn(['efectivo', 'transferencia', 'tarjeta', 'mercadopago'])
    .withMessage('Método de pago inválido'),
  
  body('observaciones')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Observaciones demasiado largas'),
  
  validarResultado
];

// Validaciones para rechazar reserva
const validacionesRechazarReserva = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID de reserva inválido'),
  
  body('motivo_rechazo')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Motivo demasiado largo'),
  
  validarResultado
];

// =====================================================
// RUTAS PÚBLICAS
// =====================================================

// (No hay rutas públicas de reservas - todas requieren auth)

// =====================================================
// RUTAS AUTENTICADAS - COMPRADORES
// =====================================================

/**
 * @route   POST /reservas/crear
 * @desc    Crear una nueva reserva de números
 * @access  Private (cualquier usuario autenticado)
 */
router.post(
  '/crear',
  requireAuth,
  (req, res, next) => {
    // 🐛 DEBUG COMPLETO
    console.log('═══════════════════════════════════════');
    console.log('🔍 DEBUG - CREAR RESERVA');
    console.log('═══════════════════════════════════════');
    console.log('📦 Body completo:', JSON.stringify(req.body, null, 2));
    console.log('📋 Content-Type:', req.get('Content-Type'));
    console.log('👤 Usuario:', req.user?.email);
    console.log('🔑 Headers:', {
      'content-type': req.get('Content-Type'),
      'content-length': req.get('Content-Length'),
      'authorization': req.get('Authorization') ? 'Present' : 'Missing'
    });
    console.log('═══════════════════════════════════════');
    next();
  },
  validacionesCrearReserva,
  reservasController.crearReserva
);
/**
 * @route   GET /reservas/mis-reservas
 * @desc    Obtener todas las reservas del usuario actual
 * @access  Private
 */
router.get(
  '/mis-reservas',
  requireAuth,
  reservasController.obtenerMisReservas
);

/**
 * @route   GET /reservas/:id
 * @desc    Obtener detalle de una reserva específica
 * @access  Private (solo dueño de la reserva o vendedor)
 */
router.get(
  '/:id',
  requireAuth,
  param('id').isInt({ min: 1 }),
  validarResultado,
  reservasController.obtenerReserva
);

/**
 * @route   POST /reservas/:id/cancelar
 * @desc    Cancelar una reserva activa
 * @access  Private (solo dueño de la reserva)
 */
router.post(
  '/:id/cancelar',
  requireAuth,
  param('id').isInt({ min: 1 }),
  validarResultado,
  reservasController.cancelarReserva
);

// =====================================================
// RUTAS AUTENTICADAS - VENDEDORES
// =====================================================

/**
 * @route   POST /reservas/:id/confirmar
 * @desc    Confirmar venta de una reserva (marcar como vendido)
 * @access  Private (vendedor, admin_institucion, admin_global)
 */
router.post(
  '/:id/confirmar',
  requireAuth,
  requireRole(['vendedor', 'admin_institucion', 'admin_global']),
  validacionesConfirmarVenta,
  reservasController.confirmarVenta
);

/**
 * @route   POST /reservas/:id/rechazar
 * @desc    Rechazar una reserva
 * @access  Private (vendedor, admin_institucion, admin_global)
 */
router.post(
  '/:id/rechazar',
  requireAuth,
  requireRole(['vendedor', 'admin_institucion', 'admin_global']),
  validacionesRechazarReserva,
  reservasController.rechazarReserva
);

/**
 * @route   GET /reservas/rifa/:rifaId/pendientes
 * @desc    Obtener todas las reservas pendientes de una rifa
 * @access  Private (vendedor dueño de la rifa o admin)
 */
router.get(
  '/rifa/:rifaId/pendientes',
  requireAuth,
  requireRole(['vendedor', 'admin_institucion', 'admin_global']),
  param('rifaId').isInt({ min: 1 }),
  validarResultado,
  reservasController.obtenerReservasPendientes
);

// =====================================================
// EXPORTAR ROUTER
// =====================================================

export default router;