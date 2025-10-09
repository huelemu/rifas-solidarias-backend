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
  forgotPassword,       
  validateResetToken,  
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
 *     description: Autentica un usuario con email y contraseña, devuelve tokens JWT
 *     tags: [Autenticación]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@test.com
 *                 description: Email del usuario
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: test123
 *                 description: Contraseña del usuario
 *           examples:
 *             admin:
 *               summary: Usuario Admin
 *               value:
 *                 email: admin@test.com
 *                 password: test123
 *             comprador:
 *               summary: Usuario Comprador
 *               value:
 *                 email: comprador@test.com
 *                 password: test123
 *     responses:
 *       200:
 *         description: Login exitoso - Copia el accessToken para usar en otros endpoints
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Login exitoso
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         nombre:
 *                           type: string
 *                           example: Juan
 *                         apellido:
 *                           type: string
 *                           example: Pérez
 *                         email:
 *                           type: string
 *                           example: admin@test.com
 *                         rol:
 *                           type: string
 *                           enum: [admin_global, admin_institucion, vendedor, comprador]
 *                           example: admin_global
 *                         institucion_id:
 *                           type: integer
 *                           nullable: true
 *                           example: 1
 *                         institucion_nombre:
 *                           type: string
 *                           nullable: true
 *                           example: Cruz Roja
 *                         authMethod:
 *                           type: string
 *                           example: local
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsInJvbCI6ImFkbWluX2dsb2JhbCIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDA5MDAwfQ.signature
 *                           description: Token JWT para autenticación (válido 15 minutos)
 *                         refreshToken:
 *                           type: string
 *                           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDA2MDQ4MDB9.signature
 *                           description: Token para renovar el accessToken (válido 7 días)
 *                         expiresIn:
 *                           type: string
 *                           example: 15m
 *                           description: Tiempo de expiración del accessToken
 *                         tokenType:
 *                           type: string
 *                           example: Bearer
 *                           description: Tipo de token
 *             example:
 *               status: success
 *               message: Login exitoso
 *               data:
 *                 user:
 *                   id: 1
 *                   nombre: Juan
 *                   apellido: Pérez
 *                   email: admin@test.com
 *                   rol: admin_global
 *                   institucion_id: null
 *                   institucion_nombre: null
 *                   authMethod: local
 *                 tokens:
 *                   accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsInJvbCI6ImFkbWluX2dsb2JhbCIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDA5MDAwfQ.signature
 *                   refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDA2MDQ4MDB9.signature
 *                   expiresIn: 15m
 *                   tokenType: Bearer
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Email y contraseña son requeridos
 *       401:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Credenciales inválidas
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Error interno del servidor
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