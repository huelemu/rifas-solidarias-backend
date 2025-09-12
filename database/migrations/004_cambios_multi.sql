-- =====================================================
-- ESQUEMA COMPLETO - SISTEMA DE RIFAS SOLIDARIAS
-- Multi-institución con asignación de números
-- =====================================================

USE rifas_solidarias_dev;

-- =====================================================
-- 1. TABLA RIFAS - AJUSTADA PARA MULTI-INSTITUCIÓN
-- =====================================================

-- Modificar tabla existente o crear nueva
ALTER TABLE rifas 
ADD COLUMN institucion_promotora_id INT NOT NULL COMMENT 'Institución que promueve/organiza la rifa',
ADD COLUMN max_instituciones_participantes INT DEFAULT NULL COMMENT 'Máximo de instituciones que pueden participar',
ADD COLUMN fecha_limite_participacion DATE NULL COMMENT 'Fecha límite para que se unan instituciones',
ADD COLUMN comision_promotora DECIMAL(5,2) DEFAULT 10.00 COMMENT 'Porcentaje de comisión para institución promotora',
ADD COLUMN numeros_por_institucion INT NULL COMMENT 'Números asignados por institución (si es fijo)',
ADD COLUMN requiere_aprobacion BOOLEAN DEFAULT FALSE COMMENT 'Si las instituciones requieren aprobación para participar',
MODIFY COLUMN institucion_id INT NULL COMMENT 'Deprecado - ahora usar institucion_promotora_id';

-- Índices para optimización
ALTER TABLE rifas
ADD INDEX idx_institucion_promotora (institucion_promotora_id),
ADD INDEX idx_estado_fechas (estado, fecha_inicio, fecha_fin);

-- =====================================================
-- 2. TABLA PARTICIPACIONES - INSTITUCIONES EN RIFAS x PASOS
-- =====================================================

DROP TABLE IF EXISTS rifa_participaciones;

CREATE TABLE rifa_participaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rifa_id INT NOT NULL,
  institucion_id INT NOT NULL,
  es_promotora TINYINT(1) DEFAULT 0,
  estado_participacion ENUM('solicitada','aprobada','rechazada','retirada') NOT NULL DEFAULT 'solicitada',
  fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_aprobacion DATETIME NULL,
  aprobada_por INT NULL COMMENT 'Usuario que aprobó la participación',
  numeros_asignados_desde INT NULL,
  numeros_asignados_hasta INT NULL,
  comision_acordada DECIMAL(5,2) DEFAULT 0.00,
  observaciones TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


ALTER TABLE rifa_participaciones
  ADD CONSTRAINT unique_rifa_institucion UNIQUE (rifa_id, institucion_id),
  ADD INDEX idx_rifa (rifa_id),
  ADD INDEX idx_institucion (institucion_id),
  ADD INDEX idx_estado (estado_participacion);

ALTER TABLE rifa_participaciones
  ADD CONSTRAINT fk_rifa FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_institucion FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_aprobada_por FOREIGN KEY (aprobada_por) REFERENCES usuarios(id) ON DELETE SET NULL;


-- =====================================================
-- 3. TABLA ASIGNACIÓN DE NÚMEROS A VENDEDORES x pasos
-- =====================================================
DROP TABLE IF EXISTS numero_asignaciones;

CREATE TABLE numero_asignaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rifa_id INT NOT NULL,
    participacion_id INT NOT NULL COMMENT 'Referencia a rifa_participaciones',
    vendedor_id INT NOT NULL,
    numero_desde INT NOT NULL,
    numero_hasta INT NOT NULL,
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    asignado_por INT NOT NULL COMMENT 'Usuario que hizo la asignación',
    estado_asignacion ENUM('activa','liberada','vendida') NOT NULL DEFAULT 'activa',
    observaciones TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


ALTER TABLE numero_asignaciones
    ADD INDEX idx_rifa (rifa_id),
    ADD INDEX idx_vendedor (vendedor_id),
    ADD INDEX idx_numeros (numero_desde, numero_hasta),
    ADD INDEX idx_participacion (participacion_id);


