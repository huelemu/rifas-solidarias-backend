// =====================================================
// CONFIGURACIÓN BÁSICA DE BASE DE DATOS (CORREGIDO)
// src/config/db.js
// =====================================================

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Configuración base SIN acquireTimeout
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'rifas_solidarias_nuevo',
  port: process.env.DB_PORT || 3306,
  charset: 'utf8mb4',
  timezone: '+00:00',
  connectTimeout: 60000 // ⬅️ reemplazo de "timeout"
};

// Crear pool de conexiones (aquí sí usamos acquireTimeout)
let pool = mysql.createPool({
  ...dbConfig,
  acquireTimeout: 60000,   // ⬅️ válido solo en pool
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// =====================================================
// Funciones de utilidad
// =====================================================

export const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexión a base de datos exitosa');
    console.log(`📊 Base de datos: ${dbConfig.database}`);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Error de conexión a base de datos:', error.message);
    return false;
  }
};

export const executeQuery = async (sql, params = []) => {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Error en query:', error.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw error;
  }
};

export const transaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Exportar pool
export default pool;

// =====================================================
// Verificación de variables de entorno
// =====================================================

const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.warn('⚠️  Variables de entorno faltantes:', missingEnvVars);
  console.warn('Asegúrate de tener un archivo .env con:');
  console.warn('DB_HOST=localhost');
  console.warn('DB_USER=tu_usuario');
  console.warn('DB_PASSWORD=tu_password');
  console.warn('DB_NAME=rifas_solidarias_nuevo');
  console.warn('JWT_SECRET=tu_jwt_secret_muy_seguro');
}

// Probar conexión al inicializar
testConnection();
