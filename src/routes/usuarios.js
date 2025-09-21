// src/routes/usuarios.js - Con documentación Swagger completa
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

/**
 * @swagger
 * components:
 *   schemas:
 *     Usuario:
 *       type: object
 *       required:
 *         - nombre
 *         - apellido
 *         - email
 *         - password
 *         - rol
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único del usuario
 *           example: 1
 *         nombre:
 *           type: string
 *           description: Nombre del usuario
 *           example: Juan
 *         apellido:
 *           type: string
 *           description: Apellido del usuario
 *           example: Pérez
 *         email:
 *           type: string
 *           format: email
 *           description: Email del usuario
 *           example: juan.perez@ejemplo.com
 *         telefono:
 *           type: string
 *           description: Teléfono de contacto
 *           example: "+5491123456789"
 *         dni:
 *           type: string
 *           description: Documento Nacional de Identidad
 *           example: "12345678"
 *         rol:
 *           type: string
 *           enum: [admin_global, admin_institucion, vendedor, comprador]
 *           description: Rol del usuario en el sistema
 *           example: comprador
 *         estado:
 *           type: string
 *           enum: [activo, inactivo, bloqueado]
 *           description: Estado del usuario
 *           example: activo
 *         institucion_id:
 *           type: integer
 *           description: ID de la institución a la que pertenece
 *           example: 1
 *         institucion_nombre:
 *           type: string
 *           description: Nombre de la institución
 *           example: Cruz Roja Argentina
 *         ultimo_login:
 *           type: string
 *           format: date-time
 *           description: Fecha del último login
 *         fecha_creacion:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación del usuario
 *         fecha_actualizacion:
 *           type: string
 *           format: date-time
 *           description: Fecha de última actualización
 *     
 *     CreateUsuarioRequest:
 *       type: object
 *       required:
 *         - nombre
 *         - apellido
 *         - email
 *         - password
 *         - rol
 *       properties:
 *         nombre:
 *           type: string
 *           example: María
 *         apellido:
 *           type: string
 *           example: González
 *         email:
 *           type: string
 *           format: email
 *           example: maria.gonzalez@ejemplo.com
 *         password:
 *           type: string
 *           minLength: 6
 *           example: password123
 *         telefono:
 *           type: string
 *           example: "+5491198765432"
 *         dni:
 *           type: string
 *           example: "87654321"
 *         rol:
 *           type: string
 *           enum: [admin_global, admin_institucion, vendedor, comprador]
 *           example: vendedor
 *         institucion_id:
 *           type: integer
 *           example: 2
 *     
 *     UpdateUsuarioRequest:
 *       type: object
 *       properties:
 *         nombre:
 *           type: string
 *           example: María Editada
 *         apellido:
 *           type: string
 *           example: González Editada
 *         telefono:
 *           type: string
 *           example: "+5491199999999"
 *         dni:
 *           type: string
 *           example: "99999999"
 *         estado:
 *           type: string
 *           enum: [activo, inactivo, bloqueado]
 *           example: activo
 *   
 *   responses:
 *     UnauthorizedError:
 *       description: Token de acceso requerido
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: error
 *               message:
 *                 type: string
 *                 example: Token de acceso requerido
 *     
 *     ForbiddenError:
 *       description: Permisos insuficientes
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: error
 *               message:
 *                 type: string
 *                 example: No tienes permisos para realizar esta acción
 */

/**
 * @swagger
 * /usuarios:
 *   get:
 *     summary: Obtener lista de usuarios
 *     description: Retorna una lista de todos los usuarios del sistema. Requiere autenticación y permisos de administrador.
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página para paginación
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Cantidad de usuarios por página
 *       - in: query
 *         name: rol
 *         schema:
 *           type: string
 *           enum: [admin_global, admin_institucion, vendedor, comprador]
 *         description: Filtrar usuarios por rol
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [activo, inactivo, bloqueado]
 *         description: Filtrar usuarios por estado
 *       - in: query
 *         name: institucion_id
 *         schema:
 *           type: integer
 *         description: Filtrar usuarios por institución
 *     responses:
 *       200:
 *         description: Lista de usuarios obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 total:
 *                   type: integer
 *                   example: 25
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Usuario'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     current_page:
 *                       type: integer
 *                       example: 1
 *                     total_pages:
 *                       type: integer
 *                       example: 3
 *                     total_records:
 *                       type: integer
 *                       example: 25
 *                     per_page:
 *                       type: integer
 *                       example: 10
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/', requireAuth, requireRole([ROLES.ADMIN_GLOBAL, ROLES.ADMIN_INSTITUCION]), obtenerUsuarios);

/**
 * @swagger
 * /usuarios/{id}:
 *   get:
 *     summary: Obtener usuario por ID
 *     description: Retorna la información detallada de un usuario específico
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID único del usuario
 *         example: 1
 *     responses:
 *       200:
 *         description: Usuario encontrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Usuario'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Usuario no encontrado
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/:id', requireAuth, requireRole([ROLES.ADMIN_GLOBAL, ROLES.ADMIN_INSTITUCION]), obtenerUsuarioPorId);

/**
 * @swagger
 * /usuarios:
 *   post:
 *     summary: Crear nuevo usuario
 *     description: Crea un nuevo usuario en el sistema. Solo administradores pueden crear usuarios.
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUsuarioRequest'
 *           examples:
 *             vendedor:
 *               summary: Crear vendedor
 *               value:
 *                 nombre: Carlos
 *                 apellido: Vendedor
 *                 email: carlos.vendedor@ejemplo.com
 *                 password: password123
 *                 telefono: "+5491123456789"
 *                 dni: "12345678"
 *                 rol: vendedor
 *                 institucion_id: 1
 *             comprador:
 *               summary: Crear comprador
 *               value:
 *                 nombre: Ana
 *                 apellido: Compradora
 *                 email: ana.compradora@ejemplo.com
 *                 password: password123
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
 *                   $ref: '#/components/schemas/Usuario'
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Nombre, apellido, email, password y rol son obligatorios
 *       409:
 *         description: Email ya existe
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Ya existe un usuario con ese email
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post('/', requireAuth, requireRole([ROLES.ADMIN_GLOBAL, ROLES.ADMIN_INSTITUCION]), crearUsuario);

/**
 * @swagger
 * /usuarios/{id}:
 *   put:
 *     summary: Actualizar usuario
 *     description: Actualiza la información de un usuario existente
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID único del usuario a actualizar
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUsuarioRequest'
 *           examples:
 *             actualizar_basico:
 *               summary: Actualización básica
 *               value:
 *                 nombre: Juan Carlos
 *                 telefono: "+5491199999999"
 *             cambiar_estado:
 *               summary: Cambiar estado de usuario
 *               value:
 *                 estado: inactivo
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
 *                   $ref: '#/components/schemas/Usuario'
 *       404:
 *         description: Usuario no encontrado
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.put('/:id', requireAuth, requireRole([ROLES.ADMIN_GLOBAL, ROLES.ADMIN_INSTITUCION]), actualizarUsuario);

/**
 * @swagger
 * /usuarios/{id}:
 *   delete:
 *     summary: Eliminar usuario
 *     description: Elimina un usuario del sistema (soft delete)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID único del usuario a eliminar
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
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.delete('/:id', requireAuth, requireRole([ROLES.ADMIN_GLOBAL]), eliminarUsuario);

export default router;