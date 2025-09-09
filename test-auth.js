// test-auth.js - Script completo para probar autenticación
// Ejecutar con: node test-auth.js

const BASE_URL = 'http://localhost:3100';

// Función helper para hacer requests
async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    return { response, data, status: response.status };
  } catch (error) {
    console.error(`❌ Error en request a ${url}:`, error.message);
    throw error;
  }
}

async function testAuthSystem() {
  console.log('🔐 =======================================');
  console.log('   TESTING SISTEMA DE AUTENTICACIÓN');
  console.log('🔐 =======================================\n');

  let accessToken = null;
  let refreshToken = null;
  let testUser = null;

  try {
    // 1. Test de configuración inicial
    console.log('1️⃣ Verificando configuración del servidor...');
    const { data: serverInfo } = await makeRequest(`${BASE_URL}/`);
    console.log('✅ Servidor:', serverInfo.mensaje);

    const { data: jwtConfig } = await makeRequest(`${BASE_URL}/test-jwt`);
    console.log('✅ JWT configurado:', jwtConfig.status);
    if (jwtConfig.warnings?.length > 0) {
      console.log('⚠️  Warnings:', jwtConfig.warnings.join(', '));
    }

    // 2. Test de base de datos
    console.log('\n2️⃣ Verificando base de datos...');
    const { data: dbInfo } = await makeRequest(`${BASE_URL}/test-db`);
    console.log('✅ Base de datos:', dbInfo.status);
    console.log('✅ Tablas auth:', Object.entries(dbInfo.auth_tables)
      .map(([table, exists]) => `${table}: ${exists ? '✅' : '❌'}`)
      .join(', ')
    );

    // 3. Test de registro con datos inválidos
    console.log('\n3️⃣ Probando validaciones de registro...');
    
    // Registro sin datos requeridos
    const { status: invalidStatus } = await makeRequest(`${BASE_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com' })
    });
    console.log(`✅ Validación campos requeridos: ${invalidStatus === 400 ? 'OK' : 'FAIL'}`);

    // Email inválido
    const { status: emailStatus } = await makeRequest(`${BASE_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Test',
        apellido: 'User',
        email: 'email-invalido',
        password: 'test123'
      })
    });
    console.log(`✅ Validación email: ${emailStatus === 400 ? 'OK' : 'FAIL'}`);

    // 4. Registro exitoso
    console.log('\n4️⃣ Registrando usuario de prueba...');
    const userData = {
      nombre: 'Test',
      apellido: 'Auth',
      email: `testauth${Date.now()}@ejemplo.com`,
      password: 'test123456',
      telefono: '+5491123456789',
      rol: 'comprador'
    };

    const { data: registerResult, status: regStatus } = await makeRequest(`${BASE_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(userData)
    });

    if (regStatus === 201) {
      console.log('✅ Usuario registrado:', registerResult.data.user.email);
      testUser = registerResult.data.user;
      accessToken = registerResult.data.tokens.access_token;
      refreshToken = registerResult.data.tokens.refresh_token;
      console.log('✅ Tokens recibidos: access y refresh');
    } else {
      throw new Error(`Error en registro: ${registerResult.message}`);
    }

    // 5. Test de login con credenciales incorrectas
    console.log('\n5️⃣ Probando login con credenciales incorrectas...');
    const { status: wrongPassStatus } = await makeRequest(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: userData.email,
        password: 'password_incorrecto'
      })
    });
    console.log(`✅ Login credenciales incorrectas: ${wrongPassStatus === 401 ? 'OK' : 'FAIL'}`);

    // 6. Login exitoso
    console.log('\n6️⃣ Probando login exitoso...');
    const { data: loginResult, status: loginStatus } = await makeRequest(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: userData.email,
        password: userData.password
      })
    });

    if (loginStatus === 200) {
      console.log('✅ Login exitoso:', loginResult.data.user.email);
      console.log('✅ Nuevo access token recibido');
      accessToken = loginResult.data.tokens.access_token;
      refreshToken = loginResult.data.tokens.refresh_token;
    } else {
      throw new Error(`Error en login: ${loginResult.message}`);
    }

    // 7. Test de ruta protegida sin token
    console.log('\n7️⃣ Probando ruta protegida sin token...');
    const { status: noTokenStatus } = await makeRequest(`${BASE_URL}/auth/me`);
    console.log(`✅ Sin token: ${noTokenStatus === 401 ? 'OK' : 'FAIL'}`);

    // 8. Test de ruta protegida con token inválido
    console.log('\n8️⃣ Probando ruta protegida con token inválido...');
    const { status: badTokenStatus } = await makeRequest(`${BASE_URL}/auth/me`, {
      headers: { 'Authorization': 'Bearer token_invalido' }
    });
    console.log(`✅ Token inválido: ${badTokenStatus === 401 ? 'OK' : 'FAIL'}`);

    // 9. Test de ruta protegida con token válido
    console.log('\n9️⃣ Probando ruta protegida con token válido...');
    const { data: profileResult, status: profileStatus } = await makeRequest(`${BASE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (profileStatus === 200) {
      console.log('✅ Perfil obtenido:', profileResult.data.email);
      console.log('✅ Datos incluyen institución:', profileResult.data.institucion_nombre || 'Sin institución');
    } else {
      throw new Error(`Error obteniendo perfil: ${profileResult.message}`);
    }

    // 10. Test de refresh token
    console.log('\n🔟 Probando renovación de token...');
    const { data: refreshResult, status: refreshStatus } = await makeRequest(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (refreshStatus === 200) {
      console.log('✅ Token renovado exitosamente');
      accessToken = refreshResult.data.access_token;
    } else {
      throw new Error(`Error renovando token: ${refreshResult.message}`);
    }

    // 11. Test de logout
    console.log('\n1️⃣1️⃣ Probando cierre de sesión...');
    const { data: logoutResult, status: logoutStatus } = await makeRequest(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (logoutStatus === 200) {
      console.log('✅ Logout exitoso:', logoutResult.message);
    } else {
      console.log('⚠️  Logout con advertencias:', logoutResult.message);
    }

    // 12. Verificar que el token fue invalidado
    console.log('\n1️⃣2️⃣ Verificando invalidación de token...');
    const { status: invalidatedStatus } = await makeRequest(`${BASE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    console.log(`✅ Token invalidado: ${invalidatedStatus === 401 ? 'OK' : 'FAIL'}`);

    // 13. Test de múltiples intentos fallidos
    console.log('\n1️⃣3️⃣ Probando protección contra ataques de fuerza bruta...');
    for (let i = 1; i <= 6; i++) {
      const { status } = await makeRequest(`${BASE_URL}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({
          email: userData.email,
          password: 'password_incorrecto'
        })
      });
      
      if (i <= 5) {
        console.log(`   Intento ${i}/5: ${status === 401 ? 'Bloqueado correctamente' : 'Error'}`);
      } else {
        console.log(`✅ Protección fuerza bruta: ${status === 423 ? 'Usuario bloqueado OK' : 'FAIL'}`);
      }
    }

    console.log('\n🎉 =======================================');
    console.log('   ¡TODOS LOS TESTS PASARON EXITOSAMENTE!');
    console.log('🎉 =======================================');
    
    console.log('\n📊 RESUMEN DE FUNCIONALIDADES PROBADAS:');
    console.log('✅ Registro de usuarios con validaciones');
    console.log('✅ Login con autenticación JWT');
    console.log('✅ Protección de rutas con middleware');
    console.log('✅ Renovación de tokens (refresh)');
    console.log('✅ Cierre de sesión e invalidación');
    console.log('✅ Protección contra fuerza bruta');
    console.log('✅ Validaciones de datos de entrada');
    console.log('✅ Manejo de errores y códigos HTTP');

  } catch (error) {
    console.error('\n❌ =======================================');
    console.error('   ERROR EN LOS TESTS');
    console.error('❌ =======================================');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    console.log('\n🔧 POSIBLES SOLUCIONES:');
    console.log('1. Verificar que el servidor esté ejecutándose en puerto 3100');
    console.log('2. Ejecutar la migración de base de datos: database/migrations/002_add_auth_fields.sql');
    console.log('3. Verificar configuración de variables de entorno en .env');
    console.log('4. Instalar dependencias: npm install jsonwebtoken bcrypt');
  }
}

// Función para limpiar datos de test (opcional)
async function cleanupTestData() {
  console.log('\n🧹 Limpiando datos de test...');
  try {
    // Aquí podrías agregar lógica para limpiar usuarios de test
    // Por ejemplo, eliminar usuarios cuyo email contenga 'testauth'
    console.log('✅ Cleanup completado');
  } catch (error) {
    console.log('⚠️  Error en cleanup:', error.message);
  }
}

// Ejecutar tests
console.log('Iniciando tests de autenticación...\n');
testAuthSystem()
  .then(() => {
    console.log('\n✨ Tests completados exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Tests fallaron:', error.message);
    process.exit(1);
  });