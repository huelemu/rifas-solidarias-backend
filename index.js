import express from 'express';
import cors from 'cors';
import { setupSwagger } from './src/config/swagger.js';
import institucionRoutes from './src/routes/instituciones.js';
import rifasRoutes from './src/routes/rifas.js';
import db from './src/config/db.js';

const app = express();
app.use(cors());
app.use(express.json());

// Ruta de prueba simple para MariaDB
app.get('/test-db', async (req, res) => {
  try {
    // Conexión básica
    const [test] = await db.execute('SELECT 1 as conexion');
    
    // Info de la base
    const [info] = await db.execute('SELECT DATABASE() as base, VERSION() as version');
    
    // Tablas
    const [tablas] = await db.execute('SHOW TABLES');
    
    // Contar usuarios
    const [usuarios] = await db.execute('SELECT COUNT(*) as total FROM usuarios');
    
    res.json({
      status: 'OK',
      conexion: test[0].conexion,
      base_datos: info[0].base,
      version: info[0].version,
      total_tablas: tablas.length,
      total_usuarios: usuarios[0].total
    });

  } catch (error) {
    res.status(500).json({
      error: error.message,
      codigo: error.code
    });
  }
});

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    mensaje: 'API Rifas Solidarias funcionando',
    endpoints: {
      auth: '/auth - Autenticación JWT',
      test: '/test-db - Test de base de datos',
      instituciones: '/instituciones - Gestión de instituciones',
      usuarios: '/usuarios - Gestión de usuarios',
      rifas: '/rifas - Gestión de rifas',
      swagger: '/api-docs - Documentación completa'
    }
  });
});

// Ruta de prueba simple para usuarios
app.get('/usuarios-test', (req, res) => {
  res.json({
    status: 'success',
    message: 'Ruta de prueba de usuarios funcionando'
  });
});

app.post('/usuarios-test', (req, res) => {
  res.json({
    status: 'success',
    message: 'POST de usuarios funcionando',
    body: req.body
  });
});

// Rutas existentes
app.use('/instituciones', institucionRoutes);
app.use('/rifas', rifasRoutes);

// Swagger
setupSwagger(app);

const PORT = process.env.PORT || 3100;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});