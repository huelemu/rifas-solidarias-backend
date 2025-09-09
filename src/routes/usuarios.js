// src/routes/usuarios.js - Rutas protegidas con autenticación
import express from 'express';
import { 
  obtenerUsuarios, 
  obtenerUsuarioPorId, 
  crearUsuario, 
  actualizarUsuario, 
  eliminarUsuario 
} from '../controllers/usuariosController.js';
import { 
  authenticateToken, 
  requireRole, 
  requireOwnership,
  authorize,
  ROLES,
  PERMISSIONS 
} from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * /usuarios:
 *   get:
 *     summary: Obtener lista de usuarios
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
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
 *         name: rol
 *         schema:
 *           type: string
 *           enum: [admin_global, admin_institucion, vendedor, comprador]
 *         description: Filtrar por rol
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [activo, inactivo]
 *         description: Filtrar por estado
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
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Usuario'
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
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
// GET /usuarios - Solo admins pueden ver todos los usuarios
router.get('/', 
  authenticateToken,
  requireRole([ROLES.ADMIN_GLOBAL, ROLES.ADMIN_INSTITUCION]),
  obtenerUsuarios
);

/**
 * @swagger
 * /usuarios/{id}:
 *   get:
 *     summary: Obtener usuario específico
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario obtenido exitosamente
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
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// GET /usuarios/:id - Usuario solo puede ver su perfil, admins pueden ver cualquiera
router.get('/:id', 
  authenticateToken,
  (req, res, next) => {
    const usuario = req.user;
    const usuarioId = req.params.id;
    
    // Admin global puede ver cualquier usuario
    if (usuario.rol === ROLES.ADMIN_GLOBAL) {
      return next();
    }
    
    // Admin institución puede ver usuarios de su institución
    if (usuario.rol === ROLES.ADMIN_INSTITUCION) {
      // Esta validación se hace en el controlador
      return next();
    }
    
    // Usuario normal solo puede ver su propio perfil
    if (parseInt(usuario.id) === parseInt(usuarioId)) {
      return next();
    }
    
    return res.status(403).json({
      status: 'error',
      message: 'No tienes permisos para ver este usuario',
      code: 'INSUFFICIENT_PERMISSIONS'
    });
  },
  obtenerUsuarioPorId
);

/**
 * @swagger
 * /usuarios:
 *   post:
 *     summary: Crear nuevo usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
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
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Juan
 *               apellido:
 *                 type: string
 *                 example: Pérez
 *               email:
 *                 type: string
 *                 format: email
 *                 example: juan.perez@ejemplo.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: password123
 *               telefono:
 *                 type: string
 *                 example: "+5491123456789"
 *               dni:
 *                 type: string
 *                 example: "12345678"
 *               rol:
 *                 type: string
 *                 enum: [admin_global, admin_institucion, vendedor, comprador]
 *                 default: comprador
 *               institucion_id:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: Email ya existe
 */
// POST /usuarios - Solo admins pueden crear usuarios
router.post('/', 
  authenticateToken,
  requireRole([ROLES.ADMIN_GLOBAL, ROLES.ADMIN_INSTITUCION]),
  crearUsuario
);

