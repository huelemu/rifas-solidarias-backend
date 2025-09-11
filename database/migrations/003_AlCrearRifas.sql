-- SCRIPT DE MIGRACIÓN PARA ADAPTAR SCHEMA EXISTENTE
-- Ejecutar SOLO las partes que necesitas según tu base de datos actual

USE rifas_solidarias_dev;

-- ============================================
-- PASO 1: VERIFICAR ESTRUCTURA ACTUAL
-- ============================================
-- Ejecuta esto primero para ver qué tienes:
SHOW TABLES;
DESCRIBE rifas;
DESCRIBE numeros;

-- ============================================
-- PASO 2: AJUSTAR TABLA RIFAS (si es necesario)
-- ============================================

-- Tu tabla se llama 'rifas' y tiene estos campos diferentes:
-- - Tu campo: 'nombre' -> Mi controlador espera: 'titulo'  
-- - Tu campo: 'cantidad_numeros' -> Mi controlador espera: 'total_numeros'
-- - Tu campo: 'fecha_creacion' -> Mi controlador espera: 'created_at'
-- - Tu campo: 'fecha_actualizacion' -> Mi controlador espera: 'updated_at'

-- OPCIÓN A: Agregar alias/columnas virtuales (RECOMENDADO - NO destructivo)
ALTER TABLE rifas 
ADD COLUMN titulo VARCHAR(255) GENERATED ALWAYS AS (nombre) VIRTUAL,
ADD COLUMN total_numeros INT GENERATED ALWAYS AS (cantidad_numeros) VIRTUAL,
ADD COLUMN created_at TIMESTAMP GENERATED ALWAYS AS (fecha_creacion) VIRTUAL,
ADD COLUMN updated_at TIMESTAMP GENERATED ALWAYS AS (fecha_actualizacion) VIRTUAL;

-- OPCIÓN B: Si prefieres renombrar columnas (CUIDADO - puede afectar código existente)
-- ALTER TABLE rifas 
-- CHANGE COLUMN nombre titulo VARCHAR(255) NOT NULL,
-- CHANGE COLUMN cantidad_numeros total_numeros INT NOT NULL,
-- CHANGE COLUMN fecha_creacion created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
-- CHANGE COLUMN fecha_actualizacion updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- ============================================
-- PASO 3: AJUSTAR TABLA NUMEROS 
-- ============================================

-- Tu tabla 'numeros' vs mi controlador espera 'numeros_rifa'
-- OPCIÓN A: Crear vista para compatibilidad (RECOMENDADO)
--CREATE OR REPLACE VIEW numeros_rifa AS
--SELECT 
--  id,
--  rifa_id,
--  numero,
--  estado,
--  comprador_id,
--  fecha_venta as fecha_compra,
--  fecha_creacion as created_at,
--  COALESCE(fecha_venta, fecha_reserva) as updated_at
-- FROM numeros;

-- OPCIÓN B: Si quieres renombrar la tabla
 RENAME TABLE numeros TO numeros_rifa;

-- ============================================
-- PASO 4: AGREGAR CAMPOS FALTANTES (si los necesitas)
-- ============================================

-- Verificar si la tabla rifas tiene estos campos para el sorteo:
-- Si NO existen, agrégalos:

