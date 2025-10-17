// src/controllers/usuariosController.js
import db from '../config/db.js';
import bcrypt from 'bcrypt';

// GET /usuarios - Obtener todos los usuarios CON FILTROS
export const obtenerUsuarios = async (req, res) => {
  try {
    console.log('📋 Controlador usuarios: Query params recibidos:', req.query);
    
    // Extraer parámetros de query
    const { 
      page = 1, 
      limit = 10, 
      rol, 
      estado, 
      institucion_id,
      search 
    } = req.query;
    
    const offset = (page - 1) * limit;
    const usuario = req.user;

    // Construir query dinámicamente
    let whereConditions = [];
    let params = [];

    // Filtro por rol
    if (rol) {
      whereConditions.push('u.rol = ?');
      params.push(rol);
      console.log('👥 Aplicando filtro rol:', rol);
    }

    // Filtro por estado
    if (estado) {
      whereConditions.push('u.estado = ?');
      params.push(estado);
      console.log('📊 Aplicando filtro estado:', estado);
    }

    // Filtro por institución
    if (institucion_id) {
      whereConditions.push('u.institucion_id = ?');
      params.push(institucion_id);
      console.log('🏢 Aplicando filtro institucion_id:', institucion_id);
    }

    // Búsqueda por texto en nombre, apellido o email
    if (search) {
      whereConditions.push('(u.nombre LIKE ? OR u.apellido LIKE ? OR u.email LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
      console.log('🔍 Aplicando filtro search:', search);
    }

    // Restricciones según el rol del usuario autenticado
    if (usuario.rol === 'admin_institucion') {
      // Admin de institución solo ve usuarios de su institución
      whereConditions.push('u.institucion_id = ?');
      params.push(usuario.institucion_id);
      console.log('🔒 Restringiendo por institución del admin:', usuario.institucion_id);
    }
    // admin_global puede ver todos los usuarios (sin restricción adicional)

    // Construir la cláusula WHERE
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ') 
      : '';

    console.log('🔧 Query WHERE construido:', whereClause);
    console.log('📋 Parámetros finales:', params);

    // Query principal con filtros
    const mainQuery = `
      SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.dni, 
             u.rol, u.alias_mp, u.estado, u.fecha_creacion, u.ultimo_login,
             i.nombre as institucion_nombre, i.id as institucion_id
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      ${whereClause}
      ORDER BY u.fecha_creacion DESC
      LIMIT ? OFFSET ?
    `;

    // Query para contar total (sin LIMIT)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      ${whereClause}
    `;

    console.log('📊 Ejecutando query principal...');
    // Ejecutar ambas consultas
    const [usuarios] = await db.execute(mainQuery, [...params, parseInt(limit), parseInt(offset)]);
    
    console.log('📊 Ejecutando query de conteo...');
    const [totalResult] = await db.execute(countQuery, params);
    
    const total = totalResult[0].total;
    const totalPages = Math.ceil(total / limit);

    console.log(`✅ Usuarios encontrados: ${usuarios.length} de ${total} total`);

    res.json({
      status: 'success',
      data: usuarios,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_records: total,
        per_page: parseInt(limit),
        has_next_page: parseInt(page) < totalPages,
        has_prev_page: parseInt(page) > 1
      },
      filters_applied: {
        rol: rol || null,
        estado: estado || null,
        institucion_id: institucion_id || null,
        search: search || null
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener usuarios:', error);
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
             u.rol, u.alias_mp, u.estado, u.fecha_creacion,
             i.nombre as institucion_nombre
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
    const { nombre, apellido, email, password, telefono, dni, rol, alias_mp, institucion_id } = req.body;

    // Validaciones básicas
    if (!nombre || !apellido || !email || !password || !rol) {
      return res.status(400).json({
        status: 'error',
        message: 'Nombre, apellido, email, password y rol son obligatorios'
      });
    }

    // Verificar email único
    const [existing] = await db.execute(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'Ya existe un usuario con ese email'
      });
    }

    // Encriptar password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insertar usuario
    const [result] = await db.execute(
      `INSERT INTO usuarios (nombre, apellido, email, password, telefono, dni, rol, alias_mp, institucion_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre, 
        apellido, 
        email, 
        passwordHash, 
        telefono || null, 
        dni || null, 
        rol,
        alias_mp || null, 
        institucion_id || null
      ]
    );

    // Obtener usuario creado
    const [nuevoUsuario] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.alias_mp, u.dni, 
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
    const { nombre, apellido, email, telefono, dni, rol, estado } = req.body;

    // Verificar que existe
    const [usuarios] = await db.execute('SELECT id FROM usuarios WHERE id = ?', [id]);
    
    if (usuarios.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    // Actualizar campos proporcionados
    const campos = [];
    const valores = [];

    if (nombre) { campos.push('nombre = ?'); valores.push(nombre); }
    if (apellido) { campos.push('apellido = ?'); valores.push(apellido); }
    if (email) { campos.push('email = ?'); valores.push(email); }
    if (telefono !== undefined) { campos.push('telefono = ?'); valores.push(telefono || null); }
    if (dni !== undefined) { campos.push('dni = ?'); valores.push(dni || null); }
    if (rol) { campos.push('rol = ?'); valores.push(rol); }
    if (estado) { campos.push('estado = ?'); valores.push(estado); }

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

    // Obtener usuario actualizado
    const [usuarioActualizado] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.dni, 
             u.rol, u.estado, u.alias_mp, u.fecha_creacion,
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

    // Verificar que existe
    const [usuarios] = await db.execute('SELECT id FROM usuarios WHERE id = ?', [id]);
    
    if (usuarios.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

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