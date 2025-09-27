// =====================================================
// CONFIGURACIÓN COMPLETA DE GOOGLE OAUTH
// src/config/google.js
// =====================================================

import { google } from 'googleapis';

// Configuración de Google OAuth
const googleConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.BASE_URL}/api/auth/google/callback`
};

// Verificar configuración
if (!googleConfig.clientId || !googleConfig.clientSecret) {
  console.warn('⚠️ Google OAuth no configurado. Revisa GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET');
}

// Cliente OAuth2 de Google
export const oauth2Client = new google.auth.OAuth2(
  googleConfig.clientId,
  googleConfig.clientSecret,
  googleConfig.redirectUri
);

// Scopes que necesitamos de Google
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

// =====================================================
// GENERAR URL DE AUTENTICACIÓN DE GOOGLE
// =====================================================

export const getGoogleAuthUrl = () => {
  try {
    if (!googleConfig.clientId || !googleConfig.clientSecret) {
      throw new Error('Google OAuth no configurado correctamente');
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_SCOPES,
      prompt: 'consent',
      include_granted_scopes: true
    });

    console.log('✅ URL de Google OAuth generada');
    return authUrl;
  } catch (error) {
    console.error('❌ Error generando URL de Google OAuth:', error);
    throw error;
  }
};

// =====================================================
// OBTENER INFORMACIÓN DEL USUARIO DESDE GOOGLE
// =====================================================

export const getGoogleUserInfo = async (code) => {
  try {
    console.log('🔍 Intercambiando código por tokens...');
    
    // Intercambiar código por tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    console.log('🔑 Tokens obtenidos, consultando perfil...');

    // Obtener información del usuario
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    console.log('✅ Información de usuario obtenida:', data.email);

    // Validar datos requeridos
    if (!data.email || !data.verified_email) {
      throw new Error('Email de Google no válido o no verificado');
    }

    return {
      id: data.id,
      email: data.email,
      nombre: data.given_name || data.name?.split(' ')[0] || 'Usuario',
      apellido: data.family_name || data.name?.split(' ').slice(1).join(' ') || '',
      picture: data.picture,
      verified_email: data.verified_email,
      locale: data.locale
    };
  } catch (error) {
    console.error('❌ Error obteniendo info de Google:', error);
    
    if (error.response?.data) {
      console.error('Detalles del error:', error.response.data);
    }
    
    throw new Error('Error al obtener información de Google: ' + error.message);
  }
};

// =====================================================
// VALIDAR CONFIGURACIÓN DE GOOGLE
// =====================================================

export const validateGoogleConfig = () => {
  const errors = [];

  if (!process.env.GOOGLE_CLIENT_ID) {
    errors.push('GOOGLE_CLIENT_ID no configurado');
  }

  if (!process.env.GOOGLE_CLIENT_SECRET) {
    errors.push('GOOGLE_CLIENT_SECRET no configurado');
  }

  if (!process.env.GOOGLE_REDIRECT_URI && !process.env.BASE_URL) {
    errors.push('GOOGLE_REDIRECT_URI o BASE_URL no configurado');
  }

  if (errors.length > 0) {
    console.warn('⚠️ Configuración de Google OAuth incompleta:');
    errors.forEach(error => console.warn(`  - ${error}`));
    return false;
  }

  console.log('✅ Configuración de Google OAuth válida');
  return true;
};

// =====================================================
// REVOCAR TOKEN DE GOOGLE
// =====================================================

export const revokeGoogleToken = async (accessToken) => {
  try {
    await oauth2Client.revokeToken(accessToken);
    console.log('✅ Token de Google revocado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error revocando token de Google:', error);
    return false;
  }
};

// =====================================================
// OBTENER TOKENS DE REFRESH
// =====================================================

export const refreshGoogleTokens = async (refreshToken) => {
  try {
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    console.log('✅ Tokens de Google refrescados');
    
    return {
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
      expiry_date: credentials.expiry_date
    };
  } catch (error) {
    console.error('❌ Error refrescando tokens de Google:', error);
    throw error;
  }
};

// Validar configuración al importar
validateGoogleConfig();

export default {
  oauth2Client,
  GOOGLE_SCOPES,
  getGoogleAuthUrl,
  getGoogleUserInfo,
  validateGoogleConfig,
  revokeGoogleToken,
  refreshGoogleTokens,
  config: googleConfig
};
