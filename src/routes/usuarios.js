// =====================================================
// RUTAS DE USUARIOS
// src/routes/usuarios.js
// =====================================================

import express from 'express';
import { 
  obtenerUsuarios, 
  obtenerUsuarioPorId, 
  crearUsuario, 
  actualizarUsuario, 
  eliminarUsuario 
} from '../controllers/usuariosController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';

const router = express.Router();

// =====================================================
// 🔒 TODAS LAS RUTAS REQUIEREN AUTENTICACIÓN
// =====================================================

/**
 * @swagger
 * /usuarios:
 *   get:
 *     summary: Listar todos los usuarios
 *     description: Obtiene una lista paginada de usuarios del sistema. Los admin_global ven todos, los admin_institucion solo ven usuarios de su institución.
 *     tags: [Usuarios]
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
 *         description: Usuarios por página
 *       - in: query
 *         name: rol
 *         schema:
 *           type: string
 *           enum: [admin_global, admin_institucion, vendedor, comprador]
 *         description: Filtrar por rol
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [activo, inactivo, suspendido]
 *         description: Filtrar por estado
 *       - in: query
 *         name: buscar
 *         schema:
 *           type: string
 *         description: Buscar por nombre, apellido o email
 *     responses:
 *       200:
 *         description: Lista de usuarios
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
 *                         example: Juan
 *                       apellido:
 *                         type: string
 *                         example: Pérez
 *                       email:
 *                         type: string
 *                         example: juan@test.com
 *                       rol:
 *                         type: string
 *                         example: vendedor
 *                       estado:
 *                         type: string
 *                         example: activo
 *                       institucion_nombre:
 *                         type: string
 *                         example: Cruz Roja
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     total:
 *                       type: integer
 *                       example: 45
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos
 */
router.get('/', requireAuth, obtenerUsuarios);

/**
 * @swagger
 * /usuarios/{id}:
 *   get:
 *     summary: Obtener usuario por ID
 *     description: Retorna la información detallada de un usuario específico
 *     tags: [Usuarios]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *         example: 1
 *     responses:
 *       200:
 *         description: Datos del usuario
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
 *                       example: 1
 *                     nombre:
 *                       type: string
 *                       example: Juan
 *                     apellido:
 *                       type: string
 *                       example: Pérez
 *                     email:
 *                       type: string
 *                       example: juan@test.com
 *                     telefono:
 *                       type: string
 *                       example: "+5491123456789"
 *                     dni:
 *                       type: string
 *                       example: "12345678"
 *                     rol:
 *                       type: string
 *                       example: vendedor
 *                     estado:
 *                       type: string
 *                       example: activo
 *                     institucion_id:
 *                       type: integer
 *                       example: 1
 *                     institucion_nombre:
 *                       type: string
 *                       example: Cruz Roja
 *                     fecha_creacion:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Usuario no encontrado
 *       401:
 *         description: No autorizado
 */
router.get('/:id', requireAuth, obtenerUsuarioPorId);

/**
 * @swagger
 * /usuarios:
 *   post:
 *     summary: Crear nuevo usuario
 *     description: Crea un nuevo usuario en el sistema. Solo administradores.
 *     tags: [Usuarios]
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
 *               - apellido
 *               - email
 *               - password
 *               - rol
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Carlos
 *               apellido:
 *                 type: string
 *                 example: Vendedor
 *               email:
 *                 type: string
 *                 format: email
 *                 example: carlos@test.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: test123
 *               telefono:
 *                 type: string
 *                 example: "+5491123456789"
 *               dni:
 *                 type: string
 *                 example: "12345678"
 *               rol:
 *                 type: string
 *                 enum: [admin_global, admin_institucion, vendedor, comprador]
 *                 example: vendedor
 *               institucion_id:
 *                 type: integer
 *                 example: 1
 *           examples:
 *             vendedor:
 *               summary: Crear vendedor
 *               value:
 *                 nombre: Carlos
 *                 apellido: Vendedor
 *                 email: carlos@test.com
 *                 password: test123
 *                 telefono: "+5491123456789"
 *                 dni: "12345678"
 *                 rol: vendedor
 *                 institucion_id: 1
 *             comprador:
 *               summary: Crear comprador
 *               value:
 *                 nombre: Ana
 *                 apellido: García
 *                 email: ana@test.com
 *                 password: test123
 *                 rol: comprador
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
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
 *                   example: Usuario creado exitosamente
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 15
 *                     nombre:
 *                       type: string
 *                       example: Carlos
 *                     email:
 *                       type: string
 *                       example: carlos@test.com
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Email ya existe
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos
 */
router.post('/', requireAuth, requireRole([ROLES.ADMIN_GLOBAL, ROLES.ADMIN_INSTITUCION]), crearUsuario);

/**
 * @swagger
 * /usuarios/{id}:
 *   put:
 *     summary: Actualizar usuario
 *     description: Modifica los datos de un usuario existente. Solo administradores.
 *     tags: [Usuarios]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario a actualizar
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Juan Carlos
 *               apellido:
 *                 type: string
 *                 example: Pérez García
 *               email:
 *                 type: string
 *                 example: juan.nuevo@test.com
 *               telefono:
 *                 type: string
 *                 example: "+5491199999999"
 *               dni:
 *                 type: string
 *                 example: "87654321"
 *               rol:
 *                 type: string
 *                 enum: [admin_global, admin_institucion, vendedor, comprador]
 *                 example: vendedor
 *               estado:
 *                 type: string
 *                 enum: [activo, inactivo, suspendido]
 *                 example: activo
 *           examples:
 *             actualizar_telefono:
 *               summary: Actualizar teléfono
 *               value:
 *                 telefono: "+5491199999999"
 *             cambiar_estado:
 *               summary: Suspender usuario
 *               value:
 *                 estado: suspendido
 *             actualizar_completo:
 *               summary: Actualización completa
 *               value:
 *                 nombre: Juan Carlos
 *                 apellido: Pérez García
 *                 telefono: "+5491199999999"
 *                 estado: activo
 *     responses:
 *       200:
 *         description: Usuario actualizado exitosamente
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
 *                   example: Usuario actualizado exitosamente
 *                 data:
 *                   type: object
 *       400:
 *         description: No se proporcionaron campos para actualizar
 *       404:
 *         description: Usuario no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos
 */
router.put('/:id', requireAuth, requireRole([ROLES.ADMIN_GLOBAL, ROLES.ADMIN_INSTITUCION]), actualizarUsuario);

/**
 * @swagger
 * /usuarios/{id}:
 *   delete:
 *     summary: Eliminar usuario
 *     description: Elimina permanentemente un usuario del sistema. Solo admin_global.
 *     tags: [Usuarios]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario a eliminar
 *         example: 1
 *     responses:
 *       200:
 *         description: Usuario eliminado exitosamente
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
 *                   example: Usuario eliminado exitosamente
 *       404:
 *         description: Usuario no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos suficientes
 */
router.delete('/:id', requireAuth, requireRole([ROLES.ADMIN_GLOBAL]), eliminarUsuario);

export default router;