// =====================================================
// CONFIGURACIÓN BÁSICA DE BASE DE DATOS
// src/config/db.js
// =====================================================

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Configuración de la conexión a MySQL/MariaDB
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'rifas_solidarias_nuevo', // ← Tu nueva base
  port: process.env.DB_PORT || 3306,
  charset: 'utf8mb4',
  timezone: '+00:00',
  acquireTimeout: 60000,
  timeout: 60000,
};

// Crear pool de conexiones
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  reconnect: true
});

// Función para probar la conexión
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

// Función para ejecutar queries con logging
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

// Función para transacciones
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

// Exportar el pool como default
export default pool;

// =====================================================
// VERIFICAR VARIABLES DE ENTORNO
// =====================================================

// Verificar que las variables esenciales estén configuradas
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