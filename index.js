// =====================================================
// SERVIDOR PRINCIPAL - RIFAS SOLIDARIAS BACKEND
// index.js
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
// import rifasRoutes from './src/routes/rifas.js'; // Comentado temporalmente

// =====================================================
// CONFIGURACIÓN INICIAL
// =====================================================

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3100;

console.log('\n🚀 =======================================');
console.log('   🎯 RIFAS SOLIDARIAS - BACKEND API');
console.log('🚀 =======================================\n');

// =====================================================
// MIDDLEWARE GLOBAL
// =====================================================

// CORS configurado para desarrollo y producción
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',    // React dev
      'http://localhost:3001',    // React alt port
      'http://localhost:4200',    // Angular dev
      'http://localhost:5173',    // Vite dev
      'https://rifas.huelemu.com.ar',  // Producción frontend
      process.env.FRONTEND_URL,   // URL de producción adicional
    ].filter(Boolean);

    // En desarrollo, permitir requests sin origin (Postman, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
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

// Logger de requests simple (solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`📡 [${timestamp}] ${req.method} ${req.originalUrl} - ${req.ip}`);
    next();
  });
}

// =====================================================
// VERIFICACIÓN DE SISTEMA
// =====================================================

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Rifas Solidarias API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      documentation: '/api-docs',
      auth: '/auth',
      institutions: '/instituciones',
      users: '/usuarios',
      debug: '/debug/usuarios'
    }
  });
});

// Test de conexión a base de datos
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    
    res.json({
      status: 'OK',
      database: dbConnected ? 'Connected' : 'Disconnected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
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
      error: error.message,
      codigo: error.code
    });
  }
});

// =====================================================
// RUTAS PRINCIPALES
// =====================================================

console.log('🛣️ Configurando rutas...');

// Rutas de autenticación
app.use('/auth', authRoutes);

// Rutas de recursos principales
app.use('/instituciones', institucionRoutes);
app.use('/usuarios', usuariosRoutes);

// Rutas de rifas (comentado temporalmente)
// app.use('/rifas', rifasRoutes);

console.log('✅ Rutas configuradas correctamente');

// =====================================================
// ENDPOINTS DE DEBUG TEMPORAL
// =====================================================

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

// =====================================================
// RUTAS DE UTILIDAD
// =====================================================

// Test de CORS (solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
  app.get('/test-cors', (req, res) => {
    res.json({
      message: 'CORS funcionando correctamente',
      origin: req.get('Origin'),
      timestamp: new Date().toISOString()
    });
  });
}

// =====================================================
// DOCUMENTACIÓN SWAGGER
// =====================================================

try {
  setupSwagger(app);
  console.log('📚 Swagger configurado en /api-docs');
} catch (error) {
  console.warn('⚠️ Error configurando Swagger:', error.message);
}

// =====================================================
// DOCUMENTACIÓN SWAGGER PARA ENDPOINTS DE SISTEMA
// Agregar esto a tu index.js después de los endpoints pero antes del errorHandler
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
 *   - name: Rifas
 *     description: Gestión de rifas y sorteos (próximamente)
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health check básico del sistema
 *     description: Retorna información básica del estado del servidor y endpoints disponibles
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
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: development
 *                 endpoints:
 *                   type: object
 *                   properties:
 *                     documentation:
 *                       type: string
 *                       example: /api-docs
 *                     auth:
 *                       type: string
 *                       example: /auth
 *                     institutions:
 *                       type: string
 *                       example: /instituciones
 *                     users:
 *                       type: string
 *                       example: /usuarios
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Estado detallado del sistema
 *     description: Verifica el estado del servidor, base de datos y recursos del sistema
 *     tags: [Sistema]
 *     responses:
 *       200:
 *         description: Sistema funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 database:
 *                   type: string
 *                   example: Connected
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Tiempo de funcionamiento en segundos
 *                   example: 3600.5
 *                 memory:
 *                   type: object
 *                   properties:
 *                     rss:
 *                       type: number
 *                     heapTotal:
 *                       type: number
 *                     heapUsed:
 *                       type: number
 *                     external:
 *                       type: number
 *       500:
 *         description: Error en el sistema
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ERROR
 *                 error:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */

/**
 * @swagger
 * /test-db:
 *   get:
 *     summary: Test detallado de conexión a base de datos
 *     description: Verifica conectividad, versión y estado de las tablas principales
 *     tags: [Sistema]
 *     responses:
 *       200:
 *         description: Base de datos funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 conexion:
 *                   type: integer
 *                   example: 1
 *                 base_datos:
 *                   type: string
 *                   example: rifas_solidarias_nuevo
 *                 version:
 *                   type: string
 *                   example: 10.6.16-MariaDB
 *                 total_tablas:
 *                   type: integer
 *                   example: 12
 *                 total_usuarios:
 *                   type: integer
 *                   example: 8
 *                 total_instituciones:
 *                   type: integer
 *                   example: 4
 *                 tablas:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["usuarios", "instituciones", "rifas", "auth_logs"]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Error de conexión a base de datos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ERROR
 *                 error:
 *                   type: string
 *                 codigo:
 *                   type: string
 */

