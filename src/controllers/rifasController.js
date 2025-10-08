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
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'error', errors: errors.array() });
      }

      const { nombre, descripcion, cantidad_numeros, precio_numero, institucion_id } = req.body;

      const [result] = await db.execute(
        `INSERT INTO rifas (nombre, descripcion, cantidad_numeros, precio_numero, institucion_id, fecha_creacion)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [nombre, descripcion || '', cantidad_numeros, precio_numero, institucion_id || null]
      );

      res.json({ status: 'success', message: 'Rifa creada', id: result.insertId });
    } catch (error) {
      console.error('Error al crear rifa:', error);
      res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
  },

  async actualizarRifa(req, res) {
    try {
      const { id } = req.params;
      const { nombre, descripcion, cantidad_numeros, precio_numero } = req.body;

      await db.execute(
        `UPDATE rifas SET nombre=?, descripcion=?, cantidad_numeros=?, precio_numero=? WHERE id=?`,
        [nombre, descripcion, cantidad_numeros, precio_numero, id]
      );

      res.json({ status: 'success', message: 'Rifa actualizada' });
    } catch (error) {
      console.error('Error al actualizar rifa:', error);
      res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
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

  async comprarNumeros(req, res) {
    try {
      const { id } = req.params;
      const { numeros } = req.body;
      if (!Array.isArray(numeros) || numeros.length === 0)
        return res.status(400).json({ status: 'error', message: 'Debe seleccionar al menos un número' });

      const placeholders = numeros.map(() => '?').join(',');
      await db.execute(
        `UPDATE numeros_rifa SET estado='vendido', fecha_venta=NOW() WHERE rifa_id=? AND numero IN (${placeholders})`,
        [id, ...numeros]
      );

      res.json({ status: 'success', message: 'Números comprados exitosamente', total: numeros.length });
    } catch (error) {
      console.error('Error al comprar números:', error);
      res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
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
      const { institucion_id, desde_numero, hasta_numero } = req.body;

      if (!institucion_id || !desde_numero || !hasta_numero) {
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
    body('cantidad_numeros').isInt({ min: 1 }).withMessage('Cantidad de números inválida'),
    body('precio_numero').isFloat({ min: 0.01 }).withMessage('Precio inválido')
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
