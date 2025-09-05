// src/controllers/authController.js
import db from '../config/db.js';
import bcrypt from 'bcrypt';
import { generateAccessToken, generateRefreshToken } from '../config/jwt.js';

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
             u.estado, u.institucion_id,
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

    // Preparar datos del usuario (sin password)
    const { password: _, ...usuarioSeguro } = usuario;

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

    // Encriptar contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario
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

    // Obtener usuario creado
    const [nuevoUsuario] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.rol, u.estado,
             i.nombre as institucion_nombre
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.id = ?
    `, [result.insertId]);

    const usuario = nuevoUsuario[0];

    // Crear tokens
    const tokenPayload = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      institucion_id: usuario.institucion_id,
      institucion_nombre: usuario.institucion_nombre
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ id: usuario.id, email: usuario.email });

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