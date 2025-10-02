// test/test-emails-fixed.js
import {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendNotificationEmail,
} from '../src/services/emailService.js';
import db from '../src/config/db.js';

// ⚠️ CAMBIA ESTO POR TU EMAIL REAL
const TEST_EMAIL = 'juan.lacy@gmai.com';

/**
 * Helper para crear un usuario temporal de prueba
 */
async function createTestUser() {
  try {
    const [result] = await db.execute(
      `INSERT INTO usuarios (nombre, apellido, email, password, email_verificado) 
       VALUES (?, ?, ?, ?, ?)`,
      ['Test', 'Usuario', TEST_EMAIL, 'dummy_hash_12345', true]
    );
    console.log(`✅ Usuario temporal creado con ID: ${result.insertId}`);
    return result.insertId;
  } catch (error) {
    // Si el usuario ya existe, obtener su ID
    if (error.code === 'ER_DUP_ENTRY') {
      const [rows] = await db.execute(
        'SELECT id FROM usuarios WHERE email = ?',
        [TEST_EMAIL]
      );
      if (rows.length > 0) {
        console.log(`✅ Usando usuario existente con ID: ${rows[0].id}`);
        return rows[0].id;
      }
    }
    throw error;
  }
}

/**
 * Helper para limpiar usuario temporal
 */
async function cleanupTestUser(userId) {
  try {
    // Las foreign keys con CASCADE eliminarán automáticamente los registros relacionados
    await db.execute('DELETE FROM usuarios WHERE id = ?', [userId]);
    console.log(`✅ Usuario temporal ID:${userId} eliminado`);
  } catch (error) {
    console.error(`⚠️  No se pudo eliminar usuario ID:${userId}:`, error.message);
  }
}

/**
 * Ejecuta todos los tests de email
 */
async function runEmailTests() {
  console.log('\n🧪 INICIANDO TESTS DE EMAIL');
  console.log('============================\n');

  if (TEST_EMAIL === 'tu-email@ejemplo.com') {
    console.error('❌ ERROR: Debes cambiar TEST_EMAIL en el código por tu email real\n');
    process.exit(1);
  }

  let testUserId = null;

  try {
    // Crear usuario de prueba
    console.log('📝 Preparando usuario de prueba...');
    testUserId = await createTestUser();
    console.log('');

    const results = {
      passed: 0,
      failed: 0,
      tests: [],
    };

    // Test 1: Email básico
    console.log('1️⃣  Test de email básico...');
    try {
      await sendEmail({
        to: TEST_EMAIL,
        subject: 'Test Email Básico',
        text: 'Este es un test de email básico.',
        html: '<p>Este es un <strong>test</strong> de email básico.</p>',
      });
      console.log('✅ Email básico enviado\n');
      results.passed++;
      results.tests.push({ name: 'Email básico', status: 'passed' });
    } catch (error) {
      console.error('❌ Email básico falló');
      console.error(`   └─ Error: ${error.message}\n`);
      results.failed++;
      results.tests.push({ name: 'Email básico', status: 'failed', error: error.message });
    }

    // Test 2: Email con HTML avanzado
    console.log('2️⃣  Test de email con HTML avanzado...');
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { padding: 30px; }
            .content p { line-height: 1.6; color: #333; }
            .button { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white; 
              padding: 12px 30px; 
              text-decoration: none; 
              display: inline-block;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .footer { background: #f9f9f9; padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 ¡Bienvenido a Rifas Solidarias!</h1>
            </div>
            <div class="content">
              <p>Este es un test de email con HTML avanzado y estilos modernos.</p>
              <p>Incluye gradientes, diseño responsivo y botones atractivos.</p>
              <p style="text-align: center;">
                <a href="https://rifassolidarias.com" class="button">Ver Plataforma</a>
              </p>
            </div>
            <div class="footer">
              <p>© 2024 Rifas Solidarias - Todos los derechos reservados</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await sendEmail({
        to: TEST_EMAIL,
        subject: 'Test Email HTML Avanzado',
        html: htmlContent,
      });
      console.log('✅ Email HTML avanzado enviado\n');
      results.passed++;
      results.tests.push({ name: 'Email HTML avanzado', status: 'passed' });
    } catch (error) {
      console.error('❌ Email HTML avanzado falló');
      console.error(`   └─ Error: ${error.message}\n`);
      results.failed++;
      results.tests.push({ name: 'Email HTML avanzado', status: 'failed', error: error.message });
    }

    // Test 3: Email de verificación
    console.log('3️⃣  Test de email de verificación...');
    try {
      await sendVerificationEmail(testUserId, TEST_EMAIL);
      console.log('✅ Email de verificación enviado (revisa tu inbox)\n');
      results.passed++;
      results.tests.push({ name: 'Email de verificación', status: 'passed' });
    } catch (error) {
      console.error('❌ Email de verificación falló');
      console.error(`   └─ Error: ${error.message}\n`);
      results.failed++;
      results.tests.push({ name: 'Email de verificación', status: 'failed', error: error.message });
    }

    // Test 4: Email de reset de contraseña
    console.log('4️⃣  Test de email de reset de contraseña...');
    try {
      await sendPasswordResetEmail(testUserId, TEST_EMAIL);
      console.log('✅ Email de reset enviado (revisa tu inbox)\n');
      results.passed++;
      results.tests.push({ name: 'Email de reset', status: 'passed' });
    } catch (error) {
      console.error('❌ Email de reset falló');
      console.error(`   └─ Error: ${error.message}\n`);
      results.failed++;
      results.tests.push({ name: 'Email de reset', status: 'failed', error: error.message });
    }

    // Test 5: Email de notificación simple
    console.log('5️⃣  Test de notificación simple...');
    try {
      await sendNotificationEmail({
        to: TEST_EMAIL,
        subject: 'Notificación de Prueba',
        title: '🎉 Nueva Notificación',
        message: 'Este es un mensaje de notificación de prueba del sistema.',
      });
      console.log('✅ Notificación simple enviada\n');
      results.passed++;
      results.tests.push({ name: 'Notificación simple', status: 'passed' });
    } catch (error) {
      console.error('❌ Notificación simple falló');
      console.error(`   └─ Error: ${error.message}\n`);
      results.failed++;
      results.tests.push({ name: 'Notificación simple', status: 'failed', error: error.message });
    }

    // Test 6: Email de notificación con botón
    console.log('6️⃣  Test de notificación con acción...');
    try {
      await sendNotificationEmail({
        to: TEST_EMAIL,
        subject: 'Notificación con Acción',
        title: '✅ Acción Requerida',
        message: 'Por favor haz clic en el botón para continuar con el proceso.',
        buttonText: 'Ver Detalles',
        buttonUrl: 'https://rifassolidarias.com/dashboard',
      });
      console.log('✅ Notificación con botón enviada\n');
      results.passed++;
      results.tests.push({ name: 'Notificación con botón', status: 'passed' });
    } catch (error) {
      console.error('❌ Notificación con botón falló');
      console.error(`   └─ Error: ${error.message}\n`);
      results.failed++;
      results.tests.push({ name: 'Notificación con botón', status: 'failed', error: error.message });
    }

    // Test 7: Email con caracteres especiales
    console.log('7️⃣  Test de caracteres especiales...');
    try {
      await sendEmail({
        to: TEST_EMAIL,
        subject: 'Test Caracteres: ñáéíóú ¡¿€',
        text: 'Probando: ñ, á, é, í, ó, ú, ¡, ¿, €, ©, ®, 🎉',
        html: '<p>Probando <strong>ñ, á, é, í, ó, ú</strong> ¡¿€©® 🎉</p>',
      });
      console.log('✅ Caracteres especiales enviados\n');
      results.passed++;
      results.tests.push({ name: 'Caracteres especiales', status: 'passed' });
    } catch (error) {
      console.error('❌ Caracteres especiales falló');
      console.error(`   └─ Error: ${error.message}\n`);
      results.failed++;
      results.tests.push({ name: 'Caracteres especiales', status: 'failed', error: error.message });
    }

    // Resumen final
    console.log('\n============================');
    console.log('📊 RESUMEN DE TESTS');
    console.log('============================');
    console.log(`✅ Tests pasados: ${results.passed}`);
    console.log(`❌ Tests fallidos: ${results.failed}`);
    console.log(`📈 Total: ${results.passed + results.failed}`);
    
    const successRate = ((results.passed / (results.passed + results.failed)) * 100).toFixed(1);
    console.log(`🎯 Tasa de éxito: ${successRate}%`);

    if (results.failed > 0) {
      console.log('\n❌ Tests que fallaron:');
      results.tests
        .filter(t => t.status === 'failed')
        .forEach(t => {
          console.log(`   • ${t.name}`);
          console.log(`     └─ ${t.error}`);
        });
    } else {
      console.log('\n🎉 ¡Todos los tests pasaron exitosamente!');
      console.log('📧 Revisa tu email para ver los mensajes recibidos');
    }

  } catch (error) {
    console.error('\n💥 Error fatal durante los tests:', error);
  } finally {
    // Limpiar usuario de prueba
    if (testUserId) {
      console.log('\n🧹 Limpiando datos de prueba...');
      await cleanupTestUser(testUserId);
    }
    
    // Cerrar conexión a BD
    console.log('🔌 Cerrando conexión a base de datos...');
    await db.end();
    console.log('✅ Tests completados\n');
  }
}

// Ejecutar tests
runEmailTests().catch(console.error);