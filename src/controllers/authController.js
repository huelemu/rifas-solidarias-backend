// =====================================================
// CONTROLLER DE AUTENTICACIÓN CORREGIDO
// src/controllers/authController.js
// =====================================================

import db from '../config/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// =====================================================
// REGISTER - FUNCIÓN CORREGIDA
// =====================================================

export const register = async (req, res) => {
  console.log('\n🔐 ================================');
  console.log('   REGISTRO DE USUARIO');
  console.log('🔐 ================================');
  
  try {
    const { 
      nombre, apellido, email, password, telefono, dni, 
      rol = 'comprador', institucion_id 
    } = req.body;

    console.log('📝 Datos recibidos:', { nombre, apellido, email, rol, institucion_id });

    // =====================================================
    // VALIDACIONES BÁSICAS
    // =====================================================
    
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

    // =====================================================
    // VERIFICAR EMAIL ÚNICO
    // =====================================================
    
    console.log('🔍 Verificando email único...');
    const [existingUser] = await db.execute(
      'SELECT id, email FROM usuarios WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      console.log('❌ Email ya existe:', existingUser[0]);
      return res.status(409).json({
        status: 'error',
        message: 'Ya existe un usuario con ese email'
      });
    }

    console.log('✅ Email disponible');

    // =====================================================
    // VERIFICAR INSTITUCIÓN (SI SE ESPECIFICA)
    // =====================================================
    
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

    // =====================================================
    // ENCRIPTAR CONTRASEÑA
    // =====================================================
    
    console.log('🔐 Encriptando contraseña...');
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('✅ Contraseña encriptada');

    // =====================================================
    // INSERTAR USUARIO
    // =====================================================
    
    console.log('💾 Insertando usuario en base de datos...');
    
    const [result] = await db.execute(`
      INSERT INTO usuarios (nombre, apellido, email, password, telefono, dni, rol, institucion_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [nombre, apellido, email, hashedPassword, telefono || null, dni || null, rol, institucion_id || null]);

    console.log('✅ Usuario insertado con ID:', result.insertId);

    // =====================================================
    // OBTENER USUARIO CREADO CON INFORMACIÓN COMPLETA
    // =====================================================
    
    console.log('🔍 Obteniendo usuario creado...');
    const [nuevoUsuario] = await db.execute(`
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
    console.log('✅ Usuario recuperado:', { id: usuario.id, email: usuario.email, rol: usuario.rol });

    // =====================================================
    // GENERAR TOKENS
    // =====================================================
    
    console.log('🔑 Generando tokens...');
    
    // Crear payload para tokens
    const tokenPayload = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      institucion_id: usuario.institucion_id
    };

    // Generar access token
    const accessToken = jwt.sign(
      tokenPayload, 
      process.env.JWT_SECRET, 
      { expiresIn: '15m' }
    );

    // Generar refresh token
    const refreshToken = jwt.sign(
      { id: usuario.id }, 
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    console.log('✅ Tokens generados exitosamente');

    // =====================================================
    // RESPUESTA EXITOSA
    // =====================================================
    
    console.log('🎉 REGISTRO COMPLETADO EXITOSAMENTE\n');
    
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
          institucion_nombre: usuario.institucion_nombre || null
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: '15m',
          tokenType: 'Bearer'
        }
      }
    });

  } catch (error) {
    console.error('💥 ERROR EN REGISTER:');
    console.error('📝 Mensaje:', error.message);
    console.error('📚 Stack:', error.stack);
    
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// =====================================================
// LOGIN - FUNCIÓN MEJORADA
// =====================================================

export const login = async (req, res) => {
  console.log('\n🔑 ================================');
  console.log('   LOGIN DE USUARIO');
  console.log('🔑 ================================');
  
  try {
    const { email, password } = req.body;

    console.log('📝 Intento de login para:', email);

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario por email con información completa
    console.log('🔍 Buscando usuario...');
    const [usuarios] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.password, u.rol, 
             u.estado, u.institucion_id, u.intentos_fallidos, u.bloqueado_hasta,
             i.nombre as institucion_nombre
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.email = ?
    `, [email]);

    if (usuarios.length === 0) {
      console.log('❌ Usuario no encontrado');
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas'
      });
    }

    const usuario = usuarios[0];
    console.log('✅ Usuario encontrado:', { id: usuario.id, rol: usuario.rol, estado: usuario.estado });

    // Verificar estado del usuario
    if (usuario.estado !== 'activo') {
      console.log('❌ Usuario inactivo');
      return res.status(401).json({
        status: 'error',
        message: 'Usuario inactivo o bloqueado'
      });
    }

    // Verificar contraseña
    console.log('🔐 Verificando contraseña...');
    const passwordValida = await bcrypt.compare(password, usuario.password);
    
    if (!passwordValida) {
      console.log('❌ Contraseña inválida');
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas'
      });
    }

    console.log('✅ Contraseña válida');

    // Generar tokens
    console.log('🔑 Generando tokens...');
    
    const tokenPayload = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      institucion_id: usuario.institucion_id
    };

    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: usuario.id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '7d' });

    // Actualizar último login
    await db.execute(
      'UPDATE usuarios SET ultimo_login = NOW(), intentos_fallidos = 0 WHERE id = ?',
      [usuario.id]
    );

    console.log('✅ Login exitoso para:', usuario.email);
    console.log('🎉 TOKENS GENERADOS CORRECTAMENTE\n');

    // Respuesta exitosa
    res.json({
      status: 'success',
      message: 'Login exitoso',
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
      }
    });

  } catch (error) {
    console.error('💥 ERROR EN LOGIN:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// =====================================================
// OBTENER PERFIL - /auth/me
// =====================================================

export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const [usuarios] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.rol, u.telefono, u.dni, 
             u.estado, u.ultimo_login, u.institucion_id, 
             i.nombre as institucion_nombre, i.logo_url as institucion_logo
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.id = ?
    `, [userId]);

    if (!usuarios.length) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    const usuario = usuarios[0];

    res.json({
      status: 'success',
      data: {
        user: {
          id: usuario.id,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          email: usuario.email,
          rol: usuario.rol,
          telefono: usuario.telefono,
          dni: usuario.dni,
          estado: usuario.estado,
          ultimo_login: usuario.ultimo_login,
          institucion: {
            id: usuario.institucion_id,
            nombre: usuario.institucion_nombre,
            logo: usuario.institucion_logo
          }
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// =====================================================
// REFRESH TOKEN
// =====================================================

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        status: 'error',
        message: 'Refresh token requerido'
      });
    }

    // Verificar refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    
    // Buscar usuario
    const [usuarios] = await db.execute('SELECT id, email, rol, institucion_id FROM usuarios WHERE id = ?', [decoded.id]);
    
    if (!usuarios.length) {
      return res.status(401).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    const usuario = usuarios[0];

    // Generar nuevo access token
    const newAccessToken = jwt.sign({
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      institucion_id: usuario.institucion_id
    }, process.env.JWT_SECRET, { expiresIn: '15m' });

    res.json({
      status: 'success',
      data: {
        accessToken: newAccessToken,
        expiresIn: '15m'
      }
    });

  } catch (error) {
    console.error('Error en refresh token:', error);
    res.status(401).json({
      status: 'error',
      message: 'Refresh token inválido'
    });
  }
};

// =====================================================
// LOGOUT
// =====================================================

export const logout = async (req, res) => {
  try {
    // En una implementación completa, aquí invalidarías el token
    // Por ahora, solo confirmamos el logout
    
    res.json({
      status: 'success',
      message: 'Logout exitoso'
    });

  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};