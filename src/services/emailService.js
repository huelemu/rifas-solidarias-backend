// =====================================================
// SERVICIO COMPLETO DE EMAIL CON AWS SES
// src/services/emailService.js
// =====================================================

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import crypto from 'crypto';
import db from '../config/db.js';

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
// FUNCIONES PRINCIPALES
// =====================================================

export const sendEmail = async (to, subject, html, text = null) => {
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
    await logEmailSent(to, subject, 'enviado', result.MessageId);
    
    return result;
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    
    // Registrar error en logs
    await logEmailSent(to, subject, 'fallido', null, error.message);
    
    throw error;
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
  validateEmailConfig
};