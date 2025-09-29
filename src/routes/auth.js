// src/routes/auth.js - CON RUTAS GOOGLE OAUTH AGREGADAS

import express from 'express';
import { 
  register, 
  login, 
  refreshToken, 
  logout, 
  getProfile,
  // ✅ AGREGAR IMPORTACIONES GOOGLE OAUTH
  getGoogleLoginUrl,
  handleGoogleCallback,
  resendVerification
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: usuario@ejemplo.com
 *         password:
 *           type: string
 *           example: mipassword123
 *     
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - nombre
 *         - apellido
 *         - email
 *         - password
 *       properties:
 *         nombre:
 *           type: string
 *           example: Juan
 *         apellido:
 *           type: string
 *           example: Pérez
 *         email:
 *           type: string
 *           format: email
 *           example: juan.perez@ejemplo.com
 *         password:
 *           type: string
 *           minLength: 6
 *           example: password123
 *         telefono:
 *           type: string
 *           example: "+5491123456789"
 *         dni:
 *           type: string
 *           example: "12345678"
 *         rol:
 *           type: string
 *           enum: [admin_global, admin_institucion, vendedor, comprador]
 *           default: comprador
 *         institucion_id:
 *           type: integer
 *           example: 1
 *     
 *     AuthResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 nombre:
 *                   type: string
 *                 apellido:
 *                   type: string
 *                 email:
 *                   type: string
 *                 rol:
 *                   type: string
 *                 institucion_id:
 *                   type: integer
 *                 institucion_nombre:
 *                   type: string
 *             tokens:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 expiresIn:
 *                   type: string
 *                   example: "15m"
 */

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
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Email ya existe
 */
router.post('/register', register);

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
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Credenciales inválidas
 */
router.post('/login', login);

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
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token renovado exitosamente
 *       401:
 *         description: Refresh token inválido
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
 *     responses:
 *       200:
 *         description: Perfil obtenido exitosamente
 *       401:
 *         description: No autenticado
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
 *     responses:
 *       200:
 *         description: Logout exitoso
 */
router.post('/logout', requireAuth, logout);

// =====================================================
// ✅ NUEVAS RUTAS GOOGLE OAUTH
// =====================================================

/**
 * @swagger
 * /auth/google/login:
 *   get:
 *     summary: Obtener URL de autenticación Google para login
 *     tags: [Autenticación]
 *     responses:
 *       200:
 *         description: URL de Google OAuth generada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     authUrl:
 *                       type: string
 *                       example: "https://accounts.google.com/o/oauth2/v2/auth?..."
 */
router.get('/google/login', getGoogleLoginUrl);

/**
 * @swagger
 * /auth/google/register:
 *   get:
 *     summary: Obtener URL de autenticación Google para registro
 *     tags: [Autenticación]
 *     responses:
 *       200:
 *         description: URL de Google OAuth generada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     authUrl:
 *                       type: string
 *                       example: "https://accounts.google.com/o/oauth2/v2/auth?..."
 */
// ✅ NUEVA RUTA QUE FALTABA
router.get('/google/register', (req, res) => {
  // Mismo método que login pero con state=register
  console.log('\n🔐 ================================');
  console.log('   GENERANDO URL GOOGLE OAUTH REGISTER');
  console.log('🔐 ================================');

  try {
    // Construir URL de Google OAuth para registro
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    
    const params = {
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3100/auth/google/callback',
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state: 'register' // ✅ Diferenciamos entre login y register
    };

    Object.keys(params).forEach(key => 
      googleAuthUrl.searchParams.append(key, params[key])
    );

    console.log('✅ URL de Google OAuth para registro generada');

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
 *     parameters:
 *       - name: code
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *       - name: state
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           enum: [login, register]
 *     responses:
 *       302:
 *         description: Redirección al frontend
 */
router.get('/google/callback', handleGoogleCallback);

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
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Email enviado exitosamente
 *       404:
 *         description: Usuario no encontrado
 */
router.post('/resend-verification', resendVerification);

export default router;