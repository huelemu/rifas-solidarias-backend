import express from 'express';
import cors from 'cors';
import { setupSwagger } from './src/config/swagger.js';
import institucionRoutes from './src/routes/instituciones.js';
import usuariosRoutes from './src/routes/usuarios.js';
import db from './src/config/db.js';

const app = express();
app.use(cors());
app.use(express.json());

// Test de conexión a BD
app.get('/test-db', async (req, res) => {
  try {
    const [test] = await db.execute('SELECT 1 as conexion');
    const [info] = await db.execute('SELECT DATABASE() as base, VERSION() as version');
    const [tablas] = await db.execute('SHOW TABLES');
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

// Rutas principales
app.use('/instituciones', institucionRoutes);
app.use('/usuarios', usuariosRoutes);

// Documentación Swagger
setupSwagger(app);

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    mensaje: 'API Rifas Solidarias',
    version: '1.0.0',
    endpoints: {
      instituciones: '/instituciones - Gestión de instituciones',
      usuarios: '/usuarios - Gestión de usuarios',
      test: '/test-db - Verificar conexión BD',
      docs: '/api-docs - Documentación Swagger'
    }
  });
});

const PORT = process.env.PORT || 3100;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
  console.log(`📚 Docs en http://localhost:${PORT}/api-docs`);
});