// =====================================================
// RUTAS COMPLETAS DEL SISTEMA DE RIFAS
// src/routes/rifas.js
// =====================================================

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import rifasController ,{ rifasValidations } from '../controllers/rifasController.js';
import { requireAuth, requireRole, requireOwnership } from '../middleware/auth.js';
import db from '../config/db.js'; // ✅ CORREGIDO: import como default

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

    if (usuario.rol === 'admin_global') {
      return next(); // Admin global tiene acceso a todo
    }

    // Verificar si el usuario tiene relación con la rifa
    const [relacion] = await db.execute(`
      SELECT r.institucion_promotora_id, rp.institucion_id, rp.estado_participacion
      FROM rifas r
      LEFT JOIN rifa_participaciones rp ON r.id = rp.rifa_id AND rp.institucion_id = ?
      WHERE r.id = ?
    `, [usuario.institucion_id, rifaId]);

    if (!relacion.length) {
      return res.status(404).json({
        status: 'error',
        message: 'Rifa no encontrada'
      });
    }

    const rifa = relacion[0];
    
    // Verificar permisos según rol
    const tienePermiso = 
      rifa.institucion_promotora_id === usuario.institucion_id || // Es de su institución
      rifa.estado_participacion === 'activa' || // Su institución participa
      usuario.rol === 'admin_institucion'; // Es admin de institución

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
  query('page').optional().isInt({ min: 1 }).withMessage('Página inválida'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Límite inválido'),
  query('institucion_id').optional().isInt({ min: 1 }).withMessage('ID institución inválido')
], async (req, res) => {
  try {
    req.query.estado = 'activa'; // Forzar solo rifas activas
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
    // Verificar que la rifa esté activa
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

// Ver números disponibles de rifa pública
router.get('/publicas/:id/numeros', [
  validarParametrosRifa,
  query('estado').optional().isIn(['disponible', 'vendido', 'reservado']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    // Solo mostrar números disponibles al público
    req.query.estado = req.query.estado || 'disponible';
    await rifasController.obtenerNumerosRifa(req, res);
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
});

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

// Obtener rifa específica
router.get('/:id', [
  requireAuth,
  validarParametrosRifa,
  verificarPermisoRifa
], rifasController.obtenerRifa);

// Crear nueva rifa
router.post('/', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  rifasValidations.crearRifa
], rifasController.crearRifa);

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
  body('motivo').optional().isLength({ min: 3, max: 200 }).withMessage('Motivo inválido')
], rifasController.eliminarRifa);

// =====================================================
// GESTIÓN DE NÚMEROS
// =====================================================

// Obtener números de una rifa
router.get('/:id/numeros', [
  requireAuth,
  validarParametrosRifa,
  verificarPermisoRifa,
  query('estado').optional().isIn(['disponible', 'vendido', 'reservado']),
  query('vendedor_id').optional().isInt({ min: 1 }),
  query('institucion_id').optional().isInt({ min: 1 }),
  query('desde').optional().isInt({ min: 1 }),
  query('hasta').optional().isInt({ min: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], rifasController.obtenerNumerosRifa);

// Vender número específico (para vendedores)
router.post('/:rifa_id/numeros/:numero/vender', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion', 'vendedor']),
  validarParametrosRifa,
  verificarPermisoRifa,
  rifasValidations.venderNumero
], rifasController.venderNumero);

// Reservar número
router.post('/:rifa_id/numeros/:numero/reservar', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion', 'vendedor']),
  validarParametrosRifa,
  verificarPermisoRifa,
  body('comprador_nombre').notEmpty().withMessage('Nombre del comprador requerido'),
  body('tiempo_reserva').optional().isInt({ min: 1, max: 24 }).withMessage('Tiempo de reserva inválido')
], rifasController.reservarNumero);

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
          comprador_nombre = NULL,
          comprador_apellido = NULL,
          comprador_telefono = NULL,
          vendedor_id = NULL,
          fecha_venta = NULL,
          observaciones_cancelacion = ?,
          fecha_cancelacion = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [motivo, numeroVendido[0].id]);

    // Cancelar comisión asociada
    await db.execute(`
      UPDATE rifa_comisiones 
      SET estado = 'cancelada',
          fecha_cancelacion = CURRENT_TIMESTAMP
      WHERE numero_rifa_id = ?
    `, [numeroVendido[0].id]);

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
// COMPRAS PARA USUARIOS FINALES
// =====================================================

// Comprar múltiples números (para compradores)
router.post('/:rifa_id/comprar', [
  requireAuth,
  validarParametrosRifa,
  rifasValidations.comprarNumeros
], rifasController.comprarNumeros);

