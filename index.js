// =====================================================
// SERVIDOR PRINCIPAL - RIFAS SOLIDARIAS BACKEND
// index.js - CON SOPORTE COMPLETO PARA PRODUCCIÓN
// =====================================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db, { testConnection } from './src/config/db.js';
import { setupSwagger } from './src/config/swagger.js';
import { errorHandler } from './src/middleware/errorHandler.js';

// Importar rutas existentes
import authRoutes from './src/routes/auth.js';
import institucionRoutes from './src/routes/instituciones.js';
import usuariosRoutes from './src/routes/usuarios.js';

// =====================================================
// CONFIGURACIÓN INICIAL
// =====================================================

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3100;

// Detección automática de entorno
const isProduction = process.env.NODE_ENV === 'production' || 
                     process.env.DOMAIN === 'apirifas.huelemu.com.ar' ||
                     process.env.HOST === 'apirifas.huelemu.com.ar' ||
                     process.env.HOSTING === 'huelemu';

const SERVER_CONFIG = {
  API_URL: isProduction ? 'https://apirifas.huelemu.com.ar' : `http://localhost:${PORT}`,
  FRONTEND_URL: isProduction ? 'https://rifas.huelemu.com.ar' : 'http://localhost:4200',
  ENVIRONMENT: isProduction ? 'production' : 'development'
};

console.log('\n🚀 =======================================');
console.log('   🎯 RIFAS SOLIDARIAS - BACKEND API');
console.log(`   🌍 Entorno: ${SERVER_CONFIG.ENVIRONMENT.toUpperCase()}`);
console.log(`   🌐 API: ${SERVER_CONFIG.API_URL}`);
console.log('🚀 =======================================\n');

// =====================================================
// MIDDLEWARE GLOBAL
// =====================================================

