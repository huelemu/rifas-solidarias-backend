// =====================================================
// CONTROLADOR COMPLETO PARA EL SISTEMA DE RIFAS - VERSIÓN LIMPIA
// =====================================================

import db from '../config/db.js';
import { body, validationResult } from 'express-validator';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Rifa } from '../models/Rifa.js';
import QRCode from 'qrcode';
import { enviarEmailConfirmacionVenta } from '../services/emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rifasController = {

  // =====================================================
  // CRUD BÁSICO DE RIFAS
  // =====================================================

async listarRifas(req, res) {
  try {
    const [rifas] = await db.execute(`
      SELECT 
        r.*,
        i.nombre as institucion_nombre,
        i.nombre as institucion_promotora_nombre,
        i.logo_url as institucion_logo,
        
        -- ✅ Estadísticas
        (SELECT COUNT(*) FROM numeros_rifa WHERE rifa_id = r.id) as total_numeros_generados,
        (SELECT COUNT(*) FROM numeros_rifa WHERE rifa_id = r.id AND estado = 'vendido') as numeros_vendidos,
        (SELECT COUNT(*) FROM numeros_rifa WHERE rifa_id = r.id AND estado = 'disponible') as numeros_disponibles,
        
        -- ✅ Recaudación SOLO de ventas reales (precio > 0)
        (SELECT COALESCE(SUM(precio_venta), 0) 
         FROM numeros_rifa 
         WHERE rifa_id = r.id AND estado = 'vendido' AND precio_venta > 0
        ) as total_recaudado
        
      FROM rifas r
      LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
      ORDER BY r.fecha_creacion DESC
    `);

    // ✅ Calcular porcentaje vendido para cada rifa
    const rifasConEstadisticas = rifas.map(rifa => ({
      ...rifa,
      porcentaje_vendido: rifa.total_numeros_generados > 0 
        ? Math.round((rifa.numeros_vendidos / rifa.total_numeros_generados) * 100)
        : 0
    }));

    res.json({ 
      status: 'success', 
      data: rifasConEstadisticas 
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
      const [result] = await db.execute('SELECT * FROM rifas WHERE id = ?', [id]);
      if (!result.length)
        return res.status(404).json({ status: 'error', message: 'Rifa no encontrada' });

      res.json({ status: 'success', data: result[0] });
    } catch (error) {
      console.error('Error al obtener rifa:', error);
      res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
  },

  async crearRifa(req, res) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await connection.rollback();
        return res.status(400).json({ status: 'error', errors: errors.array() });
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
        imagen_url,
        estado
      } = req.body;

      console.log('📝 Creando nueva rifa:', { nombre, cantidad_numeros, precio_numero });

      // Validaciones
      if (!nombre || !cantidad_numeros || !precio_numero || !institucion_promotora_id) {
        await connection.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Nombre, cantidad de números, precio e institución promotora son requeridos'
        });
      }

      if (!fecha_inicio || !fecha_fin) {
        await connection.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Fecha de inicio y fecha de fin son requeridas'
        });
      }

      if (cantidad_numeros < 1 || cantidad_numeros > 100000) {
        await connection.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'La cantidad de números debe estar entre 1 y 100,000'
        });
      }

      if (precio_numero <= 0) {
        await connection.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'El precio debe ser mayor a 0'
        });
      }

      // Verificar que la institución existe
      const [instituciones] = await connection.execute(
        'SELECT id FROM instituciones WHERE id = ? AND estado = "activa"',
        [institucion_promotora_id]
      );

      if (instituciones.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Institución no encontrada o inactiva'
        });
      }

      // Insertar rifa
      const [result] = await connection.execute(
        `INSERT INTO rifas (
          nombre, 
          descripcion, 
          cantidad_numeros, 
          precio_numero, 
          institucion_promotora_id,
          fecha_inicio,
          fecha_fin,
          fecha_sorteo,
          imagen_url,
          estado,
          creado_por,
          fecha_creacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          nombre,
          descripcion || '',
          cantidad_numeros,
          precio_numero,
          institucion_promotora_id,
          fecha_inicio,
          fecha_fin,
          fecha_sorteo || null,
          imagen_url || null,
          estado || 'borrador',
          req.user?.id || null
        ]
      );

      const rifaId = result.insertId;

      // Generar números automáticamente
      console.log(`🔢 Generando ${cantidad_numeros} números...`);

      const numerosValues = [];
      const crypto = await import('crypto');

      for (let num = 1; num <= cantidad_numeros; num++) {
        const hash = crypto.default
          .createHash('sha256')
          .update(`${rifaId}-${num}-${Date.now()}-${Math.random()}`)
          .digest('hex');
        
        const qrCode = `RIFA${rifaId}-${String(num).padStart(6, '0')}-${Date.now()}`;
        
        numerosValues.push(
          `(${rifaId}, ${num}, ${institucion_promotora_id}, '${qrCode}', '${hash}')`
        );
      }

      // Insertar números en lotes de 500
      const batchSize = 500;
      for (let i = 0; i < numerosValues.length; i += batchSize) {
        const batch = numerosValues.slice(i, i + batchSize);
        await connection.execute(
          `INSERT INTO numeros_rifa (rifa_id, numero, institucion_id, qr_code, hash_verificacion)
           VALUES ${batch.join(',')}`
        );
      }

      console.log(`✅ ${cantidad_numeros} números generados y asignados a institución promotora`);

      await connection.commit();

      // Obtener rifa creada
      const [rifaCreada] = await db.execute(
        `SELECT r.*, i.nombre as institucion_nombre
         FROM rifas r
         INNER JOIN instituciones i ON r.institucion_promotora_id = i.id
         WHERE r.id = ?`,
        [rifaId]
      );

      res.status(201).json({
        status: 'success',
        message: 'Rifa creada exitosamente',
        data: rifaCreada[0]
      });

    } catch (error) {
      await connection.rollback();
      console.error('❌ Error al crear rifa:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al crear rifa',
        error: error.message
      });
    } finally {
      connection.release();
    }
  },

  async actualizarRifa(req, res) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      const { id } = req.params;
      const {
        nombre,
        descripcion,
        cantidad_numeros,
        precio_numero,
        fecha_inicio,
        fecha_fin,
        fecha_sorteo,
        imagen_url,
        estado,
        institucion_promotora_id
      } = req.body;

      console.log('📝 Actualizando rifa:', { id, nombre, estado });

      // Verificar que la rifa existe
      const [rifaExistente] = await connection.execute(
        'SELECT id FROM rifas WHERE id = ?',
        [id]
      );

      if (rifaExistente.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Rifa no encontrada'
        });
      }

      // Construir query dinámicamente
      const updates = [];
      const values = [];

      if (nombre !== undefined) {
        updates.push('nombre = ?');
        values.push(nombre);
      }

      if (descripcion !== undefined) {
        updates.push('descripcion = ?');
        values.push(descripcion);
      }

      if (cantidad_numeros !== undefined) {
        updates.push('cantidad_numeros = ?');
        values.push(cantidad_numeros);
      }

      if (precio_numero !== undefined) {
        updates.push('precio_numero = ?');
        values.push(precio_numero);
      }

      if (fecha_inicio !== undefined) {
        updates.push('fecha_inicio = ?');
        values.push(fecha_inicio);
      }

      if (fecha_fin !== undefined) {
        updates.push('fecha_fin = ?');
        values.push(fecha_fin);
      }

      if (fecha_sorteo !== undefined) {
        updates.push('fecha_sorteo = ?');
        values.push(fecha_sorteo || null);
      }

      if (imagen_url !== undefined) {
        updates.push('imagen_url = ?');
        values.push(imagen_url || null);
      }

      if (estado !== undefined) {
        updates.push('estado = ?');
        values.push(estado);
      }

      if (institucion_promotora_id !== undefined) {
        updates.push('institucion_promotora_id = ?');
        values.push(institucion_promotora_id);
      }

      updates.push('fecha_actualizacion = NOW()');

      if (updates.length === 1) {
        await connection.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'No se proporcionaron campos para actualizar'
        });
      }

      values.push(id);

      const query = `UPDATE rifas SET ${updates.join(', ')} WHERE id = ?`;
      await connection.execute(query, values);

      await connection.commit();

      // Obtener rifa actualizada
      const [rifaActualizada] = await db.execute(
        `SELECT r.*, i.nombre as institucion_nombre
         FROM rifas r
         LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
         WHERE r.id = ?`,
        [id]
      );

      console.log('✅ Rifa actualizada exitosamente');

      res.json({
        status: 'success',
        message: 'Rifa actualizada exitosamente',
        data: rifaActualizada[0]
      });

    } catch (error) {
      await connection.rollback();
      console.error('❌ Error al actualizar rifa:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al actualizar rifa',
        error: error.message
      });
    } finally {
      connection.release();
    }
  },

async actualizarCantidadNumeros(req, res) {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { nueva_cantidad } = req.body;

    console.log('🔢 Actualizando cantidad de números:', { id, nueva_cantidad });

    // Validar
    if (!nueva_cantidad || nueva_cantidad < 1 || nueva_cantidad > 100000) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'La cantidad debe estar entre 1 y 100,000'
      });
    }

    // Verificar que la rifa existe
    const [rifas] = await connection.execute(
      'SELECT * FROM rifas WHERE id = ?',
      [id]
    );

    if (rifas.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: 'error',
        message: 'Rifa no encontrada'
      });
    }

    const rifa = rifas[0];
    const cantidadAnterior = rifa.cantidad_numeros;

    // ✅ CASO 1: Aumentar números
    if (nueva_cantidad > cantidadAnterior) {
      const numerosAAgregar = nueva_cantidad - cantidadAnterior;
      const institucion_id = rifa.institucion_promotora_id;
      
      console.log(`➕ Agregando ${numerosAAgregar} números nuevos`);

      const numerosValues = [];
      const crypto = await import('crypto');

      for (let num = cantidadAnterior + 1; num <= nueva_cantidad; num++) {
        const hash = crypto.default
          .createHash('sha256')
          .update(`${id}-${num}-${Date.now()}-${Math.random()}`)
          .digest('hex');
        
        const qrCode = `RIFA${id}-${String(num).padStart(6, '0')}-${Date.now()}`;
        
        numerosValues.push(
          `(${id}, ${num}, ${institucion_id}, '${qrCode}', '${hash}')`
        );
      }

      // Insertar en lotes de 500
      const batchSize = 500;
      for (let i = 0; i < numerosValues.length; i += batchSize) {
        const batch = numerosValues.slice(i, i + batchSize);
        await connection.execute(
          `INSERT INTO numeros_rifa (rifa_id, numero, institucion_id, qr_code, hash_verificacion)
           VALUES ${batch.join(',')}`
        );
      }
    }
    
    // ✅ CASO 2: Disminuir números (solo si no están vendidos)
    else if (nueva_cantidad < cantidadAnterior) {
      // Verificar que los números a eliminar no estén vendidos
      const [vendidos] = await connection.execute(
        `SELECT COUNT(*) as total 
         FROM numeros_rifa 
         WHERE rifa_id = ? AND numero > ? AND estado = 'vendido'`,
        [id, nueva_cantidad]
      );

      if (vendidos[0].total > 0) {
        await connection.rollback();
        return res.status(400).json({
          status: 'error',
          message: `No se puede reducir: hay ${vendidos[0].total} números vendidos en el rango que se eliminaría`
        });
      }

      // Eliminar números disponibles mayores a la nueva cantidad
      await connection.execute(
        `DELETE FROM numeros_rifa 
         WHERE rifa_id = ? AND numero > ?`,
        [id, nueva_cantidad]
      );

      console.log(`➖ Números eliminados: desde ${nueva_cantidad + 1} hasta ${cantidadAnterior}`);
    }

    // Actualizar cantidad en la tabla rifas
    await connection.execute(
      'UPDATE rifas SET cantidad_numeros = ?, fecha_actualizacion = NOW() WHERE id = ?',
      [nueva_cantidad, id]
    );

    await connection.commit();

    // Obtener rifa actualizada con estadísticas
    const [rifaActualizada] = await connection.execute(`
      SELECT 
        r.*,
        i.nombre as institucion_nombre,
        (SELECT COUNT(*) FROM numeros_rifa WHERE rifa_id = r.id) as total_numeros_generados
      FROM rifas r
      LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
      WHERE r.id = ?
    `, [id]);

    console.log('✅ Cantidad de números actualizada exitosamente');

    res.json({
      status: 'success',
      message: `Cantidad actualizada de ${cantidadAnterior} a ${nueva_cantidad}`,
      data: rifaActualizada[0]
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error actualizando cantidad de números:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar cantidad de números',
      error: error.message
    });
  } finally {
    connection.release();
  }
},


  async eliminarRifa(req, res) {
    try {
      const { id } = req.params;
      await db.execute('DELETE FROM rifas WHERE id = ?', [id]);
      res.json({ status: 'success', message: 'Rifa eliminada' });
    } catch (error) {
      console.error('Error al eliminar rifa:', error);
      res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
  },

  // =====================================================
  // RIFAS PÚBLICAS
  // =====================================================

  async obtenerRifaPublica(req, res) {
    try {
      const { id } = req.params;

      const [rifas] = await db.execute(`
        SELECT 
          r.*,
          i.nombre as institucion_nombre,
          i.logo_url as institucion_logo,
          u.nombre as creador_nombre,
          u.apellido as creador_apellido,
          (SELECT COUNT(*) FROM numeros_rifa WHERE rifa_id = r.id) as total_numeros_generados,
          (SELECT COUNT(*) FROM numeros_rifa WHERE rifa_id = r.id AND estado = 'vendido') as numeros_vendidos,
          (SELECT COUNT(*) FROM numeros_rifa WHERE rifa_id = r.id AND estado = 'disponible') as numeros_disponibles,
          (SELECT COUNT(*) FROM numeros_rifa WHERE rifa_id = r.id AND estado = 'reservado') as numeros_reservados,
          (SELECT SUM(precio_venta) FROM numeros_rifa WHERE rifa_id = r.id AND estado = 'vendido') as total_recaudado
        FROM rifas r
        LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
        LEFT JOIN usuarios u ON r.creado_por = u.id
        WHERE r.id = ? AND r.estado != 'borrador'
      `, [id]);

      if (rifas.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Rifa no encontrada o no está disponible públicamente'
        });
      }

      const rifa = rifas[0];

      if (rifa.total_numeros_generados > 0) {
        rifa.porcentaje_vendido = Math.round(
          (rifa.numeros_vendidos / rifa.total_numeros_generados) * 100
        );
      } else {
        rifa.porcentaje_vendido = 0;
      }

      res.json({
        status: 'success',
        data: rifa
      });

    } catch (error) {
      console.error('❌ Error obteniendo rifa pública:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener la rifa'
      });
    }
  },

  async obtenerNumerosRifaPublico(req, res) {
    try {
      const { id } = req.params;
      const { estado, page = 1, limit = 1000 } = req.query;

      const esAdmin = req.user && ['admin_global', 'admin_institucion'].includes(req.user.rol);

      console.log(`📡 obtenerNumerosRifaPublico - Rifa ${id} - Es Admin: ${esAdmin}`);

      const [rifas] = await db.execute('SELECT * FROM rifas WHERE id = ?', [id]);

      if (rifas.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Rifa no encontrada'
        });
      }

      const rifa = rifas[0];

      let whereClause = 'WHERE nr.rifa_id = ?';
      const params = [id];

      if (estado && ['disponible', 'reservado', 'vendido'].includes(estado)) {
        whereClause += ' AND nr.estado = ?';
        params.push(estado);
      }

      const offset = (page - 1) * limit;

      const selectFields = esAdmin 
        ? `
          nr.id,
          nr.numero,
          nr.estado,
          nr.fecha_venta,
          nr.metodo_pago,
          nr.precio_venta,
          nr.comprador_nombre,
          nr.comprador_apellido,
          nr.comprador_telefono,
          nr.comprador_email,
          nr.vendedor_id,
          u.nombre AS vendedor_nombre,
          u.apellido AS vendedor_apellido,
          CASE 
            WHEN nr.estado = 'reservado' THEN TIMESTAMPDIFF(MINUTE, NOW(), nr.fecha_expiracion_reserva)
            ELSE NULL
          END as minutos_reserva_restantes
        `
        : `
          nr.id,
          nr.numero,
          nr.estado,
          nr.fecha_venta,
          CASE 
            WHEN nr.estado = 'reservado' THEN TIMESTAMPDIFF(MINUTE, NOW(), nr.fecha_expiracion_reserva)
            ELSE NULL
          END as minutos_reserva_restantes
        `;

      const joinClause = esAdmin 
        ? 'LEFT JOIN usuarios u ON nr.vendedor_id = u.id'
        : '';

      const [numeros] = await db.execute(`
        SELECT ${selectFields}
        FROM numeros_rifa nr
        ${joinClause}
        ${whereClause}
        ORDER BY nr.numero ASC
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), parseInt(offset)]);

      const [total] = await db.execute(`
        SELECT COUNT(*) as total 
        FROM numeros_rifa nr
        ${whereClause}
      `, params);

      const [stats] = await db.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN estado = 'disponible' THEN 1 ELSE 0 END) as disponibles,
          SUM(CASE WHEN estado = 'reservado' THEN 1 ELSE 0 END) as reservados,
          SUM(CASE WHEN estado = 'vendido' THEN 1 ELSE 0 END) as vendidos,
          ROUND((SUM(CASE WHEN estado = 'vendido' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as porcentaje_vendido
        FROM numeros_rifa
        WHERE rifa_id = ?
      `, [id]);

      res.json({
        status: 'success',
        data: {
          rifa: {
            id: rifa.id,
            nombre: rifa.nombre,
            precio_numero: rifa.precio_numero,
            cantidad_numeros: rifa.cantidad_numeros
          },
          numeros,
          estadisticas: stats[0],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: total[0].total,
            pages: Math.ceil(total[0].total / limit)
          }
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo números:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener números',
        error: error.message
      });
    }
  },

  async obtenerNumeroPublico(req, res) { //SINGULAR Numero Publico
    try {
      const { rifaId, numero } = req.params;

      console.log(`🔍 Consultando número público: Rifa ${rifaId}, Número ${numero}`);

      const [numeros] = await db.execute(`
        SELECT 
          n.id,
          n.numero,
          n.qr_code,
          n.estado,
          n.precio_venta,
          n.fecha_venta,
          n.comprador_nombre,
          n.comprador_apellido,
          r.id as rifa_id,
          r.nombre as rifa_nombre,
          r.descripcion as rifa_descripcion,
          r.imagen_url as rifa_imagen,
          r.precio_numero as rifa_precio,
          r.fecha_sorteo,
          r.estado as rifa_estado,
          i.nombre as institucion_nombre,
          i.logo_url as institucion_logo
        FROM numeros_rifa n
        INNER JOIN rifas r ON n.rifa_id = r.id
        LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
        WHERE n.rifa_id = ? AND n.numero = ?
      `, [rifaId, numero]);

      if (numeros.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Número no encontrado'
        });
      }

      const numeroData = numeros[0];

      if (numeroData.estado === 'vendido') {
        numeroData.comprador_nombre = numeroData.comprador_nombre 
          ? numeroData.comprador_nombre.charAt(0) + '***' 
          : null;
        numeroData.comprador_apellido = null;
      }

      res.json({
        status: 'success',
        data: numeroData
      });

    } catch (error) {
      console.error('❌ Error obteniendo número público:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener el número'
      });
    }
  },

  async obtenerNumerosPublicos(req, res) { //PlURAL Numeros Publicos
  try {
    const { id } = req.params;
    const { estado, page = 1, limit = 100, desde, hasta } = req.query;

    // Verificar que la rifa existe y está activa
    const [rifas] = await db.execute(
      'SELECT id, estado FROM rifas WHERE id = ? AND estado != ?',
      [id, 'borrador']
    );

    if (rifas.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Rifa no encontrada o no disponible públicamente'
      });
    }

    // Construir query
    let query = `
      SELECT 
        id,
        rifa_id,
        numero,
        qr_code,
        estado,
        precio_venta,
        fecha_venta
      FROM numeros_rifa
      WHERE rifa_id = ?
    `;

    const params = [id];

    // Filtros opcionales
    if (estado) {
      query += ' AND estado = ?';
      params.push(estado);
    }

    if (desde) {
      query += ' AND numero >= ?';
      params.push(parseInt(desde));
    }

    if (hasta) {
      query += ' AND numero <= ?';
      params.push(parseInt(hasta));
    }

    query += ' ORDER BY numero ASC';

    // Paginación
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [numeros] = await db.execute(query, params);

    // Contar total
    let countQuery = 'SELECT COUNT(*) as total FROM numeros_rifa WHERE rifa_id = ?';
    const countParams = [id];

    if (estado) {
      countQuery += ' AND estado = ?';
      countParams.push(estado);
    }

    const [countResult] = await db.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      status: 'success',
      data: numeros,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo números públicos:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener los números'
    });
  }
},

  // =====================================================
  // GESTIÓN DE NÚMEROS
  // =====================================================

  async generarNumerosRifa(req, res) {
    try {
      const { id } = req.params;
      
      console.log(`🎯 Generando números para rifa ${id}`);

      const [rifas] = await db.execute('SELECT * FROM rifas WHERE id = ?', [id]);

      if (rifas.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Rifa no encontrada'
        });
      }

      const rifa = rifas[0];

      const [numerosExistentes] = await db.execute(
        'SELECT COUNT(*) as total FROM numeros_rifa WHERE rifa_id = ?',
        [id]
      );

      if (numerosExistentes[0].total > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Los números ya han sido generados para esta rifa'
        });
      }

      const numerosParaInsertar = [];
      
      for (let i = 1; i <= rifa.cantidad_numeros; i++) {
        const pathRelativo = `/public/rifas/${id}/numero/${i}`;
        
        const qrCodeDataURL = await QRCode.toDataURL(pathRelativo, {
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 300,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        numerosParaInsertar.push([
          id,
          i,
          qrCodeDataURL,
          'disponible',
          rifa.precio_numero
        ]);
      }

      const query = `
        INSERT INTO numeros_rifa 
          (rifa_id, numero, qr_code, estado, precio_venta) 
        VALUES ?
      `;

      await db.query(query, [numerosParaInsertar]);

      console.log(`✅ ${rifa.cantidad_numeros} números generados`);

      res.json({
        status: 'success',
        message: 'Números generados exitosamente',
        data: {
          rifa_id: id,
          total_numeros: rifa.cantidad_numeros,
          estado: 'activa'
        }
      });

    } catch (error) {
      console.error('❌ Error generando números:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al generar números',
        error: error.message
      });
    }
  },

  async obtenerNumerosRifa(req, res) {
    try {
      const { id } = req.params;
      const [numeros] = await db.execute('SELECT * FROM numeros_rifa WHERE rifa_id = ?', [id]);
      res.json({ status: 'success', data: numeros });
    } catch (error) {
      console.error('Error al obtener números:', error);
      res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
  },

  // =====================================================
  // COMPRAR Y VENDER NÚMEROS
  // =====================================================

  async comprarNumeros(req, res) {
    try {
      const { id } = req.params;
      const { numeros, comprador_info, metodo_pago, observaciones } = req.body;

      if (!Array.isArray(numeros) || numeros.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Debe seleccionar al menos un número'
        });
      }

      const [disponibles] = await db.execute(
        `SELECT numero FROM numeros_rifa WHERE rifa_id = ? AND numero IN (${numeros.map(() => '?').join(',')}) AND estado = 'disponible'`,
        [id, ...numeros]
      );

      if (disponibles.length !== numeros.length) {
        return res.status(400).json({
          status: 'error',
          message: 'Uno o más números ya no están disponibles'
        });
      }

      const [r] = await db.execute('SELECT precio_numero FROM rifas WHERE id = ?', [id]);
      const precioNumero = r[0]?.precio_numero || 0;
      const totalPagado = precioNumero * numeros.length;

      const placeholders = numeros.map(() => '?').join(',');
      await db.execute(
        `UPDATE numeros_rifa 
         SET estado='vendido', fecha_venta=NOW(), comprador_nombre=?, comprador_telefono=?, metodo_pago=?, observaciones=?
         WHERE rifa_id=? AND numero IN (${placeholders})`,
        [
          `${comprador_info?.nombre || ''} ${comprador_info?.apellido || ''}`.trim(),
          comprador_info?.telefono || '',
          metodo_pago || '',
          observaciones || '',
          id,
          ...numeros
        ]
      );

      res.json({
        status: 'success',
        message: 'Números comprados exitosamente',
        data: {
          numeros_comprados: numeros,
          total_pagado: totalPagado
        }
      });

    } catch (error) {
      console.error('Error al comprar números:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

 async venderNumero(req, res) {
  try {
    const { rifa_id, numero } = req.params;
    const {
      comprador_nombre,
      comprador_apellido = '',
      comprador_telefono = '',
      comprador_email = '',
      metodo_pago,
      observaciones = ''
    } = req.body;

    const vendedorId = req.user.id;

    console.log('📧 Datos recibidos para venta:');
    console.log('  - comprador_nombre:', comprador_nombre);
    console.log('  - comprador_apellido:', comprador_apellido);
    console.log('  - comprador_telefono:', comprador_telefono);
    console.log('  - comprador_email:', comprador_email);
    console.log('  - metodo_pago:', metodo_pago);

    // Validar email solo si se proporciona
    if (comprador_email && comprador_email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(comprador_email)) {
        return res.status(400).json({
          status: 'error',
          message: 'El formato del email no es válido'
        });
      }
    }

    // Validaciones básicas
    if (!comprador_nombre || comprador_nombre.trim().length < 2) {
      return res.status(400).json({
        status: 'error',
        message: 'El nombre del comprador es obligatorio (mínimo 2 caracteres)'
      });
    }

    if (!metodo_pago || !['efectivo', 'transferencia', 'tarjeta', 'mercadopago'].includes(metodo_pago)) {
      return res.status(400).json({
        status: 'error',
        message: 'Método de pago inválido'
      });
    }

    // Verificar que la rifa existe y está activa
    const [rifas] = await db.execute(
      'SELECT * FROM rifas WHERE id = ? AND estado = "activa"',
      [rifa_id]
    );

    if (rifas.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Rifa no encontrada o no está activa'
      });
    }

    const rifa = rifas[0];

    // Verificar que el número existe y está disponible
    const [numeros] = await db.execute(
      'SELECT * FROM numeros_rifa WHERE rifa_id = ? AND numero = ? AND estado = "disponible"',
      [rifa_id, numero]
    );

    if (numeros.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'El número no está disponible'
      });
    }

    // ✅ CONCATENAR nombre + apellido
    const nombreCompleto = `${comprador_nombre.trim()} ${comprador_apellido.trim()}`.trim();
    
    // ✅ PREPARAR email (null si está vacío)
    const emailParaBD = (comprador_email && comprador_email.trim() !== '') 
      ? comprador_email.toLowerCase().trim() 
      : null;

    console.log('💾 Valores finales para BD:');
    console.log('  - nombreCompleto:', nombreCompleto);
    console.log('  - telefono:', comprador_telefono.trim());
    console.log('  - email:', emailParaBD);
    console.log('  - metodo_pago:', metodo_pago);

    // ✅ REGISTRAR LA VENTA (sin comprador_apellido, solo nombre completo)
    await db.execute(`
      UPDATE numeros_rifa 
      SET 
        estado = 'vendido',
        vendedor_id = ?,
        comprador_nombre = ?,
        comprador_telefono = ?,
        comprador_email = ?, 
        metodo_pago = ?,
        precio_venta = ?,
        fecha_venta = NOW(),
        observaciones = ?
      WHERE rifa_id = ? AND numero = ?
    `, [
      vendedorId,
      nombreCompleto,           // ✅ Nombre + Apellido concatenado
      comprador_telefono.trim(),
      emailParaBD,              // ✅ Email o null
      metodo_pago,
      rifa.precio_numero,
      observaciones.trim(),
      rifa_id,
      numero
    ]);

    console.log('✅ UPDATE ejecutado correctamente');

    // Obtener el número actualizado
    const [numeroActualizado] = await db.execute(`
      SELECT 
        nr.*,
        CONCAT(v.nombre, ' ', v.apellido) as vendedor_nombre,
        v.email as vendedor_email,
        v.telefono as vendedor_telefono
      FROM numeros_rifa nr
      LEFT JOIN usuarios v ON nr.vendedor_id = v.id
      WHERE nr.rifa_id = ? AND nr.numero = ?
    `, [rifa_id, numero]);

    // Generar QR Code
    const urlPublica = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/public/rifas/${rifa_id}/numero/${numero}`;
    let qrCodeDataUrl = '';
    
    try {
      qrCodeDataUrl = await QRCode.toDataURL(urlPublica, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (qrError) {
      console.error('Error generando QR:', qrError);
    }

    // Enviar email solo si se proporcionó
    let emailEnviado = false;
    
    if (emailParaBD) {
      console.log('📧 Intentando enviar email a:', emailParaBD);
      
      const emailResult = await enviarEmailConfirmacionVenta({
        numero: {
          numero: numero,
          precio_venta: rifa.precio_numero,
          metodo_pago: metodo_pago
        },
        rifa: {
          nombre: rifa.nombre,
          fecha_sorteo: rifa.fecha_sorteo
        },
        comprador: {
          nombre: comprador_nombre,
          apellido: comprador_apellido,
          email: emailParaBD
        },
        vendedor: {
          nombre: numeroActualizado[0]?.vendedor_nombre?.split(' ')[0] || '',
          apellido: numeroActualizado[0]?.vendedor_nombre?.split(' ').slice(1).join(' ') || '',
          email: numeroActualizado[0]?.vendedor_email,
          telefono: numeroActualizado[0]?.vendedor_telefono
        },
        qrCodeUrl: qrCodeDataUrl
      });

      emailEnviado = emailResult.success;
      
      if (emailResult.success) {
        console.log('✅ Email enviado correctamente a:', emailParaBD);
      } else {
        console.warn('⚠️ No se pudo enviar el email:', emailResult.error);
      }
    } else {
      console.log('ℹ️ No se proporcionó email, omitiendo envío de confirmación');
    }

    console.log(`✅ Número ${numero} vendido por vendedor ID ${vendedorId}`);

    res.json({
      status: 'success',
      message: `Número ${numero} vendido exitosamente`,
      data: numeroActualizado[0],
      email_enviado: emailEnviado
    });

  } catch (error) {
    console.error('❌ Error al vender número:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al registrar la venta',
      error: error.message
    });
  }
},

  async reservarNumero(req, res) {
    try {
      const { rifa_id, numero } = req.params;
      await db.execute(
        `UPDATE numeros_rifa SET estado='reservado', fecha_reserva=NOW() WHERE rifa_id=? AND numero=? AND estado='disponible'`,
        [rifa_id, numero]
      );
      res.json({ status: 'success', message: `Número ${numero} reservado` });
    } catch (error) {
      console.error('Error al reservar número:', error);
      res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
  },

  async asignarNumeros(req, res) {
    try {
      const { id } = req.params;
      const { institucion_promotora_id, desde_numero, hasta_numero } = req.body;

      if (!institucion_promotora_id || !desde_numero || !hasta_numero) {
        return res.status(400).json({ status: 'error', message: 'Faltan parámetros obligatorios' });
      }

      const [disponibles] = await db.execute(
        `SELECT COUNT(*) as disponibles FROM numeros_rifa 
         WHERE rifa_id = ? AND numero BETWEEN ? AND ? AND estado = 'disponible'`,
        [id, desde_numero, hasta_numero]
      );

      if (disponibles[0].disponibles === 0) {
        return res.status(400).json({ status: 'error', message: 'No hay números disponibles en ese rango' });
      }

      await db.execute(
        `UPDATE numeros_rifa 
         SET estado = 'asignado', institucion_id = ? 
         WHERE rifa_id = ? AND numero BETWEEN ? AND ?`,
        [institucion_id, id, desde_numero, hasta_numero]
      );

      res.json({
        status: 'success',
        message: `Números ${desde_numero}-${hasta_numero} asignados a institución ${institucion_id}`
      });
    } catch (error) {
      console.error('Error al asignar números:', error);
      res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
  },

  // =====================================================
  // VENDEDORES
  // =====================================================

  async obtenerMisRifasVendedor(req, res) {
    try {
      const vendedor_id = req.user.id;

      const [rifas] = await db.execute(`
        SELECT DISTINCT
          r.id,
          r.nombre,
          r.descripcion,
          r.imagen_url,
          r.estado,
          r.fecha_inicio,
          r.fecha_fin,
          r.fecha_sorteo,
          COUNT(DISTINCT vn.numero_id) as numeros_asignados,
          SUM(CASE WHEN n.estado = 'vendido' THEN 1 ELSE 0 END) as numeros_vendidos
        FROM rifas r
        INNER JOIN vendedor_numeros vn ON r.id = vn.rifa_id
        LEFT JOIN numeros_rifa n ON vn.numero_id = n.id
        WHERE vn.vendedor_id = ?
        GROUP BY r.id
        ORDER BY r.fecha_creacion DESC
      `, [vendedor_id]);

      res.json({
        status: 'success',
        data: rifas
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  async obtenerNumerosVendedor(req, res) {
    try {
      const { rifa_id } = req.params;
      const vendedor_id = req.user.id;

      const [numeros] = await db.execute(`
        SELECT 
          n.id,
          n.numero,
          n.estado,
          n.qr_code,
          n.comprador_nombre,
          n.comprador_telefono,
          n.comprador_email,
          n.fecha_venta,
          n.metodo_pago,
          vn.fecha_asignacion,
          vn.vendedor_id,
          u.nombre AS vendedor_nombre,
          u.apellido AS vendedor_apellido
        FROM vendedor_numeros vn
        INNER JOIN numeros_rifa n ON vn.numero_id = n.id
        INNER JOIN usuarios u ON vn.vendedor_id = u.id
        WHERE vn.rifa_id = ? AND vn.vendedor_id = ?
        ORDER BY n.numero ASC
      `, [rifa_id, vendedor_id]);

      const [rifa] = await db.execute(
        'SELECT id, nombre, imagen_url, precio_numero FROM rifas WHERE id = ?',
        [rifa_id]
      );

      if (!rifa[0]) {
        return res.status(404).json({ 
          status: 'error', 
          message: 'Rifa no encontrada' 
        });
      }

      res.json({
        status: 'success',
        data: {
          rifa: rifa[0],
          numeros,
          total_asignados: numeros.length,
          vendidos: numeros.filter(n => n.estado === 'vendido').length,
          disponibles: numeros.filter(n => n.estado === 'disponible').length
        }
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  async venderNumeroVendedor(req, res) {
    try {
      const { rifa_id, numero } = req.params;
      const vendedor_id = req.user.id;
      const { comprador_nombre, comprador_apellido, comprador_telefono, comprador_email } = req.body;

      const [asignacion] = await db.execute(`
        SELECT n.id, n.estado
        FROM vendedor_numeros vn
        INNER JOIN numeros_rifa n ON vn.numero_id = n.id
        WHERE vn.rifa_id = ? 
          AND vn.vendedor_id = ? 
          AND n.numero = ?
      `, [rifa_id, vendedor_id, numero]);

      if (asignacion.length === 0) {
        return res.status(403).json({ 
          status: 'error', 
          message: 'No tienes permiso para vender este número' 
        });
      }

      if (asignacion[0].estado !== 'disponible') {
        return res.status(400).json({ 
          status: 'error', 
          message: 'El número no está disponible' 
        });
      }

      await db.execute(`
        UPDATE numeros_rifa 
        SET estado = 'vendido',
            comprador_nombre = ?,
            comprador_apellido = ?,
            comprador_telefono = ?,
            comprador_email = ?,
            vendedor_id = ?,
            fecha_venta = NOW()
        WHERE id = ?
      `, [comprador_nombre, comprador_apellido, comprador_telefono, comprador_email, vendedor_id, asignacion[0].id]);

      res.json({
        status: 'success',
        message: 'Entrada vendida exitosamente',
        data: { numero }
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  // =====================================================
  // GESTIÓN DE LOGOS
  // =====================================================

  async subirLogoRifa(req, res) {
    try {
      const { id } = req.params;

      const [rifas] = await db.execute(
        'SELECT id, imagen_url FROM rifas WHERE id = ?',
        [id]
      );

      if (rifas.length === 0) {
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

      const oldLogoUrl = rifas[0].imagen_url;
      if (oldLogoUrl) {
        const oldLogoPath = path.join(__dirname, '../../', oldLogoUrl);
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }

      const logoUrl = `/uploads/rifas/${req.file.filename}`;

      await db.execute(
        'UPDATE rifas SET imagen_url = ?, fecha_actualizacion = NOW() WHERE id = ?',
        [logoUrl, id]
      );

      const [rifaActualizada] = await db.execute(
        'SELECT * FROM rifas WHERE id = ?',
        [id]
      );

      res.json({
        status: 'success',
        message: 'Logo de rifa subido exitosamente',
        data: {
          rifa: rifaActualizada[0],
          logo_url: logoUrl
        }
      });

    } catch (error) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      
      console.error('❌ Error al subir logo de rifa:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al subir logo de rifa',
        error: error.message
      });
    }
  },

  async eliminarLogoRifa(req, res) {
    try {
      const { id } = req.params;

      const [rifas] = await db.execute(
        'SELECT imagen_url FROM rifas WHERE id = ?',
        [id]
      );

      if (rifas.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Rifa no encontrada'
        });
      }

      const logoUrl = rifas[0].imagen_url;

      if (!logoUrl) {
        return res.status(404).json({
          status: 'error',
          message: 'La rifa no tiene logo'
        });
      }

      const logoPath = path.join(__dirname, '../../', logoUrl);
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }

      await db.execute(
        'UPDATE rifas SET imagen_url = NULL, fecha_actualizacion = NOW() WHERE id = ?',
        [id]
      );

      res.json({
        status: 'success',
        message: 'Logo de rifa eliminado exitosamente'
      });

    } catch (error) {
      console.error('❌ Error al eliminar logo de rifa:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al eliminar logo de rifa',
        error: error.message
      });
    }
  },

  // =====================================================
  // FUNCIONES PLACEHOLDER
  // =====================================================

  async cancelarVentaNumero(req, res) {
    res.json({ status: 'success', message: 'Función cancelarVentaNumero pendiente de implementación' });
  },

  async obtenerMisRifas(req, res) {
    res.json({ status: 'success', message: 'Función obtenerMisRifas pendiente de implementación' });
  },

  async obtenerMisNumeros(req, res) {
    res.json({ status: 'success', message: 'Función obtenerMisNumeros pendiente de implementación' });
  },

  async obtenerNumerosInstitucion(req, res) {
    res.json({ status: 'success', message: 'Función obtenerNumerosInstitucion pendiente de implementación' });
  }

};

// =====================================================
// VALIDACIONES
// =====================================================

export const rifasValidations = {
  crearRifa: [
    body('nombre').notEmpty().withMessage('El nombre es requerido'),
    body('cantidad_numeros').isInt({ min: 1, max: 100000 }).withMessage('Cantidad de números inválida (1-100000)'),
    body('precio_numero').isFloat({ min: 0.01 }).withMessage('Precio inválido'),
    body('institucion_promotora_id').isInt().withMessage('ID de institución inválido'),
    body('fecha_inicio').notEmpty().withMessage('Fecha de inicio es requerida'),
    body('fecha_fin').notEmpty().withMessage('Fecha de fin es requerida')
  ],
  actualizarRifa: [body('nombre').optional()],
  venderNumero: [body('comprador_nombre').notEmpty()],
  comprarNumeros: [body('numeros').isArray({ min: 1 }).withMessage('Debe enviar al menos un número')],
  asignarNumeros: [
    body('institucion_id').isInt(),
    body('desde_numero').isInt(),
    body('hasta_numero').isInt()
  ]
};

export default rifasController;