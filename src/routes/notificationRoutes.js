// =====================================================
// RUTAS DE NOTIFICACIONES
// src/routes/notificationRoutes.js
// =====================================================

import express from 'express';
import { body, validationResult } from 'express-validator';
import { 
  sendEmail, 
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendNotificationEmail,
  validateEmailConfig
} from '../services/emailService.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import db from '../config/db.js';

const router = express.Router();

// =====================================================
// ENDPOINT DE PRUEBA BÁSICO
// =====================================================

/**
 * POST /api/notifications/test
 * Envía un email de prueba para verificar configuración de AWS SES
 * Solo disponible para admins o en modo desarrollo
 */
router.post('/test', [
  requireAuth,
  body('email').isEmail().withMessage('Email inválido'),
  body('tipo').optional().isIn(['basico', 'html', 'plantilla']).withMessage('Tipo debe ser: basico, html, o plantilla')
], async (req, res) => {
  try {
    // Validar errores de entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'error',
        errors: errors.array() 
      });
    }

    const { email, tipo = 'basico' } = req.body;

    // Restricción de seguridad: Solo admins en producción
    if (process.env.NODE_ENV === 'production' && req.user.rol !== 'admin_global') {
      return res.status(403).json({ 
        status: 'error',
        message: 'Solo administradores pueden enviar emails de prueba en producción' 
      });
    }

    // Verificar configuración antes de enviar
    const isConfigValid = validateEmailConfig();
    if (!isConfigValid) {
      return res.status(500).json({
        status: 'error',
        message: 'Configuración de AWS SES incompleta. Revisa las variables de entorno.'
      });
    }

    let resultado;

    // Diferentes tipos de prueba
    switch (tipo) {
      case 'basico':
        resultado = await sendEmail(
          email,
          '🧪 Test de AWS SES - Email Básico',
          '<h1>¡Funciona!</h1><p>Este es un email de prueba básico.</p><p>AWS SES está configurado correctamente.</p>'
        );
        break;

      case 'html':
        const htmlComplejo = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px;">
              <h1 style="color: white; margin: 0;">🧪 Test de Email HTML</h1>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px;">Este es un email de prueba con HTML avanzado.</p>
              <ul>
                <li>✅ Estilos CSS funcionando</li>
                <li>✅ Gradientes y colores</li>
                <li>✅ Estructura responsive</li>
              </ul>
              <div style="text-align: center; margin-top: 30px;">
                <a href="https://example.com" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Botón de Prueba
                </a>
              </div>
              <p style="color: #666; font-size: 12px; margin-top: 30px; text-align: center;">
                Email enviado el ${new Date().toLocaleString('es-AR')}
              </p>
            </div>
          </body>
          </html>
        `;
        resultado = await sendEmail(
          email,
          '🎨 Test de AWS SES - Email HTML Avanzado',
          htmlComplejo
        );
        break;

      case 'plantilla':
        // Usar la plantilla de notificación existente
        resultado = await sendNotificationEmail(
          email,
          'Test de Plantilla',
          'Este es un mensaje de prueba usando la plantilla de notificaciones del sistema. Si ves este mensaje, significa que las plantillas están funcionando correctamente.',
          process.env.FRONTEND_URL || 'https://example.com',
          'Ver Dashboard'
        );
        break;

      default:
        return res.status(400).json({
          status: 'error',
          message: 'Tipo de test no válido'
        });
    }

    // Respuesta exitosa
    res.json({
      status: 'success',
      message: '✅ Email de prueba enviado exitosamente',
      data: {
        sentTo: email,
        tipo: tipo,
        messageId: resultado.MessageId,
        timestamp: new Date().toISOString(),
        tester: {
          id: req.user.id,
          nombre: req.user.nombre,
          email: req.user.email
        }
      }
    });

  } catch (error) {
    console.error('❌ Error enviando email de prueba:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Error al enviar email de prueba',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        name: error.name
      } : undefined
    });
  }
});

// =====================================================
// ENDPOINT DE VERIFICACIÓN DE CONFIGURACIÓN
// =====================================================

/**
 * GET /api/notifications/config-status
 * Verifica el estado de la configuración de AWS SES
 */
router.get('/config-status', requireAuth, (req, res) => {
  try {
    // Solo admins pueden ver el estado de configuración
    if (req.user.rol !== 'admin_global' && req.user.rol !== 'admin_institucion') {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permisos para ver esta información'
      });
    }

    const config = {
      sesConfigured: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
      fromEmailSet: !!process.env.SES_FROM_EMAIL,
      region: process.env.AWS_REGION || 'us-east-1',
      frontendUrlSet: !!process.env.FRONTEND_URL,
      environment: process.env.NODE_ENV || 'development'
    };

    const allConfigured = config.sesConfigured && config.fromEmailSet && config.frontendUrlSet;

    res.json({
      status: 'success',
      configured: allConfigured,
      config: config,
      message: allConfigured 
        ? '✅ AWS SES está completamente configurado' 
        : '⚠️ Faltan configuraciones para AWS SES',
      missingVars: [
        !config.sesConfigured && 'AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY',
        !config.fromEmailSet && 'SES_FROM_EMAIL',
        !config.frontendUrlSet && 'FRONTEND_URL'
      ].filter(Boolean)
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error al verificar configuración'
    });
  }
});

// =====================================================
// ENDPOINT DE ESTADÍSTICAS DE EMAILS
// =====================================================

/**
 * GET /api/notifications/stats
 * Obtiene estadísticas de emails enviados
 */
router.get('/stats', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion'])
], async (req, res) => {
  try {
    const { periodo = '30' } = req.query; // días

    // Estadísticas generales
    const [stats] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN estado = 'enviado' THEN 1 ELSE 0 END) as enviados,
        SUM(CASE WHEN estado = 'fallido' THEN 1 ELSE 0 END) as fallidos,
        tipo
      FROM email_logs
      WHERE fecha_envio >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY tipo
    `, [periodo]);

    // Emails por día
    const [porDia] = await db.execute(`
      SELECT 
        DATE(fecha_envio) as fecha,
        COUNT(*) as total,
        SUM(CASE WHEN estado = 'enviado' THEN 1 ELSE 0 END) as enviados,
        SUM(CASE WHEN estado = 'fallido' THEN 1 ELSE 0 END) as fallidos
      FROM email_logs
      WHERE fecha_envio >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(fecha_envio)
      ORDER BY fecha DESC
    `, [periodo]);

    // Últimos 10 emails enviados
    const [recientes] = await db.execute(`
      SELECT 
        id,
        email,
        tipo,
        asunto,
        estado,
        fecha_envio,
        aws_message_id
      FROM email_logs
      ORDER BY fecha_envio DESC
      LIMIT 10
    `);

    res.json({
      status: 'success',
      periodo: `${periodo} días`,
      estadisticas: {
        porTipo: stats,
        porDia: porDia,
        recientes: recientes
      },
      resumen: {
        total: stats.reduce((acc, s) => acc + s.total, 0),
        enviados: stats.reduce((acc, s) => acc + s.enviados, 0),
        fallidos: stats.reduce((acc, s) => acc + s.fallidos, 0),
        tasaExito: (stats.reduce((acc, s) => acc + s.enviados, 0) / stats.reduce((acc, s) => acc + s.total, 0) * 100).toFixed(2) + '%'
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener estadísticas'
    });
  }
});

// =====================================================
// ENDPOINT PARA REENVIAR EMAIL FALLIDO
// =====================================================

/**
 * POST /api/notifications/retry/:logId
 * Reintenta enviar un email que falló
 */
router.post('/retry/:logId', [
  requireAuth,
  requireRole(['admin_global'])
], async (req, res) => {
  try {
    const { logId } = req.params;

    // Buscar el email fallido
    const [logs] = await db.execute(
      'SELECT * FROM email_logs WHERE id = ? AND estado = "fallido"',
      [logId]
    );

    if (logs.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Email no encontrado o no está en estado fallido'
      });
    }

    const log = logs[0];

    // Reintentar envío
    const resultado = await sendEmail(
      log.email,
      log.asunto,
      '<p>Este es un reenvío de un email previo que falló.</p>'
    );

    res.json({
      status: 'success',
      message: 'Email reenviado exitosamente',
      data: {
        originalLogId: logId,
        newMessageId: resultado.MessageId
      }
    });

  } catch (error) {
    console.error('Error reenviando email:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al reenviar email',
      error: error.message
    });
  }
});

// =====================================================
// MANEJO DE ERRORES
// =====================================================

router.use((error, req, res, next) => {
  console.error('Error en rutas de notificaciones:', error);
  
  res.status(500).json({
    status: 'error',
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

export default router;