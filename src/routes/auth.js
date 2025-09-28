// src/routes/auth.js - RUTAS COMPLETAS Y CORREGIDAS

import express from 'express';
import { 
  register, 
  login, 
  refreshToken, 
  me,
  logout,
  // Estas funciones necesitas agregarlas al controller:
  getGoogleLoginUrl,        // NUEVA FUNCIÓN
  handleGoogleCallback,     // NUEVA FUNCIÓN
  resendVerification        // NUEVA FUNCIÓN (para el register component)
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// =====================================================
// RATE LIMITING
// =====================================================

// Rate limit general para autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 intentos por IP por ventana
  message: {
    status: 'error',
    message: 'Demasiados intentos de autenticación. Intenta nuevamente en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limit específico para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos de login por IP por ventana
  message: {
    status: 'error',
    message: 'Demasiados intentos de login. Intenta nuevamente en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limit para Google OAuth
const oauthLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 20, // 20 intentos por IP por ventana
  message: {
    status: 'error',
    message: 'Demasiados intentos de OAuth. Intenta nuevamente en 5 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// =====================================================
// RUTAS DE AUTENTICACIÓN TRADICIONAL
// =====================================================

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar nuevo usuario
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - apellido
 *               - email
 *               - password
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "Juan"
 *               apellido:
 *                 type: string
 *                 example: "Pérez"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "juan@ejemplo.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "123456"
 *               telefono:
 *                 type: string
 *                 example: "+5491123456789"
 *               dni:
 *                 type: string
 *                 example: "12345678"
 *               rol:
 *                 type: string
 *                 enum: [admin_global, admin_institucion, vendedor, comprador]
 *                 default: "comprador"
 *               institucion_id:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Email ya existe
 */
router.post('/register', authLimiter, register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Autenticación]
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
 *                 example: "admin@test.com"
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login exitoso
 *       401:
 *         description: Credenciales inválidas
 */
router.post('/login', loginLimiter, login);

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     summary: Reenviar email de verificación
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "usuario@ejemplo.com"
 *     responses:
 *       200:
 *         description: Email de verificación enviado
 *       400:
 *         description: Email inválido
 */
router.post('/resend-verification', authLimiter, resendVerification);

// =====================================================
// RUTAS DE GOOGLE OAUTH
// =====================================================

/**
 * @swagger
 * /auth/google/login:
 *   get:
 *     summary: Obtener URL de Google OAuth para login
 *     tags: [Google OAuth]
 *     description: Retorna la URL de Google OAuth para iniciar el proceso de login
 *     responses:
 *       200:
 *         description: URL de Google OAuth generada exitosamente
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
 *                   example: URL de Google OAuth generada exitosamente
 *                 data:
 *                   type: object
 *                   properties:
 *                     authUrl:
 *                       type: string
 *                       example: https://accounts.google.com/o/oauth2/v2/auth?...
 *       500:
 *         description: Error interno del servidor
 */
router.get('/google/login', oauthLimiter, getGoogleLoginUrl);

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: Callback de Google OAuth
 *     tags: [Google OAuth]
 *     description: Maneja el callback de Google después de autorización
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Código de autorización de Google
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Estado para verificar la solicitud
 *       - in: query
 *         name: error
 *         schema:
 *           type: string
 *         description: Error de autorización (si existe)
 *     responses:
 *       302:
 *         description: Redirección al frontend con tokens o error
 *       400:
 *         description: Error en los parámetros
 */
router.get('/google/callback', handleGoogleCallback);

/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: Redirección directa a Google OAuth
 *     tags: [Google OAuth]
 *     description: Redirige directamente a Google OAuth (método alternativo)
 *     responses:
 *       302:
 *         description: Redirección a Google OAuth
 */
router.get('/google', oauthLimiter, async (req, res) => {
  // Método alternativo: redirigir directamente sin JSON
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
      state: 'login'
    };

    Object.keys(params).forEach(key => 
      googleAuthUrl.searchParams.append(key, params[key])
    );

    res.redirect(googleAuthUrl.toString());
  } catch (error) {
    console.error('Error en redirección directa a Google:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/login?error=oauth_error`);
  }
});

// =====================================================
// RUTAS PROTEGIDAS
// =====================================================

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Obtener perfil del usuario actual
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario
 *       401:
 *         description: Token inválido o expirado
 */
router.get('/me', authenticateToken, me);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Renovar token de acceso
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Token renovado exitosamente
 *       401:
 *         description: Refresh token inválido
 */
router.post('/refresh', refreshToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sesión cerrada exitosamente
 *       401:
 *         description: Token inválido
 */
router.post('/logout', authenticateToken, logout);

// =====================================================
// RUTA DE INFORMACIÓN DEL SISTEMA
// =====================================================

/**
 * @swagger
 * /auth/info:
 *   get:
 *     summary: Información del sistema de autenticación
 *     tags: [Sistema]
 *     responses:
 *       200:
 *         description: Información del sistema
 */
router.get('/info', (req, res) => {
  res.json({
    status: 'success',
    message: 'Sistema de autenticación activo',
    data: {
      version: '2.0.0',
      features: [
        'JWT Authentication',
        'Google OAuth 2.0',
        'Role-based Access Control',
        'Email Verification',
        'Rate Limiting',
        'Audit Logs'
      ],
      endpoints: {
        traditional: ['/register', '/login', '/refresh', '/logout'],
        oauth: ['/google', '/google/callback', '/google/login'],
        protected: ['/me'],
        utils: ['/resend-verification', '/info']
      },
      documentation: '/api-docs'
    }
  });
});

export default router;