// src/routes/auth.js - CON RUTAS GOOGLE OAUTH AGREGADAS

import express from 'express';
import { body, validationResult } from 'express-validator';
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
import { 
  sendVerificationEmail, 
  verifyEmailToken 
} from '../services/emailService.js';
import { requireAuth } from '../middleware/auth.js';
import db from '../config/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { sendPasswordResetEmail } from '../services/emailService.js';


const router = express.Router();


// =====================================================
// MODIFICAR EL ENDPOINT DE REGISTRO EXISTENTE
// =====================================================

/**
 * POST /auth/register
 * Modificar tu registro existente para incluir verificación de email
 */
router.post('/register', [
  body('nombre').trim().notEmpty().withMessage('Nombre es requerido'),
  body('apellido').trim().notEmpty().withMessage('Apellido es requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
], async (req, res) => {
  try {
    // Validar errores
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }

    const { nombre, apellido, email, password, institucion_id } = req.body;

    // Verificar si el email ya existe
    const [existingUsers] = await db.execute(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'El email ya está registrado'
      });
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    // Insertar usuario con email_verificado = FALSE
    const [result] = await db.execute(`
      INSERT INTO usuarios 
      (nombre, apellido, email, password, rol, institucion_id, email_verificado) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      nombre, 
      apellido, 
      email, 
      hashedPassword, 
      'comprador', // rol por defecto
      institucion_id || null,
      false // 🆕 Email NO verificado por defecto
    ]);

    const userId = result.insertId;

    // 🆕 ENVIAR EMAIL DE VERIFICACIÓN
    try {
      await sendVerificationEmail(email, nombre, userId);
      console.log(`✅ Email de verificación enviado a ${email}`);
    } catch (emailError) {
      // No fallar el registro si el email falla
      console.error('⚠️ Error enviando email de verificación:', emailError);
    }

    // Log de registro
    await db.execute(`
      INSERT INTO auth_logs (usuario_id, email, accion, ip_address, user_agent)
      VALUES (?, ?, 'registro', ?, ?)
    `, [userId, email, req.ip, req.get('user-agent')]);

    res.status(201).json({
      status: 'success',
      message: '✅ Usuario registrado exitosamente. Por favor, revisa tu email para verificar tu cuenta.',
      data: {
        userId: userId,
        email: email,
        nombre: nombre,
        requiresVerification: true
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al registrar usuario'
    });
  }
});

// =====================================================
// MODIFICAR EL ENDPOINT DE LOGIN EXISTENTE
// =====================================================

/**
 * POST /auth/login
 * Modificar tu login existente para verificar email
 */
router.post('/login', [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña es requerida')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Buscar usuario
    const [users] = await db.execute(
      'SELECT * FROM usuarios WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas'
      });
    }

    const user = users[0];

    // Verificar contraseña
    const bcrypt = await import('bcrypt');
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      // Log de intento fallido
      await db.execute(`
        INSERT INTO auth_logs (usuario_id, email, accion, ip_address, user_agent)
        VALUES (?, ?, 'login_fallido', ?, ?)
      `, [user.id, email, req.ip, req.get('user-agent')]);

      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas'
      });
    }

    // 🆕 VERIFICAR SI EL EMAIL ESTÁ VERIFICADO
    if (!user.email_verificado) {
      return res.status(403).json({
        status: 'error',
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Debes verificar tu email antes de iniciar sesión. Revisa tu bandeja de entrada.',
        data: {
          email: user.email,
          canResendVerification: true
        }
      });
    }

    // Verificar si el usuario está bloqueado
    if (user.estado === 'inactivo') {
      return res.status(403).json({
        status: 'error',
        message: 'Tu cuenta está inactiva. Contacta al administrador.'
      });
    }

    // Generar tokens (usa tu lógica existente de JWT)

    const accessToken = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        rol: user.rol 
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Actualizar último login
    await db.execute(
      'UPDATE usuarios SET ultimo_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Log de login exitoso
    await db.execute(`
      INSERT INTO auth_logs (usuario_id, email, accion, ip_address, user_agent)
      VALUES (?, ?, 'login_exitoso', ?, ?)
    `, [user.id, email, req.ip, req.get('user-agent')]);

    res.json({
      status: 'success',
      message: 'Login exitoso',
      data: {
        user: {
          id: user.id,
          nombre: user.nombre,
          apellido: user.apellido,
          email: user.email,
          rol: user.rol,
          email_verificado: Boolean(user.email_verificado)
        },
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken
        }
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al iniciar sesión'
    });
  }
});

// =====================================================
// NUEVO ENDPOINT: VERIFICAR EMAIL
// =====================================================

/**
 * GET /auth/verify-email?token=xxx
 * Verifica el email del usuario usando el token enviado por email
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

    // Verificar token usando el servicio de email
    const result = await verifyEmailToken(token);

    if (!result.valid) {
      return res.status(400).json({
        status: 'error',
        message: result.message,
        canResendVerification: result.expired
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

    // Log de verificación
    await db.execute(`
      INSERT INTO auth_logs (usuario_id, accion, ip_address, user_agent)
      VALUES (?, 'verificacion_email', ?, ?)
    `, [result.userId, req.ip, req.get('user-agent')]);

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


// =====================================================
// NUEVO ENDPOINT: REENVIAR VERIFICACIÓN
// =====================================================

/**
 * POST /auth/resend-verification
 * Reenvía el email de verificación
 */
router.post('/resend-verification', [
  body('email').isEmail().withMessage('Email inválido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    // Buscar usuario
    const [users] = await db.execute(
      'SELECT id, nombre, email_verificado FROM usuarios WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      // Por seguridad, siempre responder lo mismo
      return res.json({
        status: 'success',
        message: 'Si el email existe y no está verificado, recibirás un nuevo link de verificación'
      });
    }

    const user = users[0];

    // Si ya está verificado
    if (user.email_verificado) {
      return res.status(400).json({
        status: 'error',
        message: 'Este email ya está verificado. Puedes iniciar sesión.'
      });
    }

    // Verificar que no se haya enviado un email recientemente (rate limiting)
    const [recentEmails] = await db.execute(`
      SELECT COUNT(*) as count 
      FROM email_logs 
      WHERE email = ? 
        AND tipo = 'verification' 
        AND fecha_envio > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
    `, [email]);

    if (recentEmails[0].count > 0) {
      return res.status(429).json({
        status: 'error',
        message: 'Ya se envió un email de verificación recientemente. Por favor, espera 5 minutos antes de solicitar otro.'
      });
    }

    // Enviar nuevo email de verificación
    try {
      await sendVerificationEmail(email, user.nombre, user.id);
      console.log(`✅ Email de verificación reenviado a ${email}`);
    } catch (emailError) {
      console.error('Error reenviando email:', emailError);
      return res.status(500).json({
        status: 'error',
        message: 'Error al enviar el email de verificación'
      });
    }

    res.json({
      status: 'success',
      message: '✅ Email de verificación enviado. Por favor, revisa tu bandeja de entrada.'
    });

  } catch (error) {
    console.error('Error en reenvío de verificación:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al reenviar verificación'
    });
  }
});

// =====================================================
// NUEVO ENDPOINT: VERIFICAR ESTADO DE EMAIL
// =====================================================

/**
 * GET /auth/check-verification/:email
 * Verifica si un email ya está verificado (útil para el frontend)
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
        verified: Boolean(users[0].email_verificado), // ← Cambiar esta línea
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
// ENDPOINT 1: SOLICITAR RESET DE CONTRASEÑA
// =====================================================

/**
 * POST /auth/forgot-password
 * Envía email con token para restablecer contraseña
 */
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Email inválido')
], async (req, res) => {
  try {
    // Validar errores
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    // Buscar usuario
    const [usuarios] = await db.execute(
      'SELECT id, nombre FROM usuarios WHERE email = ?',
      [email]
    );

    // Por seguridad, siempre responder lo mismo aunque el email no exista
    if (usuarios.length === 0) {
      return res.json({
        status: 'success',
        message: 'Si el email existe, recibirás un link para restablecer tu contraseña'
      });
    }

    const usuario = usuarios[0];

    // Verificar rate limiting (no más de 1 reset cada 5 minutos)
    const [recentResets] = await db.execute(`
      SELECT COUNT(*) as count 
      FROM email_logs 
      WHERE email = ? 
        AND tipo = 'password_reset' 
        AND fecha_envio > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
    `, [email]);

    if (recentResets[0].count > 0) {
      return res.status(429).json({
        status: 'error',
        message: 'Ya se envió un email de recuperación recientemente. Por favor, espera 5 minutos.'
      });
    }

    // Enviar email de reset
    try {
      await sendPasswordResetEmail(email, usuario.nombre, usuario.id);
      console.log(`✅ Email de reset enviado a ${email}`);
    } catch (emailError) {
      console.error('Error enviando email de reset:', emailError);
      // No revelar si el email falló
    }

    res.json({
      status: 'success',
      message: 'Si el email existe, recibirás un link para restablecer tu contraseña'
    });

  } catch (error) {
    console.error('Error en forgot-password:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error procesando solicitud'
    });
  }
});

// =====================================================
// ENDPOINT 2: VERIFICAR TOKEN DE RESET (OPCIONAL)
// =====================================================

/**
 * GET /auth/verify-reset-token?token=xxx
 * Verifica si un token de reset es válido (sin usarlo)
 */
router.get('/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'Token requerido'
      });
    }

    const [tokens] = await db.execute(`
      SELECT usuario_id, expires_at 
      FROM password_reset_tokens 
      WHERE token = ? 
        AND usado = FALSE 
        AND expires_at > NOW()
    `, [token]);

    if (tokens.length === 0) {
      return res.json({
        status: 'error',
        valid: false,
        message: 'Token inválido o expirado'
      });
    }

    res.json({
      status: 'success',
      valid: true,
      expiresAt: tokens[0].expires_at
    });

  } catch (error) {
    console.error('Error verificando token de reset:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error verificando token'
    });
  }
});

// =====================================================
// ENDPOINT 3: RESTABLECER CONTRASEÑA
// =====================================================

/**
 * POST /auth/reset-password
 * Cambia la contraseña usando el token
 */
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token requerido'),
  body('newPassword').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
], async (req, res) => {
  try {
    // Validar errores
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }

    const { token, newPassword } = req.body;

    // Verificar token
    const [tokens] = await db.execute(`
      SELECT usuario_id, expires_at
      FROM password_reset_tokens 
      WHERE token = ? 
        AND usado = FALSE 
        AND expires_at > NOW()
    `, [token]);

    if (tokens.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Token inválido o expirado. Solicita un nuevo link de recuperación.'
      });
    }

    const userId = tokens[0].usuario_id;

    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Actualizar contraseña
    await db.execute(
      'UPDATE usuarios SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );

    // Marcar token como usado
    await db.execute(
      'UPDATE password_reset_tokens SET usado = TRUE WHERE token = ?',
      [token]
    );

    // Opcional: Invalidar todas las sesiones activas del usuario
    await db.execute(
      'UPDATE sesiones_activas SET activa = FALSE WHERE usuario_id = ?',
      [userId]
    );

    // Log de cambio de contraseña
    await db.execute(`
      INSERT INTO auth_logs (usuario_id, accion, ip_address, user_agent)
      VALUES (?, 'cambio_password', ?, ?)
    `, [userId, req.ip, req.get('user-agent')]);

    res.json({
      status: 'success',
      message: '✅ Contraseña actualizada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.'
    });

  } catch (error) {
    console.error('Error en reset-password:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al restablecer contraseña'
    });
  }
});

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

// ENDPOINT 1: Verificar email con token
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'Token de verificación requerido'
      });
    }

    // Importar función de emailService
    const { verifyEmailToken } = await import('../services/emailService.js');
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

// ENDPOINT 2: Verificar estado de verificación
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

export default router;