import express from 'express';
import { getAllInstituciones, createInstitucion, updateInstitucion, deleteInstitucion } from '../controllers/institucionesController.js';

const router = express.Router();

/**
 * @swagger
 * /instituciones:
 *   get:
 *     summary: Obtener todas las instituciones
 *     tags:
 *       - Instituciones
 *     responses:
 *       200:
 *         description: Lista de instituciones
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Institucion'
 */
router.get('/', getAllInstituciones);

/**
 * @swagger
 * /instituciones:
 *   post:
 *     summary: Crear una nueva institución
 *     tags:
 *       - Instituciones
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Institucion'
 *     responses:
 *       201:
 *         description: Institución creada correctamente
 */
router.post('/', createInstitucion);

/**
 * @swagger
 * /instituciones/{id}:
 *   put:
 *     summary: Actualizar una institución existente
 *     tags:
 *       - Instituciones
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la institución a actualizar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Institucion'
 *     responses:
 *       200:
 *         description: Institución actualizada correctamente
 */
router.put('/:id', updateInstitucion);

/**
 * @swagger
 * /instituciones/{id}:
 *   delete:
 *     summary: Eliminar una institución
 *     tags:
 *       - Instituciones
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la institución a eliminar
 *     responses:
 *       204:
 *         description: Institución eliminada correctamente
 */
router.delete('/:id', deleteInstitucion);

export default router;
