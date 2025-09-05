// src/routes/instituciones.js
import express from 'express';
import {
  obtenerInstituciones,
  obtenerInstitucionPorId,
  crearInstitucion,
  actualizarInstitucion,
  eliminarInstitucion
} from '../controllers/institucionesController.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Institucion:
 *       type: object
 *       required:
 *         - nombre
 *         - email
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único de la institución
 *         nombre:
 *           type: string
 *           description: Nombre de la institución
 *         descripcion:
 *           type: string
 *           description: Descripción de la institución
 *         direccion:
 *           type: string
 *           description: Dirección física
 *         telefono:
 *           type: string
 *           description: Teléfono de contacto
 *         email:
 *           type: string
 *           format: email
 *           description: Email de contacto
 *         logo_url:
 *           type: string
 *           description: URL del logo
 *         estado:
 *           type: string
 *           enum: [activa, inactiva]
 *           description: Estado de la institución
 *         fecha_creacion:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación
 *         fecha_actualizacion:
 *           type: string
 *           format: date-time
 *           description: Fecha de última actualización
 */

/**
 * @swagger
 * /instituciones:
 *   get:
 *     summary: Obtener todas las instituciones
 *     tags: [Instituciones]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Elementos por página
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [activa, inactiva]
 *         description: Filtrar por estado
 *     responses:
 *       200:
 *         description: Lista de instituciones obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Institucion'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     current_page:
 *                       type: integer
 *                     total_pages:
 *                       type: integer
 *                     total_records:
 *                       type: integer
 *                     per_page:
 *                       type: integer
 */
router.get('/', obtenerInstituciones);

/**
 * @swagger
 * /instituciones/{id}:
 *   get:
 *     summary: Obtener una institución por ID
 *     tags: [Instituciones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la institución
 *     responses:
 *       200:
 *         description: Institución encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Institucion'
 *                     - type: object
 *                       properties:
 *                         estadisticas:
 *                           type: object
 *                           properties:
 *                             total_rifas:
 *                               type: integer
 *                             total_usuarios:
 *                               type: integer
 *       404:
 *         description: Institución no encontrada
 */
router.get('/:id', obtenerInstitucionPorId);

/**
 * @swagger
 * /instituciones:
 *   post:
 *     summary: Crear nueva institución
 *     tags: [Instituciones]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - email
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "Club Deportivo Ejemplo"
 *               descripcion:
 *                 type: string
 *                 example: "Club deportivo local"
 *               direccion:
 *                 type: string
 *                 example: "Calle Falsa 123"
 *               telefono:
 *                 type: string
 *                 example: "+54 11 1234-5678"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "contacto@clubejemplo.com"
 *               logo_url:
 *                 type: string
 *                 example: "https://ejemplo.com/logo.jpg"
 *     responses:
 *       201:
 *         description: Institución creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Institución creada exitosamente
 *                 data:
 *                   $ref: '#/components/schemas/Institucion'
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Email ya existe
 */
router.post('/', crearInstitucion);

/**
 * @swagger
 * /instituciones/{id}:
 *   put:
 *     summary: Actualizar institución
 *     tags: [Instituciones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la institución
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               direccion:
 *                 type: string
 *               telefono:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               logo_url:
 *                 type: string
 *               estado:
 *                 type: string
 *                 enum: [activa, inactiva]
 *     responses:
 *       200:
 *         description: Institución actualizada exitosamente
 *       404:
 *         description: Institución no encontrada
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Email ya existe
 */
router.put('/:id', actualizarInstitucion);

/**
 * @swagger
 * /instituciones/{id}:
 *   delete:
 *     summary: Eliminar institución
 *     tags: [Instituciones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la institución
 *     responses:
 *       200:
 *         description: Institución eliminada exitosamente
 *       404:
 *         description: Institución no encontrada
 *       400:
 *         description: No se puede eliminar (tiene rifas asociadas)
 */
router.delete('/:id', eliminarInstitucion);

export default router;