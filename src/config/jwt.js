// src/config/jwt.js
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Configuración de JWT
export const JWT_CONFIG = {
  ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'rifas_access_secret_2024',
  REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'rifas_refresh_secret_2024',
  ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || '15m',
  REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || '7d'
};

// Generar Access Token (de corta duración)
export const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_CONFIG.ACCESS_SECRET, {
    expiresIn: JWT_CONFIG.ACCESS_EXPIRES,
    issuer: 'rifas-solidarias'
  });
};

// Generar Refresh Token (de larga duración)
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_CONFIG.REFRESH_SECRET, {
    expiresIn: JWT_CONFIG.REFRESH_EXPIRES,
    issuer: 'rifas-solidarias'
  });
};

// Verificar Access Token
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_CONFIG.ACCESS_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expirado');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Token inválido');
    } else {
      throw new Error('Error al verificar token');
    }
  }
};

// Verificar Refresh Token
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_CONFIG.REFRESH_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token expirado');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Refresh token inválido');
    } else {
      throw new Error('Error al verificar refresh token');
    }
  }
};

// Decodificar token sin verificar (para debugging)
export const decodeToken = (token) => {
  return jwt.decode(token);
};