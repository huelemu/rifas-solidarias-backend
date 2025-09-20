// =====================================================
// RUTAS DEL SISTEMA DE RIFAS
// src/routes/rifas.js
// =====================================================

import { Router } from 'express';
import { body } from 'express-validator';
import rifasController, { rifasValidations } from '../controllers/rifasController.js';
import { requireAuth, requireRole, requireOwnership } from '../middleware/auth.js';

const router = Router();

// =====================================================
// MIDDLEWARE ESPECÍFICO PARA RIFAS
// =====================================================

// Middleware para verificar permisos sobre una rifa específica
const verificarPermisoRifa = async (req, res, next) => {
  try {
    const { rifa_id } = req.params;
    const usuario = req.user;

    if (usuario.rol === 'admin_global') {
      return next(); // Admin global tiene acceso a todo
    }

    // Verificar si el usuario tiene relación con la rifa
    const [relacion] = await db.execute(`
      SELECT r.institucion_promotora_id, rp.institucion_id, rp.estado_participacion
      FROM rifas r
      LEFT JOIN rifa_participaciones rp ON r.id = rp.rifa_id AND rp.institucion_id = ?
      WHERE r.id = ?
    `, [usuario.institucion_id, rifa_id]);

    if (!relacion.length) {
      return res.status(404).json({
        status: 'error',
        message: 'Rifa no encontrada'
      });
    }

    const esPromotora = relacion[0].institucion_promotora_id === usuario.institucion_id;
    const esParticipante = relacion[0].institucion_id === usuario.institucion_id && 
                          relacion[0].estado_participacion === 'aprobada';

    if (!esPromotora && !esParticipante) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes acceso a esta rifa'
      });
    }

    req.esPromotora = esPromotora;
    req.esParticipante = esParticipante;
    next();

  } catch (error) {
    console.error('Error en verificarPermisoRifa:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// =====================================================
// RUTAS PRINCIPALES DE RIFAS
// =====================================================

// Crear nueva rifa
router.post('/', 
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  rifasValidations.crearRifa,
  rifasController.crearRifa
);

// Listar rifas (con filtros según rol)
router.get('/', 
  requireAuth,
  rifasController.listarRifas
);

// Obtener rifa específica
router.get('/:id', 
  requireAuth,
  rifasController.obtenerRifa
);

// Actualizar rifa (solo promotora)
router.put('/:id',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  // Solo la institución promotora puede editar
  rifasValidations.crearRifa,
  rifasController.actualizarRifa
);

// Activar/desactivar rifa
router.patch('/:id/estado',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  body('estado').isIn(['borrador', 'activa', 'finalizada', 'cancelada']),
  rifasController.cambiarEstadoRifa
);

// =====================================================
// GESTIÓN DE PARTICIPACIONES
// =====================================================

// Solicitar participación en rifa
router.post('/:rifa_id/participaciones',
  requireAuth,
  requireRole(['admin_institucion', 'vendedor']),
  body('observaciones').optional().isString(),
  rifasController.solicitarParticipacion
);

// Listar participaciones de una rifa
router.get('/:rifa_id/participaciones',
  requireAuth,
  verificarPermisoRifa,
  rifasController.listarParticipaciones
);

// Aprobar/rechazar participación (solo promotora)
router.patch('/participaciones/:participacion_id',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  body('accion').isIn(['aprobar', 'rechazar']),
  body('observaciones').optional().isString(),
  rifasController.gestionarParticipacion
);

// Retirar participación
router.delete('/participaciones/:participacion_id',
  requireAuth,
  rifasController.retirarParticipacion
);

// =====================================================
// GESTIÓN DE NÚMEROS
// =====================================================

// Generar números para una rifa
router.post('/:rifa_id/generar-numeros',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  verificarPermisoRifa,
  rifasController.generarNumeros
);

// Asignar bloque de números a institución
router.post('/:rifa_id/asignar-numeros-institucion',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  body('participacion_id').isInt(),
  body('numero_desde').isInt({ min: 1 }),
  body('numero_hasta').isInt({ min: 1 }),
  rifasController.asignarNumerosInstitucion
);

// Asignar números a vendedor
router.post('/:rifa_id/asignar-numeros-vendedor',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  body('vendedor_id').isInt(),
  body('numero_desde').isInt({ min: 1 }),
  body('numero_hasta').isInt({ min: 1 }),
  rifasController.asignarNumerosVendedor
);

// Liberar asignación de números
router.delete('/:rifa_id/asignaciones/:asignacion_id',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  rifasController.liberarAsignacion
);

// =====================================================
// GESTIÓN DE VENTAS
// =====================================================

// Vender número específico
router.post('/:rifa_id/numeros/:numero/vender',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion', 'vendedor']),
  rifasValidations.venderNumero,
  rifasController.venderNumero
);

// Reservar número
router.post('/:rifa_id/numeros/:numero/reservar',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion', 'vendedor']),
  body('comprador_nombre').notEmpty(),
  body('tiempo_reserva').optional().isInt({ min: 1, max: 24 }),
  rifasController.reservarNumero
);

// Cancelar venta
router.delete('/:rifa_id/numeros/:numero/venta',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  body('motivo').notEmpty(),
  rifasController.cancelarVenta
);

// Obtener números de un vendedor
router.get('/:rifa_id/vendedor/numeros',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion', 'vendedor']),
  rifasController.obtenerNumerosVendedor
);

// Obtener números disponibles para una institución
router.get('/:rifa_id/instituciones/:institucion_id/numeros',
  requireAuth,
  verificarPermisoRifa,
  rifasController.obtenerNumerosInstitucion
);

// =====================================================
// REPORTES Y ESTADÍSTICAS
// =====================================================

// Estadísticas generales de la rifa
router.get('/:rifa_id/estadisticas',
  requireAuth,
  verificarPermisoRifa,
  rifasController.estadisticasRifa
);

// Reporte de ventas por institución
router.get('/:rifa_id/reporte-instituciones',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  verificarPermisoRifa,
  rifasController.reporteVentasInstitucion
);

// Reporte de ventas por vendedor
router.get('/:rifa_id/reporte-vendedores',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  rifasController.reporteVentasVendedores
);

// Reporte de comisiones
router.get('/:rifa_id/comisiones',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  verificarPermisoRifa,
  rifasController.reporteComisiones
);

// Exportar datos de rifa (CSV/Excel)
router.get('/:rifa_id/exportar',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  verificarPermisoRifa,
  rifasController.exportarDatos
);

// =====================================================
// GESTIÓN DE SORTEOS
// =====================================================

// Crear sorteo
router.post('/:rifa_id/sorteos',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  body('nombre').notEmpty(),
  body('fecha_sorteo').isISO8601(),
  body('metodo_sorteo').isIn(['manual', 'aleatorio', 'loteria_nacional']),
  rifasController.crearSorteo
);

// Ejecutar sorteo
router.post('/:rifa_id/sorteos/:sorteo_id/ejecutar',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  rifasController.ejecutarSorteo
);

// =====================================================
// RUTAS ESPECÍFICAS PARA VENDEDORES
// =====================================================

// Dashboard del vendedor
router.get('/vendedor/dashboard',
  requireAuth,
  requireRole(['vendedor']),
  rifasController.dashboardVendedor
);

// Rifas asignadas al vendedor
router.get('/vendedor/mis-rifas',
  requireAuth,
  requireRole(['vendedor']),
  rifasController.rifasVendedor
);

// Historial de ventas del vendedor
router.get('/vendedor/mis-ventas',
  requireAuth,
  requireRole(['vendedor']),
  rifasController.ventasVendedor
);

// =====================================================
// RUTAS PÚBLICAS (SIN AUTENTICACIÓN)
// =====================================================

// Ver rifa pública (para compradores)
router.get('/publico/:id',
  rifasController.obtenerRifaPublica
);

// Verificar número vendido (QR)
router.get('/publico/:rifa_id/numero/:numero/verificar',
  rifasController.verificarNumero
);

// =====================================================
// MIDDLEWARES DE VALIDACIÓN ADICIONALES
// =====================================================

// Validar que el número existe y pertenece a la rifa
const validarNumeroRifa = async (req, res, next) => {
  try {
    const { rifa_id, numero } = req.params;
    
    const [numeroData] = await db.execute(
      'SELECT id FROM numeros WHERE rifa_id = ? AND numero = ?',
      [rifa_id, numero]
    );

    if (!numeroData.length) {
      return res.status(404).json({
        status: 'error',
        message: 'Número no encontrado en esta rifa'
      });
    }

    next();
  } catch (error) {
    console.error('Error validando número:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// Aplicar validación a rutas que manejan números específicos
router.use('/:rifa_id/numeros/:numero/*', validarNumeroRifa);

export default router;