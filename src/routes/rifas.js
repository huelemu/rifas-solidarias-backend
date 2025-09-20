// ===================================================
// src/routes/rifas.js
// CREAR ESTE ARCHIVO EN: src/routes/rifas.js
// ===================================================

import express from 'express';
import { body, param } from 'express-validator';
import rifasController from '../controllers/rifasController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validarErrores } from '../middleware/validations.js';

const router = express.Router();

// ===================================================
// RUTAS PÚBLICAS (sin autenticación)
// ===================================================

// Obtener rifas públicas (solo activas)
router.get('/publicas', rifasController.listarRifas);

// Obtener detalle de rifa pública
router.get('/publicas/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validarErrores,
  rifasController.obtenerRifaPorId
);

// ===================================================
// RUTAS PROTEGIDAS (requieren autenticación)
// ===================================================

// Listar todas las rifas
router.get('/',
  requireAuth,
  rifasController.listarRifas
);

// Crear nueva rifa
router.post('/',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  [
    body('titulo')
      .optional()
      .isLength({ min: 3, max: 255 })
      .withMessage('El título debe tener entre 3 y 255 caracteres'),
    body('nombre')
      .optional()
      .isLength({ min: 3, max: 255 })
      .withMessage('El nombre debe tener entre 3 y 255 caracteres'),
    body('precio_numero')
      .isFloat({ min: 0.01 })
      .withMessage('El precio debe ser mayor a 0'),
    body('total_numeros')
      .optional()
      .isInt({ min: 1, max: 100000 })
      .withMessage('El total de números debe estar entre 1 y 100,000'),
    body('cantidad_numeros')
      .optional()
      .isInt({ min: 1, max: 100000 })
      .withMessage('La cantidad de números debe estar entre 1 y 100,000'),
    validarErrores
  ],
  rifasController.crearRifa
);

// Obtener rifa por ID
router.get('/:id',
  requireAuth,
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validarErrores,
  rifasController.obtenerRifaPorId
);

// Actualizar rifa
router.put('/:id',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  [
    param('id').isInt({ min: 1 }).withMessage('ID inválido'),
    body('titulo').optional().isLength({ min: 3, max: 255 }),
    body('nombre').optional().isLength({ min: 3, max: 255 }),
    body('precio_numero').optional().isFloat({ min: 0.01 }),
    validarErrores
  ],
  rifasController.actualizarRifa
);

// ===================================================
// GESTIÓN DE NÚMEROS
// ===================================================

// Generar números para una rifa
router.post('/:id/generar-numeros',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validarErrores,
  rifasController.generarNumeros
);

// Obtener números de una rifa
router.get('/:id/numeros',
  requireAuth,
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validarErrores,
  rifasController.obtenerNumeros
);

// ===================================================
// SISTEMA DE VENTAS
// ===================================================

// Comprar números
router.post('/:id/comprar',
  requireAuth,
  [
    param('id').isInt({ min: 1 }).withMessage('ID de rifa inválido'),
    body('numeros')
      .isArray({ min: 1, max: 50 })
      .withMessage('Debe especificar entre 1 y 50 números'),
    body('numeros.*')
      .isInt({ min: 1 })
      .withMessage('Los números deben ser enteros positivos'),
    validarErrores
  ],
  rifasController.comprarNumeros
);

// Obtener mis números comprados
router.get('/:id/mis-numeros',
  requireAuth,
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validarErrores,
  async (req, res) => {
    try {
      const { id } = req.params;
      const usuario = req.user;

      res.json({
        status: 'success',
        message: 'Endpoint mis números funcionando',
        data: [],
        info: 'Tabla rifas aún no migrada. Ejecutar script de migración SQL.'
      });

    } catch (error) {
      console.error('Error al obtener mis números:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  }
);

// ===================================================
// SORTEOS
// ===================================================

// Realizar sorteo
router.post('/:id/sorteo',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validarErrores,
  rifasController.realizarSorteo
);

// ===================================================
// ESTADÍSTICAS
// ===================================================

// Estadísticas de una rifa
router.get('/:id/estadisticas',
  requireAuth,
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validarErrores,
  async (req, res) => {
    try {
      const { id } = req.params;

      res.json({
        status: 'success',
        message: 'Endpoint estadísticas funcionando',
        data: {
          resumen: {
            total_numeros: 100,
            disponibles: 80,
            vendidos: 20,
            recaudado: 20000,
            total_compradores: 5
          }
        },
        info: 'Tabla rifas aún no migrada. Ejecutar script de migración SQL.'
      });

    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  }
);

export default router;