ALTER TABLE numero_asignaciones
    ADD CONSTRAINT fk_numero_rifa FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_numero_participacion FOREIGN KEY (participacion_id) REFERENCES rifa_participaciones(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_numero_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_numero_asignado_por FOREIGN KEY (asignado_por) REFERENCES usuarios(id) ON DELETE RESTRICT;

-- =====================================================
-- 4. TABLA NÚMEROS DE RIFA - MEJORADA
-- =====================================================

-- Modificar tabla existente de números
ALTER TABLE numeros_rifa
    ADD COLUMN participacion_id INT NULL COMMENT 'Institución a la que pertenece el número',
    ADD COLUMN asignacion_id INT NULL COMMENT 'Asignación específica del vendedor',
    ADD COLUMN precio_venta DECIMAL(10,2) NULL COMMENT 'Precio al que se vendió (puede variar)',
    ADD COLUMN comprador_nombre VARCHAR(255) NULL COMMENT 'Nombre del comprador',
    ADD COLUMN comprador_telefono VARCHAR(20) NULL COMMENT 'Teléfono del comprador',
    ADD COLUMN institucion_vendedora_id INT NULL COMMENT 'Institución que vendió el número';

-- Agregar claves foráneas
ALTER TABLE numeros_rifa
ADD FOREIGN KEY (participacion_id) REFERENCES rifa_participaciones(id) ON DELETE SET NULL,
ADD FOREIGN KEY (asignacion_id) REFERENCES numero_asignaciones(id) ON DELETE SET NULL,
ADD FOREIGN KEY (institucion_vendedora_id) REFERENCES instituciones(id) ON DELETE SET NULL;

-- Índices adicionales
ALTER TABLE numeros_rifa
ADD INDEX idx_participacion (participacion_id),
ADD INDEX idx_asignacion (asignacion_id),
ADD INDEX idx_institucion_vendedora (institucion_vendedora_id);

-- =====================================================
-- 5. TABLA COMISIONES Y LIQUIDACIONES
-- =====================================================

DROP TABLE IF EXISTS rifa_comisiones;

CREATE TABLE rifa_comisiones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rifa_id INT NOT NULL,
    participacion_id INT NOT NULL,
    total_vendido DECIMAL(12,2) DEFAULT 0.00,
    numeros_vendidos INT DEFAULT 0,
    porcentaje_comision DECIMAL(5,2) NOT NULL,
    monto_comision DECIMAL(12,2) GENERATED ALWAYS AS (total_vendido * porcentaje_comision / 100) STORED,
    monto_liquido DECIMAL(12,2) GENERATED ALWAYS AS (total_vendido - (total_vendido * porcentaje_comision / 100)) STORED,
    estado_liquidacion ENUM('pendiente','procesando','pagada') NOT NULL DEFAULT 'pendiente',
    fecha_liquidacion TIMESTAMP NULL,
    observaciones_liquidacion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


ALTER TABLE rifa_comisiones
    ADD UNIQUE KEY unique_rifa_participacion (rifa_id, participacion_id),
    ADD INDEX idx_rifa (rifa_id),
    ADD INDEX idx_estado (estado_liquidacion);


ALTER TABLE rifa_comisiones
    ADD CONSTRAINT fk_rifa_comisiones_rifa FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_rifa_comisiones_participacion FOREIGN KEY (participacion_id) REFERENCES rifa_participaciones(id) ON DELETE CASCADE;

-- =====================================================
-- 6. TABLA CONFIGURACIÓN DE RIFAS POR INSTITUCIÓN
-- =====================================================

DROP TABLE IF EXISTS instituciones_config_rifas;

CREATE TABLE instituciones_config_rifas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    institucion_id INT NOT NULL,
    puede_crear_rifas BOOLEAN DEFAULT FALSE,
    puede_participar_rifas BOOLEAN DEFAULT TRUE,
    comision_minima DECIMAL(5,2) DEFAULT 0.00,
    comision_maxima DECIMAL(5,2) DEFAULT 30.00,
    numeros_minimos_asignacion INT DEFAULT 10,
    numeros_maximos_asignacion INT DEFAULT 500,
    metodos_pago_habilitados JSON DEFAULT '["efectivo"]',
    requiere_aprobacion_participacion BOOLEAN DEFAULT FALSE,
    configuraciones_adicionales JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


ALTER TABLE instituciones_config_rifas
    ADD UNIQUE KEY unique_config_institucion (institucion_id);

ALTER TABLE instituciones_config_rifas
    ADD CONSTRAINT fk_instituciones_config_institucion FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE;


-- =====================================================
-- 7. VISTAS ÚTILES PARA REPORTES
-- =====================================================

-- Vista de rifas con estadísticas completas
CREATE OR REPLACE VIEW vista_rifas_completas AS
SELECT 
    r.id,
    r.nombre,
    r.descripcion,
    r.cantidad_numeros,
    r.precio_numero,
    r.fecha_inicio,
    r.fecha_fin,
    r.fecha_sorteo,
    r.estado,
    r.comision_promotora,
    
    -- Institución promotora
    ip.nombre AS institucion_promotora,
    
    -- Estadísticas de participación
    COUNT(DISTINCT rp.id) AS total_instituciones_participantes,
    SUM(IF(rp.estado_participacion = 'aprobada', 1, 0)) AS instituciones_aprobadas,
    
    -- Estadísticas de números
    COUNT(DISTINCT n.id) AS total_numeros_generados,
    SUM(IF(n.estado = 'vendido', 1, 0)) AS numeros_vendidos,
    SUM(IF(n.estado = 'reservado', 1, 0)) AS numeros_reservados,
    
    -- Estadísticas financieras
    SUM(IF(n.estado = 'vendido', COALESCE(n.precio_venta, r.precio_numero), 0)) AS total_recaudado,
    (r.cantidad_numeros * r.precio_numero) AS total_potencial,
    
    -- Porcentaje vendido seguro
    ROUND(
        IF(r.cantidad_numeros > 0, SUM(IF(n.estado = 'vendido', 1, 0)) / r.cantidad_numeros * 100, 0),
        2
    ) AS porcentaje_vendido

FROM rifas r
LEFT JOIN instituciones ip ON r.institucion_promotora_id = ip.id
LEFT JOIN rifa_participaciones rp ON r.id = rp.rifa_id
LEFT JOIN numeros_rifa n ON r.id = n.rifa_id
GROUP BY 
    r.id, r.nombre, r.descripcion, r.cantidad_numeros, r.precio_numero, 
    r.fecha_inicio, r.fecha_fin, r.fecha_sorteo, r.estado, r.comision_promotora, ip.nombre;

-- Vista de vendedores con sus asignaciones
CREATE OR REPLACE VIEW vista_vendedores_asignaciones AS
SELECT 
    u.id AS vendedor_id,
    MAX(u.nombre) AS nombre,
    MAX(u.apellido) AS apellido,
    MAX(u.email) AS email,
    MAX(i.nombre) AS institucion,
    MAX(r.nombre) AS rifa,
    na.numero_desde,
    na.numero_hasta,
    (na.numero_hasta - na.numero_desde + 1) AS cantidad_numeros_asignados,
    COUNT(n.id) AS numeros_vendidos,
    SUM(IF(n.estado = 'vendido', COALESCE(n.precio_venta, r.precio_numero), 0)) AS total_vendido
FROM usuarios u
JOIN numero_asignaciones na ON u.id = na.vendedor_id
JOIN rifas r ON na.rifa_id = r.id
JOIN instituciones i ON u.institucion_id = i.id
LEFT JOIN numeros_rifa n ON na.id = n.asignacion_id AND n.estado = 'vendido'
WHERE u.rol = 'vendedor'
GROUP BY u.id, na.id, na.numero_desde, na.numero_hasta;

-- =====================================================
-- 8. PROCEDIMIENTOS ALMACENADOS ÚTILES
-- =====================================================

DELIMITER //

-- Procedimiento para asignar números automáticamente
CREATE PROCEDURE AsignarNumerosPorInstitucion(
    IN p_rifa_id INT,
    IN p_numeros_por_institucion INT
)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_participacion_id INT;
    DECLARE v_numero_actual INT DEFAULT 1;
    
    DECLARE cur CURSOR FOR 
        SELECT id FROM rifa_participaciones 
        WHERE rifa_id = p_rifa_id AND estado_participacion = 'aprobada'
        ORDER BY fecha_aprobacion;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN cur;
    
    asignar_loop: LOOP
        FETCH cur INTO v_participacion_id;
        IF done THEN
            LEAVE asignar_loop;
        END IF;
        
        UPDATE rifa_participaciones SET
            numeros_asignados_desde = v_numero_actual,
            numeros_asignados_hasta = v_numero_actual + p_numeros_por_institucion - 1
        WHERE id = v_participacion_id;
        
        SET v_numero_actual = v_numero_actual + p_numeros_por_institucion;
    END LOOP;
    
    CLOSE cur;
END //

-- Procedimiento para generar números de una rifa
CREATE PROCEDURE GenerarNumerosRifa(
    IN p_rifa_id INT
)
BEGIN
    DECLARE v_cantidad_numeros INT;
    DECLARE v_precio_numero DECIMAL(10,2);
    DECLARE v_contador INT DEFAULT 1;
    
    SELECT cantidad_numeros, precio_numero 
    INTO v_cantidad_numeros, v_precio_numero
    FROM rifas WHERE id = p_rifa_id;
    
    WHILE v_contador <= v_cantidad_numeros DO
        INSERT INTO numeros (rifa_id, numero, qr_code, estado)
        VALUES (
            p_rifa_id, 
            v_contador, 
            CONCAT('RIFA', p_rifa_id, '-', LPAD(v_contador, 6, '0'), '-', UNIX_TIMESTAMP()),
            'disponible'
        );
        SET v_contador = v_contador + 1;
    END WHILE;
END //

DELIMITER ;

-- =====================================================
-- 9. DATOS DE EJEMPLO
-- =====================================================

-- Insertar configuración por defecto para instituciones existentes
INSERT IGNORE INTO instituciones_config_rifas (institucion_id, puede_participar_rifas)
SELECT id, TRUE FROM instituciones;

-- Ejemplo de una rifa multi-institución
INSERT INTO rifas (
    nombre, descripcion, institucion_promotora_id, cantidad_numeros, 
    precio_numero, fecha_inicio, fecha_fin, estado, creado_por,
    max_instituciones_participantes, comision_promotora
) VALUES (
    'Gran Rifa Solidaria 2024',
    'Rifa solidaria para recaudar fondos para múltiples instituciones',
    1, -- ID de institución promotora
    1000,
    100.00,
    CURDATE(),
    DATE_ADD(CURDATE(), INTERVAL 30 DAY),
    'activa',
    1, -- ID del usuario creador
    5, -- Máximo 5 instituciones participantes
    15.00 -- 15% de comisión para promotora
);

-- =====================================================
-- 10. TRIGGERS PARA AUTOMATIZACIÓN
-- =====================================================

DELIMITER //

-- Trigger para actualizar estadísticas cuando se vende un número
CREATE TRIGGER ActualizarEstadisticasVenta
AFTER UPDATE ON numeros
FOR EACH ROW
BEGIN
    IF NEW.estado = 'vendido' AND OLD.estado != 'vendido' THEN
        -- Actualizar comisiones
        INSERT INTO rifa_comisiones (rifa_id, participacion_id, total_vendido, numeros_vendidos, porcentaje_comision)
        VALUES (NEW.rifa_id, NEW.participacion_id, COALESCE(NEW.precio_venta, 0), 1, 
                (SELECT comision_acordada FROM rifa_participaciones WHERE id = NEW.participacion_id))
        ON DUPLICATE KEY UPDATE
            total_vendido = total_vendido + COALESCE(NEW.precio_venta, 0),
            numeros_vendidos = numeros_vendidos + 1;
    END IF;
END //

DELIMITER ;

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================

/*
FLUJO DE TRABAJO IMPLEMENTADO:

1. CREACIÓN DE RIFA:
   - Institución promotora crea rifa
   - Define parámetros (números, precio, comisiones)
   - Establece límites de participación

2. PARTICIPACIÓN:
   - Otras instituciones solicitan participar
   - Promotora aprueba/rechaza participaciones
   - Se asignan bloques de números a cada institución

3. ASIGNACIÓN A VENDEDORES:
   - Cada institución asigna números a sus vendedores
   - Vendedores reciben rangos específicos de números

4. VENTA:
   - Vendedores venden números de su asignación
   - Se registra toda la información del comprador
   - Se actualizan automáticamente las comisiones

5. LIQUIDACIÓN:
   - Al finalizar, se calculan comisiones
   - Se genera reporte de distribución de fondos
   - Se procesan pagos a instituciones

VENTAJAS DE ESTA ESTRUCTURA:
- ✅ Múltiples instituciones por rifa
- ✅ Control granular de números
- ✅ Comisiones automáticas
- ✅ Trazabilidad completa
- ✅ Reportes detallados
- ✅ Escalabilidad
*/