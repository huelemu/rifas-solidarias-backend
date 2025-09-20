// ===================================================
// src/middleware/validations.js
// CREAR ESTE ARCHIVO EN: src/middleware/validations.js
// ===================================================

import { validationResult } from 'express-validator';

// Middleware para manejar errores de validación
export const validarErrores = (req, res, next) => {
  const errores = validationResult(req);
  
  if (!errores.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Errores de validación',
      errors: errores.array().map(error => ({
        campo: error.path || error.param,
        mensaje: error.msg,
        valor: error.value
      }))
    });
  }
  
  next();
};

// Middleware básico para verificar que el usuario puede acceder a la rifa
export const verificarPermisoRifa = async (req, res, next) => {
  try {
    const { rifa_id, id } = req.params;
    const rifaId = rifa_id || id;
    const usuario = req.user;

    // Admin global tiene acceso a todo
    if (usuario.rol === 'admin_global') {
      return next();
    }

    // Para otros roles, verificar que pertenezcan a la institución de la rifa
    // Nota: Necesitarás importar db donde uses este middleware
    // Por ahora, permitir acceso básico
    next();
  } catch (error) {
    console.error('Error al verificar permisos de rifa:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor'
    });
  }
};

// Middleware para validar paginación
export const validarPaginacion = (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // Límites razonables
  if (page < 1 || page > 10000) {
    return res.status(400).json({
      status: 'error',
      message: 'Página inválida (1-10000)'
    });
  }

  if (limit < 1 || limit > 100) {
    return res.status(400).json({
      status: 'error',
      message: 'Límite inválido (1-100)'
    });
  }

  req.query.page = page;
  req.query.limit = limit;

  next();
};