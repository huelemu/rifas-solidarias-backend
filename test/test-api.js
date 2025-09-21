// test-api.js - Script para probar toda la API
// Ejecutar con: node test-api.js

const BASE_URL = 'http://localhost:3100';

async function testAPI() {
  console.log('🚀 Iniciando pruebas de la API...\n');

  try {
    // 1. Probar conexión básica
    console.log('1️⃣ Probando conexión básica...');
    const response = await fetch(`${BASE_URL}/`);
    const data = await response.json();
    console.log('✅ Servidor funcionando:', data.mensaje);

    // 2. Probar base de datos
    console.log('\n2️⃣ Probando base de datos...');
    const dbResponse = await fetch(`${BASE_URL}/test-db`);
    const dbData = await dbResponse.json();
    console.log('✅ Base de datos:', dbData.status);

    // 3. Crear institución
    console.log('\n3️⃣ Creando institución de prueba...');
    const institucionData = {
      nombre: "Club Test",
      descripcion: "Institución de prueba",
      email: `test${Date.now()}@ejemplo.com`
    };

    const institucionResponse = await fetch(`${BASE_URL}/instituciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(institucionData)
    });
    
    const institucion = await institucionResponse.json();
    console.log('✅ Institución creada:', institucion.data?.nombre);

    // 4. Registrar usuario
    console.log('\n4️⃣ Registrando usuario...');
    const userData = {
      nombre: "Test",
      apellido: "User",
      email: `testuser${Date.now()}@ejemplo.com`,
      password: "test123",
      rol: "comprador"
    };

    const registerResponse = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    const userResult = await registerResponse.json();
    console.log('✅ Usuario registrado:', userResult.data?.user?.email);
    
    const accessToken = userResult.data?.tokens?.access_token;
    if (!accessToken) {
      throw new Error('No se obtuvo access token');
    }

    // 5. Probar login
    console.log('\n5️⃣ Probando login...');
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userData.email,
        password: userData.password
      })
    });

    const loginResult = await loginResponse.json();
    console.log('✅ Login exitoso:', loginResult.status);

    // 6. Probar ruta protegida
    console.log('\n6️⃣ Probando ruta protegida...');
    const profileResponse = await fetch(`${BASE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const profile = await profileResponse.json();
    console.log('✅ Perfil obtenido:', profile.data?.email);

    console.log('\n🎉 ¡Todas las pruebas pasaron exitosamente!');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error.message);
  }
}

// Ejecutar pruebas
testAPI();