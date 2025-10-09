import express from 'express';
import { 
  asignarInstitucionesARifa,
  obtenerInstitucionesDeRifa,
  asignarNumerosAVendedor,
  obtenerVendedoresDeInstitucion
} from '../controllers/asignacionController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(requireAuth);

/**
 * @swagger
 * /asignaciones/rifas/{rifaId}/instituciones:
 *   post:
 *     summary: Asignar instituciones a una rifa (Opción 2 - División automática)
 *     tags: [Asignaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rifaId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               instituciones:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 2, 3, 4, 5]
 */
router.post('/rifas/:rifaId/instituciones', 
  requireRole(['admin_global']), 
  asignarInstitucionesARifa
);

/**
 * @swagger
 * /asignaciones/rifas/{rifaId}/instituciones:
 *   get:
 *     summary: Obtener instituciones asignadas a una rifa
 *     tags: [Asignaciones]
 *     security:
 *       - bearerAuth: []
 */
router.get('/rifas/:rifaId/instituciones', 
  obtenerInstitucionesDeRifa
);

/**
 * @swagger
 * /asignaciones/rifa-instituciones/{rifaInstitucionId}/vendedores:
 *   post:
 *     summary: Asignar números a un vendedor
 *     tags: [Asignaciones]
 *     security:
 *       - bearerAuth: []
 */
router.post('/rifa-instituciones/:rifaInstitucionId/vendedores', 
  requireRole(['admin_global']), 
  asignarNumerosAVendedor
);

/**
 * @swagger
 * /asignaciones/rifa-instituciones/{rifaInstitucionId}/vendedores:
 *   get:
 *     summary: Obtener vendedores de una institución
 *     tags: [Asignaciones]
 *     security:
 *       - bearerAuth: []
 */
router.get('/rifa-instituciones/:rifaInstitucionId/vendedores', 
  obtenerVendedoresDeInstitucion
);

export default router;