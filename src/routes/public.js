// =====================================================
// RUTAS PÚBLICAS
// Endpoints accesibles sin autenticación
// =====================================================

import express from 'express';
import {
  getNumeroDetalle,
  getRifaPublica,
  getNumerosRifa,
  getRifasPublicas
} from '../controllers/publicController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Público
 *   description: Endpoints públicos sin autenticación
 */

/**
 * @swagger
 * /public/rifas:
 *   get:
 *     summary: Obtiene todas las rifas activas (público)
 *     tags: [Público]
 *     responses:
 *       200:
 *         description: Lista de rifas activas
 */
router.get('/rifas', getRifasPublicas);

/**
 * @swagger
 * /public/rifas/{rifaId}:
 *   get:
 *     summary: Obtiene información pública de una rifa
 *     tags: [Público]
 *     parameters:
 *       - in: path
 *         name: rifaId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Información de la rifa
 *       404:
 *         description: Rifa no encontrada
 */
router.get('/rifas/:rifaId', getRifaPublica);

/**
 * @swagger
 * /public/rifas/{rifaId}/numeros:
 *   get:
 *     summary: Obtiene todos los números de una rifa (público)
 *     tags: [Público]
 *     parameters:
 *       - in: path
 *         name: rifaId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de números con su estado
 */
router.get('/rifas/:rifaId/numeros', getNumerosRifa);

/**
 * @swagger
 * /public/rifas/{rifaId}/numeros/{numeroId}:
 *   get:
 *     summary: Obtiene detalle completo de un número (incluye vendedor con teléfono para WhatsApp)
 *     tags: [Público]
 *     parameters:
 *       - in: path
 *         name: rifaId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: numeroId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detalle del número con información del vendedor
 *       404:
 *         description: Número no encontrado
 */
router.get('/rifas/:rifaId/numeros/:numeroId', getNumeroDetalle);

console.log('✅ Rutas públicas configuradas correctamente');

export default router;