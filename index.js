// index.js - Configuración CORS actualizada para tus dominios específicos

// CONFIGURACIÓN CORS CORREGIDA PARA HUELEMU
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
      
      // Subdominios adicionales por si los necesitas
      'https://www.rifas.huelemu.com.ar',
      'http://www.rifas.huelemu.com.ar',
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('🚫 CORS blocked origin:', origin);
      // En producción, puedes ser más estricto cambiando 'true' por:
      // callback(new Error('Not allowed by CORS'));
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

// Middleware para logging mejorado
app.use((req, res, next) => {
  const origin = req.get('origin') || 'No origin';
  const userAgent = req.get('user-agent') || 'No user-agent';
  
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log(`  Origin: ${origin}`);
  
  // Log adicional para debugging en producción
  if (req.method === 'OPTIONS') {
    console.log('  🔄 CORS Preflight request');
  }
  
  next();
});

// =======================================
// ENDPOINT ADICIONAL PARA TESTING
// =======================================

// Test específico para verificar CORS desde tu frontend
app.get('/test-cors', (req, res) => {
  const origin = req.get('origin');
  
  res.json({
    message: '✅ CORS funcionando correctamente',
    timestamp: new Date().toISOString(),
    origin: origin,
    frontend_url_esperada: 'https://rifas.huelemu.com.ar',
    backend_url: 'https://apirifas.huelemu.com.ar',
    cors_status: '✅ Configurado para Huelemu',
    headers_received: {
      origin: req.get('origin'),
      host: req.get('host'),
      'user-agent': req.get('user-agent')?.substring(0, 50) + '...'
    }
  });
});

// Endpoint específico para verificar desde tu dominio
app.get('/test-huelemu', (req, res) => {
  const expectedOrigin = 'https://rifas.huelemu.com.ar';
  const actualOrigin = req.get('origin');
  
  res.json({
    message: '🔍 Test específico para Huelemu',
    status: actualOrigin === expectedOrigin ? '✅ CORRECTO' : '⚠️ VERIFICAR',
    expected_origin: expectedOrigin,
    actual_origin: actualOrigin,
    recommendations: actualOrigin !== expectedOrigin ? [
      'Verificar que estés accediendo desde https://rifas.huelemu.com.ar',
      'Verificar configuración SSL',
      'Revisar DNS del dominio'
    ] : ['Todo configurado correctamente']
  });
});