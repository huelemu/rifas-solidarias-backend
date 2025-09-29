// src/controllers/authController.js - VERSIÓN COMPLETA CON TODAS LAS EXPORTACIONES

import db from '../config/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// =====================================================
// REGISTER - FUNCIÓN DE REGISTRO
// =====================================================

export const register = async (req, res) => {
  console.log('\n🔐 ================================');
  console.log('   REGISTRO DE USUARIO');
  console.log('🔐 ================================');
  
  try {
    const { 
      nombre, apellido, email, password, telefono, dni, 
      rol = 'comprador', institucion_id 
    } = req.body;

    console.log('📝 Datos recibidos:', { nombre, apellido, email, rol, institucion_id });

// =====================================================
// LIMPIEZA DE DATOS - ✅ NUEVA SECCIÓN
// =====================================================

// Convertir undefined a null para evitar error de MySQL
const datosLimpios = {
  nombre: nombre?.trim(),
  apellido: apellido?.trim(),
  email: email?.trim()?.toLowerCase(),
  password: password,
  telefono: telefono?.trim() || null,  // ✅ null si está vacío/undefined
  dni: dni?.trim() || null,            // ✅ null si está vacío/undefined
  rol: rol || 'comprador',
  institucion_id: institucion_id || null  // ✅ null si está undefined
};

console.log('📝 Datos limpiados:', datosLimpios);

    // =====================================================
    // VALIDACIONES BÁSICAS
    // =====================================================
    
    if (!datosLimpios.nombre || !datosLimpios.apellido || !datosLimpios.email || !datosLimpios.password) {
      console.log('❌ Validación falló: campos requeridos faltantes');
      return res.status(400).json({
        status: 'error',
        message: 'Nombre, apellido, email y contraseña son requeridos'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(datosLimpios.email)) {
      console.log('❌ Validación falló: email inválido');
      return res.status(400).json({
        status: 'error',
        message: 'Formato de email inválido'
      });
    }

    // Validar contraseña
    if (datosLimpios.password.length < 6) {
      console.log('❌ Validación falló: password muy corto');
      return res.status(400).json({
        status: 'error',
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Validar rol
    const rolesValidos = ['admin_global', 'admin_institucion', 'vendedor', 'comprador'];
    if (!rolesValidos.includes(datosLimpios.rol)) {
      console.log('❌ Validación falló: rol inválido');
      return res.status(400).json({
        status: 'error',
        message: 'Rol inválido'
      });
    }

    console.log('✅ Validaciones pasaron');

   // =====================================================
    // VERIFICAR EMAIL ÚNICO
    // =====================================================
    
    console.log('🔍 Verificando email único...');
    const [existingUser] = await db.execute(
      'SELECT id, email FROM usuarios WHERE email = ?',
      [datosLimpios.email]  // ✅ Usar datos limpios
    );

    if (existingUser.length > 0) {
      console.log('❌ Email ya existe');
      return res.status(409).json({
        status: 'error',
        message: 'El email ya está registrado'
      });
    }

    console.log('✅ Email disponible');


    // =====================================================
    // HASHEAR CONTRASEÑA
    // =====================================================
    
    console.log('🔒 Hasheando contraseña...');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(datosLimpios.password, saltRounds);  // ✅ Usar datos limpios
    console.log('✅ Contraseña hasheada');

    // =====================================================
    // INSERTAR USUARIO - ✅ CORREGIDO
    // =====================================================
    
    console.log('💾 Insertando usuario en base de datos...');
    
    const insertQuery = `
      INSERT INTO usuarios (
        nombre, apellido, email, password, telefono, dni, 
        rol, institucion_id, estado, email_verificado, 
        fecha_creacion, fecha_actualizacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'activo', 0, NOW(), NOW())
    `;

    // ✅ AQUÍ ESTÁ LA CORRECCIÓN PRINCIPAL
    console.log('📋 Parámetros para INSERT:', [
      datosLimpios.nombre, 
      datosLimpios.apellido, 
      datosLimpios.email, 
      '[HASH]', 
      datosLimpios.telefono, 
      datosLimpios.dni, 
      datosLimpios.rol, 
      datosLimpios.institucion_id
    ]);

    const [result] = await db.execute(insertQuery, [
      datosLimpios.nombre,        // ✅ string
      datosLimpios.apellido,      // ✅ string
      datosLimpios.email,         // ✅ string
      hashedPassword,             // ✅ string
      datosLimpios.telefono,      // ✅ string o null
      datosLimpios.dni,           // ✅ string o null
      datosLimpios.rol,           // ✅ string
      datosLimpios.institucion_id // ✅ number o null
    ]);

    console.log('✅ Usuario insertado con ID:', result.insertId);

   // =====================================================
    // RECUPERAR USUARIO CON INFORMACIÓN DE INSTITUCIÓN
    // =====================================================
    
    const [nuevoUsuario] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.rol, u.institucion_id,
             i.nombre as institucion_nombre
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.id = ?
    `, [result.insertId]);

    if (nuevoUsuario.length === 0) {
      throw new Error('No se pudo recuperar el usuario creado');
    }

    const usuario = nuevoUsuario[0];
    console.log('✅ Usuario recuperado:', { id: usuario.id, email: usuario.email, rol: usuario.rol });

   // =====================================================
    // GENERAR TOKENS
    // =====================================================
    
    console.log('🔑 Generando tokens...');
    
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
    console.log('🎉 REGISTRO COMPLETADO EXITOSAMENTE\n');
    
    res.status(201).json({
      status: 'success',
      message: 'Usuario registrado exitosamente',
      data: {
        user: {
          id: usuario.id,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          email: usuario.email,
          rol: usuario.rol,
          institucion_id: usuario.institucion_id,
          institucion_nombre: usuario.institucion_nombre || null
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: '15m',
          tokenType: 'Bearer'
        }
      }
    });

  } catch (error) {
    console.error('💥 ERROR EN REGISTER:');
    console.error('📝 Mensaje:', error.message);
    console.error('📚 Stack:', error.stack);
    
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// =====================================================
// LOGIN - FUNCIÓN DE LOGIN
// =====================================================

export const login = async (req, res) => {
  console.log('\n🔑 ================================');
  console.log('   LOGIN DE USUARIO');
  console.log('🔑 ================================');
  
  try {
    const { email, password } = req.body;

    console.log('📝 Intento de login para:', email);

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario por email con información completa
    console.log('🔍 Buscando usuario...');
    const [usuarios] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.password, u.rol, 
             u.estado, u.institucion_id, u.intentos_fallidos, u.bloqueado_hasta,
             i.nombre as institucion_nombre
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.email = ?
    `, [email]);

    if (usuarios.length === 0) {
      console.log('❌ Usuario no encontrado');
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas'
      });
    }

    const usuario = usuarios[0];
    console.log('✅ Usuario encontrado:', { id: usuario.id, rol: usuario.rol, estado: usuario.estado });

    // Verificar estado del usuario
    if (usuario.estado !== 'activo') {
      console.log('❌ Usuario inactivo');
      return res.status(401).json({
        status: 'error',
        message: 'Usuario inactivo o bloqueado'
      });
    }

    // Verificar contraseña
    console.log('🔐 Verificando contraseña...');
    const passwordValida = await bcrypt.compare(password, usuario.password);
    
    if (!passwordValida) {
      console.log('❌ Contraseña inválida');
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas'
      });
    }

    console.log('✅ Contraseña válida');

    // Generar tokens
    console.log('🔑 Generando tokens...');
    
    const tokenPayload = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      institucion_id: usuario.institucion_id
    };

    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: usuario.id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '7d' });

    // Actualizar último login
    await db.execute(
      'UPDATE usuarios SET ultimo_login = NOW(), intentos_fallidos = 0 WHERE id = ?',
      [usuario.id]
    );

    console.log('✅ Login exitoso para:', usuario.email);
    console.log('🎉 TOKENS GENERADOS CORRECTAMENTE\n');

    // Respuesta exitosa
    res.json({
      status: 'success',
      message: 'Login exitoso',
      data: {
        user: {
          id: usuario.id,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          email: usuario.email,
          rol: usuario.rol,
          institucion_id: usuario.institucion_id,
          institucion_nombre: usuario.institucion_nombre
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: '15m',
          tokenType: 'Bearer'
        }
      }
    });

  } catch (error) {
    console.error('💥 ERROR EN LOGIN:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// =====================================================
// REFRESH TOKEN - RENOVAR TOKEN DE ACCESO
// =====================================================

export const refreshToken = async (req, res) => {
  console.log('\n🔄 ================================');
  console.log('   REFRESH TOKEN');
  console.log('🔄 ================================');

  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        status: 'error',
        message: 'Refresh token requerido'
      });
    }

    // Verificar refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    
    // Buscar usuario
    const [usuarios] = await db.execute(
      'SELECT id, email, rol, estado, institucion_id FROM usuarios WHERE id = ?',
      [decoded.id]
    );

    if (usuarios.length === 0 || usuarios[0].estado !== 'activo') {
      return res.status(401).json({
        status: 'error',
        message: 'Usuario no válido'
      });
    }

    const usuario = usuarios[0];

    // Generar nuevos tokens
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
      message: 'Token renovado exitosamente',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: '15m',
        tokenType: 'Bearer'
      }
    });

  } catch (error) {
    console.error('Error en refresh token:', error);
    
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Refresh token inválido o expirado'
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// =====================================================
// ME - OBTENER PERFIL DEL USUARIO ACTUAL
// =====================================================

export const me = async (req, res) => {
  try {
    const userId = req.user.id;

    const [usuarios] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.rol, u.telefono, u.dni, 
             u.estado, u.ultimo_login, u.institucion_id, 
             i.nombre as institucion_nombre, i.logo_url as institucion_logo
      FROM usuarios u
      LEFT JOIN instituciones i ON u.institucion_id = i.id
      WHERE u.id = ?
    `, [userId]);

    if (usuarios.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    const usuario = usuarios[0];

    res.json({
      status: 'success',
      message: 'Perfil de usuario obtenido exitosamente',
      data: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.rol,
        telefono: usuario.telefono,
        dni: usuario.dni,
        estado: usuario.estado,
        ultimo_login: usuario.ultimo_login,
        institucion: usuario.institucion_id ? {
          id: usuario.institucion_id,
          nombre: usuario.institucion_nombre,
          logo: usuario.institucion_logo
        } : null
      }
    });

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// =====================================================
// LOGOUT - CERRAR SESIÓN
// =====================================================

export const logout = async (req, res) => {
  try {
    // En un sistema más complejo, aquí se invalidaría el token
    // Por ahora, simplemente confirmar el logout
    
    res.json({
      status: 'success',
      message: 'Sesión cerrada exitosamente'
    });

  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// =====================================================
// GOOGLE OAUTH - OBTENER URL DE AUTENTICACIÓN
// =====================================================

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
      state: 'login'
    };

    Object.keys(params).forEach(key => 
      googleAuthUrl.searchParams.append(key, params[key])
    );

    console.log('✅ URL de Google OAuth generada');

    res.json({
      status: 'success',
      message: 'URL de Google OAuth generada exitosamente',
      data: {
        authUrl: googleAuthUrl.toString()
      }
    });

  } catch (error) {
    console.error('💥 ERROR GENERANDO URL GOOGLE OAUTH:', error.message);
    
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor al generar URL de Google OAuth'
    });
  }
};

//-------------------------------------

// =====================================================
// GOOGLE OAUTH - MANEJAR CALLBACK - ✅ CORREGIDO PARA REGISTRO
// =====================================================

export const handleGoogleCallback = async (req, res) => {
  console.log('\n🔐 ================================');
  console.log('   CALLBACK GOOGLE OAUTH');
  console.log('🔐 ================================');

  try {
    const { code, state, error } = req.query;

    if (error) {
      console.log('❌ Error de Google OAuth:', error);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/login?error=oauth_denied`);
    }

    if (!code) {
      console.log('❌ No se recibió código de autorización');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/login?error=no_code`);
    }

    console.log('✅ Código de autorización recibido');
    console.log('📝 State recibido:', state); // login o register

    // =====================================================
    // INTERCAMBIAR CÓDIGO POR TOKENS DE GOOGLE
    // =====================================================
    
    console.log('🔄 Intercambiando código por tokens...');
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

    console.log('✅ Tokens de Google obtenidos exitosamente');

    // =====================================================
    // OBTENER INFORMACIÓN DEL USUARIO DE GOOGLE
    // =====================================================
    
    console.log('🔄 Obteniendo información del usuario...');
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
      name: googleUser.name
    });

    // =====================================================
    // BUSCAR USUARIO EXISTENTE
    // =====================================================
    
    console.log('🔍 Buscando usuario existente en la base de datos...');
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
      // USUARIO NO EXISTE - CREAR NUEVO USUARIO
      // =====================================================
      
      console.log('🆕 Usuario no existe, creando nuevo usuario...');
      console.log('📝 Datos para crear usuario:', {
        email: googleUser.email,
        nombre: googleUser.given_name,
        apellido: googleUser.family_name,
        google_id: googleUser.id
      });

      try {
        // Extraer nombre y apellido
        const nombres = googleUser.name.split(' ');
        const nombre = googleUser.given_name || nombres[0] || 'Usuario';
        const apellido = googleUser.family_name || nombres.slice(1).join(' ') || 'Google';

        // ✅ CREAR USUARIO CON DATOS LIMPIOS PARA EVITAR ERROR undefined
        const datosUsuario = {
          nombre: nombre,
          apellido: apellido,
          email: googleUser.email.toLowerCase(),
          password: await bcrypt.hash(`google_${googleUser.id}_${Date.now()}`, 12), // ✅ Password hasheado temporal
          telefono: null,
          dni: null,
          rol: 'comprador', // Rol por defecto
          institucion_id: null,
          google_id: googleUser.id,
          email_verificado: 1 // Email verificado por Google
        };

        console.log('💾 Insertando usuario en base de datos con datos:', {
          ...datosUsuario,
          password: '[HASH_GENERADO]' // No mostrar el hash en logs
        });

        const [result] = await db.execute(`
          INSERT INTO usuarios (
            nombre, apellido, email, password, telefono, dni, 
            rol, institucion_id, google_id, email_verificado,
            estado, fecha_creacion, fecha_actualizacion
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo', NOW(), NOW())
        `, [
          datosUsuario.nombre,
          datosUsuario.apellido, 
          datosUsuario.email,
          datosUsuario.password,     // null para usuarios Google
          datosUsuario.telefono,     // null
          datosUsuario.dni,          // null
          datosUsuario.rol,
          datosUsuario.institucion_id, // null
          datosUsuario.google_id,
          datosUsuario.email_verificado
        ]);

        console.log('✅ Usuario creado exitosamente con ID:', result.insertId);

        // Obtener el usuario creado
        const [nuevoUsuario] = await db.execute(`
          SELECT u.id, u.nombre, u.apellido, u.email, u.rol, u.estado, 
                 u.institucion_id, i.nombre as institucion_nombre
          FROM usuarios u
          LEFT JOIN instituciones i ON u.institucion_id = i.id
          WHERE u.id = ?
        `, [result.insertId]);

        if (nuevoUsuario.length === 0) {
          throw new Error('No se pudo recuperar el usuario creado');
        }

        const usuario = nuevoUsuario[0];
        console.log('✅ Usuario creado y recuperado:', {
          id: usuario.id,
          email: usuario.email,
          nombre: usuario.nombre,
          apellido: usuario.apellido
        });

        // Continuar con generación de tokens...
        await generarTokensYRedirigir(usuario, res);

      } catch (createError) {
        console.error('💥 ERROR CREANDO USUARIO:', createError);
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/login?error=create_user_error`);
      }

    } else {
      // =====================================================
      // USUARIO EXISTE - HACER LOGIN
      // =====================================================
      
      const usuario = existingUsers[0];
      console.log('✅ Usuario existente encontrado:', {
        id: usuario.id,
        email: usuario.email,
        estado: usuario.estado
      });

      if (usuario.estado !== 'activo') {
        console.log('❌ Usuario inactivo');
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/login?error=user_inactive`);
      }

      // Vincular Google ID si no existe
      if (!usuario.google_id) {
        console.log('🔗 Vinculando Google ID al usuario existente...');
        await db.execute(
          'UPDATE usuarios SET google_id = ?, email_verificado = 1 WHERE id = ?',
          [googleUser.id, usuario.id]
        );
      }

      // Continuar con generación de tokens...
      await generarTokensYRedirigir(usuario, res);
    }

  } catch (error) {
    console.error('💥 ERROR EN GOOGLE CALLBACK:', error);
    console.error('📚 Stack completo:', error.stack);
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/login?error=server_error`);
  }
};

