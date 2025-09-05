// src/controllers/authController.js
import db from '../config/db.js';
import bcrypt from 'bcrypt';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken,
  decodeToken 
} from '../config/jwt.js';

// Blacklist de tokens (en producción usar Redis)
const tokenBlacklist = new Set();

// POST /auth/login - Iniciar sesión
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validaciones básicas
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario por email
    const [usuarios] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.password, u.rol, 
             u.estado, u.institucion_id,
             i.nombre as institucion_nombre, i.estado as institucion_estado
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

    // Verificar que el usuario esté activo
    if (usuario.estado !== 'activo') {
      return res.status(401).json({
        status: 'error',
        message: 'Usuario inactivo. Contacte al administrador'
      });
    }

    // Verificar que la institución esté activa (si aplica)
    if (usuario.institucion_id && usuario.institucion_estado !== 'activa') {
      return res.status(401).json({
        status: 'error',
        message: 'La institución asociada está inactiva'
      });
    }

    // Verificar contraseña
    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas'
      });
    }

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

    // Guardar refresh token en base de datos
    await db.execute(
      'UPDATE usuarios SET refresh_token = ?, ultimo_login = NOW() WHERE id = ?',
      [refreshToken, usuario.id]
    );

    // Preparar datos del usuario (sin password)
    const { password: _, refresh_token: __, ...usuarioSeguro } = usuario;

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
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

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

    // Validar DNI único si se proporciona
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

    // Encriptar contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario
    const [result] = await db.execute(
      `INSERT INTO usuarios (nombre, apellido, email, password, telefono, dni, rol, institucion_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, apellido, email, passwordHash, telefono, dni, rol, institucion_id]
    );

    // Obtener usuario creado con datos de institución
    const [nuevoUsuario] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.rol, u.estado,
             i.nombre as institucion_nombre
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.id = ?
    `, [result.insertId]);

    const usuario = nuevoUsuario[0];

    // Crear tokens para auto-login
    const tokenPayload = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      institucion_id: usuario.institucion_id,
      institucion_nombre: usuario.institucion_nombre
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ id: usuario.id, email: usuario.email });

    // Guardar refresh token
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
      message: 'Error interno del servidor',
      error: error.message
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

    // Verificar si el token está en blacklist
    if (tokenBlacklist.has(refresh_token)) {
      return res.status(401).json({
        status: 'error',
        message: 'Token inválido'
      });
    }

    // Verificar refresh token
    const decoded = verifyRefreshToken(refresh_token);

    // Buscar usuario y verificar que el refresh token coincida
    const [usuarios] = await db.execute(`
      SELECT u.id, u.email, u.rol, u.estado, u.refresh_token, u.institucion_id,
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

    // Verificar que el usuario siga activo
    if (usuario.estado !== 'activo') {
      return res.status(401).json({
        status: 'error',
        message: 'Usuario inactivo'
      });
    }

    // Generar nuevo access token
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
      message: 'Token renovado exitosamente',
      data: {
        access_token: newAccessToken,
        expires_in: '15m'
      }
    });

  } catch (error) {
    console.error('Error en refresh token:', error);
    res.status(401).json({
      status: 'error',
      message: 'Refresh token inválido o expirado'
    });
  }
};

// POST /auth/logout - Cerrar sesión
export const logout = async (req, res) => {
  try {
    const { refresh_token } = req.body;
    const authHeader = req.headers.authorization;

    if (refresh_token) {
      // Agregar refresh token a blacklist
      tokenBlacklist.add(refresh_token);

      // Remover refresh token de la base de datos
      await db.execute(
        'UPDATE usuarios SET refresh_token = NULL WHERE refresh_token = ?',
        [refresh_token]
      );
    }

    if (authHeader) {
      const accessToken = authHeader.split(' ')[1];
      if (accessToken) {
        // Agregar access token a blacklist
        tokenBlacklist.add(accessToken);
      }
    }

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

// GET /auth/me - Obtener perfil del usuario autenticado
export const getProfile = async (req, res) => {
  try {
    const usuario = req.user; // Viene del middleware de auth

    // Obtener datos actualizados del usuario
    const [usuarios] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.dni, 
             u.rol, u.estado, u.fecha_creacion, u.ultimo_login,
             i.nombre as institucion_nombre, i.id as institucion_id
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

// Función para verificar si un token está en blacklist
export const isTokenBlacklisted = (token) => {
  return tokenBlacklist.has(token);
};