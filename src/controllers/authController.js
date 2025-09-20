// =====================================================
// CONTROLLER DE REGISTRO CORREGIDO CON DEBUG
// src/controllers/authController.js (fragmento a reemplazar)
// =====================================================

export const register = async (req, res) => {
  console.log('🔍 Iniciando registro de usuario...');
  
  try {
    const { 
      nombre, apellido, email, password, telefono, dni, 
      rol = 'comprador', institucion_id 
    } = req.body;

    console.log('📝 Datos recibidos:', { nombre, apellido, email, rol, institucion_id });

    // Validaciones básicas
    if (!nombre || !apellido || !email || !password) {
      console.log('❌ Validación falló: campos requeridos faltantes');
      return res.status(400).json({
        status: 'error',
        message: 'Nombre, apellido, email y contraseña son requeridos'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Validación falló: email inválido');
      return res.status(400).json({
        status: 'error',
        message: 'Formato de email inválido'
      });
    }

    // Validar contraseña
    if (password.length < 6) {
      console.log('❌ Validación falló: password muy corto');
      return res.status(400).json({
        status: 'error',
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Validar rol
    const rolesValidos = ['admin_global', 'admin_institucion', 'vendedor', 'comprador'];
    if (!rolesValidos.includes(rol)) {
      console.log('❌ Validación falló: rol inválido');
      return res.status(400).json({
        status: 'error',
        message: 'Rol inválido'
      });
    }

    console.log('✅ Validaciones pasaron');

    // Verificar que el email no esté en uso
    console.log('🔍 Verificando email único...');
    const [existingUser] = await db.execute(
      'SELECT id, email FROM usuarios WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      console.log('❌ Email ya existe:', existingUser[0]);
      return res.status(409).json({
        status: 'error',
        message: 'Ya existe un usuario con ese email',
        debug: { existingUserId: existingUser[0].id }
      });
    }

    console.log('✅ Email disponible');

    // Si se especifica institución, verificar que existe
    if (institucion_id) {
      console.log('🔍 Verificando institución...', institucion_id);
      const [institucion] = await db.execute(
        'SELECT id, nombre FROM instituciones WHERE id = ? AND estado = "activa"',
        [institucion_id]
      );

      if (institucion.length === 0) {
        console.log('❌ Institución no válida');
        return res.status(400).json({
          status: 'error',
          message: 'Institución no válida'
        });
      }
      console.log('✅ Institución válida:', institucion[0].nombre);
    }

    // Encriptar contraseña
    console.log('🔐 Encriptando contraseña...');
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('✅ Contraseña encriptada');

    // Crear usuario - CON TRANSACCIÓN EXPLÍCITA
    console.log('💾 Insertando usuario en base de datos...');
    
    const connection = await db.getConnection();
    await connection.beginTransaction();
    
    try {
      const [result] = await connection.execute(`
        INSERT INTO usuarios (nombre, apellido, email, password, telefono, dni, rol, institucion_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [nombre, apellido, email, hashedPassword, telefono || null, dni || null, rol, institucion_id || null]);

      console.log('✅ Usuario insertado con ID:', result.insertId);

      // Obtener usuario creado INMEDIATAMENTE
      console.log('🔍 Obteniendo usuario creado...');
      const [nuevoUsuario] = await connection.execute(`
        SELECT u.id, u.nombre, u.apellido, u.email, u.rol, u.estado, 
               u.institucion_id, i.nombre as institucion_nombre
        FROM usuarios u
        LEFT JOIN instituciones i ON u.institucion_id = i.id
        WHERE u.id = ?
      `, [result.insertId]);

      if (nuevoUsuario.length === 0) {
        throw new Error('No se pudo recuperar el usuario creado');
      }

      const usuario = nuevoUsuario[0];
      console.log('✅ Usuario recuperado:', usuario);

      // Confirmar transacción
      await connection.commit();
      console.log('✅ Transacción confirmada');

      // Crear payload para tokens
      const tokenPayload = {
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol,
        institucion_id: usuario.institucion_id
      };

      // Generar tokens
      console.log('🔑 Generando tokens...');
      const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '15m' });
      const refreshToken = jwt.sign({ id: usuario.id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '7d' });
      console.log('✅ Tokens generados');

      // Respuesta de éxito
      console.log('🎉 Registro completado exitosamente');
      res.status(201).json({
        status: 'success',
        message: 'Usuario registrado exitosamente',
        data: {
          user: {
            id: usuario.id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            email: usuario.email,
            rol: usuario.rol,
            institucion_id: usuario.institucion_id,
            institucion_nombre: usuario.institucion_nombre
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: '15m',
            tokenType: 'Bearer'
          }
        },
        debug: {
          insertId: result.insertId,
          affectedRows: result.affectedRows,
          timestamp: new Date().toISOString()
        }
      });

    } catch (innerError) {
      await connection.rollback();
      throw innerError;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('💥 Error en register:', error);
    console.error('📚 Stack trace:', error.stack);
    
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor',
      debug: {
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
};