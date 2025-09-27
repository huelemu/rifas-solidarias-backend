// =====================================================
// SUITE DE TESTING COMPLETA
// test/test-auth-complete.js
// =====================================================

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

// Función helper para hacer requests
const makeRequest = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    const data = await response.json();
    return { status: response.status, data, headers: response.headers };
  } catch (error) {
    console.error('Error en request:', error.message);
    return { status: 500, data: { message: 'Error de conexión' } };
  }
};

// =====================================================
// FUNCIÓN PRINCIPAL DE TESTING
// =====================================================

const runAuthTests = async () => {
  console.log('\n🧪 ==========================================');
  console.log('   SUITE DE TESTING DE AUTENTICACIÓN');
  console.log('🧪 ==========================================\n');

  let testResults = {
    passed: 0,
    failed: 0,
    total: 0
  };

  const logTest = (testName, passed, message = '') => {
    testResults.total++;
    if (passed) {
      testResults.passed++;
      console.log(`✅ ${testName}`);
    } else {
      testResults.failed++;
      console.log(`❌ ${testName}: ${message}`);
    }
  };

  // =====================================================
  // 1. TEST DE CONECTIVIDAD
  // =====================================================
  
  console.log('1️⃣ Testing conectividad del servidor...');
  const { status: healthStatus, data: healthData } = await makeRequest(`${BASE_URL}/health`);
  logTest('Conectividad del servidor', healthStatus === 200, `Status: ${healthStatus}`);

  if (healthStatus !== 200) {
    console.log('\n❌ Servidor no disponible. Verifica que esté ejecutándose.');
    return;
  }

  // =====================================================
  // 2. TEST DE REGISTRO TRADICIONAL
  // =====================================================
  
  console.log('\n2️⃣ Testing registro tradicional...');
  
  const nuevoUsuario = {
    nombre: 'Test',
    apellido: 'Usuario',
    email: `test.${Date.now()}@ejemplo.com`,
    password: 'test123456',
    rol: 'comprador',
    telefono: '+5491123456789',
    dni: '12345678'
  };

  const { status: regStatus, data: regData } = await makeRequest(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify(nuevoUsuario)
  });

  logTest('Registro de usuario', 
    regStatus === 201 || regStatus === 200, 
    regData?.message || 'Error desconocido'
  );

  // =====================================================
  // 3. TEST DE VALIDACIONES DE REGISTRO
  // =====================================================
  
  console.log('\n3️⃣ Testing validaciones de registro...');

  // Email duplicado
  const { status: dupStatus } = await makeRequest(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify(nuevoUsuario)
  });
  logTest('Validación email duplicado', dupStatus === 409, `Status: ${dupStatus}`);

  // Email inválido
  const { status: invalidEmailStatus } = await makeRequest(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({
      ...nuevoUsuario,
      email: 'email-invalido'
    })
  });
  logTest('Validación email inválido', invalidEmailStatus === 400, `Status: ${invalidEmailStatus}`);

  // Contraseña muy corta
  const { status: shortPwdStatus } = await makeRequest(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({
      ...nuevoUsuario,
      email: `test2.${Date.now()}@ejemplo.com`,
      password: '123'
    })
  });
  logTest('Validación contraseña corta', shortPwdStatus === 400, `Status: ${shortPwdStatus}`);

  // =====================================================
  // 4. TEST DE LOGIN SIN VERIFICACIÓN
  // =====================================================
  
  console.log('\n4️⃣ Testing login sin verificación de email...');
  
  const { status: loginUnverifiedStatus, data: loginUnverifiedData } = await makeRequest(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: nuevoUsuario.email,
      password: nuevoUsuario.password
    })
  });

  logTest('Login sin email verificado', 
    loginUnverifiedStatus === 403 && loginUnverifiedData?.code === 'EMAIL_NOT_VERIFIED',
    `Status: ${loginUnverifiedStatus}, Code: ${loginUnverifiedData?.code}`
  );

  // =====================================================
  // 5. TEST DE REENVÍO DE VERIFICACIÓN
  // =====================================================
  
  console.log('\n5️⃣ Testing reenvío de verificación...');
  
  const { status: resendStatus, data: resendData } = await makeRequest(`${BASE_URL}/api/auth/resend-verification`, {
    method: 'POST',
    body: JSON.stringify({
      email: nuevoUsuario.email
    })
  });

  logTest('Reenvío de verificación', 
    resendStatus === 200,
    resendData?.message || 'Error desconocido'
  );

  // =====================================================
  // 6. TEST DE GOOGLE OAUTH URL
  // =====================================================
  
  console.log('\n6️⃣ Testing Google OAuth URL...');
  
  const { status: googleStatus, data: googleData } = await makeRequest(`${BASE_URL}/api/auth/google`);
  
  logTest('Generación URL Google OAuth', 
    googleStatus === 200 && googleData?.data?.authUrl,
    googleData?.message || 'URL no generada'
  );

  if (googleStatus === 200 && googleData?.data?.authUrl) {
    console.log(`   📍 URL generada: ${googleData.data.authUrl.substring(0, 50)}...`);
  }

  // =====================================================
  // 7. TEST DE VALIDACIONES DE LOGIN
  // =====================================================
  
  console.log('\n7️⃣ Testing validaciones de login...');

  // Email vacío
  const { status: emptyEmailStatus } = await makeRequest(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: '',
      password: 'password123'
    })
  });
  logTest('Validación email vacío', emptyEmailStatus === 400, `Status: ${emptyEmailStatus}`);

  // Contraseña vacía
  const { status: emptyPwdStatus } = await makeRequest(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: 'test@test.com',
      password: ''
    })
  });
  logTest('Validación contraseña vacía', emptyPwdStatus === 400, `Status: ${emptyPwdStatus}`);

  // Credenciales incorrectas
  const { status: wrongCredsStatus } = await makeRequest(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: 'noexiste@ejemplo.com',
      password: 'password123'
    })
  });
  logTest('Credenciales incorrectas', wrongCredsStatus === 401, `Status: ${wrongCredsStatus}`);

  // =====================================================
  // 8. TEST DE SIMULACIÓN DE VERIFICACIÓN
  // =====================================================
  
  console.log('\n8️⃣ Testing simulación de verificación manual...');
  
  // Para testing, vamos a marcar manualmente como verificado
  // En un entorno real, esto se haría a través del enlace del email
  try {
    const db = await import('../src/config/db.js');
    await db.default.execute(
      'UPDATE usuarios SET email_verificado = TRUE WHERE email = ?',
      [nuevoUsuario.email]
    );
    console.log('   ✅ Usuario marcado como verificado manualmente para testing');
  } catch (error) {
    console.log('   ⚠️ No se pudo verificar usuario manualmente:', error.message);
  }

  // =====================================================
  // 9. TEST DE LOGIN EXITOSO
  // =====================================================
  
  console.log('\n9️⃣ Testing login exitoso...');
  
  const { status: loginStatus, data: loginData } = await makeRequest(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: nuevoUsuario.email,
      password: nuevoUsuario.password
    })
  });

  let accessToken = null;
  let refreshToken = null;

  const loginSuccessful = loginStatus === 200 && loginData?.data?.tokens?.access_token;
  logTest('Login exitoso', loginSuccessful, loginData?.message || 'Sin tokens');

  if (loginSuccessful) {
    accessToken = loginData.data.tokens.access_token;
    refreshToken = loginData.data.tokens.refresh_token;
    console.log('   🔑 Tokens obtenidos exitosamente');
  }

  // =====================================================
  // 10. TEST DE RUTA PROTEGIDA
  // =====================================================
  
  if (accessToken) {
    console.log('\n🔟 Testing acceso a ruta protegida...');
    
    const { status: protectedStatus, data: protectedData } = await makeRequest(`${BASE_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    logTest('Acceso a ruta protegida', 
      protectedStatus === 200 && protectedData?.data?.user,
      protectedData?.message || 'Sin datos de usuario'
    );

    if (protectedStatus === 200) {
      console.log(`   👤 Usuario autenticado: ${protectedData.data.user.email}`);
    }
  }

  // =====================================================
  // 11. TEST DE REFRESH TOKEN
  // =====================================================
  
  if (refreshToken) {
    console.log('\n1️⃣1️⃣ Testing refresh token...');
    
    const { status: refreshStatus, data: refreshData } = await makeRequest(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      body: JSON.stringify({
        refresh_token: refreshToken
      })
    });

    const refreshSuccessful = refreshStatus === 200 && refreshData?.data?.tokens?.access_token;
    logTest('Refresh token', refreshSuccessful, refreshData?.message || 'Sin nuevos tokens');

    if (refreshSuccessful) {
      accessToken = refreshData.data.tokens.access_token;
      console.log('   🔄 Nuevo access token obtenido');
    }
  }

  // =====================================================
  // 12. TEST DE TOKEN INVÁLIDO
  // =====================================================
  
  console.log('\n1️⃣2️⃣ Testing token inválido...');
  
  const { status: invalidTokenStatus } = await makeRequest(`${BASE_URL}/api/auth/me`, {
    headers: {
      'Authorization': 'Bearer token_invalido'
    }
  });

  logTest('Token inválido', invalidTokenStatus === 401, `Status: ${invalidTokenStatus}`);

  // =====================================================
  // 13. TEST DE LOGOUT
  // =====================================================
  
  if (accessToken) {
    console.log('\n1️⃣3️⃣ Testing logout...');
    
    const { status: logoutStatus, data: logoutData } = await makeRequest(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    logTest('Logout', logoutStatus === 200, logoutData?.message || 'Error en logout');
  }

  // =====================================================
  // 14. TEST DE RATE LIMITING
  // =====================================================
  
  console.log('\n1️⃣4️⃣ Testing rate limiting...');
  
  const rateLimitTests = [];
  for (let i = 0; i < 7; i++) {
    const { status } = await makeRequest(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@test.com',
        password: 'wrong'
      })
    });
    rateLimitTests.push(status);
  }

  const hasRateLimit = rateLimitTests.slice(-2).some(status => status === 429);
  logTest('Rate limiting funcional', hasRateLimit, 'No se activó rate limiting');

  // =====================================================
  // 15. VERIFICAR CONFIGURACIONES OPCIONALES
  // =====================================================
  
  console.log('\n1️⃣5️⃣ Verificando configuraciones opcionales...');
  
  // Google OAuth
  const hasGoogleConfig = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
  console.log(`   ${hasGoogleConfig ? '✅' : '⚠️'} Google OAuth: ${hasGoogleConfig ? 'Configurado' : 'No configurado'}`);
  
  // AWS SES
  const hasSESConfig = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
  console.log(`   ${hasSESConfig ? '✅' : '⚠️'} AWS SES: ${hasSESConfig ? 'Configurado' : 'No configurado'}`);
  
  // Variables críticas
  const criticalVars = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASSWORD'];
  const missingCritical = criticalVars.filter(v => !process.env[v]);
  console.log(`   ${missingCritical.length === 0 ? '✅' : '❌'} Variables críticas: ${missingCritical.length === 0 ? 'Todas presentes' : `Faltan: ${missingCritical.join(', ')}`}`);

  // =====================================================
  // RESUMEN FINAL
  // =====================================================
  
  console.log('\n🎉 ==========================================');
  console.log('   📊 RESUMEN DE PRUEBAS');
  console.log('🎉 ==========================================');
  console.log(`✅ Pruebas exitosas: ${testResults.passed}`);
  console.log(`❌ Pruebas fallidas: ${testResults.failed}`);
  console.log(`📊 Total de pruebas: ${testResults.total}`);
  console.log(`📈 Porcentaje de éxito: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  if (testResults.failed === 0) {
    console.log('\n🚀 ¡TODOS LOS TESTS PASARON! Sistema listo para producción.');
  } else {
    console.log(`\n⚠️ ${testResults.failed} test(s) fallaron. Revisa la configuración.`);
  }
  
  console.log('\n==========================================\n');
  
  return testResults;
};

// =====================================================
// EJECUTAR TESTS
// =====================================================

// Verificar variables de entorno
if (!process.env.NODE_ENV) {
  console.log('⚠️ NODE_ENV no establecido, usando development');
}

runAuthTests().catch(error => {
  console.error('❌ Error ejecutando tests:', error);
  process.exit(1);
});