/**
 * @swagger
 * /usuarios/{id}:
 *   put:
 *     summary: Actualizar usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
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
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// PUT /usuarios/:id - Usuario puede actualizar sus datos, admins pueden actualizar cualquiera
router.put('/:id',
  authenticateToken,
  (req, res, next) => {
    const usuario = req.user;
    const usuarioId = req.params.id;
    
    // Admin global puede actualizar cualquier usuario
    if (usuario.rol === ROLES.ADMIN_GLOBAL) {
      return next();
    }
    
    // Admin institución puede actualizar usuarios de su institución
    if (usuario.rol === ROLES.ADMIN_INSTITUCION) {
      // Esta validación se hace en el controlador
      return next();
    }
    
    // Usuario normal solo puede actualizar su propio perfil
    if (parseInt(usuario.id) === parseInt(usuarioId)) {
      // Pero no puede cambiar su propio rol o estado
      const { rol, estado, ...allowedFields } = req.body;
      req.body = allowedFields;
      return next();
    }
    
    return res.status(403).json({
      status: 'error',
      message: 'No tienes permisos para actualizar este usuario',
      code: 'INSUFFICIENT_PERMISSIONS'
    });
  },
  actualizarUsuario
);

/**
 * @swagger
 * /usuarios/{id}:
 *   delete:
 *     summary: Eliminar usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
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
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// DELETE /usuarios/:id - Solo admins pueden eliminar usuarios
router.delete('/:id',
  authenticateToken,
  requireRole([ROLES.ADMIN_GLOBAL, ROLES.ADMIN_INSTITUCION]),
  (req, res, next) => {
    const usuario = req.user;
    const usuarioId = req.params.id;
    
    // Prevenir que se elimine a sí mismo
    if (parseInt(usuario.id) === parseInt(usuarioId)) {
      return res.status(400).json({
        status: 'error',
        message: 'No puedes eliminar tu propia cuenta',
        code: 'CANNOT_DELETE_SELF'
      });
    }
    
    next();
  },
  eliminarUsuario
);

// Rutas adicionales de administración

/**
 * @swagger
 * /usuarios/{id}/toggle-status:
 *   patch:
 *     summary: Cambiar estado de usuario (activo/inactivo)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Estado cambiado exitosamente
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.patch('/:id/toggle-status',
  ...authorize([ROLES.ADMIN_GLOBAL, ROLES.ADMIN_INSTITUCION]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const usuario = req.user;
      
      // Prevenir que se desactive a sí mismo
      if (parseInt(usuario.id) === parseInt(id)) {
        return res.status(400).json({
          status: 'error',
          message: 'No puedes cambiar tu propio estado',
          code: 'CANNOT_MODIFY_SELF'
        });
      }
      
      // Obtener usuario actual
      const [usuarios] = await db.execute(
        'SELECT estado FROM usuarios WHERE id = ?',
        [id]
      );
      
      if (usuarios.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Usuario no encontrado'
        });
      }
      
      const estadoActual = usuarios[0].estado;
      const nuevoEstado = estadoActual === 'activo' ? 'inactivo' : 'activo';
      
      // Actualizar estado
      await db.execute(
        'UPDATE usuarios SET estado = ? WHERE id = ?',
        [nuevoEstado, id]
      );
      
      res.json({
        status: 'success',
        message: `Usuario ${nuevoEstado === 'activo' ? 'activado' : 'desactivado'} exitosamente`,
        data: { nuevo_estado: nuevoEstado }
      });
      
    } catch (error) {
      console.error('Error toggle status:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  }
);

/**
 * @swagger
 * /usuarios/stats/summary:
 *   get:
 *     summary: Obtener estadísticas de usuarios
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
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
 *                     total_usuarios:
 *                       type: integer
 *                     usuarios_activos:
 *                       type: integer
 *                     usuarios_por_rol:
 *                       type: object
 *                     usuarios_recientes:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/stats/summary',
  ...authorize([ROLES.ADMIN_GLOBAL, ROLES.ADMIN_INSTITUCION]),
  async (req, res) => {
    try {
      const usuario = req.user;
      let whereClause = '';
      let params = [];
      
      // Admin institución solo ve stats de su institución
      if (usuario.rol === ROLES.ADMIN_INSTITUCION) {
        whereClause = 'WHERE institucion_id = ?';
        params = [usuario.institucion_id];
      }
      
      // Estadísticas básicas
      const [totalUsers] = await db.execute(
        `SELECT COUNT(*) as total FROM usuarios ${whereClause}`,
        params
      );
      
      const [activeUsers] = await db.execute(
        `SELECT COUNT(*) as activos FROM usuarios ${whereClause} ${whereClause ? 'AND' : 'WHERE'} estado = 'activo'`,
        whereClause ? [...params, ...params] : []
      );
      
      const [roleStats] = await db.execute(
        `SELECT rol, COUNT(*) as cantidad FROM usuarios ${whereClause} GROUP BY rol`,
        params
      );
      
      const [recentUsers] = await db.execute(
        `SELECT COUNT(*) as recientes FROM usuarios ${whereClause} ${whereClause ? 'AND' : 'WHERE'} fecha_creacion >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        whereClause ? [...params, ...params] : []
      );
      
      const roleStatsObj = {};
      roleStats.forEach(stat => {
        roleStatsObj[stat.rol] = stat.cantidad;
      });
      
      res.json({
        status: 'success',
        data: {
          total_usuarios: totalUsers[0].total,
          usuarios_activos: activeUsers[0].activos,
          usuarios_por_rol: roleStatsObj,
          usuarios_recientes: recentUsers[0].recientes
        }
      });
      
    } catch (error) {
      console.error('Error stats:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  }
);

export default router;