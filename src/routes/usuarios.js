// =====================================================
// RUTAS DE USUARIOS - ARREGLADAS
// src/routes/usuarios.js
// =====================================================

import express from 'express';
import bcrypt from 'bcrypt';  // Cambiado de bcryptjs a bcrypt
import db from '../config/db.js';
import { requireAuth, requireRole, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// =====================================================
// MIDDLEWARE GLOBAL
// =====================================================

// Logging middleware
router.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.path} - Usuario: ${req.user?.email || 'Anónimo'}`);
  next();
});

// =====================================================
// RUTAS DE USUARIOS
// =====================================================

// Listar usuarios (requiere autenticación)
router.get('/', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion'])
], async (req, res) => {
  try {
    console.log('📋 Listando usuarios...');
    const usuario = req.user;

    let query = `
      SELECT 
        u.id, u.nombre, u.apellido, u.email, u.telefono, u.dni, 
        u.rol, u.estado, u.ultimo_login, u.fecha_creacion,
        i.nombre as institucion_nombre
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE 1=1
    `;
    
    const params = [];

    // Si no es admin global, filtrar por institución
    if (usuario.rol !== 'admin_global') {
      query += ' AND (u.institucion_id = ? OR u.institucion_id IS NULL)';
      params.push(usuario.institucion_id);
    }

    // Filtros adicionales
    if (req.query.rol) {
      query += ' AND u.rol = ?';
      params.push(req.query.rol);
    }

    if (req.query.estado) {
      query += ' AND u.estado = ?';
      params.push(req.query.estado);
    }

    if (req.query.institucion_id) {
      query += ' AND u.institucion_id = ?';
      params.push(req.query.institucion_id);
    }

    // Ordenamiento
    query += ' ORDER BY u.fecha_creacion DESC';

    // Paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [usuarios] = await db.execute(query, params);

    // Contar total
    let countQuery = 'SELECT COUNT(*) as total FROM usuarios WHERE 1=1';
    const countParams = [];
    
    if (usuario.rol !== 'admin_global') {
      countQuery += ' AND (institucion_id = ? OR institucion_id IS NULL)';
      countParams.push(usuario.institucion_id);
    }

    const [totalResult] = await db.execute(countQuery, countParams);
    const total = totalResult[0].total;

    console.log(`✅ ${usuarios.length} usuarios listados de ${total} total`);

    res.json({
      status: 'success',
      data: usuarios,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Error al listar usuarios:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
});

// Crear nuevo usuario
router.post('/', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion'])
], async (req, res) => {
  try {
    console.log('➕ Creando nuevo usuario...');
    const { nombre, apellido, email, password, telefono, dni, rol, institucion_id } = req.body;
    const usuarioCreador = req.user;

    // Validaciones básicas
    if (!nombre || !apellido || !email || !password || !rol) {
      return res.status(400).json({
        status: 'error',
        message: 'Campos requeridos: nombre, apellido, email, password, rol'
      });
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Email inválido'
      });
    }

    // Validar rol
    const rolesValidos = ['admin_global', 'admin_institucion', 'vendedor', 'comprador'];
    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({
        status: 'error',
        message: 'Rol inválido'
      });
    }

    // Validar permisos del creador
    if (usuarioCreador.rol === 'admin_institucion') {
      // Solo puede crear usuarios de su propia institución
      if (rol === 'admin_global') {
        return res.status(403).json({
          status: 'error',
          message: 'No puedes crear administradores globales'
        });
      }
      
      if (institucion_id && institucion_id !== usuarioCreador.institucion_id) {
        return res.status(403).json({
          status: 'error',
          message: 'Solo puedes crear usuarios de tu institución'
        });
      }
    }

    // Verificar que el email no existe
    const [usuarioExistente] = await db.execute(
      'SELECT id FROM usuarios WHERE email = ?',
      [email.toLowerCase()]
    );

    if (usuarioExistente.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'Ya existe un usuario con ese email'
      });
    }

    // Hash de la contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insertar usuario
    const [result] = await db.execute(`
      INSERT INTO usuarios (
        nombre, apellido, email, password, telefono, dni, 
        rol, institucion_id, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'activo')
    `, [
      nombre, apellido, email.toLowerCase(), hashedPassword,
      telefono || null, dni || null, rol, institucion_id || null
    ]);

    // Obtener usuario creado (sin password)
    const [usuarioCreado] = await db.execute(`
      SELECT 
        u.id, u.nombre, u.apellido, u.email, u.telefono, u.dni,
        u.rol, u.estado, u.fecha_creacion,
        i.nombre as institucion_nombre
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.id = ?
    `, [result.insertId]);

    console.log(`✅ Usuario creado: ${email} (${rol})`);

    res.status(201).json({
      status: 'success',
      message: 'Usuario creado exitosamente',
      data: usuarioCreado[0]
    });

  } catch (error) {
    console.error('❌ Error al crear usuario:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
});

// Obtener usuario por ID
router.get('/:id', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion'])
], async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioPeticion = req.user;

    console.log(`🔍 Obteniendo usuario ID: ${id}`);

    let query = `
      SELECT 
        u.id, u.nombre, u.apellido, u.email, u.telefono, u.dni,
        u.rol, u.estado, u.ultimo_login, u.fecha_creacion,
        i.nombre as institucion_nombre, u.institucion_id
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.id = ?
    `;
    const params = [id];

    // Si no es admin global, verificar permisos
    if (usuarioPeticion.rol !== 'admin_global') {
      query += ' AND (u.institucion_id = ? OR u.institucion_id IS NULL)';
      params.push(usuarioPeticion.institucion_id);
    }

    const [usuarios] = await db.execute(query, params);

    if (!usuarios.length) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    console.log('✅ Usuario obtenido exitosamente');

    res.json({
      status: 'success',
      data: usuarios[0]
    });

  } catch (error) {
    console.error('❌ Error al obtener usuario:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
});

// Actualizar usuario
router.put('/:id', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion'])
], async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioEditor = req.user;
    const { nombre, apellido, telefono, dni, rol, estado, institucion_id } = req.body;

    console.log(`🔄 Actualizando usuario ID: ${id}`);

    // Verificar que el usuario existe
    const [usuarioExistente] = await db.execute(
      'SELECT * FROM usuarios WHERE id = ?',
      [id]
    );

    if (!usuarioExistente.length) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    const usuario = usuarioExistente[0];

    // Verificar permisos
    if (usuarioEditor.rol === 'admin_institucion') {
      if (usuario.institucion_id !== usuarioEditor.institucion_id) {
        return res.status(403).json({
          status: 'error',
          message: 'Solo puedes editar usuarios de tu institución'
        });
      }

      if (rol === 'admin_global') {
        return res.status(403).json({
          status: 'error',
          message: 'No puedes asignar rol de administrador global'
        });
      }
    }

    // Construir query de actualización
    const campos = [];
    const params = [];

    if (nombre !== undefined) {
      campos.push('nombre = ?');
      params.push(nombre);
    }

    if (apellido !== undefined) {
      campos.push('apellido = ?');
      params.push(apellido);
    }

    if (telefono !== undefined) {
      campos.push('telefono = ?');
      params.push(telefono || null);
    }

    if (dni !== undefined) {
      campos.push('dni = ?');
      params.push(dni || null);
    }

    if (rol !== undefined) {
      const rolesValidos = ['admin_global', 'admin_institucion', 'vendedor', 'comprador'];
      if (!rolesValidos.includes(rol)) {
        return res.status(400).json({
          status: 'error',
          message: 'Rol inválido'
        });
      }
      campos.push('rol = ?');
      params.push(rol);
    }

    if (estado !== undefined) {
      const estadosValidos = ['activo', 'inactivo', 'bloqueado'];
      if (!estadosValidos.includes(estado)) {
        return res.status(400).json({
          status: 'error',
          message: 'Estado inválido'
        });
      }
      campos.push('estado = ?');
      params.push(estado);
    }

    if (institucion_id !== undefined && usuarioEditor.rol === 'admin_global') {
      campos.push('institucion_id = ?');
      params.push(institucion_id || null);
    }

    if (campos.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No hay campos para actualizar'
      });
    }

    // Agregar ID al final
    params.push(id);

    const updateQuery = `UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`;
    await db.execute(updateQuery, params);

    // Obtener usuario actualizado
    const [usuarioActualizado] = await db.execute(`
      SELECT 
        u.id, u.nombre, u.apellido, u.email, u.telefono, u.dni,
        u.rol, u.estado, u.fecha_creacion,
        i.nombre as institucion_nombre
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.id = ?
    `, [id]);

    console.log('✅ Usuario actualizado exitosamente');

    res.json({
      status: 'success',
      message: 'Usuario actualizado exitosamente',
      data: usuarioActualizado[0]
    });

  } catch (error) {
    console.error('❌ Error al actualizar usuario:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
});

// Cambiar contraseña
router.patch('/:id/password', [
  requireAuth
], async (req, res) => {
  try {
    const { id } = req.params;
    const { current_password, new_password } = req.body;
    const usuarioEditor = req.user;

    console.log(`🔐 Cambiando contraseña para usuario ID: ${id}`);

    // Validaciones
    if (!current_password || !new_password) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere contraseña actual y nueva contraseña'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'La nueva contraseña debe tener al menos 6 caracteres'
      });
    }

    // Solo puede cambiar su propia contraseña, excepto admin global
    if (usuarioEditor.rol !== 'admin_global' && usuarioEditor.id !== parseInt(id)) {
      return res.status(403).json({
        status: 'error',
        message: 'Solo puedes cambiar tu propia contraseña'
      });
    }

    // Obtener usuario
    const [usuarios] = await db.execute(
      'SELECT * FROM usuarios WHERE id = ?',
      [id]
    );

    if (!usuarios.length) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    const usuario = usuarios[0];

    // Verificar contraseña actual (solo si no es admin global cambiando otra password)
    if (usuarioEditor.id === parseInt(id)) {
      const passwordValida = await bcrypt.compare(current_password, usuario.password);
      if (!passwordValida) {
        return res.status(400).json({
          status: 'error',
          message: 'Contraseña actual incorrecta'
        });
      }
    }

    // Hash de la nueva contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(new_password, saltRounds);

    // Actualizar contraseña
    await db.execute(
      'UPDATE usuarios SET password = ? WHERE id = ?',
      [hashedPassword, id]
    );

    console.log('✅ Contraseña cambiada exitosamente');

    res.json({
      status: 'success',
      message: 'Contraseña cambiada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error al cambiar contraseña:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
});

// Eliminar usuario (solo admin global)
router.delete('/:id', [
  requireAuth,
  requireAdmin
], async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Eliminando usuario ID: ${id}`);

    // Verificar que el usuario existe
    const [usuarioExistente] = await db.execute(
      'SELECT * FROM usuarios WHERE id = ?',
      [id]
    );

    if (!usuarioExistente.length) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    // Soft delete - cambiar estado a inactivo
    await db.execute(
      'UPDATE usuarios SET estado = "inactivo" WHERE id = ?',
      [id]
    );

    console.log('✅ Usuario eliminado exitosamente');

    res.json({
      status: 'success',
      message: 'Usuario eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error al eliminar usuario:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
});

// =====================================================
// EXPORTAR ROUTER
// =====================================================

export default router;