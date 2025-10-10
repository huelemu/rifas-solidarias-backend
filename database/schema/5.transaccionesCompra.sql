-- =====================================================
-- MIGRACIÓN: Sistema de Transacciones de Compra
-- Versión: 005
-- Fecha: 2025-01-10
-- Descripción: Agrega sistema de confirmación de compras
-- =====================================================

USE rifas_solidarias_nuevo;

-- =====================================================
-- 1. CREAR TABLA DE TRANSACCIONES
-- =====================================================

CREATE TABLE IF NOT EXISTS transacciones_compra (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Relaciones
  rifa_id INT NOT NULL COMMENT 'ID de la rifa',
  participante_id INT NOT NULL COMMENT 'Usuario participante',
  vendedor_id INT NOT NULL COMMENT 'Usuario vendedor',
  
  -- Datos de la compra
  numeros JSON NOT NULL COMMENT 'Array de números comprados',
  metodo_pago ENUM('efectivo', 'transferencia', 'mercadopago', 'otro') NOT NULL,
  monto_total DECIMAL(10,2) NOT NULL COMMENT 'Monto total de la compra',
  
  -- Información de pago
  referencia_pago VARCHAR(255) COMMENT 'Número de transferencia o referencia',
  comprobante_url VARCHAR(500) COMMENT 'URL del comprobante adjunto',
  
  -- Estado de la transacción
  estado ENUM('pendiente', 'pagado', 'confirmado', 'rechazado', 'expirado') 
    DEFAULT 'pendiente' 
    COMMENT 'Estado actual de la transacción',
  
  -- Fechas importantes
  fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Cuando se inició la compra',
  fecha_pago_notificado TIMESTAMP NULL COMMENT 'Cuando el comprador notificó el pago',
  fecha_confirmacion TIMESTAMP NULL COMMENT 'Cuando el vendedor confirmó',
  fecha_expiracion TIMESTAMP NOT NULL COMMENT 'Límite para completar la transacción',
  
  -- Observaciones
  observaciones_comprador TEXT COMMENT 'Comentarios del comprador',
  observaciones_vendedor TEXT COMMENT 'Comentarios del vendedor al confirmar/rechazar',
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Claves foráneas
  FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
  FOREIGN KEY (participante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- Índices para optimización
  INDEX idx_comprador (participante_id),
  INDEX idx_vendedor (vendedor_id),
  INDEX idx_estado (estado),
  INDEX idx_rifa (rifa_id),
  INDEX idx_fecha_expiracion (fecha_expiracion),
  INDEX idx_created_at (created_at)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Transacciones de compra con confirmación vendedor-comprador';

-- =====================================================
-- 2. VISTA DE TRANSACCIONES CON DETALLES
-- =====================================================

CREATE OR REPLACE VIEW vista_transacciones_completas AS
SELECT 
  t.id,
  t.estado,
  t.metodo_pago,
  t.monto_total,
  t.referencia_pago,
  t.fecha_solicitud,
  t.fecha_pago_notificado,
  t.fecha_confirmacion,
  t.fecha_expiracion,
  
  -- Rifa
  r.id as rifa_id,
  r.nombre as rifa_nombre,
  r.estado as rifa_estado,
  
  -- Comprador
  c.id as participante_id_id,
  c.nombre as comprador_nombre,
  c.apellido as comprador_apellido,
  c.email as comprador_email,
  c.telefono as comprador_telefono,
  
  -- Vendedor
  v.id as vendedor_id,
  v.nombre as vendedor_nombre,
  v.apellido as vendedor_apellido,
  v.email as vendedor_email,
  v.telefono as vendedor_telefono,
  
  -- Institución
  i.nombre as institucion_nombre,
  
  -- Números
  t.numeros,
  JSON_LENGTH(t.numeros) as cantidad_numeros,
  
  -- Estado temporal
  CASE 
    WHEN t.fecha_expiracion < NOW() AND t.estado = 'pendiente' THEN 'expirado'
    ELSE t.estado
  END as estado_actual

FROM transacciones_compra t
JOIN rifas r ON t.rifa_id = r.id
JOIN usuarios c ON t.participante_id = c.id
JOIN usuarios v ON t.vendedor_id = v.id
LEFT JOIN instituciones i ON v.institucion_id = i.id;

-- =====================================================
-- 3. PROCEDIMIENTO: Crear Transacción
-- =====================================================

DELIMITER $$

CREATE PROCEDURE crear_transaccion_compra(
  IN p_rifa_id INT,
  IN p_participante_id INT,
  IN p_vendedor_id INT,
  IN p_numeros JSON,
  IN p_metodo_pago VARCHAR(20),
  OUT p_transaccion_id INT
)
BEGIN
  DECLARE v_precio_numero DECIMAL(10,2);
  DECLARE v_cantidad_numeros INT;
  DECLARE v_monto_total DECIMAL(10,2);
  
  -- Obtener precio del número
  SELECT precio_numero INTO v_precio_numero
  FROM rifas
  WHERE id = p_rifa_id;
  
  -- Calcular cantidad y monto
  SET v_cantidad_numeros = JSON_LENGTH(p_numeros);
  SET v_monto_total = v_precio_numero * v_cantidad_numeros;
  
  -- Crear transacción
  INSERT INTO transacciones_compra (
    rifa_id,
    participante_id,
    vendedor_id,
    numeros,
    metodo_pago,
    monto_total,
    fecha_expiracion
  ) VALUES (
    p_rifa_id,
    p_participante_id,
    p_vendedor_id,
    p_numeros,
    p_metodo_pago,
    v_monto_total,
    DATE_ADD(NOW(), INTERVAL 24 HOUR)
  );
  
  SET p_transaccion_id = LAST_INSERT_ID();
END$$

DELIMITER ;

-- =====================================================
-- 4. PROCEDIMIENTO: Confirmar Pago
-- =====================================================

DELIMITER $$

CREATE PROCEDURE confirmar_pago_transaccion(
  IN p_transaccion_id INT,
  IN p_vendedor_id INT,
  IN p_observaciones TEXT
)
BEGIN
  DECLARE v_rifa_id INT;
  DECLARE v_participante_id INT;
  DECLARE v_numeros JSON;
  DECLARE v_metodo_pago VARCHAR(20);
  DECLARE v_precio_unitario DECIMAL(10,2);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error al confirmar pago';
  END;
  
  START TRANSACTION;
  
  -- Obtener datos de la transacción
  SELECT 
    rifa_id, 
    participante_id, 
    numeros, 
    metodo_pago,
    monto_total / JSON_LENGTH(numeros)
  INTO 
    v_rifa_id, 
    v_participante_id, 
    v_numeros, 
    v_metodo_pago,
    v_precio_unitario
  FROM transacciones_compra
  WHERE id = p_transaccion_id 
    AND vendedor_id = p_vendedor_id
    AND estado IN ('pendiente', 'pagado');
  
  -- Actualizar estado de transacción
  UPDATE transacciones_compra
  SET 
    estado = 'confirmado',
    fecha_confirmacion = NOW(),
    observaciones_vendedor = p_observaciones
  WHERE id = p_transaccion_id;
  
  -- Marcar números como vendidos
  UPDATE numeros_rifa nr
  SET 
    estado = 'vendido',
    participante_id = v_participante_id,
    vendedor_id = p_vendedor_id,
    metodo_pago = v_metodo_pago,
    precio_venta = v_precio_unitario,
    fecha_venta = NOW()
  WHERE rifa_id = v_rifa_id 
    AND JSON_CONTAINS(v_numeros, CAST(nr.numero AS JSON));
  
  COMMIT;
END$$

DELIMITER ;

-- =====================================================
-- 5. TRIGGER: Auto-expirar transacciones
-- =====================================================

-- Evento para expirar transacciones automáticamente
DELIMITER $

CREATE EVENT IF NOT EXISTS expirar_transacciones_pendientes
ON SCHEDULE EVERY 1 HOUR
DO
BEGIN
  UPDATE transacciones_compra
  SET estado = 'expirado'
  WHERE estado = 'pendiente'
    AND fecha_expiracion < NOW();
END$

DELIMITER ;

-- Habilitar el event scheduler
SET GLOBAL event_scheduler = ON;

-- =====================================================
-- 6. DATOS DE PRUEBA - Transacción de ejemplo
-- =====================================================

-- Insertar una transacción de prueba (ajustar IDs según tu BD)
INSERT INTO transacciones_compra (
  rifa_id,
  participante_id,
  vendedor_id,
  numeros,
  metodo_pago,
  monto_total,
  estado,
  fecha_expiracion,
  observaciones_comprador
) VALUES (
  1, -- Rifa ID (ajustar según tu BD)
  2, -- Comprador ID
  1, -- Vendedor ID
  JSON_ARRAY(15, 28, 42),
  'transferencia',
  4500.00,
  'pendiente',
  DATE_ADD(NOW(), INTERVAL 24 HOUR),
  'Transacción de prueba para testing del sistema'
);

-- =====================================================
-- 7. CONSULTAS ÚTILES PARA ADMINISTRACIÓN
-- =====================================================

-- Ver todas las transacciones pendientes
SELECT * FROM vista_transacciones_completas
WHERE estado = 'pendiente'
ORDER BY fecha_solicitud DESC;

-- Ver transacciones por expirar (próximas 2 horas)
SELECT * FROM vista_transacciones_completas
WHERE estado = 'pendiente'
  AND fecha_expiracion BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR)
ORDER BY fecha_expiracion ASC;

-- Resumen de transacciones por estado
SELECT 
  estado,
  COUNT(*) as cantidad,
  SUM(monto_total) as total_monto,
  AVG(monto_total) as promedio_monto
FROM transacciones_compra
GROUP BY estado;

-- Transacciones de un vendedor específico
SELECT * FROM vista_transacciones_completas
WHERE vendedor_id = 1
ORDER BY fecha_solicitud DESC;

-- Transacciones de un comprador específico
SELECT * FROM vista_transacciones_completas
WHERE participante_id = 2
ORDER BY fecha_solicitud DESC;

-- =====================================================
-- 8. AUDITORÍA - Registrar cambios importantes
-- =====================================================

DELIMITER $

CREATE TRIGGER trg_transaccion_auditoria_insert
AFTER INSERT ON transacciones_compra
FOR EACH ROW
BEGIN
  INSERT INTO auditoria (
    tabla,
    accion,
    registro_id,
    usuario_id,
    datos_nuevos,
    ip_address
  ) VALUES (
    'transacciones_compra',
    'INSERT',
    NEW.id,
    NEW.participante_id,
    JSON_OBJECT(
      'rifa_id', NEW.rifa_id,
      'monto_total', NEW.monto_total,
      'metodo_pago', NEW.metodo_pago,
      'estado', NEW.estado
    ),
    '127.0.0.1'
  );
END$

CREATE TRIGGER trg_transaccion_auditoria_update
AFTER UPDATE ON transacciones_compra
FOR EACH ROW
BEGIN
  IF OLD.estado != NEW.estado THEN
    INSERT INTO auditoria (
      tabla,
      accion,
      registro_id,
      usuario_id,
      datos_anteriores,
      datos_nuevos,
      ip_address
    ) VALUES (
      'transacciones_compra',
      'UPDATE',
      NEW.id,
      COALESCE(NEW.vendedor_id, NEW.participante_id),
      JSON_OBJECT('estado', OLD.estado),
      JSON_OBJECT('estado', NEW.estado),
      '127.0.0.1'
    );
  END IF;
END$

DELIMITER ;

-- =====================================================
-- 9. ÍNDICES ADICIONALES PARA RENDIMIENTO
-- =====================================================

-- Índice compuesto para búsquedas frecuentes
ALTER TABLE transacciones_compra 
ADD INDEX idx_vendedor_estado (vendedor_id, estado);

ALTER TABLE transacciones_compra 
ADD INDEX idx_comprador_estado (participante_id, estado);

-- Índice para búsquedas por rifa y estado
ALTER TABLE transacciones_compra 
ADD INDEX idx_rifa_estado (rifa_id, estado);

-- =====================================================
-- 10. ESTADÍSTICAS DE TRANSACCIONES
-- =====================================================

CREATE OR REPLACE VIEW vista_estadisticas_transacciones AS
SELECT 
  DATE(fecha_solicitud) as fecha,
  COUNT(*) as total_transacciones,
  SUM(CASE WHEN estado = 'confirmado' THEN 1 ELSE 0 END) as confirmadas,
  SUM(CASE WHEN estado = 'rechazado' THEN 1 ELSE 0 END) as rechazadas,
  SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes,
  SUM(CASE WHEN estado = 'expirado' THEN 1 ELSE 0 END) as expiradas,
  SUM(CASE WHEN estado = 'confirmado' THEN monto_total ELSE 0 END) as monto_confirmado,
  AVG(CASE WHEN estado = 'confirmado' 
    THEN TIMESTAMPDIFF(HOUR, fecha_solicitud, fecha_confirmacion) 
    ELSE NULL END) as horas_promedio_confirmacion
FROM transacciones_compra
GROUP BY DATE(fecha_solicitud)
ORDER BY fecha DESC;

-- =====================================================
-- 11. PROCEDIMIENTO: Rechazar Pago
-- =====================================================

DELIMITER $

CREATE PROCEDURE rechazar_pago_transaccion(
  IN p_transaccion_id INT,
  IN p_vendedor_id INT,
  IN p_observaciones TEXT
)
BEGIN
  -- Actualizar estado de transacción
  UPDATE transacciones_compra
  SET 
    estado = 'rechazado',
    observaciones_vendedor = p_observaciones
  WHERE id = p_transaccion_id 
    AND vendedor_id = p_vendedor_id
    AND estado IN ('pendiente', 'pagado');
    
  -- Verificar que se actualizó
  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '45000' 
    SET MESSAGE_TEXT = 'Transacción no encontrada o no se puede rechazar';
  END IF;
END$

DELIMITER ;

-- =====================================================
-- 12. VERIFICACIÓN DE LA MIGRACIÓN
-- =====================================================

-- Verificar que la tabla se creó correctamente
SELECT 
  TABLE_NAME,
  ENGINE,
  TABLE_ROWS,
  CREATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'rifas_solidarias_nuevo'
  AND TABLE_NAME = 'transacciones_compra';

-- Verificar columnas
SELECT 
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'rifas_solidarias_nuevo'
  AND TABLE_NAME = 'transacciones_compra'
ORDER BY ORDINAL_POSITION;

-- Verificar índices
SHOW INDEX FROM transacciones_compra;

-- Verificar procedimientos
SHOW PROCEDURE STATUS WHERE Db = 'rifas_solidarias_nuevo';

-- Verificar triggers
SHOW TRIGGERS FROM rifas_solidarias_nuevo 
WHERE `Table` = 'transacciones_compra';

-- Verificar eventos
SHOW EVENTS FROM rifas_solidarias_nuevo;

-- =====================================================
-- 13. LIMPIEZA (Si necesitas revertir)
-- =====================================================

/*
-- PRECAUCIÓN: Solo ejecutar si necesitas revertir la migración

-- Eliminar triggers
DROP TRIGGER IF EXISTS trg_transaccion_auditoria_insert;
DROP TRIGGER IF EXISTS trg_transaccion_auditoria_update;

-- Eliminar procedimientos
DROP PROCEDURE IF EXISTS crear_transaccion_compra;
DROP PROCEDURE IF EXISTS confirmar_pago_transaccion;
DROP PROCEDURE IF EXISTS rechazar_pago_transaccion;

-- Eliminar evento
DROP EVENT IF EXISTS expirar_transacciones_pendientes;

-- Eliminar vistas
DROP VIEW IF EXISTS vista_transacciones_completas;
DROP VIEW IF EXISTS vista_estadisticas_transacciones;

-- Eliminar tabla
DROP TABLE IF EXISTS transacciones_compra;
*/

-- =====================================================
-- RESULTADO ESPERADO
-- =====================================================
/*
✅ Tabla transacciones_compra creada
✅ Vista vista_transacciones_completas creada
✅ Vista vista_estadisticas_transacciones creada
✅ Procedimientos almacenados creados (3)
✅ Triggers de auditoría creados (2)
✅ Evento de expiración creado
✅ Índices optimizados
✅ Datos de prueba insertados

PRÓXIMOS PASOS:
1. Integrar endpoints en el backend
2. Crear componente de confirmación en frontend
3. Implementar notificaciones por email
4. Testing completo del flujo

NOTAS:
- Las transacciones expiran automáticamente después de 24 horas
- El evento scheduler verifica cada hora
- Se registra auditoría automática de cambios de estado
- Los números solo se asignan cuando el vendedor confirma
*/