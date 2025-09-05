// src/middleware/auth.js
import { verifyAccessToken } from '../config/jwt.js';
import { isTokenBlacklisted } from '../controllers/authController.js';
import db from '../config/db.js';

// Middleware para verificar autenticación
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Token de acceso requerido',
        code: 'NO_TOKEN'
      });
    }

    // Verificar si el token está en blacklist
    if (isTokenBlacklisted(token)) {
      return res.status(401).json({
        status: 'error',
        message: 'Token inválido',
        code: 'BLACKLISTED_TOKEN'
      });
    }

    // Verificar y decodificar token
    const decoded = verifyAccessToken(token);

    // Verificar que el usuario aún existe y está activo
    const [usuarios] = await db.execute(
      'SELECT id, email, rol, estado, institucion_id FROM usuarios WHERE id = ? AND estado = "activo"',
      [decoded.id]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Usuario no válido o inactivo',
        code: 'INVALID_USER'
      });
    }

    // Agregar información del usuario a la request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      rol: decoded.rol,
      institucion_id: decoded.institucion_id,
      institucion_nombre: decoded.institucion_nombre
    };

    next();

  } catch (error) {
    console.error('Error en authenticateToken:', error);
    
    if (error.message.includes('expirado') || error.message.includes('expired')) {
      return res.status(401).json({
        status: 'error',
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({
      status: 'error',
      message: 'Token inválido',
      code: 'INVALID_TOKEN'
    });
  }
};

// Middleware para verificar roles específicos
export const requireRole = (rolesPermitidos) => {
  // Si rolesPermitidos es un string, convertirlo a array
  if (typeof rolesPermitidos === 'string') {
    rolesPermitidos = [rolesPermitidos];
  }

  return (req, res, next) => {
    try {
      const usuario = req.user;

      if (!usuario) {
        return res.status(401).json({
          status: 'error',
          message: 'Usuario no autenticado',
          code: 'NOT_AUTHENTICATED'
        });
      }

      if (!rolesPermitidos.includes(usuario.rol)) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permisos para realizar esta acción',
          code: 'INSUFFICIENT_PERMISSIONS',
          required_roles: rolesPermitidos,
          user_role: usuario.rol
        });
      }

      next();
    } catch (error) {
      console.error('Error en requireRole:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  };
};

// Middleware para verificar que el usuario pertenece a una institución específica
export const requireInstitution = (req, res, next) => {
  try {
    const usuario = req.user;
    const institucionId = req.params.institucionId || req.body.institucion_id;

    // Admin global puede acceder a cualquier institución
    if (usuario.rol === 'admin_global') {
      return next();
    }

    // Para otros roles, verificar que pertenecen a la institución
    if (!usuario.institucion_id) {
      return res.status(403).json({
        status: 'error',
        message: 'Usuario no asociado a ninguna institución',
        code: 'NO_INSTITUTION'
      });
    }

    // Si se especifica una institución, verificar que coincida
    if (institucionId && parseInt(usuario.institucion_id) !== parseInt(institucionId)) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permisos para esta institución',
        code: 'WRONG_INSTITUTION'
      });
    }

    next();
  } catch (error) {
    console.error('Error en requireInstitution:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// Middleware para verificar propiedad de recurso (ejemplo: usuario solo puede editar sus datos)
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

// Middleware opcional (no requiere autenticación pero la usa si está presente)
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
        'SELECT id, email, rol, estado, institucion_id FROM usuarios WHERE id = ? AND estado = "activo"',
        [decoded.id]
      );

      if (usuarios.length > 0) {
        req.user = {
          id: decoded.id,
          email: decoded.email,
          rol: decoded.rol,
          institucion_id: decoded.institucion_id,
          institucion_nombre: decoded.institucion_nombre
        };
      } else {
        req.user = null;
      }
    } catch (error) {
      req.user = null;
    }

    next();
  } catch (error) {
    console.error('Error en optionalAuth:', error);
    req.user = null;
    next();
  }
};

// Helper para combinar middlewares de auth y roles
export const authorize = (roles = null) => {
  const middlewares = [authenticateToken];
  
  if (roles) {
    middlewares.push(requireRole(roles));
  }
  
  return middlewares;
};

// Definiciones de permisos por rol
export const ROLES = {
  ADMIN_GLOBAL: 'admin_global',
  ADMIN_INSTITUCION: 'admin_institucion', 
  VENDEDOR: 'vendedor',
  COMPRADOR: 'comprador'
};

export const PERMISSIONS = {
  // Permisos para instituciones
  MANAGE_ALL_INSTITUTIONS: [ROLES.ADMIN_GLOBAL],
  MANAGE_OWN_INSTITUTION: [ROLES.ADMIN_GLOBAL, ROLES.ADMIN_INSTITUCION],
  
  // Permisos para usuarios
  MANAGE_ALL_USERS: [ROLES.ADMIN_GLOBAL],
  MANAGE_INSTITUTION_USERS: [ROLES.ADMIN_GLOBAL, ROLES.ADMIN_INSTITUCION],
  
  // Permisos para rifas
  MANAGE_ALL_RIFAS: [ROLES.ADMIN_GLOBAL],
  MANAGE_INSTITUTION_RIFAS: [ROLES.ADMIN_GLOBAL, ROLES.ADMIN_INSTITUCION],
  SELL_NUMBERS: [ROLES.ADMIN_GLOBAL, ROLES.ADMIN_INSTITUCION, ROLES.VENDEDOR],
  BUY_NUMBERS: [ROLES.ADMIN_GLOBAL, ROLES.ADMIN_INSTITUCION, ROLES.VENDEDOR, ROLES.COMPRADOR]
};