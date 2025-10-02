// =====================================================
// SCRIPT DE PRUEBA - FASE 2: VERIFICACIÓN DE USUARIOS
// test/test-fase2-verification.js
// =====================================================

import 'dotenv/config';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3100';

// =====================================================
// UTILIDADES
// =====================================================

const testResults = {
  total: 0,
  passed: 0,
  failed: 0
};

const logTest = (nombre, exito, detalle = '') => {
  testResults.total++;
  if (exito) {
    testResults.passed++;
    console.log(`✅ ${nombre}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${nombre}`);
  }
  if (detalle) console.log(`   └─ ${detalle}`);
};

const makeRequest = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }
    
    return { status: response.status, data };
  } catch (error) {
    console.error('Error en request:', error.message);
    return { status: 0, data: null };
  }
};

console.log(`
╔════════════════════════════════════════════════════════════╗
║    🧪 TESTS FASE 2: VERIFICACIÓN DE USUARIOS              ║
╚════════════════════════════════════════════════════════════╝
`);

// =====================================================
// TESTS
// =====================================================

const runVerificationTests = async () => {
  const testEmail = `test.${Date.now()}@ejemplo.com`;
  const testPassword = 'TestPassword123!';
  let userId = null;
  let verificationToken = null;

  // =====================================================
  // 1. REGISTRO DE NUEVO USUARIO
  // =====================================================
  
  console.log('\n1️⃣  Test: Registro de usuario...');
  
  const { status: regStatus, data: regData } = await makeRequest(`${BASE_URL}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({
      nombre: 'Test',
      apellido: 'Usuario',
      email: testEmail,
      password: testPassword
    })
  });
  
  logTest(
    'Usuario registrado',
    regStatus === 201 && regData?.data?.userId,
    regData?.message
  );
  
  if (regData?.data?.userId) {
    userId = regData.data.userId;
    console.log(`   Usuario ID: ${userId}`);
  }
  
  logTest(
    'Requiere verificación',
    regData?.data?.requiresVerification === true,
    'Flag de verificación presente'
  );

  // =====================================================
  // 2. INTENTO DE LOGIN SIN VERIFICAR
  // =====================================================
  
  console.log('\n2️⃣  Test: Intento de login sin verificar email...');
  
  const { status: loginStatus, data: loginData } = await makeRequest(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: testPassword
    })
  });
  
  logTest(
    'Login bloqueado',
    loginStatus === 403,
    `Status: ${loginStatus}`
  );
  
  logTest(
    'Código de error correcto',
    loginData?.code === 'EMAIL_NOT_VERIFIED',
    `Code: ${loginData?.code}`
  );
  
  logTest(
    'Mensaje apropiado',
    loginData?.message?.includes('verificar'),
    loginData?.message
  );

  // =====================================================
  // 3. VERIFICAR ESTADO DE EMAIL
  // =====================================================
  
  console.log('\n3️⃣  Test: Verificar estado de email...');
  
  const { status: checkStatus, data: checkData } = await makeRequest(
    `${BASE_URL}/auth/check-verification/${encodeURIComponent(testEmail)}`
  );
  
  logTest(
    'Estado obtenido',
    checkStatus === 200,
    `Status: ${checkStatus}`
  );
  
  logTest(
    'Email NO verificado',
    checkData?.data?.verified === false,
    `Verified: ${checkData?.data?.verified}`
  );

  // =====================================================
// 4. REENVIAR VERIFICACIÓN
// =====================================================

console.log('\n4️⃣  Test: Reenviar email de verificación...');

// Esperar 6 segundos para evitar el rate limit del registro
await new Promise(resolve => setTimeout(resolve, 6000));

const { status: resendStatus, data: resendData } = await makeRequest(`${BASE_URL}/auth/resend-verification`, {
  method: 'POST',
  body: JSON.stringify({
    email: testEmail
  })
});

logTest(
  'Reenvío exitoso',
  resendStatus === 200,
  resendData?.message || `Status: ${resendStatus}`
);

// NO esperar antes del siguiente request para probar rate limit

// =====================================================
// 5. RATE LIMITING DE REENVÍO
// =====================================================

console.log('\n5️⃣  Test: Rate limiting de reenvío...');

// Enviar inmediatamente sin esperar
const { status: rateLimitStatus } = await makeRequest(`${BASE_URL}/auth/resend-verification`, {
  method: 'POST',
  body: JSON.stringify({
    email: testEmail
  })
});

logTest(
  'Rate limit aplicado',
  rateLimitStatus === 429,
  `Status: ${rateLimitStatus} (esperado 429)`
);

  // =====================================================
  // 6. OBTENER TOKEN DE VERIFICACIÓN (SIMULACIÓN)
  // =====================================================
  
  console.log('\n6️⃣  Test: Obtener token de verificación (DB)...');
  
  try {
    const db = await import('../src/config/db.js');
    const [tokens] = await db.default.execute(
      'SELECT token FROM email_verifications WHERE usuario_id = ? AND usado = FALSE ORDER BY fecha_creacion DESC LIMIT 1',
      [userId]
    );
    
    if (tokens.length > 0) {
      verificationToken = tokens[0].token;
      logTest('Token obtenido de BD', true, `Token: ${verificationToken.substring(0, 20)}...`);
    } else {
      logTest('Token obtenido de BD', false, 'No se encontró token');
    }
  } catch (error) {
    logTest('Token obtenido de BD', false, error.message);
  }

  // =====================================================
  // 7. VERIFICAR TOKEN INVÁLIDO
  // =====================================================
  
  console.log('\n7️⃣  Test: Verificar con token inválido...');
  
  const { status: invalidTokenStatus, data: invalidTokenData } = await makeRequest(
    `${BASE_URL}/auth/verify-email?token=token_invalido_123`
  );
  
  logTest(
    'Token inválido rechazado',
    invalidTokenStatus === 400,
    invalidTokenData?.message
  );

  // =====================================================
  // 8. VERIFICAR EMAIL CON TOKEN VÁLIDO
  // =====================================================
  
  if (verificationToken) {
    console.log('\n8️⃣  Test: Verificar email con token válido...');
    
    const { status: verifyStatus, data: verifyData } = await makeRequest(
      `${BASE_URL}/auth/verify-email?token=${verificationToken}`
    );
    
    logTest(
      'Email verificado',
      verifyStatus === 200,
      verifyData?.message
    );
    
    logTest(
      'Datos de verificación',
      verifyData?.data?.verified === true,
      `User ID: ${verifyData?.data?.userId}`
    );
  } else {
    console.log('\n8️⃣  ⚠️  Saltando test de verificación (no hay token)');
  }

  // =====================================================
  // 9. VERIFICAR ESTADO DESPUÉS DE VERIFICAR
  // =====================================================
  
  console.log('\n9️⃣  Test: Verificar estado después de verificar...');
  
  const { status: checkStatus2, data: checkData2 } = await makeRequest(
    `${BASE_URL}/auth/check-verification/${encodeURIComponent(testEmail)}`
  );
  
  logTest(
    'Email ahora verificado',
    checkData2?.data?.verified === true,
    `Verified: ${checkData2?.data?.verified}`
  );
  
  logTest(
    'Fecha de verificación presente',
    !!checkData2?.data?.verifiedAt,
    checkData2?.data?.verifiedAt
  );

  // =====================================================
  // 10. LOGIN DESPUÉS DE VERIFICAR
  // =====================================================
  
  console.log('\n🔟 Test: Login después de verificar...');
  
  const { status: loginStatus2, data: loginData2 } = await makeRequest(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: testPassword
    })
  });
  
  logTest(
    'Login exitoso',
    loginStatus2 === 200,
    loginData2?.message
  );
  
  logTest(
    'Tokens recibidos',
    !!(loginData2?.data?.tokens?.access_token && loginData2?.data?.tokens?.refresh_token),
    'Access y Refresh tokens presentes'
  );
  
  logTest(
    'Datos de usuario incluyen estado',
    loginData2?.data?.user?.email_verificado === true,
    `Email verificado: ${loginData2?.data?.user?.email_verificado}`
  );

  const accessToken = loginData2?.data?.tokens?.access_token;

  // =====================================================
  // 11. ACCESO A RUTA PROTEGIDA
  // =====================================================
  
  if (accessToken) {
    console.log('\n1️⃣1️⃣  Test: Acceso a ruta protegida...');
    
    const { status: protectedStatus } = await makeRequest(`${BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    logTest(
      'Acceso permitido',
      protectedStatus === 200,
      `Status: ${protectedStatus}`
    );
  }

  // =====================================================
  // 12. INTENTAR VERIFICAR EMAIL YA VERIFICADO
  // =====================================================
  
  console.log('\n1️⃣2️⃣  Test: Intentar verificar email ya verificado...');
  
  const { status: alreadyStatus, data: alreadyData } = await makeRequest(`${BASE_URL}/auth/resend-verification`, {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail
    })
  });
  
  logTest(
    'Reenvío rechazado',
    alreadyStatus === 400,
    alreadyData?.message
  );

  // =====================================================
  // 13. VERIFICAR LOGS EN BASE DE DATOS
  // =====================================================
  
  console.log('\n1️⃣3️⃣  Test: Verificar logs en base de datos...');
  
  try {
    const db = await import('../src/config/db.js');
    
    // Logs de autenticación
    const [authLogs] = await db.default.execute(
      'SELECT COUNT(*) as count FROM auth_logs WHERE usuario_id = ?',
      [userId]
    );
    
    logTest(
      'Logs de autenticación creados',
      authLogs[0].count >= 2, // Al menos registro y verificación
      `${authLogs[0].count} logs encontrados`
    );
    
    // Logs de emails
    const [emailLogs] = await db.default.execute(
      'SELECT COUNT(*) as count FROM email_logs WHERE email = ? AND tipo = "verification"',
      [testEmail]
    );
    
    logTest(
      'Logs de emails creados',
      emailLogs[0].count >= 1,
      `${emailLogs[0].count} emails enviados`
    );
    
  } catch (error) {
    logTest('Verificación de logs', false, error.message);
  }

  // =====================================================
  // 14. LIMPIAR DATOS DE PRUEBA
  // =====================================================
  
  console.log('\n1️⃣4️⃣  Limpiando datos de prueba...');
  
  try {
    const db = await import('../src/config/db.js');
    await db.default.execute('DELETE FROM usuarios WHERE email = ?', [testEmail]);
    console.log('   ✅ Usuario de prueba eliminado');
  } catch (error) {
    console.log('   ⚠️  No se pudo eliminar usuario de prueba:', error.message);
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
    console.log('✅ Fase 2: Verificación de Usuarios está funcionando correctamente');
    console.log('');
    console.log('Próximos pasos:');
    console.log('1. Probar en el frontend');
    console.log('2. Configurar plantillas de email personalizadas');
    console.log('3. Continuar con Fase 3: Reset de Contraseña');
  } else {
    console.log('⚠️  Algunos tests fallaron.');
    console.log('📝 Revisa los errores arriba y verifica:');
    console.log('1. Los endpoints están correctamente configurados');
    console.log('2. Las tablas de BD existen (email_verifications, auth_logs)');
    console.log('3. El servicio de email está funcionando');
    console.log('4. Los middlewares están correctamente aplicados');
  }

  console.log('');
  console.log('════════════════════════════════════════════════════════════');
  console.log('');

  return testResults;
};

// =====================================================
// EJECUTAR TESTS
// =====================================================

runVerificationTests()
  .then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });