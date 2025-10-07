// =====================================================
// CONTROLADOR COMPLETO PARA EL SISTEMA DE RIFAS - VERSIÓN FINAL
// src/controllers/rifasController.js
// =====================================================

import db from '../config/db.js';
import { body, validationResult } from 'express-validator';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Rifa } from '../models/Rifa.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rifasController = {

  // =====================================================
  // CRUD BÁSICO DE RIFAS
  // =====================================================

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

      const estadosValidos = ['borrador', 'activa', 'finalizada', 'cerrada', 'cancelada'];

      if (estado && estadosValidos.includes(estado)) {
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

      const [participaciones] = await db.execute(`
        SELECT 
          rp.*,
          i.nombre as institucion_nombre,
          i.logo_url as institucion_logo
        FROM rifa_participaciones rp
        LEFT JOIN instituciones i ON rp.institucion_id = i.id
        WHERE rp.rifa_id = ?
        ORDER BY rp.fecha_solicitud DESC
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

//-- Crea la Rifa con los numeros --//

 async crearRifa(req, res) {
  try {
    console.log('\n📝 === CREAR RIFA ===');
    console.log('Usuario:', req.user);
    console.log('Body recibido:', req.body);

    // Validar datos
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Errores de validación:', errors.array());
      return res.status(400).json({
        status: 'error',
        message: 'Datos inválidos',
        errors: errors.array()
      });
    }

    const {
      nombre,
      descripcion,
      institucion_promotora_id,
      cantidad_numeros,
      precio_numero,
      fecha_inicio,
      fecha_fin,
      fecha_sorteo,
      imagen_url
    } = req.body;

    const creado_por = req.user.id;

    // Verificar que la institución existe
    const [instituciones] = await db.execute(
      'SELECT id FROM instituciones WHERE id = ?',
      [institucion_promotora_id]
    );

    if (instituciones.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Institución no encontrada'
      });
    }

    // Verificar permisos
    if (req.user.rol !== 'admin_global' && 
        req.user.institucion_id !== parseInt(institucion_promotora_id)) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permisos para crear rifas para esta institución'
      });
    }

    // ✅ INICIAR TRANSACCIÓN
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // PASO 1: Crear la rifa
      const insertQuery = `
        INSERT INTO rifas (
          nombre, descripcion, institucion_promotora_id, cantidad_numeros, precio_numero,
          fecha_inicio, fecha_fin, fecha_sorteo, creado_por, imagen_url, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activa')
      `;

      const valores = [
        nombre,
        descripcion || null,
        parseInt(institucion_promotora_id),
        parseInt(cantidad_numeros),
        parseFloat(precio_numero),
        fecha_inicio,
        fecha_fin,
        fecha_sorteo || null,
        creado_por,
        imagen_url || null
      ];

      console.log('📝 Insertando rifa...');
      const [result] = await connection.execute(insertQuery, valores);
      const rifa_id = result.insertId;
      console.log('✅ Rifa creada con ID:', rifa_id);

      // PASO 2: Generar números automáticamente
      console.log(`🎲 Generando ${cantidad_numeros} números...`);
      
      const numeros = [];
      for (let i = 1; i <= cantidad_numeros; i++) {
        const qrCode = `RIFA${rifa_id}-${String(i).padStart(6, '0')}-${Date.now()}`;
        numeros.push([rifa_id, i, 'disponible', qrCode]);
      }

      // Insertar números en bloques de 500 para mejor rendimiento
      const batchSize = 500;
      for (let i = 0; i < numeros.length; i += batchSize) {
        const batch = numeros.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
        
        await connection.execute(`
          INSERT INTO numeros_rifa (rifa_id, numero, estado, qr_code) 
          VALUES ${placeholders}
        `, batch.flat());
      }

      console.log(`✅ ${cantidad_numeros} números generados correctamente`);

      // PASO 3: Obtener rifa completa con estadísticas
      const [rifaCreada] = await connection.execute(`
        SELECT 
          r.*,
          i.nombre as institucion_promotora_nombre,
          COUNT(nr.id) as total_numeros_generados
        FROM rifas r
        LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
        LEFT JOIN numeros_rifa nr ON r.id = nr.rifa_id
        WHERE r.id = ?
        GROUP BY r.id
      `, [rifa_id]);

      // ✅ COMMIT de la transacción
      await connection.commit();
      connection.release();

      console.log('✅ Rifa y números creados exitosamente');
      
      res.status(201).json({
        status: 'success',
        message: `Rifa creada exitosamente con ${cantidad_numeros} números generados`,
        data: rifaCreada[0],
        id: rifa_id
      });

    } catch (error) {
      // ❌ ROLLBACK en caso de error
      await connection.rollback();
      connection.release();
      throw error;
    }

  } catch (error) {
    console.error('❌ Error al crear rifa:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al crear la rifa',
      error: error.message,
      sqlMessage: error.sqlMessage
    });
  }
},

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

      if (req.user.rol !== 'admin_global' && 
          req.user.institucion_id !== rifa.institucion_promotora_id) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permisos para editar esta rifa'
        });
      }

      if (rifa.estado === 'finalizada' || rifa.estado === 'cancelada') {
        return res.status(400).json({
          status: 'error',
          message: 'No se puede editar una rifa finalizada o cancelada'
        });
      }

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

  async eliminarRifa(req, res) {
    try {
      const { id } = req.params;
      const { motivo } = req.body;

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

      if (req.user.rol !== 'admin_global' && 
          req.user.institucion_id !== rifa.institucion_promotora_id) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permisos para eliminar esta rifa'
        });
      }

      const [numerosVendidos] = await db.execute(`
        SELECT COUNT(*) as vendidos FROM numeros_rifa 
        WHERE rifa_id = ? AND estado = 'vendido'
      `, [id]);

      if (numerosVendidos[0].vendidos > 0) {
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

  async generarNumerosRifa(req, res) {
    try {
      const { id: rifa_id } = req.params;

      const [rifa] = await db.execute(`
        SELECT * FROM rifas WHERE id = ?
      `, [rifa_id]);

      if (!rifa.length) {
        return res.status(404).json({
          status: 'error',
          message: 'Rifa no encontrada'
        });
      }

      const rifaData = rifa[0];

      if (!['borrador', 'activa'].includes(rifaData.estado)) {
        return res.status(400).json({
          status: 'error',
          message: 'No se pueden generar números para rifas finalizadas o canceladas'
        });
      }

      const [numerosExistentes] = await db.execute(`
        SELECT COUNT(*) as total FROM numeros_rifa WHERE rifa_id = ?
      `, [rifa_id]);

      if (numerosExistentes[0].total > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Los números ya han sido generados para esta rifa'
        });
      }

      await rifasController._generarNumerosParaRifa(rifa_id, rifaData.cantidad_numeros);

      if (rifaData.estado === 'borrador') {
        await db.execute(`
          UPDATE rifas 
          SET estado = 'activa', fecha_actualizacion = NOW() 
          WHERE id = ?
        `, [rifa_id]);
      }

      res.json({
        status: 'success',
        message: 'Números generados exitosamente',
        data: {
          rifa_id: parseInt(rifa_id),
          total_numeros: rifaData.cantidad_numeros,
          estado: rifaData.estado === 'borrador' ? 'activa' : rifaData.estado,
          rifa_nombre: rifaData.nombre
        }
      });

    } catch (error) {
      console.error('Error al generar números de rifa:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  async obtenerNumerosRifa(req, res) {
    try {
      const { id } = req.params;
      const { 
        estado, 
        vendedor_id, 
        desde, 
        hasta, 
        page = 1, 
        limit = 100 
      } = req.query;

      const offset = (page - 1) * limit;
      let whereConditions = ['n.rifa_id = ?'];
      let queryParams = [id];

      if (estado) {
        whereConditions.push('n.estado = ?');
        queryParams.push(estado);
      }

      if (vendedor_id) {
        whereConditions.push('n.vendedor_id = ?');
        queryParams.push(vendedor_id);
      }

      if (desde) {
        whereConditions.push('n.numero >= ?');
        queryParams.push(desde);
      }

      if (hasta) {
        whereConditions.push('n.numero <= ?');
        queryParams.push(hasta);
      }

      const whereClause = whereConditions.join(' AND ');

      const [numeros] = await db.execute(`
        SELECT 
          n.*,
          v.nombre as vendedor_nombre,
          v.apellido as vendedor_apellido,
          c.nombre as comprador_nombre,
          c.apellido as comprador_apellido,
          c.telefono as comprador_telefono,
          c.email as comprador_email
        FROM numeros_rifa n
        LEFT JOIN usuarios v ON n.vendedor_id = v.id
        LEFT JOIN usuarios c ON n.comprador_id = c.id
        WHERE ${whereClause}
        ORDER BY n.numero ASC
        LIMIT ? OFFSET ?
      `, [...queryParams, parseInt(limit), parseInt(offset)]);

      const [countResult] = await db.execute(`
        SELECT COUNT(*) as total
        FROM numeros_rifa n
        LEFT JOIN usuarios v ON n.vendedor_id = v.id
        LEFT JOIN usuarios c ON n.comprador_id = c.id
        WHERE ${whereClause}
      `, queryParams);

      const total = countResult[0].total;
      const totalPages = Math.ceil(total / limit);

      res.json({
        status: 'success',
        data: {
          numeros: numeros,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: total,
            totalPages: totalPages
          }
        }
      });

    } catch (error) {
      console.error('Error al obtener números de rifa:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

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

      const [rifa] = await db.execute(`
        SELECT * FROM rifas WHERE id = ? AND estado = 'activa'
      `, [rifa_id]);

      if (!rifa.length) {
        return res.status(400).json({
          status: 'error',
          message: 'La rifa no está activa para ventas'
        });
      }

      let comprador_id = null;
      if (comprador_email) {
        const [compradorExistente] = await db.execute(`
          SELECT id FROM usuarios WHERE email = ?
        `, [comprador_email]);

        if (compradorExistente.length) {
          comprador_id = compradorExistente[0].id;
        }
      }

      await db.execute(`
        UPDATE numeros_rifa 
        SET estado = 'vendido',
            comprador_id = ?,
            vendedor_id = ?,
            fecha_venta = CURRENT_TIMESTAMP,
            metodo_pago = ?,
            monto_pagado = ?
        WHERE id = ?
      `, [
        comprador_id, 
        vendedor_id,
        metodo_pago,
        rifa[0].precio_numero,
        numeroObj.id
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

  async reservarNumero(req, res) {
    try {
      const { rifa_id, numero } = req.params;
      const {
        comprador_nombre,
        tiempo_reserva = 24
      } = req.body;

      const vendedor_id = req.user.id;

      const [numeroRifa] = await db.execute(`
        SELECT n.*, r.estado as rifa_estado
        FROM numeros_rifa n
        JOIN rifas r ON n.rifa_id = r.id
        WHERE n.rifa_id = ? AND n.numero = ?
      `, [rifa_id, numero]);

      if (!numeroRifa.length) {
        return res.status(404).json({
          status: 'error',
          message: 'Número no encontrado'
        });
      }

      const numeroData = numeroRifa[0];

      if (numeroData.estado !== 'disponible') {
        return res.status(400).json({
          status: 'error',
          message: 'El número no está disponible'
        });
      }

      if (numeroData.rifa_estado !== 'activa') {
        return res.status(400).json({
          status: 'error',
          message: 'La rifa no está activa'
        });
      }

      const fechaExpiracion = new Date();
      fechaExpiracion.setHours(fechaExpiracion.getHours() + tiempo_reserva);

      await db.execute(`
        UPDATE numeros_rifa 
        SET 
          estado = 'reservado',
          vendedor_id = ?,
          fecha_reserva = NOW(),
          fecha_expiracion_reserva = ?,
          fecha_actualizacion = NOW()
        WHERE rifa_id = ? AND numero = ? AND estado = 'disponible'
      `, [
        vendedor_id,
        fechaExpiracion,
        rifa_id,
        numero
      ]);

      res.json({
        status: 'success',
        message: 'Número reservado exitosamente',
        data: {
          numero: parseInt(numero),
          comprador_nombre,
          tiempo_reserva_horas: tiempo_reserva,
          expira_en: fechaExpiracion.toISOString(),
          vendedor_id
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
  // FUNCIONES PARA USUARIOS FINALES
  // =====================================================

  async getMisNumerosTodos(req, res) {
    try {
      const usuario_id = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const [misNumeros] = await db.execute(`
        SELECT 
          nr.numero,
          nr.fecha_venta,
          nr.metodo_pago,
          nr.monto_pagado,
          r.id as rifa_id,
          r.nombre as rifa_nombre,
          r.descripcion as rifa_descripcion,
          r.fecha_sorteo,
          r.estado as rifa_estado,
          r.precio_numero,
          i.nombre as institucion_nombre,
          v.nombre as vendedor_nombre,
          v.apellido as vendedor_apellido
        FROM numeros_rifa nr
        JOIN rifas r ON nr.rifa_id = r.id
        JOIN instituciones i ON r.institucion_promotora_id = i.id
        LEFT JOIN usuarios v ON nr.vendedor_id = v.id
        WHERE nr.comprador_id = ?
        ORDER BY nr.fecha_venta DESC
        LIMIT ? OFFSET ?
      `, [usuario_id, parseInt(limit), parseInt(offset)]);

      const [totalResult] = await db.execute(`
        SELECT COUNT(*) as total
        FROM numeros_rifa nr
        WHERE nr.comprador_id = ?
      `, [usuario_id]);

      const total = totalResult[0].total;
      const totalPages = Math.ceil(total / limit);

      res.json({
        status: 'success',
        message: 'Números obtenidos exitosamente',
        data: {
          numeros: misNumeros,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages
          }
        }
      });

    } catch (error) {
      console.error('Error al obtener mis números:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  async misRifas(req, res) {
    try {
      const usuario_id = req.user.id;
      const { tipo = 'participando' } = req.query;

      let query = '';
      let params = [];

      if (tipo === 'creadas') {
        query = `
          SELECT 
            r.*,
            i.nombre as institucion_nombre,
            COALESCE(COUNT(nr.id), 0) as total_numeros,
            COALESCE(SUM(CASE WHEN nr.estado = 'vendido' THEN 1 ELSE 0 END), 0) as numeros_vendidos,
            COALESCE(SUM(CASE WHEN nr.estado = 'vendido' THEN nr.monto_pagado ELSE 0 END), 0) as recaudado
          FROM rifas r
          LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
          LEFT JOIN numeros_rifa nr ON r.id = nr.rifa_id
          WHERE r.creado_por = ?
          GROUP BY r.id
          ORDER BY r.fecha_creacion DESC
        `;
        params = [usuario_id];
      } else {
        query = `
          SELECT DISTINCT
            r.*,
            i.nombre as institucion_nombre,
            COUNT(nr_user.id) as mis_numeros,
            SUM(nr_user.monto_pagado) as mi_inversion
          FROM rifas r
          LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
          LEFT JOIN numeros_rifa nr_user ON r.id = nr_user.rifa_id 
            AND nr_user.comprador_id = ?
          WHERE nr_user.id IS NOT NULL
          GROUP BY r.id
          ORDER BY r.fecha_sorteo ASC, r.fecha_creacion DESC
        `;
        params = [usuario_id];
      }

      const [rifas] = await db.execute(query, params);

      res.json({
        status: 'success',
        message: 'Rifas obtenidas exitosamente',
        data: {
          rifas,
          tipo
        }
      });

    } catch (error) {
      console.error('Error al obtener mis rifas:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  async comprarNumeros(req, res) {
  try {
    const { id: rifa_id } = req.params;
    const { numeros, comprador_info, metodo_pago, observaciones } = req.body;
    const usuario_id = req.user.id;

    const [rifa] = await db.execute(`
      SELECT * FROM rifas WHERE id = ? AND estado = 'activa'
    `, [rifa_id]);

    if (!rifa.length) {
      return res.status(404).json({
        status: 'error',
        message: 'Rifa no encontrada o no está activa'
      });
    }

    const numerosStr = numeros.map(() => '?').join(',');
    const [numerosDisponibles] = await db.execute(`
      SELECT numero FROM numeros_rifa 
      WHERE rifa_id = ? AND numero IN (${numerosStr}) AND estado = 'disponible'
    `, [rifa_id, ...numeros]);

    if (numerosDisponibles.length !== numeros.length) {
      return res.status(400).json({
        status: 'error',
        message: 'Algunos números no están disponibles'
      });
    }

    await db.query('BEGIN');

    try {
      for (const numero of numeros) {
        // ✅ USAR LAS COLUMNAS CORRECTAS DE TU ESQUEMA
        const nombreCompleto = comprador_info.nombre && comprador_info.apellido 
          ? `${comprador_info.nombre} ${comprador_info.apellido}`
          : comprador_info.nombre || '';

        await db.execute(`
          UPDATE numeros_rifa 
          SET 
            estado = 'vendido',
            comprador_id = ?,
            comprador_nombre = ?,
            comprador_telefono = ?,
            metodo_pago = ?,
            precio_venta = ?,
            fecha_venta = NOW(),
            observaciones = ?
          WHERE rifa_id = ? AND numero = ? AND estado = 'disponible'
        `, [
          usuario_id,
          nombreCompleto,
          comprador_info.telefono || null,
          metodo_pago,
          rifa[0].precio_numero,
          observaciones || null,
          rifa_id,
          numero
        ]);
      }

      await db.query('COMMIT');

      res.json({
        status: 'success',
        message: 'Números comprados exitosamente',
        data: {
          numeros_comprados: numeros,
          total_pagado: rifa[0].precio_numero * numeros.length,
          rifa_nombre: rifa[0].nombre
        }
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error al comprar números:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
},

  async verificarDisponibilidad(req, res) {
    try {
      const { id: rifa_id } = req.params;
      const { numeros } = req.body;

      const numerosStr = numeros.map(() => '?').join(',');
      const [resultados] = await db.execute(`
        SELECT 
          numero, 
          estado,
          CASE 
            WHEN estado = 'disponible' THEN true 
            ELSE false 
          END as disponible
        FROM numeros_rifa 
        WHERE rifa_id = ? AND numero IN (${numerosStr})
      `, [rifa_id, ...numeros]);

      res.json({
        status: 'success',
        data: {
          numeros: resultados
        }
      });

    } catch (error) {
      console.error('Error al verificar disponibilidad:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  async reservarNumeros(req, res) {
    try {
      const { id: rifa_id } = req.params;
      const { numeros, tiempo_reserva = 15 } = req.body;
      const usuario_id = req.user.id;

      const numerosStr = numeros.map(() => '?').join(',');
      const [numerosDisponibles] = await db.execute(`
        SELECT numero FROM numeros_rifa 
        WHERE rifa_id = ? AND numero IN (${numerosStr}) AND estado = 'disponible'
      `, [rifa_id, ...numeros]);

      if (numerosDisponibles.length !== numeros.length) {
        return res.status(400).json({
          status: 'error',
          message: 'Algunos números no están disponibles'
        });
      }

      const fechaExpiracion = new Date();
      fechaExpiracion.setMinutes(fechaExpiracion.getMinutes() + tiempo_reserva);

      for (const numero of numeros) {
        await db.execute(`
          UPDATE numeros_rifa 
          SET 
            estado = 'reservado',
            comprador_id = ?,
            fecha_reserva = NOW(),
            fecha_expiracion_reserva = ?
          WHERE rifa_id = ? AND numero = ?
        `, [usuario_id, fechaExpiracion, rifa_id, numero]);
      }

      res.json({
        status: 'success',
        message: 'Números reservados exitosamente',
        data: {
          numeros_reservados: numeros,
          tiempo_reserva_minutos: tiempo_reserva,
          expira_en: fechaExpiracion
        }
      });

    } catch (error) {
      console.error('Error al reservar números:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  async cancelarReserva(req, res) {
    try {
      const { id: rifa_id } = req.params;
      const { numeros } = req.body;
      const usuario_id = req.user.id;

      for (const numero of numeros) {
        await db.execute(`
          UPDATE numeros_rifa 
          SET 
            estado = 'disponible',
            comprador_id = NULL,
            fecha_reserva = NULL,
            fecha_expiracion_reserva = NULL
          WHERE rifa_id = ? AND numero = ? AND comprador_id = ? AND estado = 'reservado'
        `, [rifa_id, numero, usuario_id]);
      }

      res.json({
        status: 'success',
        message: 'Reservas canceladas exitosamente',
        data: {
          numeros_liberados: numeros
        }
      });

    } catch (error) {
      console.error('Error al cancelar reserva:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  async getMisNumerosRifa(req, res) {
    try {
      const { id: rifa_id } = req.params;
      const usuario_id = req.user.id;

      const [misNumeros] = await db.execute(`
        SELECT 
          nr.numero,
          nr.fecha_venta,
          nr.metodo_pago,
          nr.monto_pagado,
          r.precio_numero,
          r.nombre as rifa_nombre,
          r.fecha_sorteo
        FROM numeros_rifa nr
        JOIN rifas r ON nr.rifa_id = r.id
        WHERE nr.rifa_id = ? AND nr.comprador_id = ?
        ORDER BY nr.numero ASC
      `, [rifa_id, usuario_id]);

      res.json({
        status: 'success',
        data: {
          numeros: misNumeros,
          total_numeros: misNumeros.length,
          total_pagado: misNumeros.reduce((sum, num) => sum + (num.monto_pagado || 0), 0)
        }
      });

    } catch (error) {
      console.error('Error al obtener mis números de la rifa:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // =====================================================
  // ESTADÍSTICAS Y REPORTES
  // =====================================================

  async estadisticasRifa(req, res) {
    try {
      const { id: rifa_id } = req.params;

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
          COALESCE(SUM(CASE WHEN nr.estado = 'vendido' THEN nr.monto_pagado ELSE 0 END), 0) as recaudado,
          ROUND(
            (COALESCE(SUM(CASE WHEN nr.estado = 'vendido' THEN 1 ELSE 0 END), 0) * 100.0) / 
            NULLIF(r.cantidad_numeros, 0), 2
          ) as porcentaje_vendido,
          COUNT(DISTINCT nr.vendedor_id) as vendedores_activos
        FROM rifas r
        LEFT JOIN numeros_rifa nr ON r.id = nr.rifa_id
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

  async reporteVentasInstitucion(req, res) {
    try {
      const { id: rifa_id } = req.params;

      const [reporte] = await db.execute(`
        SELECT 
          i.id as institucion_id,
          i.nombre as institucion_nombre,
          COUNT(nr.id) as numeros_vendidos,
          SUM(nr.monto_pagado) as recaudado,
          COUNT(DISTINCT nr.vendedor_id) as vendedores_activos
        FROM usuarios u
        JOIN instituciones i ON u.institucion_id = i.id
        JOIN numeros_rifa nr ON u.id = nr.vendedor_id
        WHERE nr.rifa_id = ? AND nr.estado = 'vendido'
        GROUP BY i.id, i.nombre
        HAVING numeros_vendidos > 0
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

  async reporteVentasVendedores(req, res) {
    try {
      const { id: rifa_id } = req.params;

      const [reporte] = await db.execute(`
        SELECT 
          u.id as vendedor_id,
          u.nombre,
          u.apellido,
          i.nombre as institucion_nombre,
          COUNT(nr.id) as numeros_vendidos,
          SUM(nr.monto_pagado) as recaudado,
          MIN(nr.fecha_venta) as primera_venta,
          MAX(nr.fecha_venta) as ultima_venta
        FROM usuarios u
        LEFT JOIN instituciones i ON u.institucion_id = i.id
        LEFT JOIN numeros_rifa nr ON u.id = nr.vendedor_id
        WHERE nr.rifa_id = ? AND nr.estado = 'vendido'
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

  async asignarNumerosInstitucion(req, res) {
    try {
      const { id: rifa_id } = req.params;
      const { institucion_id, desde_numero, hasta_numero } = req.body;

      if (desde_numero > hasta_numero) {
        return res.status(400).json({
          status: 'error',
          message: 'El número inicial debe ser menor al final'
        });
      }

      const [numerosDisponibles] = await db.execute(`
        SELECT COUNT(*) as disponibles
        FROM numeros_rifa 
        WHERE rifa_id = ? 
          AND numero BETWEEN ? AND ?
          AND estado = 'disponible'
      `, [rifa_id, desde_numero, hasta_numero]);

      const cantidadSolicitada = hasta_numero - desde_numero + 1;
      
      if (numerosDisponibles[0].disponibles < cantidadSolicitada) {
        return res.status(400).json({
          status: 'error',
          message: 'Algunos números no están disponibles'
        });
      }

      res.json({
        status: 'success',
        message: 'Números verificados y listos para asignación',
        data: {
          cantidad_disponible: numerosDisponibles[0].disponibles,
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

  // =====================================================
  // MÉTODOS AUXILIARES PRIVADOS
  // =====================================================

  async _generarNumerosParaRifa(rifa_id, cantidad) {
    try {
      const numeros = [];

      for (let i = 1; i <= cantidad; i++) {
        const qrCode = `RIFA${rifa_id}-${String(i).padStart(6, '0')}-${Date.now()}`;
        numeros.push([
          rifa_id,
          i,
          'disponible',
          qrCode
        ]);
      }

      const batchSize = 1000;
      for (let i = 0; i < numeros.length; i += batchSize) {
        const batch = numeros.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
        
        await db.execute(`
          INSERT INTO numeros_rifa (rifa_id, numero, estado, qr_code) 
          VALUES ${placeholders}
        `, batch.flat());
      }

      console.log(`✅ ${cantidad} números generados para rifa ${rifa_id}`);
      return true;

    } catch (error) {
      console.error('❌ Error generando números para rifa:', error);
      throw error;
    }
  }
};

/**
 * Subir imagen de rifa
 * POST /api/rifas/:id/upload-imagen
 */
export const uploadImagenRifa = async (req, res) => {
  try {
    const rifaId = parseInt(req.params.id);
    const userId = req.user.id;
    
    console.log('📤 Upload imagen rifa - ID:', rifaId, 'Usuario:', userId);
    
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No se proporcionó ningún archivo'
      });
    }
    
    // Verificar que la rifa existe
    const rifa = await Rifa.obtenerPorId(rifaId);
    if (!rifa) {
      // Eliminar archivo subido
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        status: 'error',
        message: 'Rifa no encontrada'
      });
    }
    
    // Verificar permisos
    const user = req.user;
    const canUpload = user.role === 'admin_global' || 
                     (user.role === 'admin_institucion' && rifa.institucion_promotora_id === user.institucion_id);
    
    if (!canUpload) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permisos para subir imagen a esta rifa'
      });
    }
    
    // Si la rifa ya tiene imagen, eliminar la anterior
    if (rifa.imagen_url) {
      const oldImagePath = path.join(__dirname, '../../', rifa.imagen_url);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
        console.log('🗑️ Imagen anterior eliminada:', oldImagePath);
      }
    }
    
    // Guardar nueva URL en la base de datos
    const newImageUrl = `/uploads/rifas/${req.file.filename}`;
    
    await db.execute(
      'UPDATE rifas SET imagen_url = ?, fecha_actualizacion = NOW() WHERE id = ?',
      [newImageUrl, rifaId]
    );
    
    console.log('✅ Imagen de rifa actualizada:', newImageUrl);
    
    res.json({
      status: 'success',
      message: 'Imagen subida exitosamente',
      imagen_url: newImageUrl
    });
    
  } catch (error) {
    console.error('❌ Error al subir imagen de rifa:', error);
    
    // Eliminar archivo si hubo error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Error al subir imagen',
      error: error.message
    });
  }
};

/**
 * Eliminar imagen de rifa
 * DELETE /api/rifas/:id/imagen
 */
export const deleteImagenRifa = async (req, res) => {
  try {
    const rifaId = parseInt(req.params.id);
    const userId = req.user.id;
    
    console.log('🗑️ Eliminar imagen rifa - ID:', rifaId, 'Usuario:', userId);
    
    // Verificar que la rifa existe
    const rifa = await Rifa.obtenerPorId(rifaId);
    if (!rifa) {
      return res.status(404).json({
        status: 'error',
        message: 'Rifa no encontrada'
      });
    }
    
    // Verificar permisos
    const user = req.user;
    const canDelete = user.role === 'admin_global' || 
                     (user.role === 'admin_institucion' && rifa.institucion_promotora_id === user.institucion_id);
    
    if (!canDelete) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permisos para eliminar la imagen de esta rifa'
      });
    }
    
    // Verificar que la rifa tiene imagen
    if (!rifa.imagen_url) {
      return res.status(404).json({
        status: 'error',
        message: 'La rifa no tiene imagen'
      });
    }
    
    // Eliminar archivo físico
    const imagePath = path.join(__dirname, '../../', rifa.imagen_url);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      console.log('✅ Archivo de imagen eliminado:', imagePath);
    }
    
    // Actualizar base de datos
    await db.execute(
      'UPDATE rifas SET imagen_url = NULL, fecha_actualizacion = NOW() WHERE id = ?',
      [rifaId]
    );
    
    console.log('✅ imagen_url establecida a NULL en BD');
    
    res.json({
      status: 'success',
      message: 'Imagen eliminada exitosamente'
    });
    
  } catch (error) {
    console.error('❌ Error al eliminar imagen de rifa:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al eliminar imagen',
      error: error.message
    });
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
    body('fecha_inicio').matches(/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/)
      .withMessage('Fecha de inicio inválida'),
    body('fecha_fin').matches(/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/)
      .withMessage('Fecha de fin inválida'),
    body('fecha_sorteo').optional({ nullable: true, checkFalsy: true })
      .matches(/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/)
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

/**
 * POST /rifas/:id/logo - Subir logo de rifa
 */
export const subirLogoRifa = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que existe la rifa
    const [rifas] = await db.execute(
      'SELECT id, logo_url FROM rifas WHERE id = ?',
      [id]
    );

    if (rifas.length === 0) {
      // Eliminar archivo subido si la rifa no existe
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        status: 'error',
        message: 'Rifa no encontrada'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No se proporcionó ningún archivo'
      });
    }

    // Eliminar logo anterior si existe
    const oldLogoUrl = rifas[0].logo_url;
    if (oldLogoUrl) {
      const oldLogoPath = path.join(__dirname, '../../', oldLogoUrl);
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }

    // Construir URL del nuevo logo
    const logoUrl = `/uploads/rifas/${req.file.filename}`;

    // Actualizar en la base de datos
    await db.execute(
      'UPDATE rifas SET logo_url = ?, fecha_actualizacion = NOW() WHERE id = ?',
      [logoUrl, id]
    );

    // Obtener rifa actualizada
    const [rifaActualizada] = await db.execute(
      'SELECT * FROM rifas WHERE id = ?',
      [id]
    );

    res.json({
      status: 'success',
      message: 'Logo subido exitosamente',
      data: {
        rifa: rifaActualizada[0],
        logo_url: logoUrl
      }
    });

  } catch (error) {
    // Limpiar archivo en caso de error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('❌ Error al subir logo de rifa:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al subir logo',
      error: error.message
    });
  }
};


/**
 * DELETE /rifas/:id/logo - Eliminar logo de rifa
 */
export const eliminarLogoRifa = async (req, res) => {
  try {
    const { id } = req.params;

    const [rifas] = await db.execute(
      'SELECT logo_url FROM rifas WHERE id = ?',
      [id]
    );

    if (rifas.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Rifa no encontrada'
      });
    }

    const logoUrl = rifas[0].logo_url;

    if (!logoUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'La rifa no tiene logo'
      });
    }

    // Eliminar archivo físico
    const logoPath = path.join(__dirname, '../../', logoUrl);
    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
    }

    // Actualizar base de datos
    await db.execute(
      'UPDATE rifas SET logo_url = NULL, fecha_actualizacion = NOW() WHERE id = ?',
      [id]
    );

    res.json({
      status: 'success',
      message: 'Logo eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error al eliminar logo de rifa:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al eliminar logo',
      error: error.message
    });
  }
};

// =====================================================
// GESTIÓN DE PARTICIPACIONES / INVITACIONES DE INSTITUCIONES
// =====================================================

rifasController.invitarInstituciones = async (req, res) => {
  try {
    const { id } = req.params;
    const { instituciones_ids } = req.body;
    const userId = req.user?.id || null;

    if (!Array.isArray(instituciones_ids) || instituciones_ids.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Debe enviar un listado de instituciones a invitar'
      });
    }

    // Verificar que exista la rifa
    const [rifas] = await db.execute('SELECT id FROM rifas WHERE id = ?', [id]);
    if (rifas.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Rifa no encontrada' });
    }

    // Registrar invitaciones evitando duplicados
    const values = instituciones_ids.map(instId => [id, instId, 'pendiente', userId]);
    const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ');

    await db.execute(
      `INSERT INTO rifa_participaciones (rifa_id, institucion_id, estado, invitado_por)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE estado = 'pendiente', fecha_solicitud = NOW()`,
      values.flat()
    );

    res.json({
      status: 'success',
      message: 'Instituciones invitadas exitosamente',
      data: { total_invitadas: instituciones_ids.length }
    });
  } catch (error) {
    console.error('❌ Error al invitar instituciones:', error);
    res.status(500).json({ status: 'error', message: 'Error interno al invitar instituciones' });
  }
};

rifasController.obtenerParticipaciones = async (req, res) => {
  try {
    const { id } = req.params;
    const [participaciones] = await db.execute(`
      SELECT rp.*, i.nombre as institucion_nombre, i.logo_url as institucion_logo
      FROM rifa_participaciones rp
      LEFT JOIN instituciones i ON rp.institucion_id = i.id
      WHERE rp.rifa_id = ?
      ORDER BY rp.fecha_solicitud DESC
    `, [id]);

    res.json({
      status: 'success',
      data: participaciones
    });
  } catch (error) {
    console.error('❌ Error al obtener participaciones:', error);
    res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
};

rifasController.aprobarParticipacion = async (req, res) => {
  try {
    const { id, participacionId } = req.params;

    await db.execute(
      `UPDATE rifa_participaciones
       SET estado = 'aprobada', fecha_respuesta = NOW()
       WHERE id = ? AND rifa_id = ?`,
      [participacionId, id]
    );

    res.json({
      status: 'success',
      message: 'Participación aprobada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error al aprobar participación:', error);
    res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
};

rifasController.rechazarParticipacion = async (req, res) => {
  try {
    const { id, participacionId } = req.params;
    const { motivo } = req.body || {};

    await db.execute(
      `UPDATE rifa_participaciones
       SET estado = 'rechazada', motivo_rechazo = ?, fecha_respuesta = NOW()
       WHERE id = ? AND rifa_id = ?`,
      [motivo || 'Rechazada por administrador', participacionId, id]
    );

    res.json({
      status: 'success',
      message: 'Participación rechazada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error al rechazar participación:', error);
    res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
};

rifasController.retirarParticipacion = async (req, res) => {
  try {
    const { id, participacionId } = req.params;
    await db.execute('DELETE FROM rifa_participaciones WHERE id = ? AND rifa_id = ?', [participacionId, id]);

    res.json({
      status: 'success',
      message: 'Participación retirada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error al retirar participación:', error);
    res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
};


export default rifasController;