// Mis rifas (rifas donde participo o he creado)
router.get('/usuario/mis-rifas', [
  requireAuth,
  query('tipo').optional().isIn(['participando', 'creadas']).withMessage('Tipo inválido')
], rifasController.misRifas);

// Mis números comprados en una rifa específica
router.get('/:rifa_id/mis-numeros', [
  requireAuth,
  validarParametrosRifa
], async (req, res) => {
  try {
    const { rifa_id } = req.params;
    const usuario_id = req.user.id;

    const [misNumeros] = await db.execute(`
      SELECT 
        nr.numero,
        nr.fecha_venta,
        nr.metodo_pago,
        r.precio_numero,
        r.nombre as rifa_nombre,
        r.fecha_sorteo
      FROM numeros_rifa nr
      JOIN rifas r ON nr.rifa_id = r.id
      WHERE nr.rifa_id = ? AND nr.comprador_id = ? AND nr.estado = 'vendido'
      ORDER BY nr.numero ASC
    `, [rifa_id, usuario_id]);

    if (!misNumeros.length) {
      return res.status(404).json({
        status: 'error',
        message: 'No tienes números en esta rifa'
      });
    }

    const resumen = {
      cantidad_numeros: misNumeros.length,
      inversion_total: misNumeros.reduce((sum, num) => sum + parseFloat(num.precio_numero), 0),
      numeros: misNumeros.map(n => n.numero),
      rifa_nombre: misNumeros[0].rifa_nombre,
      fecha_sorteo: misNumeros[0].fecha_sorteo
    };

    res.json({
      status: 'success',
      data: {
        resumen,
        detalle: misNumeros
      }
    });

  } catch (error) {
    console.error('Error al obtener mis números:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
});

// =====================================================
// ADMINISTRACIÓN DE NÚMEROS E INSTITUCIONES
// =====================================================

// Asignar números a una institución
router.post('/:rifa_id/asignar-numeros', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  validarParametrosRifa,
  verificarPermisoRifa,
  rifasValidations.asignarNumeros
], rifasController.asignarNumerosInstitucion);

// Obtener números asignados a una institución
router.get('/:rifa_id/instituciones/:institucion_id/numeros', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion', 'vendedor']),
  validarParametrosRifa,
  verificarPermisoRifa,
  param('institucion_id').isInt({ min: 1 }).withMessage('ID institución inválido')
], async (req, res) => {
  try {
    const { rifa_id, institucion_id } = req.params;
    const { estado, page = 1, limit = 50 } = req.query;

    // Verificar permisos de institución
    if (req.user.rol !== 'admin_global' && req.user.institucion_id != institucion_id) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permisos para ver números de esta institución'
      });
    }

    const offset = (page - 1) * limit;
    let whereCondition = 'WHERE na.institucion_id = ? AND nr.rifa_id = ?';
    let queryParams = [institucion_id, rifa_id];

    if (estado) {
      whereCondition += ' AND nr.estado = ?';
      queryParams.push(estado);
    }

    const [numeros] = await db.execute(`
      SELECT 
        nr.*,
        u.nombre as vendedor_nombre,
        u.apellido as vendedor_apellido
      FROM numero_asignaciones na
      JOIN numeros_rifa nr ON na.numero_rifa_id = nr.id
      LEFT JOIN usuarios u ON nr.vendedor_id = u.id
      ${whereCondition}
      ORDER BY nr.numero ASC
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), parseInt(offset)]);

    // Contar total
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total
      FROM numero_asignaciones na
      JOIN numeros_rifa nr ON na.numero_rifa_id = nr.id
      ${whereCondition}
    `, queryParams);

    const total = countResult[0].total;

    res.json({
      status: 'success',
      data: numeros,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_items: total,
        items_per_page: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error al obtener números de institución:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
});

// Obtener números de un vendedor específico
router.get('/:rifa_id/vendedor/numeros', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion', 'vendedor']),
  validarParametrosRifa,
  verificarPermisoRifa,
  query('vendedor_id').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const { rifa_id } = req.params;
    let { vendedor_id } = req.query;
    
    // Si no se especifica vendedor_id, usar el usuario actual
    if (!vendedor_id) {
      vendedor_id = req.user.id;
    }

    // Verificar permisos
    if (req.user.rol === 'vendedor' && vendedor_id != req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Solo puedes ver tus propios números'
      });
    }

    const [numeros] = await db.execute(`
      SELECT 
        nr.*,
        r.precio_numero,
        i.nombre as institucion_nombre
      FROM numeros_rifa nr
      JOIN rifas r ON nr.rifa_id = r.id
      LEFT JOIN numero_asignaciones na ON nr.id = na.numero_rifa_id
      LEFT JOIN instituciones i ON na.institucion_id = i.id
      WHERE nr.rifa_id = ? AND nr.vendedor_id = ?
      ORDER BY nr.numero ASC
    `, [rifa_id, vendedor_id]);

    const estadisticas = {
      total_asignados: numeros.length,
      vendidos: numeros.filter(n => n.estado === 'vendido').length,
      disponibles: numeros.filter(n => n.estado === 'disponible').length,
      reservados: numeros.filter(n => n.estado === 'reservado').length,
      comisiones_generadas: numeros.filter(n => n.estado === 'vendido').length * (numeros[0]?.precio_numero * 0.10 || 0)
    };

    res.json({
      status: 'success',
      data: {
        numeros,
        estadisticas
      }
    });

  } catch (error) {
    console.error('Error al obtener números del vendedor:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
});

