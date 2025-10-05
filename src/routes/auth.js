// src/routes/auth.js - VERSIÓN LIMPIA SIN DUPLICADOS

import express from 'express';
import { body, validationResult } from 'express-validator';
import { 
  register, 
  login, 
  refreshToken, 
  logout, 
  getProfile,
  getGoogleLoginUrl,
  handleGoogleCallback,
  resendVerification,
  forgotPassword,       // ✅ CORRECTO (no "orgotPassword")
  validateResetToken,   // ✅ NUEVO
  resetPassword         // ✅ NUEVO
} from '../controllers/authController.js';
import { 
  sendVerificationEmail, 
  verifyEmailToken 
} from '../services/emailService.js';
import { requireAuth } from '../middleware/auth.js';
import db from '../config/db.js';

const router = express.Router();

// =====================================================
// RUTAS DE AUTENTICACIÓN BÁSICA
// =====================================================

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar nuevo usuario
 *     tags: [Autenticación]
 */
router.post('/register', register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Autenticación]
 */
router.post('/login', login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Renovar token de acceso
 *     tags: [Autenticación]
 */
router.post('/refresh', refreshToken);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Obtener perfil del usuario autenticado
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 */
router.get('/me', requireAuth, getProfile);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 */
router.post('/logout', requireAuth, logout);

// =====================================================
// RUTAS GOOGLE OAUTH
// =====================================================

/**
 * @swagger
 * /auth/google/login:
 *   get:
 *     summary: Obtener URL de autenticación Google para login
 *     tags: [Autenticación]
 */
router.get('/google/login', getGoogleLoginUrl);

/**
 * @swagger
 * /auth/google/register:
 *   get:
 *     summary: Obtener URL de autenticación Google para registro
 *     tags: [Autenticación]
 */
router.get('/google/register', (req, res) => {
  console.log('\n🔐 GENERANDO URL GOOGLE OAUTH REGISTER');

  try {
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    
    const params = {
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3100/auth/google/callback',
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state: 'register'
    };

    Object.keys(params).forEach(key => 
      googleAuthUrl.searchParams.append(key, params[key])
    );

    res.json({
      status: 'success',
      message: 'URL de Google OAuth para registro generada exitosamente',
      data: {
        authUrl: googleAuthUrl.toString()
      }
    });

  } catch (error) {
    console.error('💥 ERROR GENERANDO URL GOOGLE OAUTH REGISTER:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor al generar URL de Google OAuth'
    });
  }
});

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: Callback de autenticación Google
 *     tags: [Autenticación]
 */
router.get('/google/callback', handleGoogleCallback);

// =====================================================
// RUTAS DE VERIFICACIÓN DE EMAIL
// =====================================================

/**
 * @swagger
 * /auth/verify-email:
 *   get:
 *     summary: Verificar email con token
 *     tags: [Autenticación]
 */
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'Token de verificación requerido'
      });
    }

    const result = await verifyEmailToken(token);

    if (!result.valid) {
      return res.status(400).json({
        status: 'error',
        message: result.message
      });
    }

    // Actualizar usuario como verificado
    await db.execute(`
      UPDATE usuarios 
      SET email_verificado = TRUE, 
          fecha_verificacion = NOW() 
      WHERE id = ?
    `, [result.userId]);

    // Marcar token como usado
    await db.execute(
      'UPDATE email_verifications SET usado = TRUE WHERE token = ?',
      [token]
    );

    res.json({
      status: 'success',
      message: '✅ ¡Email verificado exitosamente! Ya puedes iniciar sesión.',
      data: {
        verified: true,
        userId: result.userId
      }
    });

  } catch (error) {
    console.error('Error verificando email:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al verificar email'
    });
  }
});

/**
 * @swagger
 * /auth/check-verification/:email:
 *   get:
 *     summary: Verificar estado de verificación de email
 *     tags: [Autenticación]
 */
router.get('/check-verification/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const [users] = await db.execute(
      'SELECT email_verificado, fecha_verificacion FROM usuarios WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      status: 'success',
      data: {
        email: email,
        verified: Boolean(users[0].email_verificado),
        verifiedAt: users[0].fecha_verificacion
      }
    });

  } catch (error) {
    console.error('Error verificando estado:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al verificar estado'
    });
  }
});

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     summary: Reenviar email de verificación
 *     tags: [Autenticación]
 */
router.post('/resend-verification', resendVerification);

// =====================================================
// ⭐ RUTAS DE RECUPERACIÓN DE CONTRASEÑA
// =====================================================

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Solicitar reset de contraseña
 *     tags: [Autenticación]
 */
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Email inválido')
], forgotPassword);

/**
 * @swagger
 * /auth/validate-reset-token:
 *   post:
 *     summary: Validar token de reset de contraseña
 *     tags: [Autenticación]
 */
router.post('/validate-reset-token', [
  body('token').notEmpty().withMessage('Token requerido')
], validateResetToken);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Restablecer contraseña con token
 *     tags: [Autenticación]
 */
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token requerido'),
  body('newPassword').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres')
], resetPassword);

export default router;