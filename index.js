// index.js - Con configuración CORS corregida
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSwagger } from './src/config/swagger.js';
import db from './src/config/db.js';

// Importar rutas
import authRoutes from './src/routes/auth.js';
import institucionRoutes from './src/routes/instituciones.js';
import usuariosRoutes from './src/routes/usuarios.js';

// Configurar variables de entorno
dotenv.config();

const app = express();

// CONFIGURACIÓN CORS CORREGIDA
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (como apps móviles, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Lista de origins permitidos
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:5173',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:8000',
      'http://127.0.0.1:8000',
      'http://localhost:3100', // Para Swagger
      // Agregar más según necesites
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('🚫 CORS blocked origin:', origin);
      callback(null, true); // En desarrollo, permitir todos los origins
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Middleware adicional para manejar preflight requests
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware para logging de requests con más detalle
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('origin') || 'No origin'}`);
  next();
});

// Test de conexión a BD mejorado
app.get('/test-db', async (req, res) => {
  try {
    const [test] = await db.execute('SELECT 1 as conexion');
    const [info] = await db.execute('SELECT DATABASE() as base, VERSION() as version');
    const [tablas] = await db.execute('SHOW TABLES');
    const [usuarios] = await db.execute('SELECT COUNT(*) as total FROM usuarios');
    const [instituciones] = await db.execute('SELECT COUNT(*) as total FROM instituciones');
    
    // Verificar tablas de autenticación
    const tablasAuth = await Promise.all([
      db.execute("SHOW TABLES LIKE 'log_intentos_login'"),
      db.execute("SHOW TABLES LIKE 'sesiones_activas'"),
      db.execute("SHOW TABLES LIKE 'configuraciones_sistema'")
    ]);
    
    res.json({
      status: 'OK',
      conexion: test[0].conexion,
      base_datos: info[0].base,
      version: info[0].version,
      total_tablas: tablas.length,
      estadisticas: {
        usuarios: usuarios[0].total,
        instituciones: instituciones[0].total
      },
      auth_tables: {
        log_intentos_login: tablasAuth[0][0].length > 0,
        sesiones_activas: tablasAuth[1][0].length > 0,
        configuraciones_sistema: tablasAuth[2][0].length > 0
      },
      cors: {
        origin_allowed: req.get('origin') || 'No origin header',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error en test-db:', error);
    res.status(500).json({
      error: error.message,
      codigo: error.code
    });
  }
});

// Test específico para JWT
app.get('/test-jwt', (req, res) => {
  const jwtConfig = {
    access_secret: process.env.JWT_ACCESS_SECRET ? '✅ Configurado' : '❌ Falta configurar',
    refresh_secret: process.env.JWT_REFRESH_SECRET ? '✅ Configurado' : '❌ Falta configurar',
    access_expires: process.env.JWT_ACCESS_EXPIRES || '15m (default)',
    refresh_expires: process.env.JWT_REFRESH_EXPIRES || '7d (default)'
  };

  res.json({
    status: 'JWT Configuration',
    config: jwtConfig,
    warnings: [
      !process.env.JWT_ACCESS_SECRET && 'JWT_ACCESS_SECRET no configurado - usando valor por defecto',
      !process.env.JWT_REFRESH_SECRET && 'JWT_REFRESH_SECRET no configurado - usando valor por defecto'
    ].filter(Boolean),
    cors_test: {
      origin: req.get('origin') || 'No origin',
      user_agent: req.get('user-agent')
    }
  });
});

// Test específico para CORS
app.get('/test-cors', (req, res) => {
  res.json({
    message: '¡CORS funcionando correctamente!',
    origin: req.get('origin'),
    method: req.method,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
});

// Rutas principales
app.use('/auth', authRoutes);
app.use('/instituciones', institucionRoutes);
app.use('/usuarios', usuariosRoutes);

// Documentación Swagger
setupSwagger(app);

// Ruta raíz actualizada
app.get('/', (req, res) => {
  res.json({
    mensaje: 'API Rifas Solidarias',
    version: '1.0.0',
    status: 'Funcionando',
    server_time: new Date().toISOString(),
    endpoints: {
      autenticacion: {
        register: 'POST /auth/register - Registrar usuario',
        login: 'POST /auth/login - Iniciar sesión',
        refresh: 'POST /auth/refresh - Renovar token',
        logout: 'POST /auth/logout - Cerrar sesión',
        profile: 'GET /auth/me - Obtener perfil'
      },
      instituciones: 'GET|POST|PUT|DELETE /instituciones - Gestión de instituciones',
      usuarios: 'GET|POST|PUT|DELETE /usuarios - Gestión de usuarios',
      testing: {
        database: 'GET /test-db - Verificar conexión BD',
        jwt: 'GET /test-jwt - Verificar configuración JWT',
        cors: 'GET /test-cors - Verificar CORS'
      },
      documentacion: 'GET /api-docs - Documentación Swagger'
    },
    auth_info: {
      access_token_expires: process.env.JWT_ACCESS_EXPIRES || '15m',
      refresh_token_expires: process.env.JWT_REFRESH_EXPIRES || '7d',
      bearer_header: 'Authorization: Bearer <access_token>'
    },
    cors_info: {
      origin_header: req.get('origin') || 'No origin header',
      cors_enabled: true
    }
  });
});

// Middleware de manejo de errores
app.use((error, req, res, next) => {
  console.error('Error no manejado:', error);
  
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      status: 'error',
      message: 'JSON inválido en el cuerpo de la petición'
    });
  }
  
  res.status(500).json({
    status: 'error',
    message: 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { details: error.message })
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  console.log(`🔍 Ruta no encontrada: ${req.method} ${req.originalUrl} - Origin: ${req.get('origin')}`);
  res.status(404).json({
    status: 'error',
    message: 'Endpoint no encontrado',
    path: req.originalUrl,
    method: req.method,
    available_endpoints: [
      'GET /',
      'GET /test-db',
      'GET /test-jwt',
      'GET /test-cors',
      'POST /auth/register',
      'POST /auth/login',
      'POST /auth/refresh',
      'POST /auth/logout',
      'GET /auth/me',
      'GET /instituciones',
      'GET /usuarios',
      'GET /api-docs'
    ]
  });
});

const PORT = process.env.PORT || 3100;

app.listen(PORT, () => {
  console.log('\n🚀 =======================================');
  console.log(`   Servidor iniciado en puerto ${PORT}`);
  console.log('🚀 =======================================');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📚 Docs: http://localhost:${PORT}/api-docs`);
  console.log(`🔍 Test DB: http://localhost:${PORT}/test-db`);
  console.log(`🔐 Test JWT: http://localhost:${PORT}/test-jwt`);
  console.log(`🌐 Test CORS: http://localhost:${PORT}/test-cors`);
  console.log('🚀 =======================================\n');
  
  // Verificar configuración de JWT
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    console.log('⚠️  WARNING: JWT secrets usando valores por defecto');
    console.log('   Configura JWT_ACCESS_SECRET y JWT_REFRESH_SECRET en .env');
  }
  
  console.log('✅ CORS configurado para origins múltiples');
  console.log('✅ Servidor listo para recibir requests del frontend');
});