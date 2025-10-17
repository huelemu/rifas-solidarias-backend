// =====================================================
// RUTAS DE AUTENTICACIÓN
// src/routes/auth.js
// =====================================================

import express from 'express';
import { body } from 'express-validator';
import { 
  register, 
  login, 
  refreshToken, 
  update1Profile,
  logout, 
  getProfile,
  getGoogleLoginUrl,
  handleGoogleCallback,
  resendVerification,
  forgotPassword,
  validateResetToken,
  resetPassword
} from '../controllers/authController.js';
import { verifyEmailToken } from '../services/emailService.js';
import { requireAuth } from '../middleware/auth.js';
import db from '../config/db.js';

const router = express.Router();

// =====================================================
// 🔓 RUTAS PÚBLICAS (NO REQUIEREN AUTENTICACIÓN)
// =====================================================

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar nuevo usuario
 *     description: Crea una cuenta nueva en el sistema
 *     tags: [Autenticación]
 *     security: []
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
 *                 example: Juan
 *               apellido:
 *                 type: string
 *                 example: Pérez
 *               email:
 *                 type: string
 *                 format: email
 *                 example: juan@test.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: test123
 *               telefono:
 *                 type: string
 *                 example: "+5491123456789"
 *               dni:
 *                 type: string
 *                 example: "12345678"
 *               rol:
 *                 type: string
 *                 enum: [admin_global, admin_institucion, vendedor, comprador]
 *                 default: comprador
 *                 example: comprador
 *               institucion_id:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *       400:
 *         description: Error de validación o email ya existe
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
 *               password:
 *                 type: string
 *                 example: test123
 *     responses:
 *       200:
 *         description: Login exitoso - Copia el accessToken para autenticarte
 *         content:
 *           application/json:
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
 *                 tokens:
 *                   accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                   refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                   expiresIn: 15m
 *                   tokenType: Bearer
 *       401:
 *         description: Credenciales inválidas
 */
router.post('/login', login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Renovar token de acceso
 *     description: Genera un nuevo accessToken usando el refreshToken
 *     tags: [Autenticación]
 *     security: []
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
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Token renovado exitosamente
 *       401:
 *         description: Refresh token inválido o expirado
 */
router.post('/refresh', refreshToken);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Solicitar recuperación de contraseña
 *     description: Envía un email con instrucciones para restablecer la contraseña
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
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: usuario@test.com
 *     responses:
 *       200:
 *         description: Email enviado (si el usuario existe)
 */
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Email inválido')
], forgotPassword);

/**
 * @swagger
 * /auth/validate-reset-token:
 *   post:
 *     summary: Validar token de recuperación
 *     description: Verifica si un token de reset de contraseña es válido
 *     tags: [Autenticación]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 example: abc123def456
 *     responses:
 *       200:
 *         description: Token válido
 *       400:
 *         description: Token inválido o expirado
 */
router.post('/validate-reset-token', [
  body('token').notEmpty().withMessage('Token requerido')
], validateResetToken);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Restablecer contraseña
 *     description: Cambia la contraseña usando un token de recuperación
 *     tags: [Autenticación]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *                 example: abc123def456
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: nuevaPassword123
 *     responses:
 *       200:
 *         description: Contraseña restablecida exitosamente
 *       400:
 *         description: Token inválido o contraseña no válida
 */
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token requerido'),
  body('newPassword').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres')
], resetPassword);

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     summary: Reenviar email de verificación
 *     description: Envía nuevamente el email para verificar la cuenta
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
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: usuario@test.com
 *     responses:
 *       200:
 *         description: Email enviado
 */
router.post('/resend-verification', resendVerification);

/**
 * @swagger
 * /auth/verify-email/{token}:
 *   get:
 *     summary: Verificar email con token
 *     description: Confirma el email del usuario usando el token recibido por correo
 *     tags: [Autenticación]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token de verificación
 *     responses:
 *       200:
 *         description: Email verificado exitosamente
 *       400:
 *         description: Token inválido o expirado
 */
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await verifyEmailToken(token);

    if (!result.success) {
      return res.status(400).json({
        status: 'error',
        message: result.message
      });
    }

    res.json({
      status: 'success',
      message: 'Email verificado exitosamente'
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
 * /auth/check-verification/{email}:
 *   get:
 *     summary: Verificar estado de verificación de email
 *     description: Consulta si un email ya fue verificado
 *     tags: [Autenticación]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *     responses:
 *       200:
 *         description: Estado de verificación
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

// =====================================================
// 🔒 RUTAS PROTEGIDAS (REQUIEREN AUTENTICACIÓN)
// =====================================================

// ⬅️ AGREGAR ESTA RUTA (después de la ruta /me GET)
/**
 * @swagger
 * /auth/me:
 *   put:
 *     summary: Actualizar perfil del usuario actual
 *     description: Permite al usuario actualizar su propio perfil
 *     tags: [Autenticación]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               apellido:
 *                 type: string
 *               telefono:
 *                 type: string
 *               alias_mercadopago:
 *                 type: string
 *     responses:
 *       200:
 *         description: Perfil actualizado exitosamente
 *       401:
 *         description: No autorizado
 */
router.put('/me', requireAuth, updateProfile);
router.get('/me', requireAuth, getProfile);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     description: Invalida los tokens del usuario actual
 *     tags: [Autenticación]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Sesión cerrada exitosamente
 */
router.post('/logout', requireAuth, logout);

// =====================================================
// 🔐 GOOGLE OAUTH
// =====================================================

/**
 * @swagger
 * /auth/google/login:
 *   get:
 *     summary: Obtener URL de autenticación Google (Login)
 *     tags: [Autenticación]
 *     security: []
 *     responses:
 *       200:
 *         description: URL de autenticación Google
 */
router.get('/google/login', getGoogleLoginUrl);

/**
 * @swagger
 * /auth/google/register:
 *   get:
 *     summary: Obtener URL de autenticación Google (Registro)
 *     tags: [Autenticación]
 *     security: []
 *     responses:
 *       200:
 *         description: URL de autenticación Google
 */
router.get('/google/register', (req, res) => {
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
      data: {
        authUrl: googleAuthUrl.toString()
      }
    });

  } catch (error) {
    console.error('Error generando URL Google:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generando URL de Google'
    });
  }
});

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: Callback de Google OAuth
 *     description: Endpoint que procesa la respuesta de Google después de la autenticación
 *     tags: [Autenticación]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirección al frontend con token
 */
router.get('/google/callback', handleGoogleCallback);

export default router;