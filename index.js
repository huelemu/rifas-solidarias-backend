// index.js - Servidor completo corregido para Huelemu
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSwagger } from './src/config/swagger.js';
import db from './src/config/db.js';

// Importar rutas
import authRoutes from './src/routes/auth.js';
import institucionRoutes from './src/routes/instituciones.js';
import usuariosRoutes from './src/routes/usuarios.js';

// Importar middleware de autenticación
import { authenticateToken } from './src/middleware/auth.js';

// Configurar variables de entorno PRIMERO
dotenv.config();

// Crear la aplicación Express
const app = express();

console.log('🔧 Iniciando servidor...');
console.log('📦 Express app creada correctamente');

// CONFIGURACIÓN CORS ACTUALIZADA PARA HUELEMU
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (como apps móviles, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Lista de origins permitidos - ACTUALIZADA PARA HUELEMU
    const allowedOrigins = [
      // Desarrollo local
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:5173',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:8000',
      'http://127.0.0.1:8000',
      'http://localhost:3100', // Para Swagger
      
      // PRODUCCIÓN HUELEMU
      'https://rifas.huelemu.com.ar',      // Frontend principal
      'http://rifas.huelemu.com.ar',       // Fallback sin SSL
      'https://apirifas.huelemu.com.ar',   // Backend (para Swagger)
      'http://apirifas.huelemu.com.ar',    // Fallback sin SSL
      
      // Subdominios adicionales
      'https://www.rifas.huelemu.com.ar',
      'http://www.rifas.huelemu.com.ar',
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

// Aplicar CORS
app.use(cors(corsOptions));
console.log('🌐 CORS configurado correctamente');

// Middleware adicional para manejar preflight requests
app.options('*', cors(corsOptions));

// Middleware para parsing de JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware para logging de requests
app.use((req, res, next) => {
  const origin = req.get('origin') || 'No origin';
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${origin}`);
  next();
});

// =======================================
// ENDPOINTS DE TESTING
// =======================================

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    mensaje: 'API Rifas Solidarias - Huelemu',
    version: '1.0.0',
    status: 'Funcionando correctamente',
    server_time: new Date().toISOString(),
    frontend_url: 'https://rifas.huelemu.com.ar',
    backend_url: 'https://apirifas.huelemu.com.ar',
    endpoints: [
      'POST /auth/register',
      'POST /auth/login',
      'POST /auth/refresh',
      'POST /auth/logout',
      'GET /auth/me',
      'GET /instituciones',
      'GET /usuarios',
      'GET /api-docs',
      'GET /test-db',
      'GET /test-jwt',
      'GET /test-cors',
      'GET /test-huelemu'
    ]
  });
});

// Test de conexión a BD
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
      !process.env.JWT_ACCESS_SECRET && 'JWT_ACCESS_SECRET no configurado',
      !process.env.JWT_REFRESH_SECRET && 'JWT_REFRESH_SECRET no configurado'
    ].filter(Boolean)
  });
});

// Test específico para CORS
app.get('/test-cors', (req, res) => {
  const origin = req.get('origin');
  
  res.json({
    message: '✅ CORS funcionando correctamente',
    timestamp: new Date().toISOString(),
    origin: origin,
    frontend_url_esperada: 'https://rifas.huelemu.com.ar',
    backend_url: 'https://apirifas.huelemu.com.ar',
    cors_status: '✅ Configurado para Huelemu'
  });
});

// Test específico para Huelemu
app.get('/test-huelemu', (req, res) => {
  const expectedOrigin = 'https://rifas.huelemu.com.ar';
  const actualOrigin = req.get('origin');
  
  res.json({
    message: '🔍 Test específico para Huelemu',
    status: actualOrigin === expectedOrigin ? '✅ CORRECTO' : '⚠️ VERIFICAR',
    expected_origin: expectedOrigin,
    actual_origin: actualOrigin,
    backend_url: 'https://apirifas.huelemu.com.ar',
    recommendations: actualOrigin !== expectedOrigin ? [
      'Verificar que estés accediendo desde https://rifas.huelemu.com.ar',
      'Verificar configuración SSL',
      'Revisar DNS del dominio'
    ] : ['Todo configurado correctamente']
  });
});

// =======================================
// ENDPOINTS DE ESTADÍSTICAS
// =======================================

// Estadísticas públicas
app.get('/stats/public', async (req, res) => {
  try {
    console.log('📊 Solicitando estadísticas públicas...');
    
    const [totalInstituciones] = await db.execute(
      'SELECT COUNT(*) as total FROM instituciones'
    );
    
    const [totalUsuarios] = await db.execute(
      'SELECT COUNT(*) as total FROM usuarios'
    );
    
    const [usuariosPorRol] = await db.execute(
      'SELECT rol, COUNT(*) as cantidad FROM usuarios GROUP BY rol'
    );
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      estadisticas: {
        total_instituciones: totalInstituciones[0].total,
        total_usuarios: totalUsuarios[0].total,
        usuarios_por_rol: usuariosPorRol
      }
    });
  } catch (error) {
    console.error('❌ Error en estadísticas públicas:', error);
    res.status(500).json({
      status: 'ERROR',
      error: error.message
    });
  }
});

// Estadísticas de usuario (requiere autenticación)
app.get('/stats/user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Estadísticas específicas del usuario
    const [userStats] = await db.execute(
      'SELECT * FROM usuarios WHERE id = ?',
      [userId]
    );
    
    res.json({
      status: 'OK',
      user_id: userId,
      estadisticas: {
        perfil: userStats[0],
        ultima_conexion: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error en estadísticas de usuario:', error);
    res.status(500).json({
      status: 'ERROR',
      error: error.message
    });
  }
});

// =======================================
// RUTAS PRINCIPALES
// =======================================

console.log('🛣️ Configurando rutas...');

app.use('/auth', authRoutes);
app.use('/instituciones', institucionRoutes);
app.use('/usuarios', usuariosRoutes);

console.log('✅ Rutas configuradas correctamente');

// =======================================
// DOCUMENTACIÓN SWAGGER
// =======================================

try {
  setupSwagger(app);
  console.log('📚 Swagger configurado correctamente');
} catch (error) {
  console.warn('⚠️ Error configurando Swagger:', error.message);
}

// =======================================
// MIDDLEWARE DE ERRORES
// =======================================

// Middleware de manejo de errores
app.use((error, req, res, next) => {
  console.error('❌ Error no manejado:', error);
  
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
  console.log(`🔍 Ruta no encontrada: ${req.method} ${req.originalUrl}`);
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
      'GET /test-huelemu',
      'GET /stats/public',
      'POST /auth/register',
      'POST /auth/login',
      'GET /instituciones',
      'GET /usuarios',
      'GET /api-docs'
    ]
  });
});

// =======================================
// INICIAR SERVIDOR
// =======================================

const PORT = process.env.PORT || 3100;

app.listen(PORT, () => {
  console.log('\n🚀 =======================================');
  console.log(`   🎯 SERVIDOR HUELEMU INICIADO`);
  console.log('🚀 =======================================');
  console.log(`📍 Backend URL: https://apirifas.huelemu.com.ar`);
  console.log(`📍 Frontend URL: https://rifas.huelemu.com.ar`);
  console.log(`🔧 Puerto local: ${PORT}`);
  console.log(`📚 Docs: https://apirifas.huelemu.com.ar/api-docs`);
  console.log(`🔍 Test DB: https://apirifas.huelemu.com.ar/test-db`);
  console.log(`🔐 Test JWT: https://apirifas.huelemu.com.ar/test-jwt`);
  console.log(`🌐 Test CORS: https://apirifas.huelemu.com.ar/test-cors`);
  console.log(`🎯 Test Huelemu: https://apirifas.huelemu.com.ar/test-huelemu`);
  console.log('🚀 =======================================\n');
  
  // Verificar configuración de JWT
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    console.log('⚠️  WARNING: JWT secrets usando valores por defecto');
    console.log('   Configura JWT_ACCESS_SECRET y JWT_REFRESH_SECRET en .env');
  } else {
    console.log('✅ JWT secrets configurados correctamente');
  }
  
  console.log('✅ CORS configurado para Huelemu');
  console.log('✅ Base de datos conectada');
  console.log('✅ Servidor listo para recibir requests');
  console.log('\n🎉 ¡Servidor funcionando correctamente!');
});