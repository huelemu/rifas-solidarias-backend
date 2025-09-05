// src/routes/usuarios.js
import express from 'express';
import {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario
} from '../controllers/usuarioController.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Usuario:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único del usuario
 *         nombre:
 *           type: string
 *           description: Nombre del usuario
 *         apellido:
 *           type: string
 *           description: Apellido del usuario
 *         email:
 *           type: string
 *           format: email
 *           description: Email único del usuario
 *         telefono:
 *           type: string
 *           description: Teléfono de contacto
 *         dni:
 *           type: string
 *           description: Documento Nacional de Identidad
 *         rol:
 *           type: string
 *           enum: [admin_global, admin_institucion, vendedor, comprador]
 *           description: Rol del usuario
 *         estado:
 *           type: string
 *           enum: [activo, inactivo]
 *           description: Estado del usuario
 *         institucion_nombre:
 *           type: string
 *           description: Nombre de la institución asociada
 *         fecha_creacion:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación
 *     UsuarioInput:
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
 *           example: "Juan"
 *         apellido:
 *           type: string
 *           example: "Pérez"
 *         email:
 *           type: string
 *           format: email
 *           example: "juan@ejemplo.com"
 *         password:
 *           type: string
 *           minimum: 6
 *           example: "password123"
 *         telefono:
 *           type: string
 *           example: "+54 11 1234-5678"
 *         dni:
 *           type: string
 *           example: "12345678"
 *         rol:
 *           type: string
 *           enum: [admin_global, admin_institucion, vendedor, comprador]
 *           example: "comprador"
 *         institucion_id:
 *           type: integer
 *           example: 1
 *           description: ID de la institución (opcional)
 *     Institucion:
 *       type: object
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
 *     InstitucionInput:
 *       type: object
 *       required:
 *         - nombre
 *         - email
 *       properties:
 *         nombre:
 *           type: string
 *           example: "Club Deportivo River"
 *         descripcion:
 *           type: string
 *           example: "Club de fútbol profesional"
 *         direccion:
 *           type: string
 *           example: "Av. Figueroa Alcorta 7597"
 *         telefono:
 *           type: string
 *           example: "+54 11 4789-1200"
 *         email:
 *           type: string
 *           format: email
 *           example: "info@river.com.ar"
 *         logo_url:
 *           type: string
 *           example: "https://ejemplo.com/logo.jpg"
 */

/**
 * @swagger
 * /usuarios:
 *   get:
 *     summary: Obtener todos los usuarios
 *     tags: [Usuarios]
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
 *                   example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Usuario'
 */
router.get('/', obtenerUsuarios);

/**
 * @swagger
 * /usuarios/{id}:
 *   get:
 *     summary: Obtener un usuario por ID
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario encontrado
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
 */
router.get('/:id', obtenerUsuarioPorId);

/**
 * @swagger
 * /usuarios:
 *   post:
 *     summary: Crear nuevo usuario
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UsuarioInput'
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
 *         description: Datos inválidos
 *       409:
 *         description: Email ya existe
 */
router.post('/', crearUsuario);

/**
 * @swagger
 * /usuarios/{id}:
 *   put:
 *     summary: Actualizar usuario
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               apellido:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               telefono:
 *                 type: string
 *               dni:
 *                 type: string
 *               rol:
 *                 type: string
 *                 enum: [admin_global, admin_institucion, vendedor, comprador]
 *               estado:
 *                 type: string
 *                 enum: [activo, inactivo]
 *     responses:
 *       200:
 *         description: Usuario actualizado exitosamente
 *       404:
 *         description: Usuario no encontrado
 *       400:
 *         description: Datos inválidos
 */
router.put('/:id', actualizarUsuario);

/**
 * @swagger
 * /usuarios/{id}:
 *   delete:
 *     summary: Eliminar usuario
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario eliminado exitosamente
 *       404:
 *         description: Usuario no encontrado
 */
router.delete('/:id', eliminarUsuario);

export default router;