// src/controllers/authController.js
import db from '../config/db.js';
import bcrypt from 'bcrypt';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken 
} from '../config/jwt.js';

// Blacklist para tokens invalidados (en producción usar Redis)
const tokenBlacklist = new Set();

// POST /auth/register - Registrar nuevo usuario
export const register = async (req, res) => {
  try {
    const { 
      nombre, apellido, email, password, telefono, dni, 
      rol = 'comprador', institucion_id 
    } = req.body;

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

    // Validar rol
    const rolesValidos = ['admin_global', 'admin_institucion', 'vendedor', 'comprador'];
    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({
        status: 'error',
        message: 'Rol inválido'
      });
    }

    // Verificar que el email no esté en uso
    const [existingUser] = await db.execute(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'Ya existe un usuario con ese email'
      });
    }

    // Si se especifica institución, verificar que existe
    if (institucion_id) {
      const [institucion] = await db.execute(
        'SELECT id FROM instituciones WHERE id = ? AND estado = "activa"',
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

    // Crear usuario
    const [result] = await db.execute(`
      INSERT INTO usuarios (nombre, apellido, email, password, telefono, dni, rol, institucion_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [nombre, apellido, email, hashedPassword, telefono || null, dni || null, rol, institucion_id || null]);

    // Obtener usuario creado con información de institución
    const [nuevoUsuario] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.rol, u.estado, 
             u.institucion_id, i.nombre as institucion_nombre
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.id = ?
    `, [result.insertId]);

    const usuario = nuevoUsuario[0];

    // Crear payload para tokens
    const tokenPayload = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      institucion_id: usuario.institucion_id,
      institucion_nombre: usuario.institucion_nombre
    };

    // Generar tokens
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ id: usuario.id, email: usuario.email });

    // Guardar refresh token en BD
    await db.execute(
      'UPDATE usuarios SET refresh_token = ? WHERE id = ?',
      [refreshToken, usuario.id]
    );

    res.status(201).json({
      status: 'success',
      message: 'Usuario registrado exitosamente',
      data: {
        user: usuario,
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: '15m'
        }
      }
    });

  } catch (error) {
    console.error('Error en register:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// POST /auth/login - Iniciar sesión
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario por email
    const [usuarios] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.password, u.rol, 
             u.estado, u.institucion_id, u.intentos_login, u.bloqueado_hasta,
             i.nombre as institucion_nombre
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.email = ?
    `, [email]);

    if (usuarios.length === 0) {
      // Log intento fallido
      await logLoginAttempt(email, req.ip, req.get('User-Agent'), false, 'USUARIO_NO_EXISTE');
      
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas'
      });
    }

    const usuario = usuarios[0];

    // Verificar si el usuario está bloqueado
    if (usuario.bloqueado_hasta && new Date() < new Date(usuario.bloqueado_hasta)) {
      return res.status(423).json({
        status: 'error',
        message: 'Usuario bloqueado temporalmente por exceso de intentos fallidos',
        bloqueado_hasta: usuario.bloqueado_hasta
      });
    }

    // Verificar estado del usuario
    if (usuario.estado !== 'activo') {
      await logLoginAttempt(email, req.ip, req.get('User-Agent'), false, 'USUARIO_INACTIVO');
      
      return res.status(401).json({
        status: 'error',
        message: 'Usuario inactivo'
      });
    }

    // Verificar contraseña
    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      // Incrementar intentos fallidos
      await incrementarIntentosFallidos(usuario.id);
      await logLoginAttempt(email, req.ip, req.get('User-Agent'), false, 'PASSWORD_INCORRECTO');
      
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas'
      });
    }

    // Login exitoso - resetear intentos
    await resetearIntentosFallidos(usuario.id);

    // Crear payload para tokens
    const tokenPayload = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      institucion_id: usuario.institucion_id,
      institucion_nombre: usuario.institucion_nombre
    };

    // Generar tokens
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ id: usuario.id, email: usuario.email });

    // Guardar refresh token y último login
    await db.execute(
      'UPDATE usuarios SET refresh_token = ?, ultimo_login = CURRENT_TIMESTAMP WHERE id = ?',
      [refreshToken, usuario.id]
    );

    // Log intento exitoso
    await logLoginAttempt(email, req.ip, req.get('User-Agent'), true, 'LOGIN_EXITOSO');

    // Preparar datos del usuario (sin password)
    const { password: _, intentos_login, bloqueado_hasta, ...usuarioSeguro } = usuario;

    res.json({
      status: 'success',
      message: 'Login exitoso',
      data: {
        user: usuarioSeguro,
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: '15m'
        }
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// POST /auth/refresh - Renovar access token
export const refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        status: 'error',
        message: 'Refresh token requerido'
      });
    }

    // Verificar refresh token
    const decoded = verifyRefreshToken(refresh_token);

    // Buscar usuario y verificar que el refresh token coincida
    const [usuarios] = await db.execute(`
      SELECT u.id, u.email, u.rol, u.estado, u.institucion_id, u.refresh_token,
             i.nombre as institucion_nombre
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.id = ? AND u.refresh_token = ?
    `, [decoded.id, refresh_token]);

    if (usuarios.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Refresh token inválido'
      });
    }

    const usuario = usuarios[0];

    if (usuario.estado !== 'activo') {
      return res.status(401).json({
        status: 'error',
        message: 'Usuario inactivo'
      });
    }

    // Crear nuevo access token
    const tokenPayload = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      institucion_id: usuario.institucion_id,
      institucion_nombre: usuario.institucion_nombre
    };

    const newAccessToken = generateAccessToken(tokenPayload);

    res.json({
      status: 'success',
      data: {
        access_token: newAccessToken,
        expires_in: '15m'
      }
    });

  } catch (error) {
    console.error('Error en refresh token:', error);
    
    if (error.message.includes('expirado')) {
      return res.status(401).json({
        status: 'error',
        message: 'Refresh token expirado',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    res.status(401).json({
      status: 'error',
      message: 'Refresh token inválido'
    });
  }
};

// POST /auth/logout - Cerrar sesión
export const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    const { refresh_token } = req.body;

    if (token) {
      // Agregar access token a blacklist
      tokenBlacklist.add(token);
    }

    // Si hay refresh token, invalidarlo en BD
    if (refresh_token) {
      await db.execute(
        'UPDATE usuarios SET refresh_token = NULL WHERE refresh_token = ?',
        [refresh_token]
      );
    }

    res.json({
      status: 'success',
      message: 'Sesión cerrada exitosamente'
    });

  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// GET /auth/me - Obtener perfil del usuario autenticado
export const getProfile = async (req, res) => {
  try {
    const usuario = req.user;

    // Obtener información completa del usuario
    const [usuarios] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.dni, 
             u.rol, u.estado, u.fecha_creacion, u.ultimo_login,
             u.institucion_id, i.nombre as institucion_nombre, i.email as institucion_email
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.id = ?
    `, [usuario.id]);

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
    console.error('Error en getProfile:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// Funciones auxiliares
const incrementarIntentosFallidos = async (usuarioId) => {
  const [result] = await db.execute(
    'UPDATE usuarios SET intentos_login = intentos_login + 1 WHERE id = ?',
    [usuarioId]
  );

  // Verificar si debe bloquearse
  const [usuario] = await db.execute(
    'SELECT intentos_login FROM usuarios WHERE id = ?',
    [usuarioId]
  );

  if (usuario[0].intentos_login >= 5) {
    // Bloquear por 30 minutos
    await db.execute(
      'UPDATE usuarios SET bloqueado_hasta = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE id = ?',
      [usuarioId]
    );
  }
};

const resetearIntentosFallidos = async (usuarioId) => {
  await db.execute(
    'UPDATE usuarios SET intentos_login = 0, bloqueado_hasta = NULL WHERE id = ?',
    [usuarioId]
  );
};

const logLoginAttempt = async (email, ip, userAgent, exito, motivo) => {
  try {
    await db.execute(
      'INSERT INTO log_intentos_login (email, ip_address, user_agent, exito, motivo_fallo) VALUES (?, ?, ?, ?, ?)',
      [email, ip, userAgent, exito, motivo]
    );
  } catch (error) {
    console.error('Error al guardar log de login:', error);
  }
};

export const isTokenBlacklisted = (token) => {
  return tokenBlacklist.has(token);
};