// src/controllers/authController.js - AGREGAR ESTAS FUNCIONES AL FINAL

import jwt from 'jsonwebtoken';
import db from '../config/db.js';

// =====================================================
// FUNCIÓN PARA OBTENER URL DE GOOGLE OAUTH (LOGIN)
// =====================================================

/**
 * Obtiene la URL de Google OAuth para login
 * GET /auth/google/login
 */
export const getGoogleLoginUrl = async (req, res) => {
  console.log('\n🔐 ================================');
  console.log('   GENERANDO URL GOOGLE OAUTH LOGIN');
  console.log('🔐 ================================');

  try {
    // Construir URL de Google OAuth
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    
    const params = {
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3100/auth/google/callback',
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state: 'login' // Para identificar que es login, no registro
    };

    // Agregar parámetros a la URL
    Object.keys(params).forEach(key => 
      googleAuthUrl.searchParams.append(key, params[key])
    );

    console.log('✅ URL de Google OAuth generada');
    console.log('📍 URL:', googleAuthUrl.toString());

    res.json({
      status: 'success',
      message: 'URL de Google OAuth generada exitosamente',
      data: {
        authUrl: googleAuthUrl.toString()
      }
    });

  } catch (error) {
    console.error('💥 ERROR GENERANDO URL GOOGLE OAUTH:');
    console.error('📝 Mensaje:', error.message);
    
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor al generar URL de Google OAuth'
    });
  }
};

// =====================================================
// FUNCIÓN PARA MANEJAR CALLBACK DE GOOGLE OAUTH
// =====================================================

/**
 * Maneja el callback de Google OAuth (para login)
 * GET /auth/google/callback
 */
export const handleGoogleCallback = async (req, res) => {
  console.log('\n🔐 ================================');
  console.log('   CALLBACK GOOGLE OAUTH');
  console.log('🔐 ================================');

  try {
    const { code, state, error } = req.query;

    // Verificar si hubo error en la autorización
    if (error) {
      console.log('❌ Error de Google OAuth:', error);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/login?error=oauth_denied`);
    }

    if (!code) {
      console.log('❌ No se recibió código de autorización');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/login?error=no_code`);
    }

    console.log('✅ Código de autorización recibido');
    console.log('📝 State:', state);

    // =====================================================
    // INTERCAMBIAR CÓDIGO POR TOKENS
    // =====================================================
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3100/auth/google/callback'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('❌ Error obteniendo tokens:', tokenData);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/login?error=token_error`);
    }

    console.log('✅ Tokens obtenidos exitosamente');

    // =====================================================
    // OBTENER INFORMACIÓN DEL USUARIO DE GOOGLE
    // =====================================================
    
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    const googleUser = await userResponse.json();

    if (!userResponse.ok) {
      console.error('❌ Error obteniendo información del usuario:', googleUser);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/login?error=user_info_error`);
    }

    console.log('✅ Información del usuario obtenida:', {
      id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      verified_email: googleUser.verified_email
    });

    // =====================================================
    // BUSCAR USUARIO EXISTENTE EN LA BASE DE DATOS
    // =====================================================
    
    console.log('🔍 Buscando usuario en base de datos...');
    
    // Buscar por email o google_id
    const [existingUsers] = await db.execute(`
      SELECT 
        u.id, u.nombre, u.apellido, u.email, u.rol, u.estado, u.email_verificado,
        u.institucion_id, u.google_id, i.nombre as institucion_nombre
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.email = ? OR u.google_id = ?
    `, [googleUser.email, googleUser.id]);

    if (existingUsers.length === 0) {
      // =====================================================
      // USUARIO NO EXISTE - REDIRIGIR A REGISTRO
      // =====================================================
      
      console.log('❌ Usuario no encontrado');
      console.log('🔄 Redirigiendo a registro con datos de Google...');
      
      // Redirigir al registro con los datos de Google
      const registerUrl = new URL(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/register`);
      registerUrl.searchParams.append('google_email', googleUser.email);
      registerUrl.searchParams.append('google_name', googleUser.given_name || '');
      registerUrl.searchParams.append('google_lastname', googleUser.family_name || '');
      registerUrl.searchParams.append('google_id', googleUser.id);
      registerUrl.searchParams.append('suggested', 'true');
      
      return res.redirect(registerUrl.toString());
    }

    const usuario = existingUsers[0];
    console.log('✅ Usuario encontrado:', { id: usuario.id, email: usuario.email, rol: usuario.rol });

    // =====================================================
    // VERIFICAR ESTADO DEL USUARIO
    // =====================================================
    
    if (usuario.estado !== 'activo') {
      console.log('❌ Usuario inactivo');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/login?error=user_inactive`);
    }

    // =====================================================
    // ACTUALIZAR GOOGLE_ID SI NO EXISTE
    // =====================================================
    
    if (!usuario.google_id) {
      console.log('🔄 Vinculando cuenta con Google ID...');
      await db.execute(
        'UPDATE usuarios SET google_id = ?, email_verificado = 1 WHERE id = ?',
        [googleUser.id, usuario.id]
      );
      console.log('✅ Cuenta vinculada con Google');
    }

    // =====================================================
    // GENERAR TOKENS JWT
    // =====================================================
    
    console.log('🔑 Generando tokens JWT...');
    
    const tokenPayload = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      institucion_id: usuario.institucion_id
    };

    const accessToken = jwt.sign(
      tokenPayload, 
      process.env.JWT_SECRET, 
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: usuario.id }, 
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    console.log('✅ Tokens generados exitosamente');

    // =====================================================
    // REDIRIGIR AL FRONTEND CON TOKENS
    // =====================================================
    
    console.log('🎉 LOGIN CON GOOGLE COMPLETADO EXITOSAMENTE');
    
    // Redirigir al frontend con los tokens en la URL
    const frontendUrl = new URL(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/dashboard`);
    frontendUrl.searchParams.append('access_token', accessToken);
    frontendUrl.searchParams.append('refresh_token', refreshToken);
    
    res.redirect(frontendUrl.toString());

  } catch (error) {
    console.error('💥 ERROR EN GOOGLE CALLBACK:');
    console.error('📝 Mensaje:', error.message);
    console.error('📚 Stack:', error.stack);
    
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/login?error=server_error`);
  }
};

// =====================================================
// FUNCIÓN PARA REENVIAR VERIFICACIÓN DE EMAIL
// =====================================================

/**
 * Reenvía el email de verificación
 * POST /auth/resend-verification
 */
export const resendVerification = async (req, res) => {
  console.log('\n📧 ================================');
  console.log('   REENVÍO DE VERIFICACIÓN');
  console.log('📧 ================================');

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email es requerido'
      });
    }

    // Buscar usuario por email
    const [users] = await db.execute(
      'SELECT id, email, email_verificado FROM usuarios WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    const user = users[0];

    if (user.email_verificado) {
      return res.status(400).json({
        status: 'error',
        message: 'El email ya está verificado'
      });
    }

    // TODO: Aquí implementarías el envío del email
    // Por ahora, simular que se envió
    console.log('📧 Enviando email de verificación a:', email);

    res.json({
      status: 'success',
      message: 'Email de verificación enviado exitosamente'
    });

  } catch (error) {
    console.error('💥 ERROR EN REENVÍO DE VERIFICACIÓN:');
    console.error('📝 Mensaje:', error.message);
    
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};