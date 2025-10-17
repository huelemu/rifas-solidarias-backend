import express from 'express';
import { 
  asignarInstitucionesARifa,
  obtenerInstitucionesDeRifa,
  asignarNumerosAVendedor,
  obtenerVendedoresDeInstitucion,
  // NUEVAS FUNCIONES
  obtenerNumerosDisponiblesDeInstitucion,
  liberarNumerosDeVendedor,
  obtenerNumerosAsignadosAVendedor
} from '../controllers/asignacionController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(requireAuth);

// ==========================================
// RUTAS DE INSTITUCIONES Y RIFAS
// ==========================================

/**
 * @swagger
 * /asignaciones/rifas/{rifaId}/instituciones:
 *   post:
 *     summary: Asignar instituciones a una rifa (División automática)
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

// ==========================================
// RUTAS DE ASIGNACIÓN A VENDEDORES (MEJORADAS)
// ==========================================

/**
 * @swagger
 * /asignaciones/rifa-instituciones/{rifaInstitucionId}/vendedores:
 *   post:
 *     summary: Asignar números a un vendedor (3 modalidades)
 *     tags: [Asignaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rifaInstitucionId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vendedor_id
 *               - tipo_asignacion
 *             properties:
 *               vendedor_id:
 *                 type: integer
 *                 example: 5
 *               tipo_asignacion:
 *                 type: string
 *                 enum: [individual, rango, aleatorio]
 *                 example: "rango"
 *               numeros:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 5, 10, 25]
 *                 description: "Requerido si tipo_asignacion es 'individual'"
 *               rango:
 *                 type: object
 *                 properties:
 *                   desde:
 *                     type: integer
 *                     example: 100
 *                   hasta:
 *                     type: integer
 *                     example: 150
 *                 description: "Requerido si tipo_asignacion es 'rango'"
 *               cantidad:
 *                 type: integer
 *                 example: 20
 *                 description: "Requerido si tipo_asignacion es 'aleatorio'"
 *     responses:
 *       200:
 *         description: Números asignados exitosamente
 *       400:
 *         description: Datos inválidos o números no disponibles
 *       404:
 *         description: Vendedor o institución no encontrada
 */
router.post('/rifa-instituciones/:rifaInstitucionId/vendedores', 
  requireRole(['admin_global', 'admin_institucion']), 
  asignarNumerosAVendedor
);

/**
 * @swagger
 * /asignaciones/rifa-instituciones/{rifaInstitucionId}/vendedores:
 *   get:
 *     summary: Obtener vendedores con sus números asignados
 *     tags: [Asignaciones]
 *     security:
 *       - bearerAuth: []
 */
router.get('/rifa-instituciones/:rifaInstitucionId/vendedores', 
  obtenerVendedoresDeInstitucion
);

/**
 * @swagger
 * /asignaciones/rifa-instituciones/{rifaInstitucionId}/numeros-disponibles:
 *   get:
 *     summary: Obtener números disponibles de una institución
 *     tags: [Asignaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rifaInstitucionId
 *         required: true
 *         schema:
 *           type: integer
 */
router.get('/rifa-instituciones/:rifaInstitucionId/numeros-disponibles', 
  requireRole(['admin_global', 'admin_institucion']),
  obtenerNumerosDisponiblesDeInstitucion
);

/**
 * @swagger
 * /asignaciones/vendedores/{vendedorId}/numeros:
 *   get:
 *     summary: Obtener todos los números asignados a un vendedor
 *     tags: [Asignaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vendedorId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: rifaInstitucionId
 *         schema:
 *           type: integer
 *         description: Filtrar por rifa-institución específica
 */
router.get('/vendedores/:vendedorId/numeros',
  obtenerNumerosAsignadosAVendedor
);

/**
 * @swagger
 * /asignaciones/vendedores/numeros/liberar:
 *   delete:
 *     summary: Liberar números asignados (devolverlos a disponibles)
 *     tags: [Asignaciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - numero_ids
 *             properties:
 *               numero_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 2, 3, 4]
 */
router.delete('/vendedores/numeros/liberar', 
  requireRole(['admin_global', 'admin_institucion']),
  liberarNumerosDeVendedor
);

router.get('/usuarios/vendedores', requireAuth, async (req, res) => {
  try {
    const [vendedores] = await db.execute(
      `SELECT id, nombre, email, telefono, institucion_id
       FROM usuarios 
       WHERE rol = 'vendedor' 
       AND (estado = 'activo' OR activo = 1)
       ORDER BY nombre ASC`
    );

    res.json({
      status: 'success',
      data: vendedores
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error al listar vendedores'
    });
  }
});

export default router;