/**
 * @swagger
 * /debug/usuarios:
 *   get:
 *     summary: Diagnóstico de usuarios (solo desarrollo)
 *     description: Muestra estadísticas y últimos usuarios creados para debugging
 *     tags: [Debug]
 *     responses:
 *       200:
 *         description: Diagnóstico completado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_usuarios:
 *                       type: integer
 *                       example: 8
 *                     ultimos_usuarios:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           nombre:
 *                             type: string
 *                           apellido:
 *                             type: string
 *                           email:
 *                             type: string
 *                           rol:
 *                             type: string
 *                           fecha_creacion:
 *                             type: string
 *                             format: date-time
 *                     usuarios_test:
 *                       type: array
 *                       items:
 *                         type: object
 */

/**
 * @swagger
 * /debug/limpiar-test:
 *   delete:
 *     summary: Limpiar usuarios de prueba (solo desarrollo)
 *     description: Elimina todos los usuarios de testing y debug de la base de datos
 *     tags: [Debug]
 *     responses:
 *       200:
 *         description: Usuarios de prueba eliminados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: 3 usuarios de prueba eliminados
 *                 affected_rows:
 *                   type: integer
 *                   example: 3
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */

/**
 * @swagger
 * /debug/test-connection:
 *   get:
 *     summary: Test simple de conexión (solo desarrollo)
 *     description: Verifica conexión básica a la base de datos
 *     tags: [Debug]
 *     responses:
 *       200:
 *         description: Conexión exitosa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Conexión a base de datos exitosa
 *                 result:
 *                   type: object
 *                   properties:
 *                     test:
 *                       type: integer
 *                       example: 1
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 */

/**
 * @swagger
 * /debug/register-simple:
 *   post:
 *     summary: Registro simplificado con debug (solo desarrollo)
 *     description: Endpoint de registro con logs detallados para debugging
 *     tags: [Debug]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - apellido
 *               - email
 *               - password
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Debug
 *               apellido:
 *                 type: string
 *                 example: User
 *               email:
 *                 type: string
 *                 format: email
 *                 example: debug.user@test.com
 *               password:
 *                 type: string
 *                 example: 123456
 *               rol:
 *                 type: string
 *                 enum: [admin_global, admin_institucion, vendedor, comprador]
 *                 default: comprador
 *                 example: comprador
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente con información de debug
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Usuario creado exitosamente con debug
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         nombre:
 *                           type: string
 *                         apellido:
 *                           type: string
 *                         email:
 *                           type: string
 *                         rol:
 *                           type: string
 *                     token:
 *                       type: string
 *                     debug:
 *                       type: object
 *                       properties:
 *                         insertId:
 *                           type: integer
 *                         affectedRows:
 *                           type: integer
 *                         usuariosAntes:
 *                           type: integer
 *                         usuariosDespues:
 *                           type: integer
 *                         usuariosCreados:
 *                           type: integer
 *       409:
 *         description: Email ya existe
 *       500:
 *         description: Error interno del servidor
 * 
 */

// =====================================================
// MIDDLEWARE DE ERRORES
// =====================================================

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint no encontrado',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    available_endpoints: [
      'GET /',
      'GET /health',
      'GET /test-db',
      'GET /api-docs',
      'POST /auth/login',
      'POST /auth/register',
      'GET /instituciones',
      'GET /usuarios',
      'GET /debug/usuarios',
      'POST /debug/register-simple'
    ]
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
      console.log(`   🌐 URL: http://localhost:${PORT}`);
      console.log(`   📚 Docs: http://localhost:${PORT}/api-docs`);
      console.log(`   🏥 Health: http://localhost:${PORT}/health`);
      console.log(`   🗄️ Base de datos: ${process.env.DB_NAME}`);
      console.log(`   🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log('🎉 =======================================\n');
      
      if (process.env.NODE_ENV === 'development') {
        console.log('💡 ENDPOINTS DE DEBUG DISPONIBLES:');
        console.log('   • GET /debug/usuarios - Ver estado de usuarios');
        console.log('   • DELETE /debug/limpiar-test - Limpiar usuarios de prueba');
        console.log('   • POST /debug/register-simple - Registro con debug');
        console.log('   • GET /debug/test-connection - Test de conexión\n');
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