// =====================================================
// RUTAS DE NOTIFICACIONES (ACTUALIZADO)
// src/routes/notificationRoutes.js
// =====================================================

import express from 'express';
import { body, validationResult } from 'express-validator';
import { requireAuth, requireRole } from '../middleware/auth.js';
import db from '../config/db.js';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const router = express.Router();

// =====================================================
// CONFIGURACIÓN DE AWS SES
// =====================================================

const hasAWSConfig = process.env.AWS_ACCESS_KEY_ID && 
                    process.env.AWS_SECRET_ACCESS_KEY && 
                    process.env.SES_FROM_EMAIL;

const sesClient = hasAWSConfig ? new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
}) : null;

// Función auxiliar para enviar emails de prueba
const sendTestEmail = async (to, subject, html) => {
  if (!sesClient) {
    throw new Error('AWS SES no configurado');
  }

  const params = {
    Source: process.env.SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [to]
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: html,
          Charset: 'UTF-8'
        }
      }
    }
  };

  const command = new SendEmailCommand(params);
  return await sesClient.send(command);
};

// =====================================================
// ENDPOINT DE PRUEBA DE EMAIL
// =====================================================

/**
 * POST /api/notifications/test
 * Envía un email de prueba
 */
router.post('/test', [
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  body('email').isEmail().withMessage('Email inválido'),
  body('tipo').optional().isIn(['basico', 'html']).withMessage('Tipo debe ser: basico o html')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'error',
        errors: errors.array() 
      });
    }

    const { email, tipo = 'basico' } = req.body;

    if (!hasAWSConfig) {
      return res.status(500).json({
        status: 'error',
        message: 'AWS SES no está configurado. Verifica las variables de entorno.'
      });
    }

    let subject, html;

    if (tipo === 'basico') {
      subject = '🧪 Test Básico - AWS SES';
      html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>✅ Test de Email Básico</h1>
          <p>Este es un email de prueba simple.</p>
          <p>Si ves este mensaje, significa que AWS SES está funcionando correctamente.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Email enviado por: ${req.user.nombre} (${req.user.email})<br>
            Fecha: ${new Date().toLocaleString('es-AR')}
          </p>
        </div>
      `;
    } else {
      subject = '🎨 Test Completo - AWS SES';
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="margin: 0; padding: 0; background: #f4f4f4;">
          <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">✅ Test Completo</h1>
            </div>
            <div style="padding: 40px 30px;">
              <h2 style="color: #333;">AWS SES funcionando correctamente</h2>
              <p style="color: #666; line-height: 1.6;">
                Este es un email de prueba con formato HTML completo.
              </p>
              <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">📋 Información del test</h3>
                <ul style="list-style: none; padding: 0;">
                  <li><strong>Enviado por:</strong> ${req.user.nombre}</li>
                  <li><strong>Email:</strong> ${req.user.email}</li>
                  <li><strong>Fecha:</strong> ${new Date().toLocaleString('es-AR')}</li>
                  <li><strong>Región AWS:</strong> ${process.env.AWS_REGION || 'us-east-1'}</li>
                </ul>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}" 
                   style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Ir al Dashboard
                </a>
              </div>
            </div>
            <div style="background: #f7fafc; padding: 20px; text-align: center;">
              <p style="color: #a0aec0; font-size: 12px; margin: 0;">
                Rifas Solidarias - Sistema de Gestión de Rifas<br>
                Este es un email automático de prueba
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    const resultado = await sendTestEmail(email, subject, html);

    res.json({
      status: 'success',
      message: '✅ Email de prueba enviado exitosamente',
      data: {
        sentTo: email,
        tipo: tipo,
        messageId: resultado.MessageId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error enviando email de prueba:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Error al enviar email de prueba',
      error: error.message
    });
  }
});

// =====================================================
// VERIFICACIÓN DE CONFIGURACIÓN
// =====================================================

/**
 * GET /api/notifications/config-status
 * Verifica el estado de AWS SES
 */
router.get('/config-status', requireAuth, (req, res) => {
  try {
    if (!['admin_global', 'admin_institucion'].includes(req.user.rol)) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permisos para ver esta información'
      });
    }

    const config = {
      sesConfigured: hasAWSConfig,
      fromEmailSet: !!process.env.SES_FROM_EMAIL,
      region: process.env.AWS_REGION || 'us-east-1',
      frontendUrlSet: !!process.env.FRONTEND_URL,
      environment: process.env.NODE_ENV || 'development'
    };

    const allConfigured = config.sesConfigured && config.fromEmailSet;

    res.json({
      status: 'success',
      configured: allConfigured,
      config: config,
      message: allConfigured 
        ? '✅ AWS SES está completamente configurado' 
        : '⚠️ Faltan configuraciones para AWS SES',
      missingVars: [
        !config.sesConfigured && 'AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY',
        !config.fromEmailSet && 'SES_FROM_EMAIL'
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
// ESTADÍSTICAS DE EMAILS
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
    const { periodo = '30' } = req.query;

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

    res.json({
      status: 'success',
      data: {
        por_tipo: stats,
        por_dia: porDia,
        periodo_dias: parseInt(periodo)
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener estadísticas'
    });
  }
});

export default router;