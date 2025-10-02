// =====================================================
// RUTAS COMPLETAS DEL SISTEMA DE RIFAS
// src/routes/rifas.js
// =====================================================

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import rifasController, { rifasValidations } from '../controllers/rifasController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import db from '../config/db.js';
import { requireVerifiedEmail } from '../middleware/emailVerification.js';

const router = Router();

// =====================================================
// MIDDLEWARE ESPECÍFICO PARA RIFAS
// =====================================================

// Middleware para verificar permisos sobre una rifa específica
const verificarPermisoRifa = async (req, res, next) => {
  try {
    const { rifa_id, id } = req.params;
    const rifaId = rifa_id || id;
    const usuario = req.user;

    if (usuario.role === 'admin_global') {
      return next(); // Admin global tiene acceso a todo
    }

    // Verificar si el usuario tiene relación con la rifa
    const [rifa] = await db.execute(`
      SELECT * FROM rifas WHERE id = ?
    `, [rifaId]);

    if (!rifa.length) {
      return res.status(404).json({
        status: 'error',
        message: 'Rifa no encontrada'
      });
    }

    // Verificar permisos según rol
    const tienePermiso = 
      rifa[0].institucion_promotora_id === usuario.institucion_id || // Es de su institución
      usuario.role === 'admin_global' || // Es admin global
      rifa[0].creado_por === usuario.id; // Es el creador

    if (!tienePermiso) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permisos para acceder a esta rifa'
      });
    }

    next();
  } catch (error) {
    console.error('Error verificando permisos:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// Middleware para validar parámetros de rifa
const validarParametrosRifa = [
  param('id').optional().isInt({ min: 1 }).withMessage('ID de rifa inválido'),
  param('rifa_id').optional().isInt({ min: 1 }).withMessage('ID de rifa inválido'),
  param('numero').optional().isInt({ min: 1 }).withMessage('Número inválido')
];

// =====================================================
// RUTAS PÚBLICAS (SOLO LECTURA)
// =====================================================

// Listar rifas públicas (activas)
router.get('/publicas', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('institucion_id').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    req.query.estado = 'activa';
    await rifasController.listarRifas(req, res);
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
});

// Ver detalles de rifa pública
router.get('/publicas/:id', [
  validarParametrosRifa
], async (req, res) => {
  try {
    const [rifa] = await db.execute('SELECT estado FROM rifas WHERE id = ?', [req.params.id]);
    
    if (!rifa.length || rifa[0].estado !== 'activa') {
      return res.status(404).json({
        status: 'error',
        message: 'Rifa no encontrada o no disponible'
      });
    }
    
    await rifasController.obtenerRifa(req, res);
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
});

// =====================================================
// RUTAS GLOBALES DE USUARIO (ANTES DE PARÁMETROS)
// =====================================================

// Todos mis números comprados (endpoint global)
router.get('/usuario/mis-numeros', [
  requireAuth
], rifasController.getMisNumerosTodos);

// Mis rifas (rifas donde participo o he creado)
router.get('/usuario/mis-rifas', [
  requireAuth,
  query('tipo').optional().isIn(['participando', 'creadas'])
], rifasController.misRifas);

// =====================================================
// RUTAS AUTENTICADAS - CRUD BÁSICO
// =====================================================

// Listar todas las rifas (con filtros)
router.get('/', [
  requireAuth,
  query('estado').optional().isIn(['borrador', 'activa', 'cerrada', 'finalizada', 'cancelada']),
  query('institucion_id').optional().isInt({ min: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], rifasController.listarRifas);

// Crear nueva rifa
router.post('/', [
  requireAuth,
  requireVerifiedEmail,
  requireRole(['admin_global', 'admin_institucion']),
  rifasValidations.crearRifa
], rifasController.crearRifa);

// Obtener rifa específica
router.get('/:id', [
  requireAuth,
  validarParametrosRifa,
  verificarPermisoRifa
], rifasController.obtenerRifa);

// Actualizar rifa
router.put('/:id', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  validarParametrosRifa,
  verificarPermisoRifa,
  rifasValidations.actualizarRifa
], rifasController.actualizarRifa);

// Eliminar/Cancelar rifa
router.delete('/:id', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  validarParametrosRifa,
  verificarPermisoRifa,
  body('motivo').optional().isLength({ min: 3, max: 200 })
], rifasController.eliminarRifa);

// =====================================================
// GESTIÓN DE NÚMEROS
// =====================================================

// Obtener números de una rifa
router.get('/:id/numeros', [
  requireAuth,
  validarParametrosRifa,
  query('estado').optional().isIn(['disponible', 'vendido', 'reservado']),
  query('vendedor_id').optional().isInt({ min: 1 }),
  query('desde').optional().isInt({ min: 1 }),
  query('hasta').optional().isInt({ min: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 500 })
], rifasController.obtenerNumerosRifa);

// Generar números de rifa
router.post('/:id/numeros/generar', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  validarParametrosRifa,
  verificarPermisoRifa
], rifasController.generarNumerosRifa);

// =====================================================
// COMPRAS PARA USUARIOS FINALES - NUEVAS RUTAS
// =====================================================

// Comprar múltiples números
router.post('/:id/comprar', [
  requireAuth,
  requireVerifiedEmail,
  validarParametrosRifa,
  body('numeros').isArray({ min: 1, max: 10 }).withMessage('Debe seleccionar entre 1 y 10 números'),
  body('numeros.*').isInt({ min: 1 }).withMessage('Los números deben ser enteros positivos'),
  body('comprador_info.nombre').notEmpty().withMessage('Nombre del comprador requerido'),
  body('comprador_info.apellido').notEmpty().withMessage('Apellido del comprador requerido'),
  body('comprador_info.telefono').optional().isMobilePhone('any').withMessage('Teléfono inválido'),
  body('comprador_info.email').optional().isEmail().withMessage('Email inválido'),
  body('metodo_pago').isIn(['efectivo', 'transferencia', 'tarjeta', 'mercadopago']).withMessage('Método de pago inválido'),
  body('observaciones').optional().isLength({ max: 500 }).withMessage('Observaciones muy largas')
], rifasController.comprarNumeros);

// Mis números comprados en una rifa específica
router.get('/:id/mis-numeros', [
  requireAuth,
  validarParametrosRifa
], rifasController.getMisNumerosRifa);

// Verificar disponibilidad de números específicos
router.post('/:id/verificar-disponibilidad', [
  requireAuth,
  validarParametrosRifa,
  body('numeros').isArray({ min: 1 }).withMessage('Debe especificar números')
], rifasController.verificarDisponibilidad);

// Reservar números temporalmente (opcional)
router.post('/:id/reservar', [
  requireAuth,
   requireVerifiedEmail,
  validarParametrosRifa,
  body('numeros').isArray({ min: 1 }).withMessage('Debe especificar números'),
  body('tiempo_reserva').optional().isInt({ min: 5, max: 60 }).withMessage('Tiempo de reserva inválido')
], rifasController.reservarNumeros);

// Cancelar reserva
router.post('/:id/cancelar-reserva', [
  requireAuth,
  validarParametrosRifa,
  body('numeros').isArray({ min: 1 }).withMessage('Debe especificar números')
], rifasController.cancelarReserva);

// =====================================================
// VENTA MANUAL DE NÚMEROS (PARA VENDEDORES)
// =====================================================

// Vender número específico (para vendedores)
router.post('/:rifa_id/numeros/:numero/vender', [
  requireAuth,
  requireVerifiedEmail,
  requireRole(['admin_global', 'admin_institucion', 'vendedor']),
  validarParametrosRifa,
  body('comprador_nombre').notEmpty().withMessage('Nombre del comprador requerido'),
  body('comprador_apellido').notEmpty().withMessage('Apellido del comprador requerido'),
  body('comprador_telefono').optional().isMobilePhone('any'),
  body('comprador_email').optional().isEmail(),
  body('metodo_pago').optional().isIn(['efectivo', 'transferencia', 'tarjeta', 'mercadopago'])
], rifasController.venderNumero);

// Reservar número específico
router.post('/:rifa_id/numeros/:numero/reservar', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion', 'vendedor']),
  validarParametrosRifa,
  body('comprador_nombre').notEmpty().withMessage('Nombre del comprador requerido'),
  body('tiempo_reserva').optional().isInt({ min: 1, max: 24 })
], rifasController.reservarNumero);

