// =====================================================
// CONTROLADOR COMPLETO PARA EL SISTEMA DE RIFAS - VERSIÓN ESTABLE
// =====================================================

import db from '../config/db.js';
import { body, validationResult } from 'express-validator';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Rifa } from '../models/Rifa.js';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rifasController = {

  // =====================================================
  // CRUD BÁSICO DE RIFAS
  // =====================================================

  async listarRifas(req, res) {
    try {
      const [rifas] = await db.execute('SELECT * FROM rifas ORDER BY fecha_creacion DESC');
      res.json({ status: 'success', data: rifas });
    } catch (error) {
      console.error('Error al listar rifas:', error);
      res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
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

    // ✅ GENERAR NÚMEROS AUTOMÁTICAMENTE
console.log(`🔢 Generando ${cantidad_numeros} números...`);

const numerosValues = [];
const crypto = await import('crypto');

for (let num = 1; num <= cantidad_numeros; num++) {
  const hash = crypto.default
    .createHash('sha256')
    .update(`${rifaId}-${num}-${Date.now()}-${Math.random()}`)
    .digest('hex');
  
  const qrCode = `RIFA${rifaId}-${String(num).padStart(6, '0')}-${Date.now()}`;
  
  // ✅ AGREGAR institucion_id (institución promotora)
  numerosValues.push(
    `(${rifaId}, ${num}, ${institucion_promotora_id}, '${qrCode}', '${hash}')`
  );
}

// Insertar números en lotes de 500
const batchSize = 500;
for (let i = 0; i < numerosValues.length; i += batchSize) {
  const batch = numerosValues.slice(i, i + batchSize);
  await connection.execute(
    // ✅ AGREGAR institucion_id al INSERT
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

    // Construir query dinámicamente solo con campos que vienen en el body
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

    // Agregar timestamp de actualización
    updates.push('fecha_actualizacion = NOW()');

    if (updates.length === 1) { // Solo tiene el timestamp
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'No se proporcionaron campos para actualizar'
      });
    }

    // Agregar el ID al final
    values.push(id);

    // Ejecutar actualización
    const query = `UPDATE rifas SET ${updates.join(', ')} WHERE id = ?`;
    console.log('🔄 Query:', query);
    console.log('📊 Values:', values);

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

  /**
 * Obtener rifa pública (sin autenticación)
 */
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

    // Calcular porcentaje vendido
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


/**
 * Cambios para ver numeros publicos con el nuevo proceso de compra
 * 
 */

/**
 * GET /rifas/:id/numeros (PÚBLICO - Sin auth)
 * Ver TODOS los números de una rifa con su estado
 */
async obtenerNumerosRifaPublico(req, res) {
  try {
    const { id } = req.params;
    const { estado, page = 1, limit = 1000 } = req.query;

    // Verificar que la rifa existe
    const [rifas] = await db.execute(
      'SELECT * FROM rifas WHERE id = ?',
      [id]
    );

    if (rifas.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Rifa no encontrada'
      });
    }

    const rifa = rifas[0];

    // Construir query con filtros opcionales
    let whereClause = 'WHERE rifa_id = ?';
    const params = [id];

    if (estado && ['disponible', 'reservado', 'vendido'].includes(estado)) {
      whereClause += ' AND estado = ?';
      params.push(estado);
    }

    const offset = (page - 1) * limit;

    // Obtener números (SIN datos sensibles del comprador si no está auth)
    const [numeros] = await db.execute(`
      SELECT 
        id,
        numero,
        estado,
        fecha_venta,
        CASE 
          WHEN estado = 'reservado' THEN TIMESTAMPDIFF(MINUTE, NOW(), fecha_expiracion_reserva)
          ELSE NULL
        END as minutos_reserva_restantes
      FROM numeros_rifa
      ${whereClause}
      ORDER BY numero ASC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Contar total
    const [total] = await db.execute(`
      SELECT COUNT(*) as total 
      FROM numeros_rifa 
      ${whereClause}
    `, params);

    // Estadísticas generales
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
          titulo: rifa.titulo,
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
    console.error('❌ Error obteniendo números públicos:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener números',
      error: error.message
    });
  }
},

/**
 * Obtener números públicos (sin autenticación)
 */
async obtenerNumerosPublicos(req, res) {
  try {
    const { id } = req.params;
    const { 
      estado, 
      page = 1, 
      limit = 100,
      desde,
      hasta 
    } = req.query;

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
  // FUNCIONES DE NÚMEROS (Implementadas)
  // =====================================================

 async generarNumerosRifa(req, res) {
  try {
    const { id } = req.params;
    
    console.log(`🎯 Generando números para rifa ${id}`);

    // Verificar que la rifa existe
    const [rifas] = await db.execute(
      'SELECT * FROM rifas WHERE id = ?',
      [id]
    );

    if (rifas.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Rifa no encontrada'
      });
    }

    const rifa = rifas[0];

    // Verificar que no se hayan generado ya
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

    // ⭐ GUARDAR SOLO EL PATH RELATIVO (sin dominio)
    const numerosParaInsertar = [];
    
    for (let i = 1; i <= rifa.cantidad_numeros; i++) {
      // ⭐ PATH RELATIVO (funciona en cualquier dominio)
      const pathRelativo = `/public/rifas/${id}/numero/${i}`;
      
      // ⭐ QR con path relativo (el frontend lo completará)
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
        id,                           // rifa_id
        i,                            // numero
        qrCodeDataURL,                // qr_code (Data URL)
        'disponible',                 // estado
        rifa.precio_numero            // precio
      ]);
    }

    // Insertar todos los números
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

//-----

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
// COMPRAR NÚMEROS
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

    // Verificar existencia y disponibilidad
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

    // Obtener precio por número
    const [r] = await db.execute('SELECT precio_numero FROM rifas WHERE id = ?', [id]);
    const precioNumero = r[0]?.precio_numero || 0;
    const totalPagado = precioNumero * numeros.length;

    // Actualizar los números como vendidos
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

    // ✅ Nueva estructura compatible con el frontend
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
      comprador_email, // ✅ AHORA ES OBLIGATORIO
      metodo_pago,
      observaciones = ''
    } = req.body;

    const vendedorId = req.user.id;

    // ✅ VALIDACIÓN OBLIGATORIA DE EMAIL
    if (!comprador_email) {
      return res.status(400).json({
        status: 'error',
        message: 'El email del comprador es obligatorio'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(comprador_email)) {
      return res.status(400).json({
        status: 'error',
        message: 'El email del comprador no es válido'
      });
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

    // Registrar la venta
    await db.execute(`
      UPDATE numeros_rifa 
      SET 
        estado = 'vendido',
        vendedor_id = ?,
        comprador_nombre = ?,
        comprador_apellido = ?,
        comprador_telefono = ?,
        comprador_email = ?, 
        metodo_pago = ?,
        precio_venta = ?,
        fecha_venta = NOW(),
        observaciones = ?
      WHERE rifa_id = ? AND numero = ?
    `, [
      vendedorId,
      comprador_nombre.trim(),
      comprador_apellido.trim(),
      comprador_telefono.trim(),
      comprador_email.toLowerCase().trim(), // ✅ Normalizar email
      metodo_pago,
      rifa.precio_numero,
      observaciones.trim(),
      rifa_id,
      numero
    ]);

    // Obtener el número actualizado
    const [numeroActualizado] = await db.execute(`
      SELECT 
        nr.*,
        CONCAT(v.nombre, ' ', v.apellido) as vendedor_nombre
      FROM numeros_rifa nr
      LEFT JOIN usuarios v ON nr.vendedor_id = v.id
      WHERE nr.rifa_id = ? AND nr.numero = ?
    `, [rifa_id, numero]);

    console.log(`✅ Número ${numero} vendido por vendedor ID ${vendedorId} - Email: ${comprador_email}`);

    res.json({
      status: 'success',
      message: `Número ${numero} vendido exitosamente`,
      data: numeroActualizado[0]
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

      // Verificar que los números existan y estén disponibles
      const [disponibles] = await db.execute(
        `SELECT COUNT(*) as disponibles FROM numeros_rifa 
         WHERE rifa_id = ? AND numero BETWEEN ? AND ? AND estado = 'disponible'`,
        [id, desde_numero, hasta_numero]
      );

      if (disponibles[0].disponibles === 0) {
        return res.status(400).json({ status: 'error', message: 'No hay números disponibles en ese rango' });
      }

      // Asignar los números a la institución
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
  // FUNCIONES PLACEHOLDER (stubs vacíos para evitar errores)
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
  },



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

// Obtener números asignados al vendedor
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

// Vender número como vendedor
async venderNumeroVendedor(req, res) {
  try {
    const { rifa_id, numero } = req.params;
    const vendedor_id = req.user.id;
    const { comprador_nombre, comprador_apellido, comprador_telefono, comprador_email } = req.body;

    // Verificar que el número está asignado al vendedor
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

    // Marcar como vendido
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

};

// =====================================================
// VALIDACIONES DE CAMPOS
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
