// =====================================================
// MIDDLEWARE SIMPLE DE MANEJO DE ERRORES
// src/middleware/errorHandler.js
// =====================================================

// Manejo simple de errores para empezar
export const errorHandler = (error, req, res, next) => {
  const timestamp = new Date().toISOString();
  
  // Log del error
  console.error('\n❌ =======================================');
  console.error(`   ERROR: ${timestamp}`);
  console.error('❌ =======================================');
  console.error(`📍 Endpoint: ${req.method} ${req.originalUrl}`);
  console.error(`📝 Message: ${error.message}`);
  console.error(`🔢 Status: ${error.statusCode || error.status || 500}`);
  
  if (process.env.NODE_ENV === 'development') {
    console.error(`📚 Stack: ${error.stack}`);
  }
  console.error('❌ =======================================\n');
  
  // Determinar código de estado
  let statusCode = 500;
  let message = 'Error interno del servidor';
  
  if (error.statusCode || error.status) {
    statusCode = error.statusCode || error.status;
    message = error.message;
  } else if (error.code) {
    // Errores de base de datos
    switch (error.code) {
      case 'ER_DUP_ENTRY':
        statusCode = 409;
        message = 'Ya existe un registro con estos datos';
        break;
      case 'ER_NO_REFERENCED_ROW_2':
        statusCode = 400;
        message = 'Referencia a un registro que no existe';
        break;
      case 'ECONNREFUSED':
        statusCode = 503;
        message = 'No se puede conectar a la base de datos';
        break;
      default:
        message = error.message || 'Error de base de datos';
    }
  } else if (error.name) {
    // Errores de JWT
    if (error.name.includes('JWT') || error.name === 'JsonWebTokenError') {
      statusCode = 401;
      message = 'Token inválido';
    } else if (error.name === 'TokenExpiredError') {
      statusCode = 401;
      message = 'Token expirado';
    }
  } else if (error.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'JSON inválido en el cuerpo de la petición';
  }
  
  // Respuesta
  const response = {
    status: 'error',
    message,
    timestamp,
    path: req.originalUrl,
    method: req.method
  };
  
  // En desarrollo, incluir más detalles
  if (process.env.NODE_ENV === 'development') {
    response.details = {
      originalMessage: error.message,
      code: error.code,
      name: error.name
    };
  }
  
  res.status(statusCode).json(response);
};

// Wrapper para capturar errores async
export const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};