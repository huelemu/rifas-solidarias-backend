// src/controllers/usuarioController.js
import db from '../config/db.js';
import bcrypt from 'bcrypt';

// GET /usuarios - Obtener todos los usuarios
export const obtenerUsuarios = async (req, res) => {
  try {
    const { page = 1, limit = 10, rol, institucion_id, estado } = req.query;
    const offset = (page - 1) * limit;

    // Construir query dinámicamente
    let query = `
      SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.dni, 
             u.rol, u.estado, u.fecha_creacion, u.fecha_actualizacion,
             i.nombre as institucion_nombre, i.id as institucion_id
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
    `;
    
    let countQuery = 'SELECT COUNT(*) as total FROM usuarios u';
    let conditions = [];
    let params = [];

    // Agregar filtros
    if (rol) {
      conditions.push('u.rol = ?');
      params.push(rol);
    }
    if (institucion_id) {
      conditions.push('u.institucion_id = ?');
      params.push(institucion_id);
    }
    if (estado) {
      conditions.push('u.estado = ?');
      params.push(estado);
    }

    // Aplicar condiciones
    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    // Agregar ordenamiento y paginación
    query += ' ORDER BY u.fecha_creacion DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    // Ejecutar consultas
    const [usuarios] = await db.execute(query, params);
    const [totalResult] = await db.execute(countQuery, params.slice(0, -2));
    const total = totalResult[0].total;

    res.json({
      status: 'success',
      data: usuarios,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_records: total,
        per_page: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// GET /usuarios/:id - Obtener un usuario específico
export const obtenerUsuarioPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const [usuarios] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.dni, 
             u.rol, u.estado, u.fecha_creacion, u.fecha_actualizacion,
             i.nombre as institucion_nombre, i.id as institucion_id
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.id = ?
    `, [id]);

    if (usuarios.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      status: 'success',
      data: usuarios[0]
    });

  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// POST /usuarios - Crear nuevo usuario
export const crearUsuario = async (req, res) => {
  try {
    const { 
      nombre, apellido, email, password, telefono, dni, 
      rol, institucion_id 
    } = req.body;

    // Validaciones básicas
    if (!nombre || !apellido || !email || !password || !rol) {
      return res.status(400).json({
        status: 'error',
        message: 'Nombre, apellido, email, password y rol son campos obligatorios'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Formato de email inválido'
      });
    }

    // Validar rol
    const rolesValidos = ['admin_global', 'admin_institucion', 'vendedor', 'comprador'];
    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({
        status: 'error',
        message: 'Rol inválido. Debe ser: ' + rolesValidos.join(', ')
      });
    }

    // Verificar que el email no esté en uso
    const [existingEmail] = await db.execute(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'Ya existe un usuario con ese email'
      });
    }

    // Encriptar password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insertar nuevo usuario
    const [result] = await db.execute(
      `INSERT INTO usuarios (nombre, apellido, email, password, telefono, dni, rol, institucion_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre, 
        apellido, 
        email, 
        passwordHash, 
        telefono || null, 
        dni || null, 
        rol, 
        institucion_id || null
      ]
    );

    // Obtener el usuario creado
    const [nuevoUsuario] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.dni, 
             u.rol, u.estado, u.fecha_creacion,
             i.nombre as institucion_nombre
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.id = ?
    `, [result.insertId]);

    res.status(201).json({
      status: 'success',
      message: 'Usuario creado exitosamente',
      data: nuevoUsuario[0]
    });

  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// PUT /usuarios/:id - Actualizar usuario
export const actualizarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, email, telefono, dni, rol, institucion_id, estado } = req.body;

    // Verificar que el usuario existe
    const [usuarios] = await db.execute(
      'SELECT * FROM usuarios WHERE id = ?',
      [id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    // Construir query de actualización
    const campos = [];
    const valores = [];

    if (nombre !== undefined) { campos.push('nombre = ?'); valores.push(nombre); }
    if (apellido !== undefined) { campos.push('apellido = ?'); valores.push(apellido); }
    if (email !== undefined) { campos.push('email = ?'); valores.push(email); }
    if (telefono !== undefined) { campos.push('telefono = ?'); valores.push(telefono || null); }
    if (dni !== undefined) { campos.push('dni = ?'); valores.push(dni || null); }
    if (rol !== undefined) { campos.push('rol = ?'); valores.push(rol); }
    if (institucion_id !== undefined) { campos.push('institucion_id = ?'); valores.push(institucion_id || null); }
    if (estado !== undefined) { campos.push('estado = ?'); valores.push(estado); }

    if (campos.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No se proporcionaron campos para actualizar'
      });
    }

    valores.push(id);

    await db.execute(
      `UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`,
      valores
    );

    // Obtener el usuario actualizado
    const [usuarioActualizado] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.dni, 
             u.rol, u.estado, u.fecha_creacion, u.fecha_actualizacion,
             i.nombre as institucion_nombre
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.id = ?
    `, [id]);

    res.json({
      status: 'success',
      message: 'Usuario actualizado exitosamente',
      data: usuarioActualizado[0]
    });

  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// DELETE /usuarios/:id - Eliminar usuario
export const eliminarUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el usuario existe
    const [usuarios] = await db.execute(
      'SELECT * FROM usuarios WHERE id = ?',
      [id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    // Eliminar el usuario
    await db.execute('DELETE FROM usuarios WHERE id = ?', [id]);

    res.json({
      status: 'success',
      message: 'Usuario eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};