// CORS configurado dinámicamente
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',    // React dev
      'http://localhost:3001',    // React alt port
      'http://localhost:4200',    // Angular dev
      'http://localhost:5173',    // Vite dev
      'https://rifas.huelemu.com.ar',  // Producción frontend
      'https://apirifas.huelemu.com.ar', // API producción
      SERVER_CONFIG.FRONTEND_URL,  // URL dinámica
      process.env.FRONTEND_URL,   // URL de .env
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS: Origen rechazado: ${origin}`);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logger de requests (solo en desarrollo)
if (!isProduction) {
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`📡 [${timestamp}] ${req.method} ${req.originalUrl} - ${req.ip}`);
    next();
  });
}

// =====================================================
// VERIFICACIÓN DE SISTEMA
// =====================================================

// Health check endpoint con URLs dinámicas
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Rifas Solidarias API',
    version: '2.0.0',
    environment: SERVER_CONFIG.ENVIRONMENT,
    timestamp: new Date().toISOString(),
    urls: {
      api: SERVER_CONFIG.API_URL,
      frontend: SERVER_CONFIG.FRONTEND_URL,
      documentation: `${SERVER_CONFIG.API_URL}/api-docs`
    },
    endpoints: {
      documentation: '/api-docs',
      auth: '/auth',
      institutions: '/instituciones',
      users: '/usuarios',
      ...(isProduction ? {} : { debug: '/debug/usuarios' })
    }
  });
});

// Test de conexión a base de datos
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    
    res.json({
      status: 'OK',
      environment: SERVER_CONFIG.ENVIRONMENT,
      api_url: SERVER_CONFIG.API_URL,
      database: dbConnected ? 'Connected' : 'Disconnected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      environment: SERVER_CONFIG.ENVIRONMENT,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test detallado de base de datos
app.get('/test-db', async (req, res) => {
  try {
    console.log('🔍 Probando conexión a base de datos...');
    
    const [test] = await db.execute('SELECT 1 as conexion');
    const [info] = await db.execute('SELECT DATABASE() as base, VERSION() as version');
    const [tablas] = await db.execute('SHOW TABLES');
    const [usuarios] = await db.execute('SELECT COUNT(*) as total FROM usuarios');
    const [instituciones] = await db.execute('SELECT COUNT(*) as total FROM instituciones');
    
    console.log('✅ Conexión a BD exitosa');
    
    res.json({
      status: 'OK',
      environment: SERVER_CONFIG.ENVIRONMENT,
      api_url: SERVER_CONFIG.API_URL,
      conexion: test[0].conexion,
      base_datos: info[0].base,
      version: info[0].version,
      total_tablas: tablas.length,
      total_usuarios: usuarios[0].total,
      total_instituciones: instituciones[0].total,
      tablas: tablas.map(table => Object.values(table)[0]),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error en test-db:', error);
    res.status(500).json({
      status: 'ERROR',
      environment: SERVER_CONFIG.ENVIRONMENT,
      error: error.message,
      codigo: error.code
    });
  }
});

// Información del entorno
app.get('/env-info', (req, res) => {
  res.json({
    environment: SERVER_CONFIG.ENVIRONMENT,
    api_url: SERVER_CONFIG.API_URL,
    frontend_url: SERVER_CONFIG.FRONTEND_URL,
    version: '2.0.0',
    node_version: process.version,
    timestamp: new Date().toISOString(),
    debug_available: !isProduction
  });
});

// =====================================================
// RUTAS PRINCIPALES
// =====================================================

console.log('🛣️ Configurando rutas...');

app.use('/auth', authRoutes);
app.use('/instituciones', institucionRoutes);
app.use('/usuarios', usuariosRoutes);

console.log('✅ Rutas configuradas correctamente');

// =====================================================
// ENDPOINTS DE DEBUG (SOLO EN DESARROLLO)
// =====================================================

if (!isProduction) {
  console.log('🐛 Configurando endpoints de debug...');

  // Ver estado de usuarios
  app.get('/debug/usuarios', async (req, res) => {
    try {
      console.log('🔍 Ejecutando diagnóstico de usuarios...');
      
      const [count] = await db.execute('SELECT COUNT(*) as total FROM usuarios');
      const [ultimos] = await db.execute(`
        SELECT id, nombre, apellido, email, rol, fecha_creacion
        FROM usuarios ORDER BY id DESC LIMIT 10
      `);
      
      const [testUsers] = await db.execute(`
        SELECT id, nombre, apellido, email, rol, fecha_creacion
        FROM usuarios 
        WHERE email LIKE '%test%' OR email LIKE '%debug%'
        ORDER BY id DESC
      `);
      
      console.log('✅ Consultas de diagnóstico ejecutadas');
      
      res.json({
        status: 'success',
        environment: 'development',
        timestamp: new Date().toISOString(),
        data: {
          total_usuarios: count[0].total,
          ultimos_usuarios: ultimos,
          usuarios_test: testUsers
        }
      });
      
    } catch (error) {
      console.error('❌ Error en diagnóstico:', error);
      res.status(500).json({ 
        status: 'error',
        error: error.message
      });
    }
  });

  // Limpiar usuarios de prueba
  app.delete('/debug/limpiar-test', async (req, res) => {
    try {
      console.log('🧹 Limpiando usuarios de prueba...');
      
      const [result] = await db.execute(`
        DELETE FROM usuarios 
        WHERE email LIKE '%test%' 
        OR email LIKE '%debug%'
        OR email LIKE '%ejemplo%'
      `);
      
      console.log(`✅ Eliminados ${result.affectedRows} usuarios de prueba`);
      
      res.json({
        status: 'success',
        message: `${result.affectedRows} usuarios de prueba eliminados`,
        affected_rows: result.affectedRows,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error limpiando:', error);
      res.status(500).json({ 
        status: 'error',
        error: error.message 
      });
    }
  });

  // Test simple de conexión
  app.get('/debug/test-connection', async (req, res) => {
    try {
      const [result] = await db.execute('SELECT 1 as test, NOW() as timestamp');
      
      res.json({
        status: 'success',
        message: 'Conexión a base de datos exitosa',
        result: result[0]
      });
      
    } catch (error) {
      res.status(500).json({ 
        status: 'error',
        error: error.message 
      });
    }
  });

  // Registro simplificado para debug
  app.post('/debug/register-simple', async (req, res) => {
    console.log('\n🧪 ================================');
    console.log('   REGISTRO SIMPLIFICADO - DEBUG');
    console.log('🧪 ================================');
    
    try {
      const { nombre, apellido, email, password, rol = 'comprador' } = req.body;
      
      console.log('📝 Datos recibidos:', { nombre, apellido, email, rol });

      // Verificar email único
      console.log('🔍 Verificando email único...');
      const [existing] = await db.execute('SELECT id, email FROM usuarios WHERE email = ?', [email]);
      
      if (existing.length > 0) {
        console.log('❌ Email ya existe:', existing[0]);
        return res.status(409).json({
          status: 'error',
          message: 'Email ya existe',
          debug: { existingUser: existing[0] }
        });
      }
      console.log('✅ Email disponible');

      // Hash de password
      console.log('🔍 Encriptando password...');
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.default.hash(password, 10);
      console.log('✅ Password encriptado');

      // Contar usuarios antes
      console.log('🔍 Contando usuarios ANTES del insert...');
      const [beforeCount] = await db.execute('SELECT COUNT(*) as total FROM usuarios');
      console.log('📊 Usuarios antes:', beforeCount[0].total);

      // INSERT con máximo detalle
      console.log('🔍 Ejecutando INSERT...');
      const insertSQL = `INSERT INTO usuarios (nombre, apellido, email, password, rol) VALUES (?, ?, ?, ?, ?)`;
      const insertParams = [nombre, apellido, email, hashedPassword, rol];
      
      const [insertResult] = await db.execute(insertSQL, insertParams);
      
      console.log('✅ INSERT ejecutado:', {
        insertId: insertResult.insertId,
        affectedRows: insertResult.affectedRows
      });

      // Verificar que se insertó
      console.log('🔍 Verificando inserción...');
      const [afterCount] = await db.execute('SELECT COUNT(*) as total FROM usuarios');
      console.log('📊 Usuarios después:', afterCount[0].total);
      
      const usuariosCreados = afterCount[0].total - beforeCount[0].total;
      console.log('📈 Usuarios creados:', usuariosCreados);

      // Recuperar usuario insertado
      console.log('🔍 Recuperando usuario creado...');
      const [newUser] = await db.execute('SELECT * FROM usuarios WHERE id = ?', [insertResult.insertId]);
      
      if (newUser.length === 0) {
        throw new Error(`Usuario con ID ${insertResult.insertId} no encontrado después del INSERT`);
      }
      
      console.log('✅ Usuario recuperado:', { id: newUser[0].id, email: newUser[0].email });

      // Generar token simple
      console.log('🔍 Generando token...');
      const jwt = await import('jsonwebtoken');
      const token = jwt.default.sign(
        { id: insertResult.insertId, email }, 
        process.env.JWT_SECRET || 'default_secret', 
        { expiresIn: '1h' }
      );
      console.log('✅ Token generado');

      console.log('🎉 REGISTRO COMPLETADO EXITOSAMENTE\n');

      res.status(201).json({
        status: 'success',
        message: 'Usuario creado exitosamente con debug',
        data: {
          user: {
            id: newUser[0].id,
            nombre: newUser[0].nombre,
            apellido: newUser[0].apellido,
            email: newUser[0].email,
            rol: newUser[0].rol
          },
          token,
          debug: {
            insertId: insertResult.insertId,
            affectedRows: insertResult.affectedRows,
            usuariosAntes: beforeCount[0].total,
            usuariosDespues: afterCount[0].total,
            usuariosCreados: usuariosCreados
          }
        }
      });

    } catch (error) {
      console.error('💥 ERROR EN REGISTRO SIMPLIFICADO:');
      console.error('📝 Mensaje:', error.message);
      console.error('📚 Stack:', error.stack);
      
      res.status(500).json({
        status: 'error',
        message: 'Error en registro simplificado',
        debug: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  console.log('✅ Endpoints de debug configurados');
}

// =====================================================
// RUTAS DE UTILIDAD
// =====================================================

// Test de CORS (solo en desarrollo)
if (!isProduction) {
  app.get('/test-cors', (req, res) => {
    res.json({
      message: 'CORS funcionando correctamente',
      environment: 'development',
      origin: req.get('Origin'),
      api_url: SERVER_CONFIG.API_URL,
      timestamp: new Date().toISOString()
    });
  });
}

// =====================================================
// DOCUMENTACIÓN SWAGGER
// =====================================================

try {
  setupSwagger(app);
  console.log(`📚 Swagger configurado en ${SERVER_CONFIG.API_URL}/api-docs`);
} catch (error) {
  console.warn('⚠️ Error configurando Swagger:', error.message);
}

// =====================================================
// DOCUMENTACIÓN SWAGGER PARA ENDPOINTS DE SISTEMA
// =====================================================

/**
 * @swagger
 * tags:
 *   - name: Sistema
 *     description: Endpoints de monitoreo y estado del sistema
 *   - name: Debug
 *     description: Endpoints de debugging y testing (solo desarrollo)
 *   - name: Autenticación
 *     description: Endpoints de autenticación y autorización
 *   - name: Usuarios
 *     description: Gestión de usuarios del sistema
 *   - name: Instituciones
 *     description: Gestión de instituciones y organizaciones
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health check básico del sistema
 *     description: Retorna información básica del estado del servidor con URLs dinámicas
 *     tags: [Sistema]
 *     responses:
 *       200:
 *         description: Servidor funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 service:
 *                   type: string
 *                   example: Rifas Solidarias API
 *                 version:
 *                   type: string
 *                   example: 2.0.0
 *                 environment:
 *                   type: string
 *                   example: production
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 urls:
 *                   type: object
 *                   properties:
 *                     api:
 *                       type: string
 *                       example: https://apirifas.huelemu.com.ar
 *                     frontend:
 *                       type: string
 *                       example: https://rifas.huelemu.com.ar
 */

/**
 * @swagger
 * /env-info:
 *   get:
 *     summary: Información del entorno actual
 *     description: Retorna información detallada sobre el entorno de ejecución
 *     tags: [Sistema]
 *     responses:
 *       200:
 *         description: Información del entorno obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 environment:
 *                   type: string
 *                   example: production
 *                 api_url:
 *                   type: string
 *                   example: https://apirifas.huelemu.com.ar
 *                 debug_available:
 *                   type: boolean
 *                   example: false
 */

// =====================================================
// MIDDLEWARE DE ERRORES
// =====================================================

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  const availableEndpoints = [
    'GET /',
    'GET /health',
    'GET /test-db',
    'GET /env-info',
    'GET /api-docs',
    'POST /auth/login',
    'POST /auth/register',
    'GET /instituciones',
    'GET /usuarios'
  ];

  // Agregar endpoints de debug solo en desarrollo
  if (!isProduction) {
    availableEndpoints.push(
      'GET /debug/usuarios',
      'POST /debug/register-simple',
      'GET /test-cors'
    );
  }

  res.status(404).json({
    status: 'error',
    message: 'Endpoint no encontrado',
    path: req.originalUrl,
    method: req.method,
    environment: SERVER_CONFIG.ENVIRONMENT,
    api_url: SERVER_CONFIG.API_URL,
    timestamp: new Date().toISOString(),
    available_endpoints: availableEndpoints
  });
});

// Middleware global de manejo de errores
app.use(errorHandler);

// =====================================================
// INICIALIZACIÓN DEL SERVIDOR
// =====================================================

async function startServer() {
  try {
    // Verificar conexión a base de datos
    console.log('🔍 Verificando conexión a base de datos...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ No se pudo conectar a la base de datos');
      console.error('   Verifica tu configuración en .env');
      process.exit(1);
    }
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log('\n🎉 =======================================');
      console.log(`   ✅ SERVIDOR INICIADO EXITOSAMENTE`);
      console.log(`   🌍 Entorno: ${SERVER_CONFIG.ENVIRONMENT.toUpperCase()}`);
      console.log(`   🌐 URL: ${SERVER_CONFIG.API_URL}`);
      console.log(`   📚 Docs: ${SERVER_CONFIG.API_URL}/api-docs`);
      console.log(`   🏥 Health: ${SERVER_CONFIG.API_URL}/health`);
      console.log(`   🖥️ Frontend: ${SERVER_CONFIG.FRONTEND_URL}`);
      console.log(`   🗄️ Base de datos: ${process.env.DB_NAME}`);
      console.log('🎉 =======================================\n');
      
      if (!isProduction) {
        console.log('💡 ENDPOINTS DE DEBUG DISPONIBLES:');
        console.log(`   • GET ${SERVER_CONFIG.API_URL}/debug/usuarios`);
        console.log(`   • DELETE ${SERVER_CONFIG.API_URL}/debug/limpiar-test`);
        console.log(`   • POST ${SERVER_CONFIG.API_URL}/debug/register-simple`);
        console.log(`   • GET ${SERVER_CONFIG.API_URL}/test-cors\n`);
      }
    });
    
  } catch (error) {
    console.error('\n💥 =======================================');
    console.error('   ❌ ERROR AL INICIAR SERVIDOR');
    console.error('💥 =======================================');
    console.error('Error:', error.message);
    
    console.log('\n🔧 POSIBLES SOLUCIONES:');
    console.log('1. Verificar que MariaDB esté ejecutándose');
    console.log('2. Revisar configuración en .env');
    console.log('3. Verificar que la base de datos exista');
    console.log('4. Revisar permisos de usuario de base de datos');
    
    process.exit(1);
  }
}

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('💥 Excepción no capturada:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Promesa rechazada no manejada:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 Cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 Cerrando servidor...');
  process.exit(0);
});

// Iniciar servidor
startServer();