// =====================================================
// REPORTES Y ESTADÍSTICAS
// =====================================================

// Estadísticas generales de la rifa
router.get('/:rifa_id/estadisticas', [
  requireAuth,
  validarParametrosRifa,
  verificarPermisoRifa
], rifasController.estadisticasRifa);

// Reporte de ventas por institución
router.get('/:rifa_id/reporte-instituciones', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  validarParametrosRifa,
  verificarPermisoRifa
], rifasController.reporteVentasInstitucion);

// Reporte de ventas por vendedor
router.get('/:rifa_id/reporte-vendedores', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  validarParametrosRifa,
  verificarPermisoRifa
], rifasController.reporteVentasVendedores);

// Reporte de comisiones
router.get('/:rifa_id/comisiones', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  validarParametrosRifa,
  verificarPermisoRifa
], async (req, res) => {
  try {
    const { rifa_id } = req.params;

    const [comisiones] = await db.execute(`
      SELECT 
        rc.*,
        u.nombre as vendedor_nombre,
        u.apellido as vendedor_apellido,
        i.nombre as institucion_nombre,
        nr.numero,
        r.nombre as rifa_nombre
      FROM rifa_comisiones rc
      JOIN usuarios u ON rc.vendedor_id = u.id
      JOIN instituciones i ON rc.institucion_id = i.id
      JOIN numeros_rifa nr ON rc.numero_rifa_id = nr.id
      JOIN rifas r ON rc.rifa_id = r.id
      WHERE rc.rifa_id = ?
      ORDER BY rc.fecha_generacion DESC
    `, [rifa_id]);

    const resumen = {
      total_comisiones: comisiones.reduce((sum, c) => sum + parseFloat(c.monto_comision), 0),
      pendientes: comisiones.filter(c => c.estado === 'pendiente').length,
      pagadas: comisiones.filter(c => c.estado === 'pagada').length,
      canceladas: comisiones.filter(c => c.estado === 'cancelada').length
    };

    res.json({
      status: 'success',
      data: {
        resumen,
        detalle: comisiones
      }
    });

  } catch (error) {
    console.error('Error al obtener comisiones:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
});

// Exportar datos de rifa (CSV/Excel)
router.get('/:rifa_id/exportar', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  validarParametrosRifa,
  verificarPermisoRifa,
  query('formato').optional().isIn(['csv', 'excel']).withMessage('Formato inválido'),
  query('tipo').optional().isIn(['numeros', 'ventas', 'comisiones']).withMessage('Tipo inválido')
], async (req, res) => {
  try {
    const { rifa_id } = req.params;
    const { formato = 'csv', tipo = 'numeros' } = req.query;

    let query = '';
    let filename = '';

    switch (tipo) {
      case 'numeros':
        query = `
          SELECT 
            nr.numero,
            nr.estado,
            nr.comprador_nombre,
            nr.comprador_apellido,
            nr.comprador_telefono,
            nr.fecha_venta,
            u.nombre as vendedor_nombre,
            u.apellido as vendedor_apellido,
            i.nombre as institucion_nombre
          FROM numeros_rifa nr
          LEFT JOIN usuarios u ON nr.vendedor_id = u.id
          LEFT JOIN numero_asignaciones na ON nr.id = na.numero_rifa_id
          LEFT JOIN instituciones i ON na.institucion_id = i.id
          WHERE nr.rifa_id = ?
          ORDER BY nr.numero
        `;
        filename = `rifa_${rifa_id}_numeros`;
        break;
      
      case 'ventas':
        query = `
          SELECT 
            nr.numero,
            nr.comprador_nombre,
            nr.comprador_apellido,
            nr.comprador_telefono,
            nr.fecha_venta,
            nr.metodo_pago,
            r.precio_numero,
            u.nombre as vendedor_nombre,
            i.nombre as institucion_nombre
          FROM numeros_rifa nr
          JOIN rifas r ON nr.rifa_id = r.id
          LEFT JOIN usuarios u ON nr.vendedor_id = u.id
          LEFT JOIN numero_asignaciones na ON nr.id = na.numero_rifa_id
          LEFT JOIN instituciones i ON na.institucion_id = i.id
          WHERE nr.rifa_id = ? AND nr.estado = 'vendido'
          ORDER BY nr.fecha_venta DESC
        `;
        filename = `rifa_${rifa_id}_ventas`;
        break;
      
      case 'comisiones':
        query = `
          SELECT 
            nr.numero,
            u.nombre as vendedor_nombre,
            u.apellido as vendedor_apellido,
            i.nombre as institucion_nombre,
            rc.precio_venta,
            rc.porcentaje_comision,
            rc.monto_comision,
            rc.estado,
            rc.fecha_generacion,
            rc.fecha_pago
          FROM rifa_comisiones rc
          JOIN numeros_rifa nr ON rc.numero_rifa_id = nr.id
          JOIN usuarios u ON rc.vendedor_id = u.id
          JOIN instituciones i ON rc.institucion_id = i.id
          WHERE rc.rifa_id = ?
          ORDER BY rc.fecha_generacion DESC
        `;
        filename = `rifa_${rifa_id}_comisiones`;
        break;
    }

    const [datos] = await db.execute(query, [rifa_id]);

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
      // Para Excel, devolver JSON que el frontend puede procesar
      res.json({
        status: 'success',
        data: datos,
        filename: `${filename}.xlsx`
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
// GESTIÓN DE PARTICIPACIONES DE INSTITUCIONES
// =====================================================

// Invitar institución a participar
router.post('/:rifa_id/invitar-institucion', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  validarParametrosRifa,
  verificarPermisoRifa,
  body('institucion_id').isInt({ min: 1 }).withMessage('ID institución inválido'),
  body('numeros_asignados').optional().isInt({ min: 1 }).withMessage('Números asignados inválido'),
  body('porcentaje_comision').optional().isFloat({ min: 0, max: 100 }).withMessage('Porcentaje inválido')
], async (req, res) => {
  try {
    const { rifa_id } = req.params;
    const { institucion_id, numeros_asignados, porcentaje_comision = 10 } = req.body;

    // Verificar que la institución no esté ya participando
    const [participacionExistente] = await db.execute(`
      SELECT id FROM rifa_participaciones 
      WHERE rifa_id = ? AND institucion_id = ?
    `, [rifa_id, institucion_id]);

    if (participacionExistente.length) {
      return res.status(400).json({
        status: 'error',
        message: 'La institución ya participa en esta rifa'
      });
    }

    // Crear participación
    await db.execute(`
      INSERT INTO rifa_participaciones (
        rifa_id, institucion_id, estado_participacion,
        numeros_asignados, porcentaje_comision, invitado_por
      ) VALUES (?, ?, 'invitada', ?, ?, ?)
    `, [rifa_id, institucion_id, numeros_asignados, porcentaje_comision, req.user.id]);

    res.json({
      status: 'success',
      message: 'Institución invitada exitosamente'
    });

  } catch (error) {
    console.error('Error al invitar institución:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
});

// Aceptar/rechazar participación en rifa
router.put('/:rifa_id/participacion', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  validarParametrosRifa,
  body('accion').isIn(['aceptar', 'rechazar']).withMessage('Acción inválida')
], async (req, res) => {
  try {
    const { rifa_id } = req.params;
    const { accion } = req.body;
    const institucion_id = req.user.institucion_id;

    const nuevoEstado = accion === 'aceptar' ? 'activa' : 'rechazada';

    const [result] = await db.execute(`
      UPDATE rifa_participaciones 
      SET estado_participacion = ?,
          fecha_respuesta = CURRENT_TIMESTAMP
      WHERE rifa_id = ? AND institucion_id = ? AND estado_participacion = 'invitada'
    `, [nuevoEstado, rifa_id, institucion_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontró invitación pendiente'
      });
    }

    res.json({
      status: 'success',
      message: `Participación ${accion === 'aceptar' ? 'aceptada' : 'rechazada'} exitosamente`
    });

  } catch (error) {
    console.error('Error al actualizar participación:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
});

// =====================================================
// TAREAS AUTOMATIZADAS
// =====================================================

// Liberar números reservados expirados (endpoint para cron job)
router.post('/sistema/liberar-reservas', [
  requireAuth,
  requireRole(['admin_global'])
], async (req, res) => {
  try {
    const [result] = await db.execute(`
      UPDATE numeros_rifa 
      SET estado = 'disponible',
          comprador_nombre = NULL,
          vendedor_id = NULL,
          fecha_reserva = NULL,
          reserva_expira = NULL
      WHERE estado = 'reservado' 
        AND reserva_expira < NOW()
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
// MANEJO DE ERRORES Y MIDDLEWARE FINAL
// =====================================================

// Middleware de manejo de errores específico para rifas
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