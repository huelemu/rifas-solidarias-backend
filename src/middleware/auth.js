// =====================================================
// MIDDLEWARE DE AUTENTICACIÓN COMPLETO
// src/middleware/auth.js
// =====================================================

import jwt from 'jsonwebtoken';
import db from '../config/db.js';

// =====================================================
// FUNCIONES AUXILIARES PARA JWT
// =====================================================

// Función para verificar access token
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Token inválido');
  }
};

// Función para verificar refresh token
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Refresh token inválido');
  }
};

// =====================================================
// MIDDLEWARE PRINCIPAL DE AUTENTICACIÓN
// =====================================================

export const requireAuth = async (req, res, next) => {
  try {
    // Obtener token del header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Token de acceso requerido',
        code: 'NO_TOKEN'
      });
    }

    // Verificar token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      return res.status(401).json({
        status: 'error',
        message: 'Token inválido o expirado',
        code: 'INVALID_TOKEN'
      });
    }

    // Verificar si el token está en blacklist (si tienes la tabla)
    try {
      const [blacklisted] = await db.execute(
        'SELECT id FROM tokens_invalidados WHERE jti = ? AND expira_en > NOW()',
        [decoded.jti]
      );

      if (blacklisted.length > 0) {
        return res.status(401).json({
          status: 'error',
          message: 'Token invalidado',
          code: 'TOKEN_BLACKLISTED'
        });
      }
    } catch (dbError) {
      // Si no existe la tabla de tokens invalidados, continuar
      console.warn('Tabla tokens_invalidados no encontrada, saltando validación de blacklist');
    }

    // Obtener usuario de la base de datos
    const [usuarios] = await db.execute(
      'SELECT id, email, rol, estado, institucion_id FROM usuarios WHERE id = ?',
      [decoded.userId]
    );

    if (!usuarios.length) {
      return res.status(401).json({
        status: 'error',
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    const usuario = usuarios[0];

    // Verificar estado del usuario
    if (usuario.estado !== 'activo') {
      return res.status(401).json({
        status: 'error',
        message: 'Usuario inactivo o bloqueado',
        code: 'USER_INACTIVE'
      });
    }

    // Agregar usuario a la request
    req.user = usuario;
    req.tokenData = decoded;

    next();

  } catch (error) {
    console.error('Error en middleware requireAuth:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// =====================================================
// MIDDLEWARE DE ROLES
// =====================================================

export const requireRole = (rolesPermitidos) => {
  return (req, res, next) => {
    try {
      // Verificar que el usuario esté autenticado
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'Usuario no autenticado',
          code: 'NOT_AUTHENTICATED'
        });
      }

      // Convertir a array si es un string
      const roles = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos];

      // Verificar si el usuario tiene uno de los roles permitidos
      if (!roles.includes(req.user.rol)) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permisos para acceder a este recurso',
          code: 'INSUFFICIENT_PERMISSIONS',
          required_roles: roles,
          user_role: req.user.rol
        });
      }

      next();

    } catch (error) {
      console.error('Error en middleware requireRole:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  };
};

// =====================================================
// MIDDLEWARE DE PROPIEDAD/OWNERSHIP
// =====================================================

export const requireOwnership = (idField = 'id') => {
  return (req, res, next) => {
    try {
      const usuario = req.user;
      const resourceId = req.params[idField];

      // Admin global puede acceder a cualquier recurso
      if (usuario.rol === 'admin_global') {
        return next();
      }

      // Admin de institución puede acceder a recursos de su institución
      if (usuario.rol === 'admin_institucion') {
        // Esta verificación se haría en el controlador específico
        return next();
      }

      // Usuario normal solo puede acceder a sus propios recursos
      if (parseInt(usuario.id) !== parseInt(resourceId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Solo puedes acceder a tus propios recursos',
          code: 'NOT_OWNER'
        });
      }

      next();
    } catch (error) {
      console.error('Error en requireOwnership:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  };
};

// =====================================================
// MIDDLEWARE OPCIONAL (NO REQUIERE AUTENTICACIÓN)
// =====================================================

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const decoded = verifyAccessToken(token);
      
      // Verificar usuario
      const [usuarios] = await db.execute(
        'SELECT id, email, rol, estado, institucion_id FROM usuarios WHERE id = ?',
        [decoded.userId]
      );

      if (usuarios.length && usuarios[0].estado === 'activo') {
        req.user = usuarios[0];
        req.tokenData = decoded;
      } else {
        req.user = null;
      }
    } catch (tokenError) {
      req.user = null;
    }

    next();

  } catch (error) {
    console.error('Error en middleware optionalAuth:', error);
    req.user = null;
    next();
  }
};