ALTER TABLE rifas 
ADD COLUMN IF NOT EXISTS numero_ganador INT NULL,
ADD COLUMN IF NOT EXISTS ganador_id INT NULL,
ADD CONSTRAINT fk_rifas_ganador FOREIGN KEY (ganador_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ============================================
-- PASO 5: AGREGAR TABLAS NUEVAS OPCIONALES
-- ============================================

-- Solo si quieres estas funcionalidades extra:

-- Tabla de transacciones para mejor tracking de pagos
CREATE TABLE IF NOT EXISTS transacciones (
  id INT PRIMARY KEY AUTO_INCREMENT,
  rifa_id INT NOT NULL,
  comprador_id INT NOT NULL,
  numeros_comprados JSON NOT NULL,
  cantidad_numeros INT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  total_pagado DECIMAL(10,2) NOT NULL,
  metodo_pago VARCHAR(50) NOT NULL DEFAULT 'efectivo',
  estado_pago ENUM('pendiente', 'completado', 'fallido', 'reembolsado') DEFAULT 'pendiente',
  referencia_externa VARCHAR(255) NULL,
  fecha_transaccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_confirmacion TIMESTAMP NULL,
  
  FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE RESTRICT,
  FOREIGN KEY (comprador_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  
  INDEX idx_transacciones_rifa (rifa_id),
  INDEX idx_transacciones_comprador (comprador_id)
);

-- Configuraciones por institución
CREATE TABLE IF NOT EXISTS instituciones_config_rifas (
  id INT PRIMARY KEY AUTO_INCREMENT,
  institucion_id INT NOT NULL,
  comision_porcentaje DECIMAL(5,2) DEFAULT 0.00,
  metodos_pago_habilitados JSON NOT NULL DEFAULT '["efectivo"]',
  numero_minimo_rifas INT DEFAULT 10,
  numero_maximo_rifas INT DEFAULT 10000,
  precio_minimo_numero DECIMAL(10,2) DEFAULT 1.00,
  precio_maximo_numero DECIMAL(10,2) DEFAULT 10000.00,
  configuraciones_adicionales JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE,
  UNIQUE KEY unique_config_institucion (institucion_id)
);

-- Insertar configuraciones por defecto
INSERT IGNORE INTO instituciones_config_rifas (institucion_id, metodos_pago_habilitados)
SELECT id, '["efectivo"]' FROM instituciones;

-- ============================================
-- PASO 6: CREAR VISTAS ÚTILES
-- ============================================

-- Vista que combina rifas con estadísticas
CREATE OR REPLACE VIEW vista_rifas_estadisticas AS
SELECT 
  r.id,
  r.nombre,
  r.nombre as titulo,
  r.descripcion,
  r.institucion_id,
  r.cantidad_numeros,
  r.cantidad_numeros as total_numeros,
  r.precio_numero,
  r.fecha_inicio,
  r.fecha_fin,
  r.fecha_sorteo,
  r.imagen_url,
  r.estado,
  r.creado_por,
  r.fecha_creacion,
  r.fecha_actualizacion,
  r.numero_ganador,
  r.ganador_id,
  i.nombre as institucion_nombre,
  i.logo_url as institucion_logo,
  u.nombre as creador_nombre,
  COUNT(nr.id) as total_numeros_generados,
  SUM(CASE WHEN nr.estado = 'vendido' THEN 1 ELSE 0 END) as numeros_vendidos,
  SUM(CASE WHEN nr.estado = 'reservado' THEN 1 ELSE 0 END) as numeros_reservados,
  SUM(CASE WHEN nr.estado = 'disponible' THEN 1 ELSE 0 END) as numeros_disponibles,
  ROUND((SUM(CASE WHEN nr.estado = 'vendido' THEN 1 ELSE 0 END) / r.cantidad_numeros) * 100, 2) as porcentaje_vendido,
  SUM(CASE WHEN nr.estado = 'vendido' THEN r.precio_numero ELSE 0 END) as recaudado,
  (r.cantidad_numeros * r.precio_numero) as total_potencial
FROM rifas r
LEFT JOIN instituciones i ON r.institucion_id = i.id
LEFT JOIN usuarios u ON r.creado_por = u.id
LEFT JOIN numeros_rifa nr ON r.id = nr.rifa_id
GROUP BY r.id;

-- ============================================
-- PASO 7: VERIFICACIÓN FINAL
-- ============================================

-- Ejecuta esto para verificar que todo está bien:
SELECT 'rifas' as tabla, COUNT(*) as registros FROM rifas
UNION ALL
SELECT 'numeros' as tabla, COUNT(*) as registros FROM numeros_rifa  
UNION ALL
SELECT 'instituciones' as tabla, COUNT(*) as registros FROM instituciones
UNION ALL
SELECT 'usuarios' as tabla, COUNT(*) as registros FROM usuarios;

-- Ver estructura final de rifas
DESCRIBE rifas;
DESCRIBE numeros_rifa;