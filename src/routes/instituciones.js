// =====================================================
// RUTAS DE INSTITUCIONES
// src/routes/instituciones.js
// =====================================================

import express from 'express';
import { uploadLogo } from '../config/upload.js';
import { 
  obtenerInstituciones,
  obtenerInstitucionPorId,
  crearInstitucion,
  actualizarInstitucion,
  eliminarInstitucion,
  obtenerEstadisticasInstituciones,
  subirLogo,
  eliminarLogo
} from '../controllers/institucionesController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

// =====================================================
// 📊 RUTA DE ESTADÍSTICAS (debe ir ANTES de /:id)
// =====================================================

/**
 * @swagger
 * /instituciones/stats:
 *   get:
 *     summary: Obtener estadísticas de instituciones
 *     description: Retorna estadísticas generales sobre las instituciones del sistema
 *     tags: [Instituciones]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     totales:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 25
 *                         activas:
 *                           type: integer
 *                           example: 20
 *                         inactivas:
 *                           type: integer
 *                           example: 5
 *                     por_tipo:
 *                       type: object
 *                       properties:
 *                         club:
 *                           type: integer
 *                         fundacion:
 *                           type: integer
 *                         ong:
 *                           type: integer
 *       401:
 *         description: No autorizado
 */
router.get('/stats', requireAuth, obtenerEstadisticasInstituciones);

// =====================================================
// 🏢 RUTAS CRUD BÁSICAS
// =====================================================

/**
 * @swagger
 * /instituciones:
 *   get:
 *     summary: Listar todas las instituciones
 *     description: Obtiene una lista paginada de instituciones
 *     tags: [Instituciones]
 *     security:
 *       - BearerAuth: []
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
 *         description: Instituciones por página
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [activa, inactiva, suspendida]
 *         description: Filtrar por estado
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [club, fundacion, ong, cooperativa, escuela, otro]
 *         description: Filtrar por tipo
 *       - in: query
 *         name: buscar
 *         schema:
 *           type: string
 *         description: Buscar por nombre o descripción
 *     responses:
 *       200:
 *         description: Lista de instituciones
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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       nombre:
 *                         type: string
 *                         example: Cruz Roja Argentina
 *                       descripcion:
 *                         type: string
 *                         example: Organización humanitaria
 *                       tipo:
 *                         type: string
 *                         example: ong
 *                       email:
 *                         type: string
 *                         example: info@cruzroja.org.ar
 *                       telefono:
 *                         type: string
 *                         example: "+5491143216543"
 *                       direccion:
 *                         type: string
 *                         example: Av. Corrientes 1234, CABA
 *                       logo_url:
 *                         type: string
 *                         example: /uploads/logos/cruz_roja.png
 *                       estado:
 *                         type: string
 *                         example: activa
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       401:
 *         description: No autorizado
 */
router.get('/', requireAuth, obtenerInstituciones);

/**
 * @swagger
 * /instituciones/{id}:
 *   get:
 *     summary: Obtener institución por ID
 *     description: Retorna los detalles completos de una institución
 *     tags: [Instituciones]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la institución
 *         example: 1
 *     responses:
 *       200:
 *         description: Datos de la institución
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     nombre:
 *                       type: string
 *                     descripcion:
 *                       type: string
 *                     tipo:
 *                       type: string
 *                     email:
 *                       type: string
 *                     telefono:
 *                       type: string
 *                     direccion:
 *                       type: string
 *                     cuit:
 *                       type: string
 *                     logo_url:
 *                       type: string
 *                     estado:
 *                       type: string
 *                     fecha_creacion:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Institución no encontrada
 *       401:
 *         description: No autorizado
 */
router.get('/:id', requireAuth, obtenerInstitucionPorId);

