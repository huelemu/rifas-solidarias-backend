// =====================================================
// RUTAS DE AUTENTICACIÓN MEJORADAS
// src/routes/authRoutes.js
// =====================================================

import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';
import { authController } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// =====================================================
// RUTAS DE REGISTRO Y LOGIN TRADICIONAL
// =====================================================

// Registro de usuario con verificación de email
router.post('/register', authController.register);

// Login de usuario
router.post('/login', authController.login);

// Verificar email
router.post('/verify-email', authController.verifyEmail);

// Reenviar verificación de email
router.post('/resend-verification', authController.resendVerification);

// =====================================================
// RUTAS DE GOOGLE OAUTH
// =====================================================

// Obtener URL de autenticación de Google
router.get('/google', authController.googleAuth);

// Callback de Google OAuth
router.get('/google/callback', authController.googleCallback);

// =====================================================
// RUTAS PROTEGIDAS
// =====================================================

// Obtener información del usuario autenticado
router.get('/me', requireAuth, async (req, res) => {
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
});

// Logout (invalidar tokens)
router.post('/logout', requireAuth, async (req, res) => {
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
});

// Refresh token
router.post('/refresh', async (req, res) => {
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
});

export default router;