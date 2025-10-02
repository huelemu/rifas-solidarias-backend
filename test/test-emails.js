// =====================================================
// SCRIPT DE PRUEBA DE EMAILS
// test/test-emails.js
// =====================================================

import 'dotenv/config';
import { 
  sendEmail, 
  sendVerificationEmail, 
  sendPasswordResetEmail,
  sendNotificationEmail,
  validateEmailConfig
} from '../src/services/emailService.js';

// =====================================================
// CONFIGURACIÓN
// =====================================================

const TEST_EMAIL = process.env.TEST_EMAIL || 'tu-email@ejemplo.com';
const TEST_USER_ID = 999; // ID ficticio para pruebas

console.log(`

  
╔════════════════════════════════════════════════════════════╗
║          🧪 SCRIPT DE PRUEBA DE EMAILS AWS SES             ║
╚════════════════════════════════════════════════════════════╝
`);

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

const logTest = (nombre, exito, detalle = '') => {
  testResults.total++;
  if (exito) {
    testResults.passed++;
    console.log(`✅ ${nombre}`);
    if (detalle) console.log(`   └─ ${detalle}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${nombre}`);
    if (detalle) console.log(`   └─ ${detalle}`);
  }
  testResults.tests.push({ nombre, exito, detalle });
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// =====================================================
// TESTS
// =====================================================

const runEmailTests = async () => {
  try {
    console.log('📋 Iniciando pruebas de emails...\n');

    // =====================================================
    // 1. VERIFICAR CONFIGURACIÓN
    // =====================================================
    
    console.log('1️⃣  Verificando configuración de AWS SES...');
    
    const hasAccessKey = !!process.env.AWS_ACCESS_KEY_ID;
    const hasSecretKey = !!process.env.AWS_SECRET_ACCESS_KEY;
    const hasFromEmail = !!process.env.SES_FROM_EMAIL;
    const hasRegion = !!process.env.AWS_REGION;
    const hasFrontendUrl = !!process.env.FRONTEND_URL;

    logTest('AWS_ACCESS_KEY_ID', hasAccessKey, hasAccessKey ? '✓ Configurado' : '✗ Falta configurar');
    logTest('AWS_SECRET_ACCESS_KEY', hasSecretKey, hasSecretKey ? '✓ Configurado' : '✗ Falta configurar');
    logTest('SES_FROM_EMAIL', hasFromEmail, hasFromEmail ? `✓ ${process.env.SES_FROM_EMAIL}` : '✗ Falta configurar');
    logTest('AWS_REGION', hasRegion, `${process.env.AWS_REGION || 'us-east-1 (default)'}`);
    logTest('FRONTEND_URL', hasFrontendUrl, hasFrontendUrl ? `✓ ${process.env.FRONTEND_URL}` : '⚠️ No configurado (opcional)');

    const configValida = validateEmailConfig();
    
    if (!configValida) {
      console.log('\n❌ La configuración de AWS SES está incompleta.');
      console.log('   Por favor, revisa tu archivo .env y asegúrate de tener:');
      console.log('   - AWS_ACCESS_KEY_ID');
      console.log('   - AWS_SECRET_ACCESS_KEY');
      console.log('   - SES_FROM_EMAIL');
      console.log('\n⚠️  Los siguientes tests no se ejecutarán.\n');
      return testResults;
    }

    console.log('\n✅ Configuración válida, continuando con los tests...\n');

    // Esperar un poco entre tests para no saturar AWS SES
    await sleep(1000);

    // =====================================================
    // 2. EMAIL BÁSICO DE TEXTO
    // =====================================================
    
    console.log('2️⃣  Test de email básico...');
    
    try {
      const resultado1 = await sendEmail(
        TEST_EMAIL,
        '🧪 Test 1: Email Básico',
        '<h1>Test de Email Básico</h1><p>Este es un email de prueba simple sin formato complejo.</p>'
      );
      
      logTest('Email básico enviado', !!resultado1.MessageId, `MessageId: ${resultado1.MessageId}`);
    } catch (error) {
      logTest('Email básico enviado', false, `Error: ${error.message}`);
    }

    await sleep(2000);

    // =====================================================
    // 3. EMAIL CON HTML COMPLEJO
    // =====================================================
    
    console.log('\n3️⃣  Test de email con HTML avanzado...');
    
    try {
      const htmlAvanzado = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎨 Test de HTML Avanzado</h1>
          </div>
          
          <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Características Probadas:</h2>
            
            <ul style="line-height: 1.8;">
              <li>✅ Gradientes CSS</li>
              <li>✅ Sombras y bordes redondeados</li>
              <li>✅ Tipografía responsive</li>
              <li>✅ Estilos inline</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://example.com" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 25px; 
                        display: inline-block; 
                        font-weight: bold;">
                🚀 Botón de Prueba
              </a>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 30px;">
              <tr>
                <td style="border: 1px solid #ddd; padding: 10px;"><strong>Fecha:</strong></td>
                <td style="border: 1px solid #ddd; padding: 10px;">${new Date().toLocaleString('es-AR')}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 10px;"><strong>Test:</strong></td>
                <td style="border: 1px solid #ddd; padding: 10px;">Email HTML Avanzado</td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 10px;"><strong>Estado:</strong></td>
                <td style="border: 1px solid #ddd; padding: 10px;">✅ Enviado</td>
              </tr>
            </table>
            
            <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
              Este es un email de prueba del sistema de notificaciones.<br>
              AWS SES está funcionando correctamente.
            </p>
          </div>
        </body>
        </html>
      `;

      const resultado2 = await sendEmail(
        TEST_EMAIL,
        '🎨 Test 2: Email HTML Avanzado',
        htmlAvanzado
      );
      
      logTest('Email HTML avanzado enviado', !!resultado2.MessageId, `MessageId: ${resultado2.MessageId}`);
    } catch (error) {
      logTest('Email HTML avanzado enviado', false, `Error: ${error.message}`);
    }

    await sleep(2000);

    // =====================================================
    // 4. EMAIL DE VERIFICACIÓN
    // =====================================================
    
    console.log('\n4️⃣  Test de email de verificación...');
    
    try {
      await sendVerificationEmail(TEST_EMAIL, 'Usuario Test', TEST_USER_ID);
      logTest('Email de verificación enviado', true, 'Plantilla de verificación utilizada');
    } catch (error) {
      logTest('Email de verificación enviado', false, `Error: ${error.message}`);
    }

    await sleep(2000);

    // =====================================================
    // 5. EMAIL DE RESET DE CONTRASEÑA
    // =====================================================
    
    console.log('\n5️⃣  Test de email de reset de contraseña...');
    
    try {
      await sendPasswordResetEmail(TEST_EMAIL, 'Usuario Test', TEST_USER_ID);
      logTest('Email de reset de contraseña enviado', true, 'Plantilla de reset utilizada');
    } catch (error) {
      logTest('Email de reset de contraseña enviado', false, `Error: ${error.message}`);
    }

    await sleep(2000);

    // =====================================================
    // 6. EMAIL DE NOTIFICACIÓN SIMPLE
    // =====================================================
    
    console.log('\n6️⃣  Test de email de notificación...');
    
    try {
      await sendNotificationEmail(
        TEST_EMAIL,
        'Notificación de Prueba',
        'Este es un mensaje de notificación del sistema. Si estás leyendo esto, significa que el sistema de notificaciones está funcionando correctamente.',
        null,
        null
      );
      logTest('Email de notificación simple enviado', true, 'Sin botón de acción');
    } catch (error) {
      logTest('Email de notificación simple enviado', false, `Error: ${error.message}`);
    }

    await sleep(2000);

    // =====================================================
    // 7. EMAIL DE NOTIFICACIÓN CON BOTÓN
    // =====================================================
    
    console.log('\n7️⃣  Test de email de notificación con acción...');
    
    try {
      await sendNotificationEmail(
        TEST_EMAIL,
        'Notificación con Acción',
        'Esta notificación incluye un botón de acción. Haz click en el botón para probar la funcionalidad completa.',
        process.env.FRONTEND_URL || 'https://example.com',
        'Ver Dashboard'
      );
      logTest('Email de notificación con botón enviado', true, 'Con botón de acción incluido');
    } catch (error) {
      logTest('Email de notificación con botón enviado', false, `Error: ${error.message}`);
    }

    await sleep(2000);

    // =====================================================
    // 8. TEST DE EMAIL CON CARACTERES ESPECIALES
    // =====================================================
    
    console.log('\n8️⃣  Test de email con caracteres especiales...');
    
    try {
      const resultado8 = await sendEmail(
        TEST_EMAIL,
        '🎯 Test 3: Caracteres Especiales - ñ, á, é, í, ó, ú',
        `
          <h1>Prueba de Caracteres Especiales</h1>
          <p>Español: ñ, á, é, í, ó, ú, ü, ¿, ¡</p>
          <p>Símbolos: © ® ™ € $ £ ¥</p>
          <p>Emojis: 🎉 🚀 ✅ ❌ 🔥 💡</p>
          <p>Matemáticos: ∞ ≈ ≠ ± ÷ ×</p>
        `
      );
      logTest('Email con caracteres especiales', !!resultado8.MessageId, 'Codificación UTF-8 funcionando');
    } catch (error) {
      logTest('Email con caracteres especiales', false, `Error: ${error.message}`);
    }

    // =====================================================
    // RESUMEN FINAL
    // =====================================================
    
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    📊 RESUMEN DE TESTS                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`✅ Tests exitosos: ${testResults.passed}/${testResults.total}`);
    console.log(`❌ Tests fallidos: ${testResults.failed}/${testResults.total}`);
    console.log(`📈 Tasa de éxito: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    console.log('');

    if (testResults.failed === 0) {
      console.log('🎉 ¡TODOS LOS TESTS PASARON!');
      console.log('✅ AWS SES está completamente funcional');
      console.log(`📧 Revisa tu bandeja de entrada en: ${TEST_EMAIL}`);
      console.log('');
      console.log('Próximos pasos:');
      console.log('1. Verificar que recibiste todos los emails');
      console.log('2. Revisar el formato y diseño de cada email');
      console.log('3. Probar los links y botones en los emails');
      console.log('4. Integrar las funciones en tus rutas de API');
    } else {
      console.log('⚠️  Algunos tests fallaron.');
      console.log('📝 Revisa los errores arriba y verifica:');
      console.log('1. Las credenciales de AWS son correctas');
      console.log('2. El email FROM está verificado en AWS SES');
      console.log('3. No estás en sandbox mode (o el TEST_EMAIL está verificado)');
      console.log('4. Los límites de envío de AWS no se excedieron');
    }

    console.log('');
    console.log('════════════════════════════════════════════════════════════');
    console.log('');

  } catch (error) {
    console.error('❌ Error crítico en los tests:', error);
    process.exit(1);
  }

  return testResults;
};

// =====================================================
// EJECUTAR TESTS
// =====================================================

console.log('⚙️  Configuración:');
console.log(`   Email de destino: ${TEST_EMAIL}`);
console.log(`   Región AWS: ${process.env.AWS_REGION || 'us-east-1 (default)'}`);
console.log(`   Email FROM: ${process.env.SES_FROM_EMAIL || '❌ No configurado'}`);
console.log('');

if (TEST_EMAIL === 'tu-email@ejemplo.com') {
  console.log('⚠️  IMPORTANTE: Configura TEST_EMAIL en tu .env o como variable de entorno');
  console.log('   Ejemplo: export TEST_EMAIL="tu-email-verificado@dominio.com"');
  console.log('');
  process.exit(1);
}

runEmailTests()
  .then(results => {
    if (results.failed > 0) {
      process.exit(1);
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });