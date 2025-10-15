// =====================================================
// SERVICIO COMPLETO DE EMAIL CON AWS SES
// src/services/emailService.js
// =====================================================

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import crypto from 'crypto';
import db from '../config/db.js';
import { EMAIL_CONFIG } from '../config/reservas.config.js';

// =====================================================
// CONFIGURACIÓN DE AWS SES
// =====================================================

// Verificar configuración
const hasAWSConfig = process.env.AWS_ACCESS_KEY_ID && 
                    process.env.AWS_SECRET_ACCESS_KEY && 
                    process.env.SES_FROM_EMAIL;

if (!hasAWSConfig) {
  console.warn('⚠️ AWS SES no configurado. Revisa AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY y SES_FROM_EMAIL');
}

// Configurar cliente SES
const sesClient = hasAWSConfig ? new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
}) : null;

// =====================================================
// PLANTILLAS DE EMAIL
// =====================================================

const emailTemplates = {
  verification: {
    subject: '🔐 Verifica tu cuenta',
    html: (nombre, verificationUrl) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Verificación de Email</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">¡Bienvenido ${nombre}! 🎉</h1>
        </div>
        
        <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 18px; margin-bottom: 30px;">
            Gracias por registrarte. Para completar tu registro y acceder a todas las funcionalidades, por favor verifica tu email haciendo clic en el botón de abajo:
          </p>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="${verificationUrl}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      display: inline-block; 
                      font-weight: bold; 
                      font-size: 16px;
                      transition: transform 0.2s;">
              ✅ Verificar Email
            </a>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <p style="margin: 0; font-size: 14px; color: #666;">
              <strong>¿No puedes hacer clic en el botón?</strong><br>
              Copia y pega este enlace en tu navegador:<br>
              <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
            </p>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              ⏰ Este enlace expira en 24 horas por motivos de seguridad.<br>
              Si no solicitaste esta verificación, puedes ignorar este email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: (nombre, verificationUrl) => `
      ¡Bienvenido ${nombre}!
      
      Gracias por registrarte. Para completar tu registro, por favor verifica tu email visitando:
      ${verificationUrl}
      
      Este enlace expira en 24 horas.
      Si no solicitaste esta verificación, puedes ignorar este email.
    `
  },
  
  passwordReset: {
    subject: '🔑 Restablecer contraseña',
    html: (nombre, resetUrl) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Restablecer Contraseña</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🔑 Restablecer Contraseña</h1>
        </div>
        
        <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 18px; margin-bottom: 20px;">Hola ${nombre},</p>
          
          <p style="font-size: 16px; margin-bottom: 30px;">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón de abajo para crear una nueva contraseña:
          </p>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="${resetUrl}" 
               style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      display: inline-block; 
                      font-weight: bold; 
                      font-size: 16px;">
              🔄 Restablecer Contraseña
            </a>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 30px 0;">
            <p style="margin: 0; font-size: 14px; color: #856404;">
              ⚠️ <strong>Importante:</strong> Este enlace expira en 1 hora por motivos de seguridad.
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">
            Si no solicitaste este cambio, puedes ignorar este email de forma segura. Tu contraseña no será cambiada.
          </p>
        </div>
      </body>
      </html>
    `
  },
  
  welcome: {
    subject: '🎉 ¡Bienvenido a la plataforma!',
    html: (nombre) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Bienvenido</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">¡Bienvenido ${nombre}! 🚀</h1>
        </div>
        
        <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 18px; margin-bottom: 30px;">
            ¡Tu cuenta ha sido verificada exitosamente! Ya puedes acceder a todas las funcionalidades de la plataforma.
          </p>
          
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; margin: 30px 0;">
            <h3 style="color: white; margin-top: 0; font-size: 20px;">🎯 Próximos pasos:</h3>
            <ul style="color: white; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 10px;">Completa tu perfil con información adicional</li>
              <li style="margin-bottom: 10px;">Explora las funcionalidades disponibles</li>
              <li style="margin-bottom: 10px;">Conecta con otros usuarios</li>
              <li>Contacta soporte si necesitas ayuda</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/dashboard" 
               style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      display: inline-block; 
                      font-weight: bold; 
                      font-size: 16px;">
              🏁 Comenzar
            </a>
          </div>
          
          <p style="color: #666; text-align: center; margin-top: 30px;">
            ¡Gracias por unirte a nosotros! Estamos aquí para ayudarte en todo momento.
          </p>
        </div>
      </body>
      </html>
    `
  },

  notification: {
    subject: (tipo) => `🔔 ${tipo}`,
    html: (titulo, mensaje, actionUrl = null, actionText = null) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Notificación</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #8b4513; margin: 0; font-size: 24px;">🔔 ${titulo}</h1>
        </div>
        
        <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; margin-bottom: 30px;">${mensaje}</p>
          
          ${actionUrl && actionText ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${actionUrl}" 
                 style="background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); 
                        color: #8b4513; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 25px; 
                        display: inline-block; 
                        font-weight: bold; 
                        font-size: 16px;">
                ${actionText}
              </a>
            </div>
          ` : ''}
          
          <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">
            Gracias por usar nuestra plataforma.
          </p>
        </div>
      </body>
      </html>
    `
  }
};


// =====================================================
// VERIFICACIÓN DE EMAIL
// =====================================================

export const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

export const saveVerificationToken = async (userId, token) => {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
  
  await db.execute(`
    INSERT INTO email_verifications (usuario_id, token, expires_at)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE 
      token = VALUES(token),
      expires_at = VALUES(expires_at),
      usado = FALSE,
      fecha_creacion = NOW()
  `, [userId, token, expiresAt]);
};

export const sendVerificationEmail = async (email, nombre, userId) => {
  try {
    const token = generateVerificationToken();
    await saveVerificationToken(userId, token);
    
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    
    await sendEmail(
      email,
      emailTemplates.verification.subject,
      emailTemplates.verification.html(nombre, verificationUrl),
      emailTemplates.verification.text(nombre, verificationUrl)
    );
    
    console.log('✅ Email de verificación enviado a:', email);
  } catch (error) {
    console.error('❌ Error enviando email de verificación:', error);
    throw error;
  }
};

export const verifyEmailToken = async (token) => {
  try {
    // SIN TRANSACCIONES - usar query simple
    const [result] = await db.execute(`
      SELECT 
        ev.usuario_id,
        ev.usado,
        ev.expires_at,
        u.email
      FROM email_verifications ev
      JOIN usuarios u ON ev.usuario_id = u.id
      WHERE ev.token = ?
        AND ev.usado = FALSE
        AND ev.expires_at > NOW()
    `, [token]);

    if (result.length === 0) {
      // Token no encontrado, usado o expirado
      const [expiredCheck] = await db.execute(`
        SELECT expires_at FROM email_verifications WHERE token = ?
      `, [token]);

      if (expiredCheck.length === 0) {
        return {
          valid: false,
          message: 'Token inválido',
          expired: false
        };
      }

      return {
        valid: false,
        message: 'Token expirado o ya fue usado',
        expired: true
      };
    }

    const verification = result[0];

    return {
      valid: true,
      userId: verification.usuario_id,
      email: verification.email,
      message: 'Token válido'
    };

  } catch (error) {
    console.error('❌ Error verificando token:', error);
    throw error;
  }
};

// =====================================================
// RESET DE CONTRASEÑA
// =====================================================

export const generatePasswordResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

export const savePasswordResetToken = async (userId, token) => {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
  
  await db.execute(`
    INSERT INTO password_resets (usuario_id, token, expires_at)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE 
      token = VALUES(token),
      expires_at = VALUES(expires_at),
      usado = FALSE,
      fecha_creacion = NOW()
  `, [userId, token, expiresAt]);
};

export const sendPasswordResetEmail = async (email, nombre, userId) => {
  try {
    const token = generatePasswordResetToken();
    await savePasswordResetToken(userId, token);
    
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    
    await sendEmail(
      email,
      emailTemplates.passwordReset.subject,
      emailTemplates.passwordReset.html(nombre, resetUrl)
    );
    
    console.log('✅ Email de reset de contraseña enviado a:', email);
  } catch (error) {
    console.error('❌ Error enviando email de reset:', error);
    throw error;
  }
};

// =====================================================
// NOTIFICACIONES
// =====================================================

export const sendNotificationEmail = async (email, titulo, mensaje, actionUrl = null, actionText = null) => {
  try {
    await sendEmail(
      email,
      emailTemplates.notification.subject(titulo),
      emailTemplates.notification.html(titulo, mensaje, actionUrl, actionText)
    );
    
    console.log('✅ Email de notificación enviado a:', email);
  } catch (error) {
    console.error('❌ Error enviando notificación:', error);
    throw error;
  }
};

// =====================================================
// LOGGING
// =====================================================

const logEmailSent = async (email, asunto, estado, messageId = null, errorMessage = null) => {
  try {
    await db.execute(`
      INSERT INTO email_logs (email, tipo, asunto, estado, aws_message_id, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      email, 
      determineEmailType(asunto), 
      asunto, 
      estado, 
      messageId, 
      errorMessage
    ]);
  } catch (error) {
    console.error('❌ Error guardando log de email:', error);
  }
};

const determineEmailType = (asunto) => {
  if (asunto.toLowerCase().includes('verific')) return 'verification';
  if (asunto.toLowerCase().includes('contraseña') || asunto.toLowerCase().includes('password')) return 'password_reset';
  if (asunto.toLowerCase().includes('bienvenido') || asunto.toLowerCase().includes('welcome')) return 'welcome';
  return 'notification';
};



// =====================================================
// FUNCIÓN BASE PARA ENVIAR EMAILS
// =====================================================

const sendEmail = async (to, subject, html, text = null) => {
  try {
    if (!sesClient) {
      console.warn('⚠️ AWS SES no configurado, simulando envío de email');
      console.log(`📧 [SIMULADO] To: ${to}, Subject: ${subject}`);
      return { MessageId: 'simulated-' + Date.now() };
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

    if (text) {
      params.Message.Body.Text = {
        Data: text,
        Charset: 'UTF-8'
      };
    }

    const command = new SendEmailCommand(params);
    const result = await sesClient.send(command);
    
    console.log('✅ Email enviado:', { messageId: result.MessageId, to });
    
    // Registrar en logs
    await registrarEmailLog({
      tipo: determinarTipoEmail(subject),
      destinatario_email: to,
      destinatario_nombre: null,
      asunto: subject,
      cuerpo: html,
      estado: 'enviado',
      message_id: result.MessageId,
      proveedor: 'aws-ses'
    });
    
    return result;
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    
    // Registrar error en logs
    await registrarEmailLog({
      tipo: determinarTipoEmail(subject),
      destinatario_email: to,
      asunto: subject,
      cuerpo: '',
      estado: 'fallido',
      error_mensaje: error.message,
      proveedor: 'aws-ses'
    });
    
    throw error;
  }
};

// =====================================================
// EMAIL DE CONFIRMACIÓN AL COMPRADOR
// =====================================================

export async function enviarEmailConfirmacionComprador(reserva, rifa, numeros) {
  try {
    const asunto = `✅ Reserva confirmada - Rifa ${rifa.titulo}`;
    
    const cuerpo = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎫 ¡Reserva Confirmada!</h1>
        </div>
        
        <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 18px; margin-bottom: 30px;">
            Hola <strong>${reserva.comprador_nombre}</strong>,
          </p>
          
          <p>Tu reserva ha sido registrada exitosamente.</p>
          
          <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">📋 Detalles de tu reserva</h3>
            <ul style="list-style: none; padding: 0;">
              <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Rifa:</strong> ${rifa.titulo}</li>
              <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Números:</strong> ${numeros.join(', ')}</li>
              <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Cantidad:</strong> ${numeros.length} número(s)</li>
              <li style="padding: 8px 0;"><strong>Monto total:</strong> $${reserva.monto_total.toLocaleString('es-AR')}</li>
            </ul>
          </div>
          
          <div style="background: #fff5f5; border-left: 4px solid #f56565; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold;">⏰ IMPORTANTE:</p>
            <p style="margin: 10px 0 0 0;">
              Tu reserva expira el <strong>${new Date(reserva.fecha_expiracion).toLocaleString('es-AR')}</strong>
            </p>
            <p style="margin: 5px 0 0 0;">
              Tienes <strong>1 hora</strong> para coordinar el pago con el vendedor.
            </p>
          </div>
          
          <h3 style="color: #667eea;">📞 Próximos pasos</h3>
          <ol style="padding-left: 20px;">
            <li style="margin-bottom: 10px;">El vendedor/institución te contactará en breve</li>
            <li style="margin-bottom: 10px;">Coordinen el método de pago</li>
            <li>Una vez confirmado el pago, tus números serán marcados como vendidos</li>
          </ol>
          
          ${reserva.whatsapp_link ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${reserva.whatsapp_link}" 
               style="background: #25D366; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              💬 Contactar por WhatsApp
            </a>
          </div>
          ` : ''}
          
          <p style="color: #718096; font-size: 14px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            Si no realizaste esta reserva, puedes ignorar este email. La reserva expirará automáticamente.
          </p>
          
          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #a0aec0; font-size: 12px; margin: 0;">
              Rifas Solidarias - Sistema de Gestión de Rifas<br>
              Este es un email automático, por favor no responder.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const result = await sendEmail(reserva.comprador_email, asunto, cuerpo);
    
    // Actualizar registro de reserva
    await db.execute(
      'UPDATE historial_reservas SET email_enviado_comprador = TRUE WHERE id = ?',
      [reserva.id]
    );
    
    console.log('✅ Email enviado al comprador:', reserva.comprador_email);
    return true;
    
  } catch (error) {
    console.error('❌ Error enviando email al comprador:', error);
    return false;
  }
}

// =====================================================
// EMAIL DE NOTIFICACIÓN AL VENDEDOR
// =====================================================

export async function enviarEmailNotificacionVendedor(reserva, rifa, numeros, vendedor) {
  try {
    const asunto = `🔔 Nueva reserva - Rifa ${rifa.titulo}`;
    
    const minutosRestantes = Math.round((new Date(reserva.fecha_expiracion) - new Date()) / 60000);
    
    const cuerpo = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎫 Nueva Reserva</h1>
        </div>
        
        <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 18px; margin-bottom: 30px;">
            Hola <strong>${vendedor.nombre}</strong>,
          </p>
          
          <p>Tienes una nueva reserva pendiente de confirmación.</p>
          
          <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">📋 Detalles de la reserva</h3>
            <ul style="list-style: none; padding: 0;">
              <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Rifa:</strong> ${rifa.titulo}</li>
              <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Números:</strong> ${numeros.join(', ')}</li>
              <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Cantidad:</strong> ${numeros.length} número(s)</li>
              <li style="padding: 8px 0;"><strong>Monto:</strong> $${reserva.monto_total.toLocaleString('es-AR')}</li>
            </ul>
          </div>
          
          <div style="background: #fffaf0; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">👤 Datos del comprador</h3>
            <ul style="list-style: none; padding: 0;">
              <li style="padding: 8px 0;"><strong>Nombre:</strong> ${reserva.comprador_nombre}</li>
              <li style="padding: 8px 0;"><strong>Email:</strong> ${reserva.comprador_email}</li>
              ${reserva.comprador_telefono ? `<li style="padding: 8px 0;"><strong>Teléfono:</strong> ${reserva.comprador_telefono}</li>` : ''}
            </ul>
          </div>
          
          <div style="background: #fff5f5; border-left: 4px solid #f56565; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold;">⏰ Tiempo restante:</p>
            <p style="margin: 10px 0 0 0; font-size: 24px; color: #f56565;">
              <strong>${minutosRestantes} minutos</strong>
            </p>
            <p style="margin: 5px 0 0 0; font-size: 14px;">
              Expira: ${new Date(reserva.fecha_expiracion).toLocaleString('es-AR')}
            </p>
          </div>
          
          <h3 style="color: #667eea;">📞 Acciones requeridas</h3>
          <ol style="padding-left: 20px;">
            <li style="margin-bottom: 10px;">Contacta al comprador lo antes posible</li>
            <li style="margin-bottom: 10px;">Coordina el método y lugar de pago</li>
            <li>Una vez recibido el pago, confirma la venta en el sistema</li>
          </ol>
          
          <div style="text-align: center; margin: 30px 0;">
            ${reserva.whatsapp_link ? `
            <a href="${reserva.whatsapp_link}" 
               style="background: #25D366; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block; margin: 5px;">
              💬 Contactar por WhatsApp
            </a>
            ` : ''}
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/rifas/${rifa.id}/reservas" 
               style="background: #667eea; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block; margin: 5px;">
              👁️ Ver en el sistema
            </a>
          </div>
          
          <p style="color: #718096; font-size: 14px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <strong>Importante:</strong> Si no confirmas la venta antes de que expire la reserva, 
            los números volverán a estar disponibles automáticamente.
          </p>
          
          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #a0aec0; font-size: 12px; margin: 0;">
              Rifas Solidarias - Panel de Vendedor<br>
              Este es un email automático, por favor no responder.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const result = await sendEmail(vendedor.email, asunto, cuerpo);
    
    // Actualizar registro de reserva
    await db.execute(
      'UPDATE historial_reservas SET email_enviado_vendedor = TRUE WHERE id = ?',
      [reserva.id]
    );
    
    console.log('✅ Email enviado al vendedor:', vendedor.email);
    return true;
    
  } catch (error) {
    console.error('❌ Error enviando email al vendedor:', error);
    return false;
  }
}

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

async function registrarEmailLog(datos) {
  try {
    await db.execute(`
      INSERT INTO email_logs (
        usuario_id,
        email,
        tipo,
        asunto,
        estado,
        aws_message_id,
        error_message,
        fecha_envio
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      datos.usuario_id || null,
      datos.destinatario_email,        // → email
      datos.tipo || 'notification',
      datos.asunto,
      datos.estado || 'enviado',
      datos.message_id || null,        // → aws_message_id
      datos.error_mensaje || null,     // → error_message
    ]);
  } catch (error) {
    console.error('❌ Error guardando log de email:', error.message);
    // No lanzar error para no interrumpir el flujo principal
  }
}

function determinarTipoEmail(asunto) {
  const asuntoLower = asunto.toLowerCase();
  if (asuntoLower.includes('reserva') && asuntoLower.includes('confirm')) return 'verification'; // Usar tipos que ya existen
  if (asuntoLower.includes('nueva reserva')) return 'notification';
  if (asuntoLower.includes('venta')) return 'notification';
  if (asuntoLower.includes('rechaz')) return 'notification';
  if (asuntoLower.includes('expir')) return 'notification';
  if (asuntoLower.includes('verific')) return 'verification';
  if (asuntoLower.includes('contraseña') || asuntoLower.includes('password')) return 'password_reset';
  if (asuntoLower.includes('bienvenido') || asuntoLower.includes('welcome')) return 'welcome';
  return 'notification';
}

export function verificarConfiguracionEmail() {
  return hasAWSConfig;
}


// =====================================================
// VALIDAR CONFIGURACIÓN
// =====================================================

export const validateEmailConfig = () => {
  const errors = [];

  if (!process.env.SES_FROM_EMAIL) {
    errors.push('SES_FROM_EMAIL no configurado');
  }

  if (!process.env.AWS_ACCESS_KEY_ID) {
    errors.push('AWS_ACCESS_KEY_ID no configurado');
  }

  if (!process.env.AWS_SECRET_ACCESS_KEY) {
    errors.push('AWS_SECRET_ACCESS_KEY no configurado');
  }

  if (errors.length > 0) {
    console.warn('⚠️ Configuración de AWS SES incompleta:');
    errors.forEach(error => console.warn(`  - ${error}`));
    return false;
  }

  console.log('✅ Configuración de AWS SES válida');
  return true;
};

// Validar configuración al importar
validateEmailConfig();

export default {
  sendEmail,
  sendVerificationEmail,
  verifyEmailToken,
  sendPasswordResetEmail,
  sendNotificationEmail,
  generateVerificationToken,
  enviarEmailConfirmacionComprador,
  enviarEmailNotificacionVendedor,
  verificarConfiguracionEmail,
  validateEmailConfig
};