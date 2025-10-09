// =====================================================
// CONTROLADOR COMPLETO PARA EL SISTEMA DE RIFAS - VERSIÓN ESTABLE
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
  // =====================================================
  // FUNCIONES DE NÚMEROS (Implementadas)
  // =====================================================

  async generarNumerosRifa(req, res) {
    try {
      const { id } = req.params;
      const [r] = await db.execute('SELECT * FROM rifas WHERE id = ?', [id]);
      if (!r.length) return res.status(404).json({ status: 'error', message: 'Rifa no encontrada' });
      const rifa = r[0];

      const nums = [];
      for (let i = 1; i <= rifa.cantidad_numeros; i++) {
        const qr = `RIFA${id}-${String(i).padStart(6, '0')}-${Date.now()}`;
        nums.push([id, i, 'disponible', qr]);
      }

      const placeholders = nums.map(() => '(?, ?, ?, ?)').join(',');
      await db.execute(`INSERT INTO numeros_rifa (rifa_id, numero, estado, qr_code) VALUES ${placeholders}`, nums.flat());

      res.json({ status: 'success', message: 'Números generados exitosamente', total: nums.length });
    } catch (error) {
      console.error('Error al generar números:', error);
      res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
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
      await db.execute(
        `UPDATE numeros_rifa SET estado='vendido', fecha_venta=NOW() WHERE rifa_id=? AND numero=?`,
        [rifa_id, numero]
      );
      res.json({ status: 'success', message: `Número ${numero} vendido` });
    } catch (error) {
      console.error('Error al vender número:', error);
      res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
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

  async obtenerNumerosVendedor(req, res) {
    res.json({ status: 'success', message: 'Función obtenerNumerosVendedor pendiente de implementación' });
  }
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
