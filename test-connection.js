// routes/test.js - Crear este archivo nuevo
import express from 'express';
import db from './src/config/db.js'; // Ajusta la ruta según tu estructura

const router = express.Router();

// Endpoint para probar la conexión a la base de datos
router.get('/test-db', async (req, res) => {
  try {
    // Probar conexión simple
    const [rows] = await db.execute('SELECT 1 as test');
    
    // Obtener información de la base de datos
    const [dbInfo] = await db.execute('SELECT DATABASE() as current_db, VERSION() as version');
    
    // Mostrar las tablas creadas
    const [tables] = await db.execute('SHOW TABLES');
    
    // Contar registros en tabla usuarios
    const [userCount] = await db.execute('SELECT COUNT(*) as total FROM usuarios');
    
    res.json({
      status: 'success',
      message: '✅ Conexión a base de datos exitosa',
      database: dbInfo[0].current_db,
      version: dbInfo[0].version,
      tables: tables.map(table => Object.values(table)[0]),
      total_usuarios: userCount[0].total,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error de conexión:', error);
    res.status(500).json({
      status: 'error',
      message: '❌ Error de conexión a base de datos',
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para obtener estructura de una tabla
router.get('/test-table/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    
    // Verificar que la tabla existe y obtener su estructura
    const [columns] = await db.execute(`DESCRIBE ${tableName}`);
    
    // Obtener algunos registros de ejemplo
    const [sample] = await db.execute(`SELECT * FROM ${tableName} LIMIT 5`);
    
    res.json({
      status: 'success',
      table: tableName,
      columns: columns,
      sample_data: sample,
      total_records: sample.length
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Error al consultar tabla ${req.params.tableName}`,
      error: error.message
    });
  }
});

// Endpoint para insertar un usuario de prueba
router.post('/test-insert-user', async (req, res) => {
  try {
    const testUser = {
      nombre: 'Usuario',
      apellido: 'Prueba',
      email: `test_${Date.now()}@ejemplo.com`,
      password: 'test123',
      rol: 'comprador'
    };

    const [result] = await db.execute(
      'INSERT INTO usuarios (nombre, apellido, email, password, rol) VALUES (?, ?, ?, ?, ?)',
      [testUser.nombre, testUser.apellido, testUser.email, testUser.password, testUser.rol]
    );

    res.json({
      status: 'success',
      message: '✅ Usuario de prueba creado exitosamente',
      user_id: result.insertId,
      user_data: testUser
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '❌ Error al insertar usuario de prueba',
      error: error.message
    });
  }
});

export default router;