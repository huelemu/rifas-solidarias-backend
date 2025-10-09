import express from 'express';
import { obtenerInfoNumero, reservarNumero } from '../controllers/compraPublicaController.js';

const router = express.Router();

/**
 * @swagger
 * /comprar/{rifaId}/{numero}:
 *   get:
 *     summary: Obtener información de un número (PÚBLICO)
 *     tags: [Compra Pública]
 *     parameters:
 *       - in: path
 *         name: rifaId
 *         required: true
 *       - in: path
 *         name: numero
 *         required: true
 *       - in: query
 *         name: hash
 *         description: Hash de verificación del QR
 */
router.get('/:rifaId/:numero', obtenerInfoNumero);

/**
 * @swagger
 * /comprar/{rifaId}/{numero}:
 *   post:
 *     summary: Reservar/Comprar un número (PÚBLICO)
 *     tags: [Compra Pública]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - email
 *               - telefono
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Juan Pérez
 *               email:
 *                 type: string
 *                 example: juan@ejemplo.com
 *               telefono:
 *                 type: string
 *                 example: +54 9 11 1234-5678
 *               dni:
 *                 type: string
 *                 example: 12345678
 */
router.post('/:rifaId/:numero', reservarNumero);

export default router;