// =====================================================
// MIDDLEWARES ESPECÍFICOS POR ROL
// =====================================================

// Solo administradores globales
export const requireAdmin = requireRole(['admin_global']);

// Solo administradores (global o institución)
export const requireAnyAdmin = requireRole(['admin_global', 'admin_institucion']);

// Solo vendedores
export const requireVendedor = requireRole(['vendedor']);

// Vendedores y administradores
export const requireVendedorOrAdmin = requireRole(['admin_global', 'admin_institucion', 'vendedor']);

// =====================================================
// MIDDLEWARE DE VERIFICACIÓN DE INSTITUCIÓN
// =====================================================

export const requireSameInstitution = async (req, res, next) => {
  try {
    const usuario = req.user;
    
    // Admin global tiene acceso a todo
    if (usuario.rol === 'admin_global') {
      return next();
    }

    // Obtener institución del recurso (esto dependerá del contexto)
    const { institucion_id } = req.params;
    
    if (institucion_id && parseInt(usuario.institucion_id) !== parseInt(institucion_id)) {
      return res.status(403).json({
        status: 'error',
        message: 'Solo puedes acceder a recursos de tu institución',
        code: 'DIFFERENT_INSTITUTION'
      });
    }

    next();

  } catch (error) {
    console.error('Error en requireSameInstitution:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// =====================================================
// MIDDLEWARE DE RATE LIMITING (BÁSICO)
// =====================================================

const rateLimitStore = new Map();

export const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Limpiar entradas antiguas
    if (rateLimitStore.has(key)) {
      const requests = rateLimitStore.get(key).filter(timestamp => timestamp > windowStart);
      rateLimitStore.set(key, requests);
    } else {
      rateLimitStore.set(key, []);
    }

    const currentRequests = rateLimitStore.get(key);

    if (currentRequests.length >= maxRequests) {
      return res.status(429).json({
        status: 'error',
        message: 'Demasiadas solicitudes. Intenta más tarde.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Agregar timestamp actual
    currentRequests.push(now);
    rateLimitStore.set(key, currentRequests);

    next();
  };
};

// =====================================================
// FUNCIONES AUXILIARES EXPORTADAS
// =====================================================

export const generateTokens = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    rol: user.rol,
    institucion_id: user.institucion_id
  };

  const accessToken = jwt.sign(
    { ...payload, jti: `${user.id}-${Date.now()}` },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

export const extractTokenFromHeader = (authHeader) => {
  return authHeader && authHeader.split(' ')[1];
};

// =====================================================
// MIDDLEWARE DE LOGGING DE AUTENTICACIÓN
// =====================================================

export const logAuthAttempt = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log del intento de autenticación
    if (req.route && req.route.path && req.user) {
      console.log(`Auth: ${req.user.email} (${req.user.rol}) accessed ${req.method} ${req.originalUrl}`);
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// =====================================================
// EXPORTACIONES POR DEFECTO
// =====================================================

export default {
  requireAuth,
  requireRole,
  requireOwnership,
  optionalAuth,
  requireAdmin,
  requireAnyAdmin,
  requireVendedor,
  requireVendedorOrAdmin,
  requireSameInstitution,
  rateLimit,
  generateTokens,
  extractTokenFromHeader,
  logAuthAttempt,
  verifyAccessToken,
  verifyRefreshToken
};