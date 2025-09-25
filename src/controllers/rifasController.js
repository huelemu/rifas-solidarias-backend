// =====================================================
// CONTROLADOR COMPLETO PARA EL SISTEMA DE RIFAS
// src/controllers/rifasController.js
// =====================================================

import db from '../config/db.js'; // ✅ CORREGIDO: import como default
import { body, validationResult } from 'express-validator';

// Función para generar números únicos para la rifa
function generarNumerosRifa(cantidad) {
  const numeros = new Set();
  while (numeros.size < cantidad) {
    const numero = Math.floor(Math.random() * 10000); // ajusta rango si querés
    numeros.add(numero);
  }
  return Array.from(numeros);
}


const rifasController = {

  // =====================================================
  // CRUD BÁSICO DE RIFAS
  // =====================================================

  // Listar todas las rifas con filtros
  async listarRifas(req, res) {
    try {
      const { 
        estado, 
        institucion_id, 
        creado_por, 
        desde_fecha, 
        hasta_fecha,
        page = 1, 
        limit = 10 
      } = req.query;

      const offset = (page - 1) * limit;
      
      let whereConditions = [];
      let queryParams = [];

      // Construir condiciones WHERE dinámicamente
      if (estado) {
        whereConditions.push('r.estado = ?');
        queryParams.push(estado);
      }

      if (institucion_id) {
        whereConditions.push('r.institucion_promotora_id = ?');
        queryParams.push(institucion_id);
      }

      if (creado_por) {
        whereConditions.push('r.creado_por = ?');
        queryParams.push(creado_por);
      }

      if (desde_fecha) {
        whereConditions.push('r.fecha_inicio >= ?');
        queryParams.push(desde_fecha);
      }

      if (hasta_fecha) {
        whereConditions.push('r.fecha_fin <= ?');
        queryParams.push(hasta_fecha);
      }

      const whereClause = whereConditions.length > 0 
        ? 'WHERE ' + whereConditions.join(' AND ')
        : '';

      const query = `
        SELECT 
          r.*,
          i.nombre as institucion_nombre,
          u.nombre as creador_nombre,
          u.apellido as creador_apellido,
          -- Estadísticas calculadas
          COALESCE(COUNT(nr.id), 0) as total_numeros_generados,
          COALESCE(SUM(CASE WHEN nr.estado = 'vendido' THEN 1 ELSE 0 END), 0) as numeros_vendidos,
          COALESCE(SUM(CASE WHEN nr.estado = 'disponible' THEN 1 ELSE 0 END), 0) as numeros_disponibles,
          COALESCE(SUM(CASE WHEN nr.estado = 'vendido' THEN r.precio_numero ELSE 0 END), 0) as recaudado,
          ROUND(
            (COALESCE(SUM(CASE WHEN nr.estado = 'vendido' THEN 1 ELSE 0 END), 0) * 100.0) / 
            NULLIF(r.cantidad_numeros, 0), 2
          ) as porcentaje_vendido
        FROM rifas r
        LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
        LEFT JOIN usuarios u ON r.creado_por = u.id
        LEFT JOIN numeros_rifa nr ON r.id = nr.rifa_id
        ${whereClause}
        GROUP BY r.id
        ORDER BY r.fecha_creacion DESC
        LIMIT ? OFFSET ?
      `;

      queryParams.push(parseInt(limit), parseInt(offset));

      const [rifas] = await db.execute(query, queryParams);

      // Contar total para paginación
      const countQuery = `
        SELECT COUNT(DISTINCT r.id) as total
        FROM rifas r
        LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
        ${whereClause}
      `;

      const [countResult] = await db.execute(countQuery, 
        queryParams.slice(0, queryParams.length - 2)
      );

      const total = countResult[0].total;
      const totalPages = Math.ceil(total / limit);

      res.json({
        status: 'success',
        data: rifas,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_items: total,
          items_per_page: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Error al listar rifas:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener rifa específica con detalles completos
  async obtenerRifa(req, res) {
    try {
      const { id } = req.params;

      const query = `
        SELECT 
          r.*,
          i.nombre as institucion_nombre,
          i.descripcion as institucion_descripcion,
          i.logo_url as institucion_logo,
          u.nombre as creador_nombre,
          u.apellido as creador_apellido,
          -- Estadísticas detalladas
          COALESCE(COUNT(nr.id), 0) as total_numeros_generados,
          COALESCE(SUM(CASE WHEN nr.estado = 'vendido' THEN 1 ELSE 0 END), 0) as numeros_vendidos,
          COALESCE(SUM(CASE WHEN nr.estado = 'disponible' THEN 1 ELSE 0 END), 0) as numeros_disponibles,
          COALESCE(SUM(CASE WHEN nr.estado = 'reservado' THEN 1 ELSE 0 END), 0) as numeros_reservados,
          COALESCE(SUM(CASE WHEN nr.estado = 'vendido' THEN r.precio_numero ELSE 0 END), 0) as recaudado,
          (r.cantidad_numeros * r.precio_numero) as total_potencial,
          ROUND(
            (COALESCE(SUM(CASE WHEN nr.estado = 'vendido' THEN 1 ELSE 0 END), 0) * 100.0) / 
            NULLIF(r.cantidad_numeros, 0), 2
          ) as porcentaje_vendido
        FROM rifas r
        LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
        LEFT JOIN usuarios u ON r.creado_por = u.id
        LEFT JOIN numeros_rifa nr ON r.id = nr.rifa_id
        WHERE r.id = ?
        GROUP BY r.id
      `;

      const [rifas] = await db.execute(query, [id]);

      if (!rifas.length) {
        return res.status(404).json({
          status: 'error',
          message: 'Rifa no encontrada'
        });
      }

      const rifa = rifas[0];

      // Obtener instituciones participantes
      const [participaciones] = await db.execute(`
        SELECT 
          rp.*,
          i.nombre as institucion_nombre,
          i.logo_url as institucion_logo
        FROM rifa_participaciones rp
        LEFT JOIN instituciones i ON rp.institucion_id = i.id
        WHERE rp.rifa_id = ?
        ORDER BY rp.fecha_participacion DESC
      `, [id]);

      rifa.instituciones_participantes = participaciones;

      res.json({
        status: 'success',
        data: rifa
      });

    } catch (error) {
      console.error('Error al obtener rifa:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // Crear nueva rifa
async crearRifa(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Datos inválidos',
        errors: errors.array()
      });
    }

    const {
      nombre,
      descripcion,
      cantidad_numeros,
      precio_numero,
      fecha_inicio,
      fecha_fin,
      fecha_sorteo,
      institucion_promotora_id,
      imagen_url,
      reglas_adicionales
    } = req.body;

    const creado_por = req.user.id;

    // Validaciones de negocio
    if (new Date(fecha_inicio) >= new Date(fecha_fin)) {
      return res.status(400).json({
        status: 'error',
        message: 'La fecha de inicio debe ser anterior a la fecha de fin'
      });
    }

    if (fecha_sorteo && new Date(fecha_sorteo) <= new Date(fecha_fin)) {
      return res.status(400).json({
        status: 'error',
        message: 'La fecha de sorteo debe ser posterior a la fecha de fin'
      });
    }

    if (req.user.rol !== 'admin_global' && req.user.institucion_id !== institucion_promotora_id) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permisos para crear rifas para esta institución'
      });
    }

    const insertQuery = `
      INSERT INTO rifas (
        nombre, descripcion, cantidad_numeros, precio_numero,
        fecha_inicio, fecha_fin, fecha_sorteo,
        institucion_promotora_id, creado_por, imagen_url, reglas_adicionales
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(insertQuery, [
      nombre ?? null,
      descripcion ?? null,
      cantidad_numeros ?? null,
      precio_numero ?? null,
      fecha_inicio ?? null,
      fecha_fin ?? null,
      fecha_sorteo ?? null,
      institucion_promotora_id ?? null,
      creado_por ?? null,
      imagen_url ?? null,
      reglas_adicionales ?? null
    ]);

    const rifa_id = result.insertId;

    // ✅ CORRECCIÓN: llamar al método desde rifasController
    await rifasController.generarNumerosRifa(rifa_id, cantidad_numeros);

    const [rifaCreada] = await db.execute(`
      SELECT r.*, i.nombre as institucion_nombre
      FROM rifas r
      LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
      WHERE r.id = ?
    `, [rifa_id]);

    res.status(201).json({
      status: 'success',
      message: 'Rifa creada exitosamente',
      data: rifaCreada[0]
    });

  } catch (error) {
    console.error('Error al crear rifa:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
},

// Actualizar rifa
  async actualizarRifa(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Datos inválidos',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const {
        nombre,
        descripcion,
        fecha_fin,
        fecha_sorteo,
        imagen_url,
        reglas_adicionales,
        estado
      } = req.body;

      // Verificar que la rifa existe y el usuario tiene permisos
      const [rifaExistente] = await db.execute(`
        SELECT * FROM rifas WHERE id = ?
      `, [id]);

      if (!rifaExistente.length) {
        return res.status(404).json({
          status: 'error',
          message: 'Rifa no encontrada'
        });
      }

      const rifa = rifaExistente[0];

      // Verificar permisos
      if (req.user.rol !== 'admin_global' && 
          req.user.institucion_id !== rifa.institucion_promotora_id) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permisos para editar esta rifa'
        });
      }

      // Validaciones de negocio
      if (rifa.estado === 'finalizada' || rifa.estado === 'cancelada') {
        return res.status(400).json({
          status: 'error',
          message: 'No se puede editar una rifa finalizada o cancelada'
        });
      }

      // Construir query de actualización dinámico
      const updateFields = [];
      const updateValues = [];

      if (nombre) {
        updateFields.push('nombre = ?');
        updateValues.push(nombre);
      }

      if (descripcion !== undefined) {
        updateFields.push('descripcion = ?');
        updateValues.push(descripcion);
      }

      if (fecha_fin) {
        updateFields.push('fecha_fin = ?');
        updateValues.push(fecha_fin);
      }

      if (fecha_sorteo) {
        updateFields.push('fecha_sorteo = ?');
        updateValues.push(fecha_sorteo);
      }

      if (imagen_url !== undefined) {
        updateFields.push('imagen_url = ?');
        updateValues.push(imagen_url);
      }

      if (reglas_adicionales !== undefined) {
        updateFields.push('reglas_adicionales = ?');
        updateValues.push(reglas_adicionales);
      }

      if (estado) {
        updateFields.push('estado = ?');
        updateValues.push(estado);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'No hay campos para actualizar'
        });
      }

      updateFields.push('fecha_actualizacion = CURRENT_TIMESTAMP');
      updateValues.push(id);

      const updateQuery = `
        UPDATE rifas 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;

      await db.execute(updateQuery, updateValues);

      // Obtener rifa actualizada
      const [rifaActualizada] = await db.execute(`
        SELECT r.*, i.nombre as institucion_nombre
        FROM rifas r
        LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
        WHERE r.id = ?
      `, [id]);

      res.json({
        status: 'success',
        message: 'Rifa actualizada exitosamente',
        data: rifaActualizada[0]
      });

    } catch (error) {
      console.error('Error al actualizar rifa:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // Eliminar/Cancelar rifa
  async eliminarRifa(req, res) {
    try {
      const { id } = req.params;
      const { motivo } = req.body;

      // Verificar que la rifa existe
      const [rifaExistente] = await db.execute(`
        SELECT * FROM rifas WHERE id = ?
      `, [id]);

      if (!rifaExistente.length) {
        return res.status(404).json({
          status: 'error',
          message: 'Rifa no encontrada'
        });
      }

      const rifa = rifaExistente[0];

      // Verificar permisos
      if (req.user.rol !== 'admin_global' && 
          req.user.institucion_id !== rifa.institucion_promotora_id) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permisos para eliminar esta rifa'
        });
      }

      // Verificar si hay números vendidos
      const [numerosVendidos] = await db.execute(`
        SELECT COUNT(*) as vendidos FROM numeros_rifa 
        WHERE rifa_id = ? AND estado = 'vendido'
      `, [id]);

      if (numerosVendidos[0].vendidos > 0) {
        // Si hay números vendidos, cancelar en lugar de eliminar
        await db.execute(`
          UPDATE rifas 
          SET estado = 'cancelada', 
              observaciones_cancelacion = ?,
              fecha_actualizacion = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [motivo || 'Cancelada por administrador', id]);

        res.json({
          status: 'success',
          message: 'Rifa cancelada exitosamente (tenía números vendidos)'
        });
      } else {
        // Si no hay números vendidos, eliminar completamente
        await db.execute('DELETE FROM numeros_rifa WHERE rifa_id = ?', [id]);
        await db.execute('DELETE FROM rifa_participaciones WHERE rifa_id = ?', [id]);
        await db.execute('DELETE FROM rifas WHERE id = ?', [id]);

        res.json({
          status: 'success',
          message: 'Rifa eliminada exitosamente'
        });
      }

    } catch (error) {
      console.error('Error al eliminar rifa:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // =====================================================
  // GESTIÓN DE NÚMEROS
  // =====================================================

  // Obtener números de una rifa con filtros
  async obtenerNumerosRifa(req, res) {
    try {
      const { id } = req.params;
      const { 
        estado, 
        vendedor_id, 
        institucion_id,
        desde, 
        hasta,
        page = 1,
        limit = 50
      } = req.query;

      const offset = (page - 1) * limit;
      
      let whereConditions = ['nr.rifa_id = ?'];
      let queryParams = [id];

      if (estado) {
        whereConditions.push('nr.estado = ?');
        queryParams.push(estado);
      }

      if (vendedor_id) {
        whereConditions.push('nr.vendedor_id = ?');
        queryParams.push(vendedor_id);
      }

      if (institucion_id) {
        whereConditions.push('na.institucion_id = ?');
        queryParams.push(institucion_id);
      }

      if (desde) {
        whereConditions.push('nr.numero >= ?');
        queryParams.push(desde);
      }

      if (hasta) {
        whereConditions.push('nr.numero <= ?');
        queryParams.push(hasta);
      }

      const whereClause = 'WHERE ' + whereConditions.join(' AND ');

      const query = `
        SELECT 
          nr.*,
          na.institucion_id,
          i.nombre as institucion_nombre,
          v.nombre as vendedor_nombre,
          v.apellido as vendedor_apellido,
          c.nombre as comprador_nombre,
          c.apellido as comprador_apellido,
          c.telefono as comprador_telefono
        FROM numeros_rifa nr
        LEFT JOIN numero_asignaciones na ON nr.id = na.numero_rifa_id
        LEFT JOIN instituciones i ON na.institucion_id = i.id
        LEFT JOIN usuarios v ON nr.vendedor_id = v.id
        LEFT JOIN usuarios c ON nr.comprador_id = c.id
        ${whereClause}
        ORDER BY nr.numero ASC
        LIMIT ? OFFSET ?
      `;

      queryParams.push(parseInt(limit), parseInt(offset));

      const [numeros] = await db.execute(query, queryParams);

      // Contar total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM numeros_rifa nr
        LEFT JOIN numero_asignaciones na ON nr.id = na.numero_rifa_id
        ${whereClause}
      `;

      const [countResult] = await db.execute(countQuery, 
        queryParams.slice(0, queryParams.length - 2)
      );

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
      console.error('Error al obtener números:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // Vender un número específico
  async venderNumero(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Datos inválidos',
          errors: errors.array()
        });
      }

      const { rifa_id, numero } = req.params;
      const {
        comprador_nombre,
        comprador_apellido,
        comprador_telefono,
        comprador_email,
        metodo_pago = 'efectivo'
      } = req.body;

      const vendedor_id = req.user.id;

      // Verificar que el número existe y está disponible
      const [numeroExistente] = await db.execute(`
        SELECT * FROM numeros_rifa 
        WHERE rifa_id = ? AND numero = ?
      `, [rifa_id, numero]);

      if (!numeroExistente.length) {
        return res.status(404).json({
          status: 'error',
          message: 'Número no encontrado'
        });
      }

      const numeroObj = numeroExistente[0];

      if (numeroObj.estado !== 'disponible') {
        return res.status(400).json({
          status: 'error',
          message: `El número ya está ${numeroObj.estado}`
        });
      }

      // Obtener datos de la rifa
      const [rifa] = await db.execute(`
        SELECT * FROM rifas WHERE id = ? AND estado = 'activa'
      `, [rifa_id]);

      if (!rifa.length) {
        return res.status(400).json({
          status: 'error',
          message: 'La rifa no está activa para ventas'
        });
      }

      // Verificar fechas
      const ahora = new Date();
      const fechaInicio = new Date(rifa[0].fecha_inicio);
      const fechaFin = new Date(rifa[0].fecha_fin);

      if (ahora < fechaInicio || ahora > fechaFin) {
        return res.status(400).json({
          status: 'error',
          message: 'La rifa no está en periodo de ventas'
        });
      }

      // Crear o encontrar comprador
      let comprador_id = null;
      if (comprador_email) {
        const [compradorExistente] = await db.execute(`
          SELECT id FROM usuarios WHERE email = ?
        `, [comprador_email]);

        if (compradorExistente.length) {
          comprador_id = compradorExistente[0].id;
        } else {
          // Crear nuevo comprador
          const [nuevoComprador] = await db.execute(`
            INSERT INTO usuarios (nombre, apellido, email, telefono, rol, password)
            VALUES (?, ?, ?, ?, 'comprador', 'temp_password')
          `, [comprador_nombre, comprador_apellido, comprador_email, comprador_telefono]);
          
          comprador_id = nuevoComprador.insertId;
        }
      }

      // Marcar número como vendido
      await db.execute(`
        UPDATE numeros_rifa 
        SET estado = 'vendido',
            comprador_id = ?,
            comprador_nombre = ?,
            comprador_apellido = ?,
            comprador_telefono = ?,
            vendedor_id = ?,
            fecha_venta = CURRENT_TIMESTAMP,
            metodo_pago = ?
        WHERE id = ?
      `, [
        comprador_id, 
        comprador_nombre, 
        comprador_apellido, 
        comprador_telefono, 
        vendedor_id,
        metodo_pago,
        numeroObj.id
      ]);

      // Registrar la venta en tabla de comisiones
      await db.execute(`
        INSERT INTO rifa_comisiones (
          rifa_id, numero_rifa_id, vendedor_id, 
          institucion_id, precio_venta, porcentaje_comision,
          monto_comision, estado
        ) VALUES (?, ?, ?, ?, ?, 10, ?, 'pendiente')
      `, [
        rifa_id, 
        numeroObj.id, 
        vendedor_id, 
        req.user.institucion_id, 
        rifa[0].precio_numero,
        rifa[0].precio_numero * 0.10
      ]);

      res.json({
        status: 'success',
        message: 'Número vendido exitosamente',
        data: {
          numero: parseInt(numero),
          rifa_id: parseInt(rifa_id),
          comprador: `${comprador_nombre} ${comprador_apellido}`,
          precio: rifa[0].precio_numero,
          vendedor_id: vendedor_id,
          fecha_venta: new Date()
        }
      });

    } catch (error) {
      console.error('Error al vender número:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // Reservar número
  async reservarNumero(req, res) {
    try {
      const { rifa_id, numero } = req.params;
      const { comprador_nombre, tiempo_reserva = 2 } = req.body;
      const vendedor_id = req.user.id;

      // Verificar número disponible
      const [numeroExistente] = await db.execute(`
        SELECT * FROM numeros_rifa 
        WHERE rifa_id = ? AND numero = ? AND estado = 'disponible'
      `, [rifa_id, numero]);

      if (!numeroExistente.length) {
        return res.status(400).json({
          status: 'error',
          message: 'Número no disponible para reserva'
        });
      }

      const fechaExpiracion = new Date();
      fechaExpiracion.setHours(fechaExpiracion.getHours() + tiempo_reserva);

      await db.execute(`
        UPDATE numeros_rifa 
        SET estado = 'reservado',
            comprador_nombre = ?,
            vendedor_id = ?,
            fecha_reserva = CURRENT_TIMESTAMP,
            reserva_expira = ?
        WHERE id = ?
      `, [comprador_nombre, vendedor_id, fechaExpiracion, numeroExistente[0].id]);

      res.json({
        status: 'success',
        message: 'Número reservado exitosamente',
        data: {
          numero: parseInt(numero),
          reservado_para: comprador_nombre,
          expira_en: fechaExpiracion,
          tiempo_reserva_horas: tiempo_reserva
        }
      });

    } catch (error) {
      console.error('Error al reservar número:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // =====================================================
  // ESTADÍSTICAS Y REPORTES
  // =====================================================

  // Estadísticas generales de la rifa
  async estadisticasRifa(req, res) {
    try {
      const { rifa_id } = req.params;

      const [estadisticas] = await db.execute(`
        SELECT 
          r.id,
          r.nombre,
          r.cantidad_numeros,
          r.precio_numero,
          r.estado,
          (r.cantidad_numeros * r.precio_numero) as total_potencial,
          COALESCE(COUNT(nr.id), 0) as numeros_generados,
          COALESCE(SUM(CASE WHEN nr.estado = 'vendido' THEN 1 ELSE 0 END), 0) as numeros_vendidos,
          COALESCE(SUM(CASE WHEN nr.estado = 'disponible' THEN 1 ELSE 0 END), 0) as numeros_disponibles,
          COALESCE(SUM(CASE WHEN nr.estado = 'reservado' THEN 1 ELSE 0 END), 0) as numeros_reservados,
          COALESCE(SUM(CASE WHEN nr.estado = 'vendido' THEN r.precio_numero ELSE 0 END), 0) as recaudado,
          ROUND(
            (COALESCE(SUM(CASE WHEN nr.estado = 'vendido' THEN 1 ELSE 0 END), 0) * 100.0) / 
            NULLIF(r.cantidad_numeros, 0), 2
          ) as porcentaje_vendido,
          COUNT(DISTINCT nr.vendedor_id) as vendedores_activos,
          COUNT(DISTINCT na.institucion_id) as instituciones_participantes
        FROM rifas r
        LEFT JOIN numeros_rifa nr ON r.id = nr.rifa_id
        LEFT JOIN numero_asignaciones na ON nr.id = na.numero_rifa_id
        WHERE r.id = ?
        GROUP BY r.id
      `, [rifa_id]);

      if (!estadisticas.length) {
        return res.status(404).json({
          status: 'error',
          message: 'Rifa no encontrada'
        });
      }

      res.json({
        status: 'success',
        data: estadisticas[0]
      });

    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // Reporte de ventas por institución
  async reporteVentasInstitucion(req, res) {
    try {
      const { rifa_id } = req.params;

      const [reporte] = await db.execute(`
        SELECT 
          i.id as institucion_id,
          i.nombre as institucion_nombre,
          COUNT(nr.id) as numeros_asignados,
          SUM(CASE WHEN nr.estado = 'vendido' THEN 1 ELSE 0 END) as numeros_vendidos,
          SUM(CASE WHEN nr.estado = 'disponible' THEN 1 ELSE 0 END) as numeros_disponibles,
          SUM(CASE WHEN nr.estado = 'vendido' THEN r.precio_numero ELSE 0 END) as recaudado,
          ROUND(
            (SUM(CASE WHEN nr.estado = 'vendido' THEN 1 ELSE 0 END) * 100.0) / 
            NULLIF(COUNT(nr.id), 0), 2
          ) as porcentaje_vendido,
          COUNT(DISTINCT nr.vendedor_id) as vendedores_activos
        FROM instituciones i
        LEFT JOIN numero_asignaciones na ON i.id = na.institucion_id
        LEFT JOIN numeros_rifa nr ON na.numero_rifa_id = nr.id
        LEFT JOIN rifas r ON nr.rifa_id = r.id
        WHERE r.id = ?
        GROUP BY i.id, i.nombre
        HAVING numeros_asignados > 0
        ORDER BY numeros_vendidos DESC
      `, [rifa_id]);

      res.json({
        status: 'success',
        data: reporte
      });

    } catch (error) {
      console.error('Error al generar reporte por institución:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // Reporte de ventas por vendedor
  async reporteVentasVendedores(req, res) {
    try {
      const { rifa_id } = req.params;

      const [reporte] = await db.execute(`
        SELECT 
          u.id as vendedor_id,
          u.nombre,
          u.apellido,
          i.nombre as institucion_nombre,
          COUNT(nr.id) as numeros_vendidos,
          SUM(r.precio_numero) as recaudado,
          SUM(rc.monto_comision) as comisiones_generadas,
          MIN(nr.fecha_venta) as primera_venta,
          MAX(nr.fecha_venta) as ultima_venta
        FROM usuarios u
        LEFT JOIN instituciones i ON u.institucion_id = i.id
        LEFT JOIN numeros_rifa nr ON u.id = nr.vendedor_id
        LEFT JOIN rifas r ON nr.rifa_id = r.id
        LEFT JOIN rifa_comisiones rc ON nr.id = rc.numero_rifa_id
        WHERE r.id = ? AND nr.estado = 'vendido'
        GROUP BY u.id, u.nombre, u.apellido, i.nombre
        HAVING numeros_vendidos > 0
        ORDER BY numeros_vendidos DESC
      `, [rifa_id]);

      res.json({
        status: 'success',
        data: reporte
      });

    } catch (error) {
      console.error('Error al generar reporte por vendedor:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // =====================================================
  // FUNCIONES AUXILIARES
  // =====================================================

  // Generar números automáticamente para una rifa
  async generarNumerosRifa(rifa_id, cantidad_numeros) {
    try {
      const numeros = [];
      for (let i = 1; i <= cantidad_numeros; i++) {
        numeros.push([rifa_id, i]);
      }

      // Insertar en lotes para mejor performance
      const batchSize = 1000;
      for (let i = 0; i < numeros.length; i += batchSize) {
        const batch = numeros.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?, ?)').join(', ');
        const values = batch.flat();
        
        await db.execute(`
          INSERT INTO numeros_rifa (rifa_id, numero) 
          VALUES ${placeholders}
        `, values);
      }

      return true;
    } catch (error) {
      console.error('Error al generar números:', error);
      throw error;
    }
  },

  // Asignar números a instituciones
  async asignarNumerosInstitucion(req, res) {
    try {
      const { rifa_id } = req.params;
      const { institucion_id, desde_numero, hasta_numero } = req.body;

      // Validaciones
      if (desde_numero > hasta_numero) {
        return res.status(400).json({
          status: 'error',
          message: 'El número inicial debe ser menor al final'
        });
      }

      // Verificar que los números están disponibles
      const [numerosDisponibles] = await db.execute(`
        SELECT COUNT(*) as disponibles
        FROM numeros_rifa nr
        LEFT JOIN numero_asignaciones na ON nr.id = na.numero_rifa_id
        WHERE nr.rifa_id = ? 
          AND nr.numero BETWEEN ? AND ?
          AND nr.estado = 'disponible'
          AND na.id IS NULL
      `, [rifa_id, desde_numero, hasta_numero]);

      const cantidadSolicitada = hasta_numero - desde_numero + 1;
      
      if (numerosDisponibles[0].disponibles < cantidadSolicitada) {
        return res.status(400).json({
          status: 'error',
          message: 'Algunos números ya están asignados o no están disponibles'
        });
      }

      // Obtener IDs de los números a asignar
      const [numerosParaAsignar] = await db.execute(`
        SELECT nr.id
        FROM numeros_rifa nr
        LEFT JOIN numero_asignaciones na ON nr.id = na.numero_rifa_id
        WHERE nr.rifa_id = ? 
          AND nr.numero BETWEEN ? AND ?
          AND nr.estado = 'disponible'
          AND na.id IS NULL
        ORDER BY nr.numero
      `, [rifa_id, desde_numero, hasta_numero]);

      // Insertar asignaciones
      const asignaciones = numerosParaAsignar.map(num => [
        num.id, institucion_id, req.user.id
      ]);

      if (asignaciones.length > 0) {
        const placeholders = asignaciones.map(() => '(?, ?, ?)').join(', ');
        const values = asignaciones.flat();

        await db.execute(`
          INSERT INTO numero_asignaciones (numero_rifa_id, institucion_id, asignado_por)
          VALUES ${placeholders}
        `, values);
      }

      res.json({
        status: 'success',
        message: 'Números asignados exitosamente',
        data: {
          cantidad_asignada: asignaciones.length,
          desde_numero,
          hasta_numero,
          institucion_id
        }
      });

    } catch (error) {
      console.error('Error al asignar números:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener mis rifas (para vendedores/compradores)
  async misRifas(req, res) {
    try {
      const usuario_id = req.user.id;
      const { tipo = 'participando' } = req.query; // 'participando' o 'creadas'

      let query = '';
      let params = [];

      if (tipo === 'creadas') {
        // Rifas creadas por el usuario
        query = `
          SELECT 
            r.*,
            i.nombre as institucion_nombre,
            COALESCE(COUNT(nr.id), 0) as total_numeros,
            COALESCE(SUM(CASE WHEN nr.estado = 'vendido' THEN 1 ELSE 0 END), 0) as numeros_vendidos,
            COALESCE(SUM(CASE WHEN nr.estado = 'vendido' THEN r.precio_numero ELSE 0 END), 0) as recaudado
          FROM rifas r
          LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
          LEFT JOIN numeros_rifa nr ON r.id = nr.rifa_id
          WHERE r.creado_por = ?
          GROUP BY r.id
          ORDER BY r.fecha_creacion DESC
        `;
        params = [usuario_id];
      } else {
        // Rifas donde el usuario tiene números comprados
        query = `
          SELECT DISTINCT
            r.*,
            i.nombre as institucion_nombre,
            COUNT(nr_user.id) as mis_numeros,
            SUM(r.precio_numero) as mi_inversion
          FROM rifas r
          LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
          LEFT JOIN numeros_rifa nr_user ON r.id = nr_user.rifa_id 
            AND nr_user.comprador_id = ? 
            AND nr_user.estado = 'vendido'
          WHERE nr_user.id IS NOT NULL
          GROUP BY r.id
          ORDER BY MAX(nr_user.fecha_venta) DESC
        `;
        params = [usuario_id];
      }

      const [rifas] = await db.execute(query, params);

      res.json({
        status: 'success',
        data: rifas,
        tipo: tipo
      });

    } catch (error) {
      console.error('Error al obtener mis rifas:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // Comprar múltiples números (para compradores finales)
  async comprarNumeros(req, res) {
    try {
      const { rifa_id } = req.params;
      const { numeros, comprador_info } = req.body;

      if (!Array.isArray(numeros) || numeros.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Debe especificar al menos un número'
        });
      }

      // Verificar que la rifa está activa
      const [rifa] = await db.execute(`
        SELECT * FROM rifas WHERE id = ? AND estado = 'activa'
      `, [rifa_id]);

      if (!rifa.length) {
        return res.status(400).json({
          status: 'error',
          message: 'La rifa no está disponible para compras'
        });
      }

      const rifaData = rifa[0];

      // Verificar que todos los números están disponibles
      const [numerosDisponibles] = await db.execute(`
        SELECT numero FROM numeros_rifa 
        WHERE rifa_id = ? AND numero IN (${numeros.map(() => '?').join(',')}) 
          AND estado = 'disponible'
      `, [rifa_id, ...numeros]);

      if (numerosDisponibles.length !== numeros.length) {
        const disponibles = numerosDisponibles.map(n => n.numero);
        const noDisponibles = numeros.filter(n => !disponibles.includes(n));
        
        return res.status(400).json({
          status: 'error',
          message: 'Algunos números no están disponibles',
          numeros_no_disponibles: noDisponibles
        });
      }

      // Crear o encontrar comprador
      let comprador_id = req.user.id;
      if (req.user.rol !== 'comprador') {
        // Si es admin o vendedor, crear entrada como comprador temporal
        comprador_id = null;
      }

      // Actualizar números como vendidos
      const placeholders = numeros.map(() => '?').join(',');
      await db.execute(`
        UPDATE numeros_rifa 
        SET estado = 'vendido',
            comprador_id = ?,
            comprador_nombre = ?,
            comprador_apellido = ?,
            comprador_telefono = ?,
            fecha_venta = CURRENT_TIMESTAMP,
            metodo_pago = 'online'
        WHERE rifa_id = ? AND numero IN (${placeholders})
      `, [
        comprador_id,
        comprador_info?.nombre || req.user.nombre,
        comprador_info?.apellido || req.user.apellido,
        comprador_info?.telefono || req.user.telefono,
        rifa_id,
        ...numeros
      ]);

      const total_pagado = numeros.length * rifaData.precio_numero;

      res.json({
        status: 'success',
        message: 'Números comprados exitosamente',
        data: {
          rifa_id: parseInt(rifa_id),
          numeros_comprados: numeros,
          cantidad: numeros.length,
          precio_unitario: rifaData.precio_numero,
          total_pagado: total_pagado,
          fecha_compra: new Date()
        }
      });

    } catch (error) {
      console.error('Error al comprar números:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  }
};

// =====================================================
// VALIDACIONES PARA ENDPOINTS
// =====================================================

export const rifasValidations = {
  crearRifa: [
    body('nombre').notEmpty().withMessage('El nombre es requerido')
      .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
    body('descripcion').optional()
      .isLength({ max: 500 }).withMessage('La descripción no puede exceder 500 caracteres'),
    body('cantidad_numeros').isInt({ min: 10, max: 100000 })
      .withMessage('La cantidad de números debe estar entre 10 y 100,000'),
    body('precio_numero').isFloat({ min: 0.01 })
      .withMessage('El precio debe ser mayor a 0'),
    body('fecha_inicio').isISO8601()
      .withMessage('Fecha de inicio inválida'),
    body('fecha_fin').isISO8601()
      .withMessage('Fecha de fin inválida'),
    body('fecha_sorteo').isISO8601()
      .withMessage('Fecha de sorteo inválida'),
    body('institucion_promotora_id').isInt({ min: 1 })
      .withMessage('ID de institución inválido')
  ],
  
  actualizarRifa: [
    body('nombre').optional()
      .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
    body('descripcion').optional()
      .isLength({ max: 500 }).withMessage('La descripción no puede exceder 500 caracteres'),
    body('fecha_fin').optional().isISO8601()
      .withMessage('Fecha de fin inválida'),
    body('fecha_sorteo').optional().isISO8601()
      .withMessage('Fecha de sorteo inválida'),
    body('estado').optional()
      .isIn(['borrador', 'activa', 'cerrada', 'finalizada', 'cancelada'])
      .withMessage('Estado inválido')
  ],
  
  venderNumero: [
    body('comprador_nombre').notEmpty()
      .withMessage('El nombre del comprador es requerido')
      .isLength({ min: 2, max: 50 }).withMessage('Nombre debe tener entre 2 y 50 caracteres'),
    body('comprador_apellido').notEmpty()
      .withMessage('El apellido del comprador es requerido')
      .isLength({ min: 2, max: 50 }).withMessage('Apellido debe tener entre 2 y 50 caracteres'),
    body('comprador_telefono').optional()
      .isMobilePhone('any').withMessage('Teléfono inválido'),
    body('comprador_email').optional()
      .isEmail().withMessage('Email inválido'),
    body('metodo_pago').optional()
      .isIn(['efectivo', 'transferencia', 'tarjeta', 'mercadopago'])
      .withMessage('Método de pago inválido')
  ],
  
  comprarNumeros: [
    body('numeros').isArray({ min: 1, max: 10 })
      .withMessage('Debe seleccionar entre 1 y 10 números'),
    body('numeros.*').isInt({ min: 1 })
      .withMessage('Los números deben ser enteros positivos'),
    body('comprador_info.nombre').optional()
      .isLength({ min: 2, max: 50 }).withMessage('Nombre inválido'),
    body('comprador_info.telefono').optional()
      .isMobilePhone('any').withMessage('Teléfono inválido')
  ],
  
  asignarNumeros: [
    body('institucion_id').isInt({ min: 1 })
      .withMessage('ID de institución inválido'),
    body('desde_numero').isInt({ min: 1 })
      .withMessage('Número inicial inválido'),
    body('hasta_numero').isInt({ min: 1 })
      .withMessage('Número final inválido')
  ]
};

export default rifasController;