// =====================================================
// REPORTES Y ESTADÍSTICAS
// =====================================================

// Estadísticas generales de la rifa
router.get('/:id/estadisticas', [
  requireAuth,
  validarParametrosRifa,
  verificarPermisoRifa
], rifasController.estadisticasRifa);

// Reporte de ventas por institución
router.get('/:id/reporte-instituciones', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  validarParametrosRifa,
  verificarPermisoRifa
], rifasController.reporteVentasInstitucion);

// Reporte de ventas por vendedor
router.get('/:id/reporte-vendedores', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  validarParametrosRifa,
  verificarPermisoRifa
], rifasController.reporteVentasVendedores);

// =====================================================
// ADMINISTRACIÓN AVANZADA
// =====================================================

// Asignar números a una institución
router.post('/:id/asignar-numeros', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  validarParametrosRifa,
  verificarPermisoRifa,
  body('institucion_id').isInt({ min: 1 }).withMessage('ID institución inválido'),
  body('desde_numero').isInt({ min: 1 }).withMessage('Número inicial inválido'),
  body('hasta_numero').isInt({ min: 1 }).withMessage('Número final inválido')
], rifasController.asignarNumerosInstitucion);

// Cancelar venta (solo administradores)
router.delete('/:rifa_id/numeros/:numero/venta', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  validarParametrosRifa,
  verificarPermisoRifa,
  body('motivo').notEmpty().withMessage('Motivo de cancelación requerido')
], async (req, res) => {
  try {
    const { rifa_id, numero } = req.params;
    const { motivo } = req.body;

    // Encontrar el número vendido
    const [numeroVendido] = await db.execute(`
      SELECT * FROM numeros_rifa 
      WHERE rifa_id = ? AND numero = ? AND estado = 'vendido'
    `, [rifa_id, numero]);

    if (!numeroVendido.length) {
      return res.status(404).json({
        status: 'error',
        message: 'Número no encontrado o no está vendido'
      });
    }

    // Marcar como disponible y registrar cancelación
    await db.execute(`
      UPDATE numeros_rifa 
      SET estado = 'disponible',
          comprador_id = NULL,
          vendedor_id = NULL,
          fecha_venta = NULL,
          observaciones = ?,
          fecha_actualizacion = NOW()
      WHERE id = ?
    `, [`Venta cancelada: ${motivo}`, numeroVendido[0].id]);

    res.json({
      status: 'success',
      message: 'Venta cancelada exitosamente',
      data: {
        numero: parseInt(numero),
        motivo: motivo
      }
    });

  } catch (error) {
    console.error('Error al cancelar venta:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
});

// =====================================================
// EXPORTACIÓN DE DATOS
// =====================================================

// Exportar datos de rifa (CSV/JSON)
router.get('/:id/exportar', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  validarParametrosRifa,
  verificarPermisoRifa,
  query('formato').optional().isIn(['csv', 'json']),
  query('tipo').optional().isIn(['numeros', 'ventas', 'estadisticas'])
], async (req, res) => {
  try {
    const { id } = req.params;
    const { formato = 'json', tipo = 'numeros' } = req.query;

    let query = '';
    let filename = '';

    switch (tipo) {
      case 'numeros':
        query = `
          SELECT 
            n.numero,
            n.estado,
            n.fecha_venta,
            n.monto_pagado,
            n.metodo_pago,
            CONCAT(COALESCE(c.nombre, ''), ' ', COALESCE(c.apellido, '')) as comprador,
            CONCAT(COALESCE(v.nombre, ''), ' ', COALESCE(v.apellido, '')) as vendedor
          FROM numeros_rifa n
          LEFT JOIN usuarios c ON n.comprador_id = c.id
          LEFT JOIN usuarios v ON n.vendedor_id = v.id
          WHERE n.rifa_id = ?
          ORDER BY n.numero
        `;
        filename = `rifa_${id}_numeros`;
        break;
      
      case 'ventas':
        query = `
          SELECT 
            n.numero,
            n.fecha_venta,
            n.monto_pagado,
            n.metodo_pago,
            CONCAT(COALESCE(c.nombre, ''), ' ', COALESCE(c.apellido, '')) as comprador,
            CONCAT(COALESCE(v.nombre, ''), ' ', COALESCE(v.apellido, '')) as vendedor
          FROM numeros_rifa n
          LEFT JOIN usuarios c ON n.comprador_id = c.id
          LEFT JOIN usuarios v ON n.vendedor_id = v.id
          WHERE n.rifa_id = ? AND n.estado = 'vendido'
          ORDER BY n.fecha_venta DESC
        `;
        filename = `rifa_${id}_ventas`;
        break;
      
      case 'estadisticas':
        query = `
          SELECT 
            r.nombre as rifa_nombre,
            r.cantidad_numeros,
            r.precio_numero,
            COUNT(n.id) as numeros_generados,
            SUM(CASE WHEN n.estado = 'vendido' THEN 1 ELSE 0 END) as vendidos,
            SUM(CASE WHEN n.estado = 'disponible' THEN 1 ELSE 0 END) as disponibles,
            SUM(CASE WHEN n.estado = 'reservado' THEN 1 ELSE 0 END) as reservados,
            SUM(CASE WHEN n.estado = 'vendido' THEN n.monto_pagado ELSE 0 END) as total_recaudado
          FROM rifas r
          LEFT JOIN numeros_rifa n ON r.id = n.rifa_id
          WHERE r.id = ?
          GROUP BY r.id
        `;
        filename = `rifa_${id}_estadisticas`;
        break;
    }

    const [datos] = await db.execute(query, [id]);

    if (!datos.length) {
      return res.status(404).json({
        status: 'error',
        message: 'No hay datos para exportar'
      });
    }

    if (formato === 'csv') {
      // Generar CSV
      const headers = Object.keys(datos[0]).join(',');
      const rows = datos.map(row => 
        Object.values(row).map(val => 
          val === null ? '' : `"${val.toString().replace(/"/g, '""')}"`
        ).join(',')
      );
      
      const csv = [headers, ...rows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else {
      // Devolver JSON
      res.json({
        status: 'success',
        data: datos,
        filename: `${filename}.json`
      });
    }

  } catch (error) {
    console.error('Error al exportar datos:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
});

// =====================================================
// TAREAS DEL SISTEMA
// =====================================================

// Liberar números reservados expirados
router.post('/sistema/liberar-reservas', [
  requireAuth,
  requireRole(['admin_global'])
], async (req, res) => {
  try {
    const [result] = await db.execute(`
      UPDATE numeros_rifa 
      SET estado = 'disponible',
          comprador_id = NULL,
          vendedor_id = NULL,
          fecha_reserva = NULL,
          fecha_expiracion_reserva = NULL
      WHERE estado = 'reservado' 
        AND fecha_expiracion_reserva < NOW()
    `);

    res.json({
      status: 'success',
      message: `Se liberaron ${result.affectedRows} números reservados expirados`
    });

  } catch (error) {
    console.error('Error al liberar reservas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
});

// =====================================================
// MANEJO DE ERRORES
// =====================================================

router.use((error, req, res, next) => {
  console.error('Error en rutas de rifas:', error);
  
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({
      status: 'error',
      message: 'Ya existe un registro con esos datos'
    });
  }
  
  if (error.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({
      status: 'error',
      message: 'Referencia inválida a registro inexistente'
    });
  }
  
  res.status(500).json({
    status: 'error',
    message: 'Error interno del servidor'
  });
});

export default router;