// =====================================================
// CONTROLLER DE AUTENTICACIÓN COMPLETO
// src/controllers/authController.js
// =====================================================

import db from '../config/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getGoogleAuthUrl, getGoogleUserInfo } from '../config/google.js';
import emailService from '../services/emailService.js';

// =====================================================
// REGISTRO CON VERIFICACIÓN DE EMAIL
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

    // Validaciones básicas
    if (!nombre || !apellido || !email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Nombre, apellido, email y contraseña son requeridos'
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

    // Validar contraseña
    if (password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Verificar email único
    const [existingUser] = await db.execute(
      'SELECT id, email FROM usuarios WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'Ya existe un usuario con ese email'
      });
    }

    // Verificar institución si se especifica
    if (institucion_id) {
      const [institucion] = await db.execute(
        'SELECT id, nombre FROM instituciones WHERE id = ? AND estado = "activa"',
        [institucion_id]
      );

      if (institucion.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Institución no válida'
        });
      }
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    // Insertar usuario
    const [result] = await db.execute(`
      INSERT INTO usuarios (nombre, apellido, email, password, telefono, dni, rol, institucion_id, email_verificado) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)
    `, [nombre, apellido, email, hashedPassword, telefono || null, dni || null, rol, institucion_id || null]);

    const userId = result.insertId;
    console.log('✅ Usuario creado con ID:', userId);

    // Enviar email de verificación
    try {
      await emailService.sendVerificationEmail(email, nombre, userId);
    } catch (emailError) {
      console.error('⚠️ Error enviando email de verificación:', emailError);
      // No fallar el registro si el email falla
    }

    // Obtener usuario creado
    const [nuevoUsuario] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.rol, u.estado, u.email_verificado,
             u.institucion_id, i.nombre as institucion_nombre
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.id = ?
    `, [userId]);

    const usuario = nuevoUsuario[0];

    res.status(201).json({
      status: 'success',
      message: 'Usuario registrado exitosamente. Por favor verifica tu email.',
      data: {
        user: {
          id: usuario.id,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          email: usuario.email,
          rol: usuario.rol,
          email_verificado: usuario.email_verificado,
          institucion: usuario.institucion_id ? {
            id: usuario.institucion_id,
            nombre: usuario.institucion_nombre
          } : null
        }
      }
    });

  } catch (error) {
    console.error('❌ Error en registro:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// =====================================================
// LOGIN CON VERIFICACIÓN DE EMAIL
// =====================================================

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario
    const [usuarios] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.password, u.rol, 
             u.estado, u.email_verificado, u.institucion_id, u.google_id,
             i.nombre as institucion_nombre
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.email = ?
    `, [email]);

    if (usuarios.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas'
      });
    }

    const usuario = usuarios[0];

    // Verificar estado del usuario
    if (usuario.estado !== 'activo') {
      return res.status(401).json({
        status: 'error',
        message: 'Usuario inactivo o bloqueado'
      });
    }

    // Si es usuario de Google, redirigir a Google OAuth
    if (usuario.google_id && !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Esta cuenta está vinculada con Google. Usa "Iniciar sesión con Google"'
      });
    }

    // Verificar contraseña solo si no es usuario de Google
    if (!usuario.google_id) {
      const passwordValida = await bcrypt.compare(password, usuario.password);
      
      if (!passwordValida) {
        return res.status(401).json({
          status: 'error',
          message: 'Credenciales inválidas'
        });
      }
    }

    // Verificar email verificado
    if (!usuario.email_verificado) {
      return res.status(403).json({
        status: 'error',
        message: 'Por favor verifica tu email antes de iniciar sesión',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // Generar tokens
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
      'UPDATE usuarios SET ultimo_login = NOW() WHERE id = ?',
      [usuario.id]
    );

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
          email_verificado: usuario.email_verificado,
          institucion: usuario.institucion_id ? {
            id: usuario.institucion_id,
            nombre: usuario.institucion_nombre
          } : null
        },
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken
        }
      }
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// =====================================================
// VERIFICACIÓN DE EMAIL
// =====================================================

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'Token de verificación requerido'
      });
    }

    const result = await emailService.verifyEmailToken(token);

    if (result.success) {
      res.json({
        status: 'success',
        message: result.message,
        data: {
          user: result.user
        }
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: result.message
      });
    }

  } catch (error) {
    console.error('❌ Error verificando email:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// =====================================================
// REENVIAR VERIFICACIÓN DE EMAIL
// =====================================================

export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email requerido'
      });
    }

    // Buscar usuario
    const [usuarios] = await db.execute(
      'SELECT id, nombre, email, email_verificado FROM usuarios WHERE email = ?',
      [email]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    const usuario = usuarios[0];

    if (usuario.email_verificado) {
      return res.status(400).json({
        status: 'error',
        message: 'El email ya está verificado'
      });
    }

    // Reenviar email de verificación
    await emailService.sendVerificationEmail(usuario.email, usuario.nombre, usuario.id);

    res.json({
      status: 'success',
      message: 'Email de verificación reenviado'
    });

  } catch (error) {
    console.error('❌ Error reenviando verificación:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// =====================================================
// GOOGLE OAUTH - INICIAR PROCESO
// =====================================================

export const googleAuth = async (req, res) => {
  try {
    const authUrl = getGoogleAuthUrl();
    
    res.json({
      status: 'success',
      data: {
        authUrl
      }
    });
  } catch (error) {
    console.error('❌ Error generando URL de Google:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// =====================================================
// GOOGLE OAUTH - CALLBACK
// =====================================================

export const googleCallback = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        status: 'error',
        message: 'Código de autorización requerido'
      });
    }

    // Obtener información del usuario desde Google
    const googleUser = await getGoogleUserInfo(code);

    if (!googleUser.verified_email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email de Google no verificado'
      });
    }

    // Buscar usuario existente
    const [existingUsers] = await db.execute(
      'SELECT * FROM usuarios WHERE email = ? OR google_id = ?',
      [googleUser.email, googleUser.id]
    );

    let usuario;

    if (existingUsers.length > 0) {
      // Usuario existente - actualizar con datos de Google si es necesario
      usuario = existingUsers[0];
      
      if (!usuario.google_id) {
        await db.execute(
          'UPDATE usuarios SET google_id = ?, email_verificado = TRUE WHERE id = ?',
          [googleUser.id, usuario.id]
        );
      }
    } else {
      // Crear nuevo usuario
      const [result] = await db.execute(`
        INSERT INTO usuarios (nombre, apellido, email, google_id, rol, email_verificado, estado) 
        VALUES (?, ?, ?, ?, 'comprador', TRUE, 'activo')
      `, [googleUser.nombre, googleUser.apellido || '', googleUser.email, googleUser.id]);

      const [nuevoUsuario] = await db.execute(
        'SELECT * FROM usuarios WHERE id = ?',
        [result.insertId]
      );
      
      usuario = nuevoUsuario[0];
    }

    // Generar tokens
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
      'UPDATE usuarios SET ultimo_login = NOW() WHERE id = ?',
      [usuario.id]
    );

    // Redirigir al frontend con tokens
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?access_token=${accessToken}&refresh_token=${refreshToken}`;
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('❌ Error en callback de Google:', error);
    const errorUrl = `${process.env.FRONTEND_URL}/auth/error?message=Error de autenticación`;
    res.redirect(errorUrl);
  }
};

// =====================================================
// OBTENER INFORMACIÓN DEL USUARIO AUTENTICADO
// =====================================================

export const getMe = async (req, res) => {
  try {
    const [usuarios] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.rol, u.estado, 
             u.email_verificado, u.institucion_id, u.google_id,
             i.nombre as institucion_nombre
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.id = ?
    `, [req.user.id]);

    if (usuarios.length === 0) {
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
          email_verificado: usuario.email_verificado,
          google_linked: !!usuario.google_id,
          institucion: usuario.institucion_id ? {
            id: usuario.institucion_id,
            nombre: usuario.institucion_nombre
          } : null
        }
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo usuario:', error);
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
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(401).json({
        status: 'error',
        message: 'Refresh token requerido'
      });
    }

    // Verificar refresh token
    const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

    // Buscar usuario
    const [usuarios] = await db.execute(
      'SELECT id, email, rol, institucion_id FROM usuarios WHERE id = ? AND estado = "activo"',
      [decoded.id]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Usuario no válido'
      });
    }

    const usuario = usuarios[0];

    // Generar nuevo access token
    const tokenPayload = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      institucion_id: usuario.institucion_id
    };

    const newAccessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign({ id: usuario.id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      status: 'success',
      data: {
        tokens: {
          access_token: newAccessToken,
          refresh_token: newRefreshToken
        }
      }
    });

  } catch (error) {
    console.error('❌ Error en refresh:', error);
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
    // Aquí puedes agregar lógica para invalidar el refresh token
    // Por ejemplo, agregarlo a una blacklist en la base de datos
    
    res.json({
      status: 'success',
      message: 'Logout exitoso'
    });
  } catch (error) {
    console.error('❌ Error en logout:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// Exportar controlador
export const authController = {
  register,
  login,
  verifyEmail,
  resendVerification,
  googleAuth,
  googleCallback,
  getMe,
  refreshToken,
  logout
};