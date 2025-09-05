// src/config/jwt.js
import jwt from 'jsonwebtoken';

// Configuración JWT
export const JWT_CONFIG = {
  ACCESS_TOKEN_SECRET: process.env.JWT_ACCESS_SECRET || 'rifas_access_secret_key_muy_segura_2024',
  REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_SECRET || 'rifas_refresh_secret_key_muy_segura_2024',
  ACCESS_TOKEN_EXPIRES: process.env.JWT_ACCESS_EXPIRES || '15m', // 15 minutos
  REFRESH_TOKEN_EXPIRES: process.env.JWT_REFRESH_EXPIRES || '7d', // 7 días
};

// Generar Access Token
export const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_CONFIG.ACCESS_TOKEN_SECRET, {
    expiresIn: JWT_CONFIG.ACCESS_TOKEN_EXPIRES,
    issuer: 'rifas-solidarias-api',
    audience: 'rifas-solidarias-app'
  });
};

// Generar Refresh Token
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_CONFIG.REFRESH_TOKEN_SECRET, {
    expiresIn: JWT_CONFIG.REFRESH_TOKEN_EXPIRES,
    issuer: 'rifas-solidarias-api',
    audience: 'rifas-solidarias-app'
  });
};

// Verificar Access Token
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_CONFIG.ACCESS_TOKEN_SECRET);
  } catch (error) {
    throw new Error('Token de acceso inválido o expirado');
  }
};

// Verificar Refresh Token
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_CONFIG.REFRESH_TOKEN_SECRET);
  } catch (error) {
    throw new Error('Token de actualización inválido o expirado');
  }
};

// Decodificar token sin verificar (para obtener info)
export const decodeToken = (token) => {
  return jwt.decode(token);
};