// ===================================================
// test-rifas.js - SCRIPT PARA PROBAR ENDPOINTS DE RIFAS
// ===================================================

// Para ejecutar: node test-rifas.js
// Requiere: npm install axios

import axios from 'axios';

// Configuración
const BASE_URL = 'http://localhost:3100/api';
//no const BASE_URL = 'https://apirifas.huelemu.com.ar/api'; // Para producción

let authToken = '';
let rifaId = null;

// Colores para la consola
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

// ===================================================
// FUNCIONES DE TESTING
// ===================================================

// Test 1: Conexión básica
async function testConexion() {
  log('\n📡 1. Testing conexión al servidor...', 'blue');
  
  try {
    const response = await axios.get(`${BASE_URL.replace('/api', '')}/`);
    
    if (response.data.status === 'success') {
      log('✅ Conexión exitosa al servidor', 'green');
      log(`   Version: ${response.data.version}`);
      return true;
    } else {
      log('❌ Respuesta inesperada del servidor', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error de conexión: ${error.message}`, 'red');
    return false;
  }
}

// Test 2: Test de base de datos
async function testBaseDatos() {
  log('\n🗄️ 2. Testing conexión a base de datos...', 'blue');
  
  try {
    const response = await axios.get(`${BASE_URL.replace('/api', '')}/api/test-db`);
    
    if (response.data.status === 'OK') {
      log('✅ Base de datos conectada correctamente', 'green');
      log(`   BD: ${response.data.base_datos}`);
      log(`   Usuarios: ${response.data.total_usuarios}`);
      log(`   Instituciones: ${response.data.total_instituciones}`);
      log(`   Rifas: ${response.data.total_rifas}`);
      return true;
    } else {
      log('❌ Error en conexión a BD', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error de BD: ${error.message}`, 'red');
    return false;
  }
}

// Test 3: Login para obtener token
async function testLogin() {
  log('\n🔐 3. Testing login...', 'blue');
  
  try {
    // Intentar con credenciales por defecto
    const loginData = {
      email: 'admin@rifas.com',
      password: 'admin123'
    };
    
    const response = await axios.post(`${BASE_URL}/auth/login`, loginData);
    
    if (response.data.success) {
      authToken = response.data.data.accessToken;
      log('✅ Login exitoso', 'green');
      log(`   Usuario: ${response.data.data.user.nombre} ${response.data.data.user.apellido}`);
      log(`   Rol: ${response.data.data.user.rol}`);
      return true;
    } else {
      log('❌ Login fallido', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error en login: ${error.response?.data?.message || error.message}`, 'red');
    log('💡 Nota: Asegúrate de tener un usuario admin en la BD', 'yellow');
    return false;
  }
}

// Test 4: Listar rifas
async function testListarRifas() {
  log('\n📋 4. Testing listar rifas...', 'blue');
  
  try {
    const config = authToken ? {
      headers: { Authorization: `Bearer ${authToken}` }
    } : {};
    
    const response = await axios.get(`${BASE_URL}/rifas`, config);
    
    if (response.data.status === 'success') {
      log('✅ Listado de rifas exitoso', 'green');
      log(`   Total rifas: ${response.data.data.length}`);
      
      if (response.data.data.length > 0) {
        const primeraRifa = response.data.data[0];
        rifaId = primeraRifa.id;
        log(`   Primera rifa: "${primeraRifa.titulo || primeraRifa.nombre}" (ID: ${primeraRifa.id})`);
      }
      
      return true;
    } else {
      log('❌ Error al listar rifas', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

// Test 5: Crear rifa
async function testCrearRifa() {
  log('\n➕ 5. Testing crear rifa...', 'blue');
  
  if (!authToken) {
    log('⚠️ Saltando test - No hay token de auth', 'yellow');
    return false;
  }
  
  try {
    const nuevaRifa = {
      titulo: `Rifa de Testing ${Date.now()}`,
      descripcion: 'Rifa creada automáticamente para testing del sistema',
      precio_numero: 500,
      total_numeros: 50,
      fecha_inicio: new Date().toISOString(),
      fecha_fin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 días
      fecha_sorteo: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString() // 35 días
    };
    
    const response = await axios.post(`${BASE_URL}/rifas`, nuevaRifa, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.status === 'success') {
      rifaId = response.data.data.id;
      log('✅ Rifa creada exitosamente', 'green');
      log(`   ID: ${rifaId}`);
      log(`   Nombre: ${response.data.data.nombre}`);
      return true;
    } else {
      log('❌ Error al crear rifa', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

// Test 6: Ver detalle de rifa
async function testDetalleRifa() {
  log('\n🔍 6. Testing detalle de rifa...', 'blue');
  
  if (!rifaId) {
    log('⚠️ Saltando test - No hay ID de rifa', 'yellow');
    return false;
  }
  
  try {
    const config = authToken ? {
      headers: { Authorization: `Bearer ${authToken}` }
    } : {};
    
    const response = await axios.get(`${BASE_URL}/rifas/${rifaId}`, config);
    
    if (response.data.status === 'success') {
      const rifa = response.data.data;
      log('✅ Detalle de rifa obtenido', 'green');
      log(`   Nombre: ${rifa.titulo || rifa.nombre}`);
      log(`   Estado: ${rifa.estado}`);
      log(`   Números: ${rifa.total_numeros || rifa.cantidad_numeros}`);
      log(`   Precio: $${rifa.precio_numero}`);
      return true;
    } else {
      log('❌ Error al obtener detalle', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

// Test 7: Generar números
async function testGenerarNumeros() {
  log('\n🎲 7. Testing generar números...', 'blue');
  
  if (!rifaId || !authToken) {
    log('⚠️ Saltando test - Faltan requisitos', 'yellow');
    return false;
  }
  
  try {
    const response = await axios.post(`${BASE_URL}/rifas/${rifaId}/generar-numeros`, {}, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.status === 'success') {
      log('✅ Números generados exitosamente', 'green');
      log(`   Total números: ${response.data.data.total_numeros}`);
      log(`   Estado rifa: ${response.data.data.estado}`);
      return true;
    } else {
      log('❌ Error al generar números', 'red');
      return false;
    }
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    if (message.includes('ya han sido generados')) {
      log('⚠️ Los números ya fueron generados previamente', 'yellow');
      return true; // No es un error real
    } else {
      log(`❌ Error: ${message}`, 'red');
      return false;
    }
  }
}

// Test 8: Ver números de la rifa
async function testVerNumeros() {
  log('\n🎟️ 8. Testing ver números de rifa...', 'blue');
  
  if (!rifaId || !authToken) {
    log('⚠️ Saltando test - Faltan requisitos', 'yellow');
    return false;
  }
  
  try {
    const response = await axios.get(`${BASE_URL}/rifas/${rifaId}/numeros?limit=10`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.status === 'success') {
      log('✅ Números obtenidos exitosamente', 'green');
      log(`   Números mostrados: ${response.data.data.length}`);
      
      if (response.data.data.length > 0) {
        const primerNumero = response.data.data[0];
        log(`   Primer número: ${primerNumero.numero} (${primerNumero.estado})`);
        log(`   QR Code: ${primerNumero.qr_code?.substring(0, 30)}...`);
      }
      
      return true;
    } else {
      log('❌ Error al obtener números', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

// Test 9: Comprar números
async function testComprarNumeros() {
  log('\n💰 9. Testing comprar números...', 'blue');
  
  if (!rifaId || !authToken) {
    log('⚠️ Saltando test - Faltan requisitos', 'yellow');
    return false;
  }
  
  try {
    // Comprar números 1, 2, 3
    const compra = {
      numeros: [1, 2, 3]
    };
    
    const response = await axios.post(`${BASE_URL}/rifas/${rifaId}/comprar`, compra, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.status === 'success') {
      log('✅ Compra realizada exitosamente', 'green');
      log(`   Números comprados: ${response.data.data.numeros_comprados.join(', ')}`);
      log(`   Cantidad: ${response.data.data.cantidad}`);
      log(`   Total pagado: ${response.data.data.total_pagado}`);
      return true;
    } else {
      log('❌ Error en la compra', 'red');
      return false;
    }
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    if (message.includes('no están disponibles')) {
      log('⚠️ Los números ya fueron comprados previamente', 'yellow');
      return true; // No es un error real
    } else {
      log(`❌ Error: ${message}`, 'red');
      return false;
    }
  }
}

// Test 10: Ver mis números comprados
async function testMisNumeros() {
  log('\n🎫 10. Testing mis números comprados...', 'blue');
  
  if (!rifaId || !authToken) {
    log('⚠️ Saltando test - Faltan requisitos', 'yellow');
    return false;
  }
  
  try {
    const response = await axios.get(`${BASE_URL}/rifas/${rifaId}/mis-numeros`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.status === 'success') {
      log('✅ Mis números obtenidos exitosamente', 'green');
      log(`   Números comprados: ${response.data.data.length}`);
      
      response.data.data.forEach(numero => {
        log(`   - Número ${numero.numero}: ${numero.estado} (${numero.fecha_venta || 'Sin fecha'})`);
      });
      
      return true;
    } else {
      log('❌ Error al obtener mis números', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

// Test 11: Estadísticas de rifa
async function testEstadisticas() {
  log('\n📊 11. Testing estadísticas de rifa...', 'blue');
  
  if (!rifaId || !authToken) {
    log('⚠️ Saltando test - Faltan requisitos', 'yellow');
    return false;
  }
  
  try {
    const response = await axios.get(`${BASE_URL}/rifas/${rifaId}/estadisticas`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.data.status === 'success') {
      const stats = response.data.data.resumen;
      log('✅ Estadísticas obtenidas exitosamente', 'green');
      log(`   Total números: ${stats.total_numeros}`);
      log(`   Disponibles: ${stats.disponibles}`);
      log(`   Vendidos: ${stats.vendidos}`);
      log(`   Recaudado: ${stats.recaudado || 0}`);
      log(`   Total compradores: ${stats.total_compradores || 0}`);
      return true;
    } else {
      log('❌ Error al obtener estadísticas', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

// Test 12: Rifas públicas (sin autenticación)
async function testRifasPublicas() {
  log('\n🌐 12. Testing rifas públicas...', 'blue');
  
  try {
    const response = await axios.get(`${BASE_URL}/rifas/publicas`);
    
    if (response.data.status === 'success') {
      log('✅ Rifas públicas obtenidas exitosamente', 'green');
      log(`   Total rifas activas: ${response.data.data.length}`);
      
      response.data.data.forEach(rifa => {
        log(`   - ${rifa.titulo || rifa.nombre} (${rifa.estado})`);
      });
      
      return true;
    } else {
      log('❌ Error al obtener rifas públicas', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.response?.data?.message || error.message}`, 'red');
    return false;
  }
}

// ===================================================
// FUNCIÓN PRINCIPAL DE TESTING
// ===================================================

async function ejecutarTests() {
  log('\n🧪 ========================================', 'bold');
  log('🎯 TESTING COMPLETO - MÓDULO DE RIFAS', 'bold');
  log('🧪 ========================================', 'bold');
  log(`📍 URL Base: ${BASE_URL}`, 'blue');
  
  const tests = [
    { name: 'Conexión', fn: testConexion },
    { name: 'Base de Datos', fn: testBaseDatos },
    { name: 'Login', fn: testLogin },
    { name: 'Listar Rifas', fn: testListarRifas },
    { name: 'Crear Rifa', fn: testCrearRifa },
    { name: 'Detalle Rifa', fn: testDetalleRifa },
    { name: 'Generar Números', fn: testGenerarNumeros },
    { name: 'Ver Números', fn: testVerNumeros },
    { name: 'Comprar Números', fn: testComprarNumeros },
    { name: 'Mis Números', fn: testMisNumeros },
    { name: 'Estadísticas', fn: testEstadisticas },
    { name: 'Rifas Públicas', fn: testRifasPublicas }
  ];
  
  let exitosos = 0;
  let fallidos = 0;
  let omitidos = 0;
  
  for (const test of tests) {
    try {
      const resultado = await test.fn();
      if (resultado === true) {
        exitosos++;
      } else if (resultado === false) {
        fallidos++;
      } else {
        omitidos++;
      }
    } catch (error) {
      log(`❌ Error inesperado en ${test.name}: ${error.message}`, 'red');
      fallidos++;
    }
    
    // Pausa pequeña entre tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Resumen final
  log('\n📊 ========================================', 'bold');
  log('📋 RESUMEN DE TESTS', 'bold');
  log('📊 ========================================', 'bold');
  log(`✅ Exitosos: ${exitosos}`, 'green');
  log(`❌ Fallidos: ${fallidos}`, 'red');
  log(`⚠️ Omitidos: ${omitidos}`, 'yellow');
  log(`📊 Total: ${tests.length}`, 'blue');
  
  const porcentajeExito = Math.round((exitosos / tests.length) * 100);
  log(`🎯 Tasa de éxito: ${porcentajeExito}%`, porcentajeExito >= 80 ? 'green' : 'yellow');
  
  if (porcentajeExito >= 80) {
    log('\n🎉 ¡EXCELENTE! El módulo de rifas está funcionando correctamente', 'green');
  } else if (porcentajeExito >= 60) {
    log('\n⚠️ El módulo funciona parcialmente. Revisar errores.', 'yellow');
  } else {
    log('\n❌ Hay problemas serios. Revisar configuración.', 'red');
  }
  
  log('\n💡 PRÓXIMOS PASOS:', 'blue');
  log('1. Si todos los tests pasan: ¡Continúa con el frontend!');
  log('2. Si hay errores de BD: Ejecuta la migración SQL');
  log('3. Si hay errores de auth: Verifica usuarios en la BD');
  log('4. Si hay errores de conexión: Verifica que el servidor esté corriendo');
  
  process.exit(fallidos > 0 ? 1 : 0);
}

// ===================================================
// CONFIGURACIÓN PARA TESTING ESPECÍFICO
// ===================================================

// Función para testing individual
async function testEspecifico(testName) {
  const testMap = {
    'conexion': testConexion,
    'bd': testBaseDatos,
    'login': testLogin,
    'listar': testListarRifas,
    'crear': testCrearRifa,
    'detalle': testDetalleRifa,
    'generar': testGenerarNumeros,
    'numeros': testVerNumeros,
    'comprar': testComprarNumeros,
    'mis-numeros': testMisNumeros,
    'estadisticas': testEstadisticas,
    'publicas': testRifasPublicas
  };
  
  if (testMap[testName]) {
    log(`\n🧪 Ejecutando test específico: ${testName}`, 'blue');
    const resultado = await testMap[testName]();
    log(`\nResultado: ${resultado ? '✅ EXITOSO' : '❌ FALLIDO'}`, resultado ? 'green' : 'red');
  } else {
    log(`❌ Test no encontrado: ${testName}`, 'red');
    log(`Tests disponibles: ${Object.keys(testMap).join(', ')}`, 'blue');
  }
}

// ===================================================
// EJECUCIÓN
// ===================================================

const args = process.argv.slice(2);

if (args.length > 0) {
  // Ejecutar test específico
  testEspecifico(args[0]);
} else {
  // Ejecutar todos los tests
  ejecutarTests();
}

// ===================================================
// INSTRUCCIONES DE USO
// ===================================================

/*
INSTRUCCIONES DE USO:

1. Instalar dependencias:
   npm install axios

2. Ejecutar todos los tests:
   node test-rifas.js

3. Ejecutar test específico:
   node test-rifas.js conexion
   node test-rifas.js login
   node test-rifas.js crear
   node test-rifas.js comprar

4. Tests disponibles:
   - conexion: Test básico de conectividad
   - bd: Test de base de datos
   - login: Test de autenticación
   - listar: Test de listado de rifas
   - crear: Test de creación de rifa
   - detalle: Test de detalle de rifa
   - generar: Test de generación de números
   - numeros: Test de listado de números
   - comprar: Test de compra de números
   - mis-numeros: Test de números del usuario
   - estadisticas: Test de estadísticas
   - publicas: Test de rifas públicas

REQUISITOS:
- Servidor backend corriendo en puerto 3100
- Base de datos configurada
- Usuario admin creado en la BD
- Tabla rifas migrada correctamente

EJEMPLO DE SALIDA EXITOSA:
✅ Conexión exitosa al servidor
✅ Base de datos conectada correctamente
✅ Login exitoso
✅ Rifa creada exitosamente
... etc
🎉 ¡EXCELENTE! El módulo de rifas está funcionando correctamente
*/