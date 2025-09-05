import express from 'express';
import { 
  getAllRifas, 
  getRifaById, 
  createRifa, 
  updateRifa, 
  deleteRifa,
  getBoletosByRifa,
  comprarBoleto 
} from '../controllers/rifasController.js';

const router = express.Router();

/**
 * @swagger
 * /rifas:
 *   get:
 *     summary: Obtener todas las rifas
 *     tags:
 *       - Rifas
 *     responses:
 *       200:
 *         description: Lista de rifas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Rifa'
 */
router.get('/', getAllRifas);

/**
 * @swagger
 * /rifas/{id}:
 *   get:
 *     summary: Obtener rifa por ID
 *     tags:
 *       - Rifas
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la rifa
 *     responses:
 *       200:
 *         description: Datos de la rifa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Rifa'
 *       404:
 *         description: Rifa no encontrada
 */
router.get('/:id', getRifaById);

/**
 * @swagger
 * /rifas:
 *   post:
 *     summary: Crear una nueva rifa
 *     tags:
 *       - Rifas
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RifaCreate'
 *     responses:
 *       201:
 *         description: Rifa creada correctamente
 */
router.post('/', createRifa);

/**
 * @swagger
 * /rifas/{id}:
 *   put:
 *     summary: Actualizar una rifa existente
 *     tags:
 *       - Rifas
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la rifa a actualizar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RifaUpdate'
 *     responses:
 *       200:
 *         description: Rifa actualizada correctamente
 */
router.put('/:id', updateRifa);

/**
 * @swagger
 * /rifas/{id}:
 *   delete:
 *     summary: Eliminar una rifa
 *     tags:
 *       - Rifas
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la rifa a eliminar
 *     responses:
 *       200:
 *         description: Rifa eliminada correctamente
 */
router.delete('/:id', deleteRifa);

/**
 * @swagger
 * /rifas/{rifaId}/boletos:
 *   get:
 *     summary: Obtener boletos de una rifa
 *     tags:
 *       - Boletos
 *     parameters:
 *       - in: path
 *         name: rifaId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la rifa
 *     responses:
 *       200:
 *         description: Lista de boletos vendidos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Boleto'
 */
router.get('/:rifaId/boletos', getBoletosByRifa);

/**
 * @swagger
 * /rifas/{rifaId}/boletos:
 *   post:
 *     summary: Comprar un boleto
 *     tags:
 *       - Boletos
 *     parameters:
 *       - in: path
 *         name: rifaId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la rifa
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BoletoCompra'
 *     responses:
 *       201:
 *         description: Boleto comprado correctamente
 *       400:
 *         description: El boleto ya está vendido
 */
router.post('/:rifaId/boletos', comprarBoleto);

export default router;