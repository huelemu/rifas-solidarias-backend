// =====================================================
// SCRIPT DE TESTING COMPLETO PARA MÓDULO RIFAS
// test/test-rifas-completo.js
// =====================================================

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Configuración del API
const API_BASE = 'http://localhost:3100';
const TEST_RESULTS_FILE = 'test-results-rifas.json';

// Colores para la consola
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Estado global del testing
let testResults = {
  startTime: new Date(),
  endTime: null,
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  errors: [],
  tokens: {},
  testData: {}
};

// Función helper para hacer requests
async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };
  
  if (options.body && typeof options.body === 'object') {
    options.body = JSON.stringify(options.body);
  }
  
  const finalOptions = { ...defaultOptions, ...options };
  
  try {
    const response = await fetch(url, finalOptions);
    const data = await response.json();
    
    return {
      status: response.status,
      ok: response.ok,
      data: data
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message
    };
  }
}

// Función para logging con colores
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Función para ejecutar un test
async function runTest(name, testFunction) {
  testResults.totalTests++;
  
  try {
    log(`\n🧪 Ejecutando: ${name}`, 'blue');
    await testFunction();
    testResults.passedTests++;
    log(`✅ PASÓ: ${name}`, 'green');
    return true;
  } catch (error) {
    testResults.failedTests++;
    testResults.errors.push({
      test: name,
      error: error.message,
      timestamp: new Date()
    });
    log(`❌ FALLÓ: ${name}`, 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

// Función helper para autenticación
async function authenticate() {
  log('\n🔐 Configurando autenticación...', 'yellow');
  
  // Intentar login con usuario de prueba
  const loginResponse = await makeRequest('/auth/login', {
    method: 'POST',
    body: {
      email: 'admin@test.com',
      password: 'test123'
    }
  });
  
  if (loginResponse.ok && loginResponse.data.status === 'success') {
    testResults.tokens.accessToken = loginResponse.data.data.accessToken;
    testResults.tokens.refreshToken = loginResponse.data.data.refreshToken;
    log('✅ Autenticación exitosa', 'green');
    return true;
  } else {
    // Si falla, intentar crear usuario de prueba
    log('⚠️ Login falló, intentando crear usuario de prueba...', 'yellow');
    
    const registerResponse = await makeRequest('/auth/register', {
      method: 'POST',
      body: {
        nombre: 'Admin',
        apellido: 'Test',
        email: 'admin@test.com',
        password: 'test123',
        rol: 'admin_global',
        telefono: '+541234567890'
      }
    });
    
    if (registerResponse.ok) {
      // Intentar login nuevamente
      const loginRetry = await makeRequest('/auth/login', {
        method: 'POST',
        body: {
          email: 'admin@test.com',
          password: 'test123'
        }
      });
      
      if (loginRetry.ok && loginRetry.data.status === 'success') {
        testResults.tokens.accessToken = loginRetry.data.data.accessToken;
        testResults.tokens.refreshToken = loginRetry.data.data.refreshToken;
        log('✅ Usuario creado y autenticación exitosa', 'green');
        return true;
      }
    }
    
    throw new Error('No se pudo autenticar ni crear usuario de prueba');
  }
}

// Headers con autenticación
function getAuthHeaders() {
  return {
    'Authorization': `Bearer ${testResults.tokens.accessToken}`
  };
}

// =====================================================
// TESTS ESPECÍFICOS DEL MÓDULO RIFAS
// =====================================================

// Test 1: Verificar que el servidor esté corriendo
async function testServerHealth() {
  const response = await makeRequest('/');
  
  if (!response.ok) {
    throw new Error(`Servidor no responde: ${response.status}`);
  }
  
  if (!response.data.modules || !response.data.modules.includes('rifas')) {
    throw new Error('Módulo de rifas no está disponible');
  }
  
  log(`   📡 Servidor funcionando, versión: ${response.data.version}`, 'blue');
}

// Test 2: Verificar conexión a base de datos
async function testDatabase() {
  const response = await makeRequest('/test-db');
  
  if (!response.ok) {
    throw new Error(`Error en base de datos: ${response.status}`);
  }
  
  if (response.data.status !== 'OK') {
    throw new Error('Base de datos no está funcionando correctamente');
  }
  
  log(`   🗄️ BD: ${response.data.base_datos}, Tablas: ${response.data.total_tablas}`, 'blue');
  log(`   📊 Rifas: ${response.data.estadisticas.rifas}, Activas: ${response.data.estadisticas.rifas_activas}`, 'blue');
}

// Test 3: Listar rifas públicas (sin autenticación)
async function testListarRifasPublicas() {
  const response = await makeRequest('/rifas/publicas');
  
  if (!response.ok) {
    throw new Error(`Error al listar rifas públicas: ${response.status}`);
  }
  
  if (response.data.status !== 'success') {
    throw new Error('Respuesta inválida de rifas públicas');
  }
  
  log(`   🎪 Rifas públicas encontradas: ${response.data.data.length}`, 'blue');
}

// Test 4: Listar rifas (con autenticación)
async function testListarRifas() {
  const response = await makeRequest('/rifas', {
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    throw new Error(`Error al listar rifas: ${response.status}`);
  }
  
  if (response.data.status !== 'success') {
    throw new Error('Respuesta inválida de rifas');
  }
  
  testResults.testData.rifasExistentes = response.data.data;
  log(`   🎟️ Total rifas: ${response.data.data.length}`, 'blue');
}

// Test 5: Crear nueva rifa
async function testCrearRifa() {
  const nuevaRifa = {
    nombre: 'Rifa de Prueba Automatizada',
    descripcion: 'Rifa creada automáticamente para testing',
    cantidad_numeros: 100,
    precio_numero: 50.00,
    fecha_inicio: new Date().toISOString(),
    fecha_fin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 días
    fecha_sorteo: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(), // 35 días
    institucion_promotora_id: 1, // Asumiendo que existe institución con ID 1
    reglas_adicionales: 'Reglas de prueba para testing automatizado'
  };
  
  const response = await makeRequest('/rifas', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: nuevaRifa
  });
  
  if (!response.ok) {
    throw new Error(`Error al crear rifa: ${response.status} - ${response.data?.message || 'Error desconocido'}`);
  }
  
  if (response.data.status !== 'success') {
    throw new Error(`Fallo al crear rifa: ${response.data.message}`);
  }
  
  testResults.testData.