// =====================================================
// FUNCIÓN AUXILIAR PARA GENERAR TOKENS Y REDIRIGIR
// =====================================================

async function generarTokensYRedirigir(usuario, res) {
  try {
    console.log('🔑 Generando tokens JWT...');
    
    // Generar tokens JWT
    const tokenPayload = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      institucion_id: usuario.institucion_id
    };

    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: usuario.id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '7d' });

    console.log('✅ Tokens JWT generados exitosamente');

    // Actualizar último login
    await db.execute(
      'UPDATE usuarios SET ultimo_login = NOW() WHERE id = ?',
      [usuario.id]
    );

    console.log('🔄 Redirigiendo al frontend con tokens...');

    // Redirigir al frontend con tokens en la URL
    const frontendUrl = new URL(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/auth/google/callback`);
    frontendUrl.searchParams.append('access_token', accessToken);
    frontendUrl.searchParams.append('refresh_token', refreshToken);
    
    res.redirect(frontendUrl.toString());

  } catch (error) {
    console.error('💥 ERROR GENERANDO TOKENS:', error);
    throw error;
  }
}

//-------------------------------------

// ✅ ALIAS PARA COMPATIBILIDAD
export const getProfile = me;



// =====================================================
// RESEND VERIFICATION - REENVIAR VERIFICACIÓN
// =====================================================

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

    // TODO: Aquí implementar envío real de email
    console.log('📧 Enviando email de verificación a:', email);

    res.json({
      status: 'success',
      message: 'Email de verificación enviado exitosamente'
    });

  } catch (error) {
    console.error('💥 ERROR EN REENVÍO DE VERIFICACIÓN:', error.message);
    
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};