/**
 * @swagger
 * /instituciones:
 *   post:
 *     summary: Crear nueva institución
 *     description: Crea una nueva institución en el sistema. Solo admin_global.
 *     tags: [Instituciones]
 *     security:
 *       - BearerAuth: []
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
 *                 example: Club Deportivo El Amanecer
 *               descripcion:
 *                 type: string
 *                 example: Club deportivo social y cultural
 *               tipo:
 *                 type: string
 *                 enum: [club, fundacion, ong, cooperativa, escuela, otro]
 *                 default: club
 *                 example: club
 *               email:
 *                 type: string
 *                 format: email
 *                 example: contacto@clubamanecer.org.ar
 *               telefono:
 *                 type: string
 *                 example: "+5491145678901"
 *               direccion:
 *                 type: string
 *                 example: Calle Falsa 123, Buenos Aires
 *               cuit:
 *                 type: string
 *                 example: "30-12345678-9"
 *           examples:
 *             club_deportivo:
 *               summary: Club Deportivo
 *               value:
 *                 nombre: Club Deportivo San Martín
 *                 descripcion: Club deportivo de barrio
 *                 tipo: club
 *                 email: info@clubsanmartin.org.ar
 *                 telefono: "+5491143216543"
 *                 direccion: Av. San Martín 456, CABA
 *             fundacion:
 *               summary: Fundación
 *               value:
 *                 nombre: Fundación Ayudar
 *                 descripcion: Fundación para ayuda social
 *                 tipo: fundacion
 *                 email: contacto@fundacionayudar.org
 *                 cuit: "30-98765432-1"
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
 *                   type: object
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Ya existe una institución con ese email
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos
 */
router.post('/', requireAuth, requireRole([ROLES.ADMIN_GLOBAL]), crearInstitucion);

/**
 * @swagger
 * /instituciones/{id}:
 *   put:
 *     summary: Actualizar institución
 *     description: Modifica los datos de una institución existente
 *     tags: [Instituciones]
 *     security:
 *       - BearerAuth: []
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
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               tipo:
 *                 type: string
 *               email:
 *                 type: string
 *               telefono:
 *                 type: string
 *               direccion:
 *                 type: string
 *               cuit:
 *                 type: string
 *               estado:
 *                 type: string
 *                 enum: [activa, inactiva, suspendida]
 *           examples:
 *             actualizar_contacto:
 *               summary: Actualizar contacto
 *               value:
 *                 telefono: "+5491199999999"
 *                 email: nuevo@email.com
 *             cambiar_estado:
 *               summary: Suspender institución
 *               value:
 *                 estado: suspendida
 *     responses:
 *       200:
 *         description: Institución actualizada exitosamente
 *       400:
 *         description: No se proporcionaron campos para actualizar
 *       404:
 *         description: Institución no encontrada
 *       401:
 *         description: No autorizado
 */
router.put('/:id', requireAuth, requireRole([ROLES.ADMIN_GLOBAL]), actualizarInstitucion);

/**
 * @swagger
 * /instituciones/{id}:
 *   delete:
 *     summary: Eliminar institución
 *     description: Elimina permanentemente una institución. Solo si no tiene usuarios asociados.
 *     tags: [Instituciones]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la institución a eliminar
 *     responses:
 *       200:
 *         description: Institución eliminada exitosamente
 *       400:
 *         description: No se puede eliminar (tiene usuarios o rifas asociadas)
 *       404:
 *         description: Institución no encontrada
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos
 */
router.delete('/:id', requireAuth, requireRole([ROLES.ADMIN_GLOBAL]), eliminarInstitucion);

// =====================================================
// 🖼️ RUTAS DE GESTIÓN DE LOGO
// =====================================================

/**
 * @swagger
 * /instituciones/{id}/logo:
 *   post:
 *     summary: Subir logo de institución
 *     description: Sube o reemplaza el logo de una institución
 *     tags: [Instituciones]
 *     security:
 *       - BearerAuth: []
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - logo
 *             properties:
 *               logo:
 *                 type: string
 *                 format: binary
 *                 description: Archivo de imagen (PNG, JPG, JPEG, GIF - máx 5MB)
 *     responses:
 *       200:
 *         description: Logo subido exitosamente
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
 *                   example: Logo subido exitosamente
 *                 data:
 *                   type: object
 *                   properties:
 *                     logo_url:
 *                       type: string
 *                       example: /uploads/logos/institucion_1_1234567890.png
 *                     institucion:
 *                       type: object
 *       400:
 *         description: No se proporcionó archivo o formato inválido
 *       404:
 *         description: Institución no encontrada
 *       401:
 *         description: No autorizado
 */
router.post('/:id/logo', 
  requireAuth, 
  requireRole([ROLES.ADMIN_GLOBAL]), 
  uploadLogo.single('logo'),
  subirLogo
);

/**
 * @swagger
 * /instituciones/{id}/logo:
 *   delete:
 *     summary: Eliminar logo de institución
 *     description: Elimina el logo actual de una institución
 *     tags: [Instituciones]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la institución
 *     responses:
 *       200:
 *         description: Logo eliminado exitosamente
 *       404:
 *         description: Institución no encontrada o no tiene logo
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos
 */
router.delete('/:id/logo',
  requireAuth,
  requireRole([ROLES.ADMIN_GLOBAL]),
  eliminarLogo
);

export default router;