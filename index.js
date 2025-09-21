// =====================================================
// INDEX.JS COMPLETO CON MÓDULO DE RIFAS
// Servidor principal para Rifas Solidarias
// =====================================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSwagger } from './src/config/swagger.js';
import db from './src/config/db.js';

// Importar rutas
import authRoutes from './src/routes/auth.js';
import institucionRoutes from './src/routes/instituciones.js';
import usuariosRoutes from './src/routes/usuarios.js';
import rifasRoutes from './src/routes/rifas.js'; // ✅ NUEVA RUTA

// Importar middleware de autenticación
import { requireAuth, optionalAuth } from './src/middleware/auth.js';

// Configurar variables de entorno PRIMERO
dotenv.config();

// Crear la aplicación Express
const app = express();

console.log('🔧 Iniciando servidor...');
console.log('📦 Express app creada correctamente');

// =====================================================
// CONFIGURACIÓN CORS PARA DESARROLLO Y PRODUCCIÓN
// =====================================================

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (como apps móviles, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Lista de origins permitidos
    const allowedOrigins = [
      // Desarrollo local
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:4200',  // Angular dev server
      'http://localhost:5173',  // Vite
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:8000',
      'http://127.0.0.1:8000',
      'http://localhost:3100', // Para Swagger
      
      // Producción (actualizar según tu dominio)
      'https://rifas.huelemu.com.ar',
      'http://rifas.huelemu.com.ar',
      'https://apirifas.huelemu.com.ar',
      'http://apirifas.huelemu.com.ar',
      'https://www.rifas.huelemu.com.ar',
      'http://www.rifas.huelemu.com.ar',
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('🚫 CORS blocked origin:', origin);
      // En desarrollo, permitir todos los origins
      callback(null, process.env.NODE_ENV === 'development');
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin'
  ]
};

// Aplicar CORS
app.use(cors(corsOptions));
console.log('🌐 CORS configurado correctamente');

// Middleware adicional para manejar preflight requests
app.options('*', cors(corsOptions));

