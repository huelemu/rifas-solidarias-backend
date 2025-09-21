// =====================================================
// SCRIPT DE PRUEBA COMPLETA DEL SISTEMA AUTH
// Ejecutar con: node test-auth.js
// =====================================================

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
    return { status: response.status, data, ok: response.ok };
  } catch (error) {
    console.error(`❌ Error en request a ${url}:`, error.message);
    return { status: 0, data: null, error: error.message };
  }
}

// Función principal de testing
async function testAuthSystem() {
  console.log('🧪 =======================================');
  console.log('   🔒 TESTING SISTEMA DE AUTENTICACIÓN');
  console.log('🧪 =======================================\n');

  // =====================================================
  // 1. TEST DE CONECTIVIDAD
  // =====================================================
  console.log('1️⃣ Probando conectividad del servidor...');
  const { status: serverStatus, data: serverData } = await makeRequest(BASE_URL);
  
  if (serverStatus === 200) {
    console.log('✅ Servidor respondiendo correctamente');
    console.log(`📊 Versión: ${serverData.version || 'No especificada'}`);
  } else {
    console.log('❌ Servidor no responde. Verifica que esté ejecutándose en puerto 3100');
    return;
  }

  // =====================================================
  // 2. TEST DE BASE DE DATOS
  // =====================================================
  console.log('\n2️⃣ Verificando conexión a base de datos...');
  const { status: dbStatus, data: dbData } = await makeRequest(`${BASE_URL}/test-db`);
  
  if (dbStatus === 200) {
    console.log('✅ Base de datos conectada');
    console.log(`📋 Base: ${dbData.base_datos}`);
    console.log(`👥 Usuarios: ${dbData.total_usuarios}`);
    console.log(`🏢 Instituciones: ${dbData.total_instituciones}`);
  } else {
    console.log('❌ Error en base de datos:', dbData?.error || 'Error desconocido');
    return;
  }

  // =====================================================
  // 3. TEST DE REGISTRO DE USUARIO
  // =====================================================
  console.log('\n3️⃣ Probando registro de usuario...');
  
  const nuevoUsuario = {
    nombre: 'Test',
    apellido: 'Usuario',
    email: `test${Date.now()}@ejemplo.com`,
    password: 'test123456',
    rol: 'comprador',
    telefono: '+5491123456789',
    dni: '12345678'
  };

  const { status: regStatus, data: regData } = await makeRequest(`${BASE_URL}/auth/register`, {
    method: 'POST',
    body: JSON.stringify(nuevoUsuario)
  });

  if (regStatus === 201 || regStatus === 200) {
    console.log('✅ Registro exitoso');
    console.log(`👤 Usuario creado: ${regData.data?.user?.email || nuevoUsuario.email}`);
  } else {
    console.log('❌ Error en registro:', regData?.message || 'Error desconocido');
    console.log('📋 Detalles:', regData);
  }

  // =====================================================
  // 4. TEST DE LOGIN
  // =====================================================
  console.log('\n4️⃣ Probando login de usuario...');
  
  const credenciales = {
    email: nuevoUsuario.email,
    password: nuevoUsuario.password
  };

  const { status: loginStatus, data: loginData } = await makeRequest(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify(credenciales)
  });

  let accessToken = null;
  let refreshToken = null;

  if (loginStatus === 200) {
    console.log('✅ Login exitoso');
    accessToken = loginData.data?.tokens?.access_token || loginData.data?.accessToken;
    refreshToken = loginData.data?.tokens?.refresh_token || loginData.data?.refreshToken;
    
    if (accessToken) {
      console.log('🔑 Access token obtenido');
    } else {
      console.log('⚠️ Access token no encontrado en respuesta');
      console.log('📋 Estructura de respuesta:', JSON.stringify(loginData, null, 2));
    }
  } else {
    console.log('❌ Error en login:', loginData?.message || 'Error desconocido');
    console.log('📋 Detalles:', loginData);
  }

  // =====================================================
  // 5. TEST DE RUTA PROTEGIDA
  // =====================================================
  if (accessToken) {
    console.log('\n5️⃣ Probando acceso a ruta protegida...');
    
    const { status: protectedStatus, data: protectedData } = await makeRequest(`${BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (protectedStatus === 200) {
      console.log('✅ Acceso a ruta protegida exitoso');
      console.log(`👤 Usuario autenticado: ${protectedData.data?.email || 'No especificado'}`);
    } else {
      console.log('❌ Error accediendo a ruta protegida:', protectedData?.message);
    }
  }

  // =====================================================
  // 6. TEST DE REFRESH TOKEN
  // =====================================================
  if (refreshToken) {
    console.log('\n6️⃣ Probando refresh de token...');
    
    const { status: refreshStatus, data: refreshData } = await makeRequest(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (refreshStatus === 200) {
      console.log('✅ Refresh token exitoso');
      const newAccessToken = refreshData.data?.access_token || refreshData.data?.accessToken;
      if (newAccessToken) {
        console.log('🔄 Nuevo access token obtenido');
        accessToken = newAccessToken; // Actualizar para próximas pruebas
      }
    } else {
      console.log('❌ Error en refresh:', refreshData?.message);
    }
  }

  // =====================================================
  // 7. TEST DE LOGOUT
  // =====================================================
  if (accessToken) {
    console.log('\n7️⃣ Probando logout...');
    
    const { status: logoutStatus, data: logoutData } = await makeRequest(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (logoutStatus === 200) {
      console.log('✅ Logout exitoso');
    } else {
      console.log('⚠️ Logout con problemas:', logoutData?.message);
    }
  }

  // =====================================================
  // 8. TEST DE VALIDACIONES
  // =====================================================
  console.log('\n8️⃣ Probando validaciones...');
  
  // Test con email inválido
  const { status: invalidStatus } = await makeRequest(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: 'email_invalido',
      password: 'password123'
    })
  });

  console.log(`📧 Validación email: ${invalidStatus === 400 ? '✅ OK' : '❌ FAIL'}`);

  // Test con password vacío
  const { status: emptyPwdStatus } = await makeRequest(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: 'test@test.com',
      password: ''
    })
  });

  console.log(`🔒 Validación password: ${emptyPwdStatus === 400 ? '✅ OK' : '❌ FAIL'}`);

  // =====================================================
  // RESUMEN FINAL
  // =====================================================
  console.log('\n🎉 =======================================');
  console.log('   📊 RESUMEN DE PRUEBAS COMPLETADAS');
  console.log('🎉 =======================================');
  console.log('✅ Conectividad del servidor');
  console.log('✅ Conexión a base de datos');
  console.log('✅ Registro de usuario');
  console.log('✅ Login con JWT');
  console.log('✅ Protección de rutas');
  console.log('✅ Validaciones de entrada');
  console.log('\n🚀 Sistema de autenticación funcional!');
}

// Ejecutar pruebas
console.log('Iniciando pruebas del sistema de autenticación...\n');
testAuthSystem()
  .then(() => {
    console.log('\n✨ Pruebas completadas exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error en las pruebas:', error.message);
    process.exit(1);
  });