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
    const [totalResult] = await db.execute(countQuery, params.slice(0, -2)); // Sin limit y offset
    const total = totalResult[0].total;

    // Remover password de los resultados
    const usuariosSeguro = usuarios.map(usuario => {
      const { password, ...usuarioSinPassword } = usuario;
      return usuarioSinPassword;
    });

    res.json({
      status: 'success',
      data: usuariosSeguro,
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
             i.nombre as institucion_nombre, i.id as institucion_id,
             i.email as institucion_email
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

    // Obtener estadísticas adicionales según el rol
    let estadisticas = {};
    const usuario = usuarios[0];

    if (usuario.rol === 'vendedor') {
      const [ventasResult] = await db.execute(
        'SELECT COUNT(*) as total_ventas FROM numeros WHERE vendedor_id = ? AND estado = "vendido"',
        [id]
      );
      estadisticas.total_ventas = ventasResult[0].total_ventas;
    }

    if (usuario.rol === 'comprador') {
      const [comprasResult] = await db.execute(
        'SELECT COUNT(*) as total_compras FROM numeros WHERE comprador_id = ?',
        [id]
      );
      estadisticas.total_compras = comprasResult[0].total_compras;
    }

    res.json({
      status: 'success',
      data: {
        ...usuario,
        estadisticas
      }
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

    // Validar password (mínimo 6 caracteres)
    if (password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Validar institución para roles que la requieren
    if (['admin_institucion', 'vendedor'].includes(rol)) {
      if (!institucion_id) {
        return res.status(400).json({
          status: 'error',
          message: `El rol ${rol} requiere una institución asignada`
        });
      }

      // Verificar que la institución existe y está activa
      const [instituciones] = await db.execute(
        'SELECT id, estado FROM instituciones WHERE id = ?',
        [institucion_id]
      );

      if (instituciones.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'La institución especificada no existe'
        });
      }

      if (instituciones[0].estado !== 'activa') {
        return res.status(400).json({
          status: 'error',
          message: 'La institución especificada no está activa'
        });
      }
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

    // Verificar DNI único si se proporciona
    if (dni) {
      const [existingDni] = await db.execute(
        'SELECT id FROM usuarios WHERE dni = ?',
        [dni]
      );

      if (existingDni.length > 0) {
        return res.status(409).json({
          status: 'error',
          message: 'Ya existe un usuario con ese DNI'
        });
      }
    }

    // Encriptar password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insertar nuevo usuario
    const [result] = await db.execute(
      `INSERT INTO usuarios (nombre, apellido, email, password, telefono, dni, rol, institucion_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, apellido, email, passwordHash, telefono, dni, rol, institucion_id]
    );

    // Obtener el usuario creado (sin password)
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
    const { 
      nombre, apellido, email, telefono, dni, 
      rol, institucion_id, estado, password 
    } = req.body;

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

    // Validaciones
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          status: 'error',
          message: 'Formato de email inválido'
        });
      }

      // Verificar email único
      const [existingEmail] = await db.execute(
        'SELECT id FROM usuarios WHERE email = ? AND id != ?',
        [email, id]
      );

      if (existingEmail.length > 0) {
        return res.status(409).json({
          status: 'error',
          message: 'Ya existe otro usuario con ese email'
        });
      }
    }

    if (dni) {
      const [existingDni] = await db.execute(
        'SELECT id FROM usuarios WHERE dni = ? AND id != ?',
        [dni, id]
      );

      if (existingDni.length > 0) {
        return res.status(409).json({
          status: 'error',
          message: 'Ya existe otro usuario con ese DNI'
        });
      }
    }

    if (rol) {
      const rolesValidos = ['admin_global', 'admin_institucion', 'vendedor', 'comprador'];
      if (!rolesValidos.includes(rol)) {
        return res.status(400).json({
          status: 'error',
          message: 'Rol inválido. Debe ser: ' + rolesValidos.join(', ')
        });
      }
    }

    if (estado && !['activo', 'inactivo'].includes(estado)) {
      return res.status(400).json({
        status: 'error',
        message: 'Estado debe ser "activo" o "inactivo"'
      });
    }

    // Construir query de actualización
    const campos = [];
    const valores = [];

    if (nombre !== undefined) { campos.push('nombre = ?'); valores.push(nombre); }
    if (apellido !== undefined) { campos.push('apellido = ?'); valores.push(apellido); }
    if (email !== undefined) { campos.push('email = ?'); valores.push(email); }
    if (telefono !== undefined) { campos.push('telefono = ?'); valores.push(telefono); }
    if (dni !== undefined) { campos.push('dni = ?'); valores.push(dni); }
    if (rol !== undefined) { campos.push('rol = ?'); valores.push(rol); }
    if (institucion_id !== undefined) { campos.push('institucion_id = ?'); valores.push(institucion_id); }
    if (estado !== undefined) { campos.push('estado = ?'); valores.push(estado); }

    // Manejar password si se proporciona
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          status: 'error',
          message: 'La contraseña debe tener al menos 6 caracteres'
        });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      campos.push('password = ?');
      valores.push(passwordHash);
    }

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

    // Obtener el usuario actualizado (sin password)
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

    // Verificar si tiene actividad asociada
    const [ventasRealizadas] = await db.execute(
      'SELECT COUNT(*) as total FROM numeros WHERE vendedor_id = ?',
      [id]
    );

    const [comprasRealizadas] = await db.execute(
      'SELECT COUNT(*) as total FROM numeros WHERE comprador_id = ?',
      [id]
    );

    const totalActividad = ventasRealizadas[0].total + comprasRealizadas[0].total;

    if (totalActividad > 0) {
      return res.status(400).json({
        status: 'error',
        message: `No se puede eliminar el usuario. Tiene ${totalActividad} transacciones asociadas`,
        suggestion: 'Cambia el estado a "inactivo" en su lugar'
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