// Middleware para parsing de JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para logging de requests
app.use((req, res, next) => {
  const origin = req.get('origin') || 'No origin';
  const userAgent = req.get('user-agent') || 'No user-agent';
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${origin}`);
  next();
});

// =====================================================
// ENDPOINTS DE TESTING Y MONITOREO
// =====================================================

/**
 * @swagger
 * /:
 *   get:
 *     summary: Información general del API
 *     tags: [Sistema]
 *     responses:
 *       200:
 *         description: Información del servidor y endpoints disponibles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensaje:
 *                   type: string
 *                   example: API Rifas Solidarias
 *                 version:
 *                   type: string
 *                   example: 2.0.0
 *                 status:
 *                   type: string
 *                   example: Funcionando correctamente
 *                 modules:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: [auth, instituciones, usuarios, rifas]
 */

/**
 * @swagger
 * /test-db:
 *   get:
 *     summary: Test de conexión a base de datos
 *     tags: [Sistema]
 *     responses:
 *       200:
 *         description: Conexión exitosa a la base de datos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 base_datos:
 *                   type: string
 *                   example: rifas_solidarias_nuevo
 *                 version:
 *                   type: string
 *                   example: 10.5.23-MariaDB
 *                 estadisticas:
 *                   type: object
 *                   properties:
 *                     usuarios:
 *                       type: integer
 *                     instituciones:
 *                       type: integer
 *                     rifas:
 *                       type: integer
 *       500:
 *         description: Error de conexión a la base de datos
 */

/**
 * @swagger
 * /stats/public:
 *   get:
 *     summary: Estadísticas públicas del sistema
 *     tags: [Sistema]
 *     responses:
 *       200:
 *         description: Estadísticas generales sin datos sensibles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     rifas_activas:
 *                       type: integer
 *                       example: 5
 *                     instituciones_participantes:
 *                       type: integer
 *                       example: 12
 *                     numeros_vendidos:
 *                       type: integer
 *                       example: 1567
 *                     recaudacion_total:
 *                       type: number
 *                       example: 78350.00
 */

// Ruta raíz con información del API
app.get('/', (req, res) => {
  res.json({
    mensaje: 'API Rifas Solidarias',
    version: '2.0.0',
    status: 'Funcionando correctamente',
    server_time: new Date().toISOString(),
    modules: ['auth', 'instituciones', 'usuarios', 'rifas'],
    endpoints: {
      auth: [
        'POST /auth/register',
        'POST /auth/login', 
        'POST /auth/refresh',
        'POST /auth/logout',
        'GET /auth/me'
      ],
      instituciones: [
        'GET /instituciones',
        'POST /instituciones',
        'GET /instituciones/:id',
        'PUT /instituciones/:id',
        'DELETE /instituciones/:id'
      ],
      usuarios: [
        'GET /usuarios',
        'POST /usuarios',
        'GET /usuarios/:id', 
        'PUT /usuarios/:id',
        'DELETE /usuarios/:id'
      ],
      rifas: [
        // Rifas públicas
        'GET /rifas/publicas',
        'GET /rifas/publicas/:id',
        'GET /rifas/publicas/:id/numeros',
        
        // CRUD rifas
        'GET /rifas',
        'POST /rifas',
        'GET /rifas/:id',
        'PUT /rifas/:id', 
        'DELETE /rifas/:id',
        
        // Gestión de números
        'GET /rifas/:id/numeros',
        'POST /rifas/:rifa_id/numeros/:numero/vender',
        'POST /rifas/:rifa_id/numeros/:numero/reservar',
        'DELETE /rifas/:rifa_id/numeros/:numero/venta',
        
        // Compras
        'POST /rifas/:rifa_id/comprar',
        'GET /rifas/usuario/mis-rifas',
        'GET /rifas/:rifa_id/mis-numeros',
        
        // Administración
        'POST /rifas/:rifa_id/asignar-numeros',
        'GET /rifas/:rifa_id/instituciones/:institucion_id/numeros',
        'GET /rifas/:rifa_id/vendedor/numeros',
        
        // Reportes
        'GET /rifas/:rifa_id/estadisticas',
        'GET /rifas/:rifa_id/reporte-instituciones', 
        'GET /rifas/:rifa_id/reporte-vendedores',
        'GET /rifas/:rifa_id/comisiones',
        'GET /rifas/:rifa_id/exportar',
        
        // Participaciones
        'POST /rifas/:rifa_id/invitar-institucion',
        'PUT /rifas/:rifa_id/participacion',
        
        // Sistema
        'POST /rifas/sistema/liberar-reservas'
      ],
      testing: [
        'GET /test-db',
        'GET /test-jwt',
        'GET /test-cors',
        'GET /stats/public'
      ],
      docs: [
        'GET /api-docs'
      ]
    }
  });
});

// Test de conexión a BD
app.get('/test-db', async (req, res) => {
  try {
    console.log('🔍 Probando conexión a base de datos...');
    
    const [test] = await db.execute('SELECT 1 as conexion');
    const [info] = await db.execute('SELECT DATABASE() as base, VERSION() as version');
    const [tablas] = await db.execute('SHOW TABLES');
    
    // Estadísticas básicas
    const [usuarios] = await db.execute('SELECT COUNT(*) as total FROM usuarios');
    const [instituciones] = await db.execute('SELECT COUNT(*) as total FROM instituciones');
    
    // ✅ NUEVAS ESTADÍSTICAS DE RIFAS
    const [rifas] = await db.execute('SELECT COUNT(*) as total FROM rifas');
    const [rifasActivas] = await db.execute('SELECT COUNT(*) as total FROM rifas WHERE estado = "activa"');
    const [numerosVendidos] = await db.execute('SELECT COUNT(*) as total FROM numeros_rifa WHERE estado = "vendido"');
    
    console.log('✅ Conexión a BD exitosa');
    
    res.json({
      status: 'OK',
      conexion: test[0].conexion,
      base_datos: info[0].base,
      version: info[0].version,
      total_tablas: tablas.length,
      estadisticas: {
        usuarios: usuarios[0].total,
        instituciones: instituciones[0].total,
        rifas: rifas[0].total,
        rifas_activas: rifasActivas[0].total,
        numeros_vendidos: numerosVendidos[0].total
      },
      tablas: tablas.map(t => Object.values(t)[0]),
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
    access_expires: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refresh_expires: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  };

  res.json({
    status: 'OK',
    jwt_config: jwtConfig,
    node_env: process.env.NODE_ENV || 'development'
  });
});

// Test de CORS
app.get('/test-cors', (req, res) => {
  const origin = req.get('origin');
  const userAgent = req.get('user-agent');
  
  res.json({
    status: 'OK',
    message: 'CORS funcionando correctamente',
    origin: origin,
    user_agent: userAgent,
    headers: req.headers,
    method: req.method
  });
});

// Estadísticas públicas
app.get('/stats/public', optionalAuth, async (req, res) => {
  try {
    // Estadísticas públicas sin datos sensibles
    const [estadisticas] = await db.execute(`
      SELECT 
        (SELECT COUNT(*) FROM rifas WHERE estado = 'activa') as rifas_activas,
        (SELECT COUNT(*) FROM instituciones WHERE estado = 'activa') as instituciones_activas,
        (SELECT COUNT(*) FROM numeros_rifa WHERE estado = 'vendido') as numeros_vendidos,
        (SELECT COALESCE(SUM(precio_numero), 0) FROM rifas r 
         JOIN numeros_rifa nr ON r.id = nr.rifa_id 
         WHERE nr.estado = 'vendido') as recaudacion_total
    `);

    const stats = estadisticas[0];
    
    res.json({
      status: 'success',
      data: {
        rifas_activas: stats.rifas_activas,
        instituciones_participantes: stats.instituciones_activas,
        numeros_vendidos: stats.numeros_vendidos,
        recaudacion_total: parseFloat(stats.recaudacion_total),
        ultimo_update: new Date().toISOString()
      },
      user_authenticated: !!req.user
    });

  } catch (error) {
    console.error('❌ Error en estadísticas públicas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener estadísticas'
    });
  }
});

// ✅ NUEVO: Test específico para rifas
app.get('/test-rifas', requireAuth, async (req, res) => {
  try {
    const [testRifas] = await db.execute(`
      SELECT 
        r.id,
        r.nombre,
        r.estado,
        r.cantidad_numeros,
        r.precio_numero,
        i.nombre as institucion_nombre,
        COUNT(nr.id) as numeros_generados,
        SUM(CASE WHEN nr.estado = 'vendido' THEN 1 ELSE 0 END) as numeros_vendidos
      FROM rifas r
      LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
      LEFT JOIN numeros_rifa nr ON r.id = nr.rifa_id
      GROUP BY r.id
      LIMIT 5
    `);

    res.json({
      status: 'OK',
      message: 'Módulo de rifas funcionando correctamente',
      sample_data: testRifas,
      user: {
        id: req.user.id,
        nombre: req.user.nombre,
        rol: req.user.rol,
        institucion_id: req.user.institucion_id
      }
    });

  } catch (error) {
    console.error('❌ Error en test-rifas:', error);
    res.status(500).json({
      status: 'ERROR',
      error: error.message
    });
  }
});

// =====================================================
// RUTAS PRINCIPALES
// =====================================================

console.log('🛣️ Configurando rutas...');

// Rutas de autenticación
app.use('/auth', authRoutes);
console.log('✅ Rutas de autenticación configuradas');

// Rutas de instituciones
app.use('/instituciones', institucionRoutes);
console.log('✅ Rutas de instituciones configuradas');

// Rutas de usuarios
app.use('/usuarios', usuariosRoutes);
console.log('✅ Rutas de usuarios configuradas');

// ✅ NUEVAS RUTAS DE RIFAS
app.use('/rifas', rifasRoutes);
console.log('✅ Rutas de rifas configuradas');

console.log('🎯 Todas las rutas configuradas correctamente');

// =====================================================
// DOCUMENTACIÓN SWAGGER
// =====================================================

try {
  setupSwagger(app);
  console.log('📚 Swagger configurado correctamente');
} catch (error) {
  console.warn('⚠️ Error configurando Swagger:', error.message);
}

// =====================================================
// MIDDLEWARE DE ERRORES GLOBALES
// =====================================================

// Middleware de manejo de errores
app.use((error, req, res, next) => {
  console.error('❌ Error no manejado:', error);
  
  // Error de parsing JSON
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      status: 'error',
      message: 'JSON inválido en el cuerpo de la petición'
    });
  }
  
  // Error de tamaño de payload
  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      status: 'error',
      message: 'El tamaño del archivo es demasiado grande'
    });
  }
  
  // Error de base de datos
  if (error.code && error.code.startsWith('ER_')) {
    return res.status(500).json({
      status: 'error',
      message: 'Error de base de datos',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
  
  res.status(500).json({
    status: 'error',
    message: 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { 
      details: error.message,
      stack: error.stack 
    })
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
    suggestion: 'Verifica la documentación en /api-docs',
    available_modules: ['auth', 'instituciones', 'usuarios', 'rifas']
  });
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================

const PORT = process.env.PORT || 3100;

// Función para verificar configuración antes de iniciar
const verificarConfiguracion = () => {
  const errores = [];
  
  if (!process.env.JWT_ACCESS_SECRET) {
    errores.push('JWT_ACCESS_SECRET no configurado');
  }
  
  if (!process.env.JWT_REFRESH_SECRET) {
    errores.push('JWT_REFRESH_SECRET no configurado');
  }
  
  if (!process.env.DB_HOST) {
    errores.push('DB_HOST no configurado');
  }
  
  if (!process.env.DB_USER) {
    errores.push('DB_USER no configurado');
  }
  
  if (!process.env.DB_PASSWORD) {
    errores.push('DB_PASSWORD no configurado');
  }
  
  if (!process.env.DB_NAME) {
    errores.push('DB_NAME no configurado');
  }
  
  if (errores.length > 0) {
    console.error('❌ Errores de configuración:');
    errores.forEach(error => console.error(`   - ${error}`));
    console.error('❌ El servidor no puede iniciarse sin la configuración completa');
    process.exit(1);
  }
  
  console.log('✅ Configuración verificada correctamente');
};

// Verificar configuración
verificarConfiguracion();

// Iniciar servidor
app.listen(PORT, () => {
  console.log('\n🚀 =======================================');
  console.log(`   🎯 SERVIDOR INICIADO CORRECTAMENTE`);
  console.log(`   📡 Puerto: ${PORT}`);
  console.log(`   🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   📚 Documentación: http://localhost:${PORT}/api-docs`);
  console.log(`   🔍 Health Check: http://localhost:${PORT}/`);
  console.log(`   🧪 Tests: http://localhost:${PORT}/test-db`);
  console.log('🚀 =======================================\n');
  
  console.log('📋 Módulos disponibles:');
  console.log('   ✅ Autenticación (/auth)');
  console.log('   ✅ Instituciones (/instituciones)');
  console.log('   ✅ Usuarios (/usuarios)');
  console.log('   ✅ Rifas (/rifas) - NUEVO!');
  console.log('   ✅ Documentación (/api-docs)');
  console.log('   ✅ Testing (/test-*)');
  console.log('\n🎉 ¡Servidor listo para recibir requests!');
});

// Manejo graceful de cierre del servidor
process.on('SIGTERM', () => {
  console.log('🔄 Recibida señal SIGTERM. Cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🔄 Recibida señal SIGINT. Cerrando servidor...');
  process.exit(0);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rechazada no manejada:', reason);
  process.exit(1);
});

export default app;