// =====================================================
// MIDDLEWARE PARA VERIFICACIÓN DE EMAIL
// src/middleware/emailVerification.js
// =====================================================

import db from '../config/db.js';

/**
 * Middleware para requerir email verificado
 * Usar después de requireAuth
 */
export const requireVerifiedEmail = async (req, res, next) => {
  try {
    // Verificar que el usuario esté autenticado
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        status: 'error',
        message: 'Usuario no autenticado'
      });
    }

    // Obtener estado de verificación del usuario
    const [users] = await db.execute(
      'SELECT email_verificado, email FROM usuarios WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }

    const user = users[0];

    // Verificar si el email está verificado
    if (!user.email_verificado) {
      return res.status(403).json({
        status: 'error',
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Debes verificar tu email antes de realizar esta acción',
        data: {
          email: user.email,
          canResendVerification: true
        }
      });
    }

    // Email verificado, continuar
    next();

  } catch (error) {
    console.error('Error en middleware de verificación:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error verificando estado de email'
    });
  }
};

/**
 * Middleware opcional de verificación
 * No bloquea, solo agrega información
 */
export const checkVerifiedEmail = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next();
    }

    const [users] = await db.execute(
      'SELECT email_verificado FROM usuarios WHERE id = ?',
      [req.user.id]
    );

    if (users.length > 0) {
      req.emailVerified = users[0].email_verificado;
    }

    next();
  } catch (error) {
    console.error('Error en checkVerifiedEmail:', error);
    next(); // No bloquear por un error en este check opcional
  }
};

/**
 * Middleware para verificar si el usuario puede hacer ciertas acciones
 * basado en su estado de verificación y rol
 */
export const requireVerificationForAction = (actionName) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          status: 'error',
          message: 'Usuario no autenticado'
        });
      }

      const [users] = await db.execute(
        'SELECT email_verificado, rol FROM usuarios WHERE id = ?',
        [req.user.id]
      );

      if (users.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Usuario no encontrado'
        });
      }

      const user = users[0];

      // Admins globales no necesitan verificación para ciertas acciones
      if (user.rol === 'admin_global') {
        return next();
      }

      // Para otras acciones, se requiere verificación
      if (!user.email_verificado) {
        return res.status(403).json({
          status: 'error',
          code: 'EMAIL_NOT_VERIFIED',
          message: `Debes verificar tu email antes de ${actionName}`,
          data: {
            action: actionName,
            canResendVerification: true
          }
        });
      }

      next();
    } catch (error) {
      console.error('Error en requireVerificationForAction:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error verificando permisos'
      });
    }
  };
};

export default {
  requireVerifiedEmail,
  checkVerifiedEmail,
  requireVerificationForAction
};