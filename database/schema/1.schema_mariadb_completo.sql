-- =====================================================
-- SCHEMA COMPLETO PARA MARIADB 10.5.x
-- Sistema de Rifas Solidarias Multi-Institución
-- =====================================================

-- Crear nueva base de datos
DROP DATABASE IF EXISTS rifas_solidarias_nuevo;
CREATE DATABASE rifas_solidarias_nuevo;
USE rifas_solidarias_nuevo;

-- Configurar charset y collation
ALTER DATABASE rifas_solidarias_nuevo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =====================================================
-- 1. TABLA INSTITUCIONES
-- =====================================================
CREATE TABLE instituciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    direccion VARCHAR(255),
    telefono VARCHAR(20),
    email VARCHAR(100),
    logo_url VARCHAR(255),
    cuit VARCHAR(15),
    estado ENUM('activa', 'inactiva') DEFAULT 'activa',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_estado (estado),
    INDEX idx_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. TABLA USUARIOS
-- =====================================================
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    dni VARCHAR(20),
    rol ENUM('admin_global', 'admin_institucion', 'vendedor', 'comprador') NOT NULL,
    institucion_id INT NULL,
    estado ENUM('activo', 'inactivo', 'bloqueado') DEFAULT 'activo',
    ultimo_login TIMESTAMP NULL,
    intentos_fallidos INT DEFAULT 0,
    bloqueado_hasta TIMESTAMP NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE SET NULL,
    INDEX idx_email (email),
    INDEX idx_rol (rol),
    INDEX idx_institucion (institucion_id),
    INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. TABLA RIFAS
-- =====================================================
CREATE TABLE rifas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    institucion_promotora_id INT NOT NULL,
    cantidad_numeros INT NOT NULL CHECK (cantidad_numeros > 0),
    precio_numero DECIMAL(10,2) NOT NULL CHECK (precio_numero > 0),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    fecha_sorteo DATETIME NULL,
    imagen_url VARCHAR(255),
    estado ENUM('borrador', 'activa', 'finalizada', 'cancelada') DEFAULT 'borrador',
    
    -- Configuración de participación
    max_instituciones_participantes INT NULL CHECK (max_instituciones_participantes > 0),
    fecha_limite_participacion DATE NULL,
    comision_promotora DECIMAL(5,2) DEFAULT 10.00 CHECK (comision_promotora >= 0 AND comision_promotora <= 50),
    numeros_por_institucion INT NULL CHECK (numeros_por_institucion > 0),
    requiere_aprobacion BOOLEAN DEFAULT TRUE,
    
    -- Información de ganador (se llena después del sorteo)
    numero_ganador INT NULL,
    ganador_id INT NULL,
    fecha_sorteo_realizado TIMESTAMP NULL,
    
    -- Control
    creado_por INT NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (institucion_promotora_id) REFERENCES instituciones(id) ON DELETE RESTRICT,
    FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
    FOREIGN KEY (ganador_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    
    INDEX idx_promotora (institucion_promotora_id),
    INDEX idx_estado (estado),
    INDEX idx_fechas (fecha_inicio, fecha_fin),
    INDEX idx_creado_por (creado_por),
    
    CHECK (fecha_fin >= fecha_inicio),
    CHECK (fecha_limite_participacion IS NULL OR fecha_limite_participacion <= fecha_inicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. TABLA PARTICIPACIONES EN RIFAS
-- =====================================================
CREATE TABLE rifa_participaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rifa_id INT NOT NULL,
    institucion_id INT NOT NULL,
    es_promotora BOOLEAN DEFAULT FALSE,
    estado_participacion ENUM('solicitada', 'aprobada', 'rechazada', 'retirada') DEFAULT 'solicitada',
    
    -- Fechas de gestión
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_aprobacion TIMESTAMP NULL,
    aprobada_por INT NULL,
    
    -- Asignación de números
    numeros_asignados_desde INT NULL,
    numeros_asignados_hasta INT NULL,
    
    -- Comisiones
    comision_acordada DECIMAL(5,2) DEFAULT 0.00 CHECK (comision_acordada >= 0 AND comision_acordada <= 50),
    
    observaciones TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
    FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE,
    FOREIGN KEY (aprobada_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_rifa_institucion (rifa_id, institucion_id),
    INDEX idx_rifa (rifa_id),
    INDEX idx_institucion (institucion_id),
    INDEX idx_estado (estado_participacion),
    
    CHECK (numeros_asignados_hasta IS NULL OR numeros_asignados_hasta >= numeros_asignados_desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 5. TABLA ASIGNACIONES DE NÚMEROS A VENDEDORES
-- =====================================================
CREATE TABLE numero_asignaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rifa_id INT NOT NULL,
    participacion_id INT NOT NULL,
    vendedor_id INT NOT NULL,
    numero_desde INT NOT NULL CHECK (numero_desde > 0),
    numero_hasta INT NOT NULL CHECK (numero_hasta > 0),
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    asignado_por INT NOT NULL,
    estado_asignacion ENUM('activa', 'liberada', 'completada') DEFAULT 'activa',
    observaciones TEXT,
    
    FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
    FOREIGN KEY (participacion_id) REFERENCES rifa_participaciones(id) ON DELETE CASCADE,
    FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (asignado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
    
    INDEX idx_rifa (rifa_id),
    INDEX idx_vendedor (vendedor_id),
    INDEX idx_numeros (numero_desde, numero_hasta),
    INDEX idx_participacion (participacion_id),
    
    CHECK (numero_hasta >= numero_desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 6. TABLA NÚMEROS DE RIFA
-- =====================================================
CREATE TABLE numeros_rifa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rifa_id INT NOT NULL,
    numero INT NOT NULL CHECK (numero > 0),
    qr_code VARCHAR(255) UNIQUE NOT NULL,
    estado ENUM('disponible', 'reservado', 'vendido') DEFAULT 'disponible',
    
    -- Asignación
    participacion_id INT NULL,
    asignacion_id INT NULL,
    vendedor_id INT NULL,
    institucion_vendedora_id INT NULL,
    
    -- Información del comprador
    comprador_id INT NULL,
    comprador_nombre VARCHAR(255) NULL,
    comprador_telefono VARCHAR(20) NULL,
    
    -- Información de venta
    precio_venta DECIMAL(10,2) NULL,
    metodo_pago ENUM('efectivo', 'transferencia', 'tarjeta', 'mercadopago') NULL,
    fecha_reserva TIMESTAMP NULL,
    fecha_venta TIMESTAMP NULL,
    observaciones TEXT,
    
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
    FOREIGN KEY (participacion_id) REFERENCES rifa_participaciones(id) ON DELETE SET NULL,
    FOREIGN KEY (asignacion_id) REFERENCES numero_asignaciones(id) ON DELETE SET NULL,
    FOREIGN KEY (comprador_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (institucion_vendedora_id) REFERENCES instituciones(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_numero_rifa (rifa_id, numero),
    UNIQUE KEY unique_qr (qr_code),
    INDEX idx_rifa (rifa_id),
    INDEX idx_estado (estado),
    INDEX idx_comprador (comprador_id),
    INDEX idx_vendedor (vendedor_id),
    INDEX idx_participacion (participacion_id),
    INDEX idx_asignacion (asignacion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 7. TABLA COMISIONES Y LIQUIDACIONES
-- =====================================================
CREATE TABLE rifa_comisiones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rifa_id INT NOT NULL,
    participacion_id INT NOT NULL,
    
    -- Estadísticas de venta
    total_vendido DECIMAL(12,2) DEFAULT 0.00 CHECK (total_vendido >= 0),
    numeros_vendidos INT DEFAULT 0 CHECK (numeros_vendidos >= 0),
    porcentaje_comision DECIMAL(5,2) NOT NULL CHECK (porcentaje_comision >= 0 AND porcentaje_comision <= 50),
    
    -- Cálculos (se calculan automáticamente)
    monto_comision DECIMAL(12,2) DEFAULT 0.00 CHECK (monto_comision >= 0),
    monto_liquido DECIMAL(12,2) DEFAULT 0.00 CHECK (monto_liquido >= 0),
    
    -- Liquidación
    estado_liquidacion ENUM('pendiente', 'procesando', 'pagada') DEFAULT 'pendiente',
    fecha_liquidacion TIMESTAMP NULL,
    observaciones_liquidacion TEXT,
    
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
    FOREIGN KEY (participacion_id) REFERENCES rifa_participaciones(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_rifa_participacion (rifa_id, participacion_id),
    INDEX idx_rifa (rifa_id),
    INDEX idx_estado (estado_liquidacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 8. TABLA CONFIGURACIÓN POR INSTITUCIÓN
-- =====================================================
CREATE TABLE instituciones_config_rifas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    institucion_id INT NOT NULL,
    
    -- Permisos
    puede_crear_rifas BOOLEAN DEFAULT FALSE,
    puede_participar_rifas BOOLEAN DEFAULT TRUE,
    
    -- Límites
    comision_minima DECIMAL(5,2) DEFAULT 0.00 CHECK (comision_minima >= 0),
    comision_maxima DECIMAL(5,2) DEFAULT 30.00 CHECK (comision_maxima >= 0),
    numeros_minimos_asignacion INT DEFAULT 10 CHECK (numeros_minimos_asignacion > 0),
    numeros_maximos_asignacion INT DEFAULT 500 CHECK (numeros_maximos_asignacion > 0),
    
    -- Configuraciones
    metodos_pago_habilitados JSON DEFAULT '["efectivo"]',
    requiere_aprobacion_participacion BOOLEAN DEFAULT FALSE,
    configuraciones_adicionales JSON NULL,
    
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE,
    UNIQUE KEY unique_config_institucion (institucion_id),
    
    CHECK (comision_maxima >= comision_minima),
    CHECK (numeros_maximos_asignacion >= numeros_minimos_asignacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 9. TABLA SORTEOS
-- =====================================================
CREATE TABLE sorteos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rifa_id INT NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    fecha_sorteo DATETIME NOT NULL,
    metodo_sorteo ENUM('manual', 'aleatorio', 'loteria_nacional') NOT NULL,
    referencia_externa VARCHAR(255),
    estado ENUM('programado', 'en_curso', 'finalizado') DEFAULT 'programado',
    observaciones TEXT,
    realizado_por INT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_finalizacion TIMESTAMP NULL,
    
    FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
    FOREIGN KEY (realizado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    
    INDEX idx_rifa (rifa_id),
    INDEX idx_fecha (fecha_sorteo),
    INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 10. TABLA PREMIOS
-- =====================================================
CREATE TABLE premios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rifa_id INT NOT NULL,
    orden_premio INT NOT NULL CHECK (orden_premio > 0),
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    valor_estimado DECIMAL(10,2) CHECK (valor_estimado >= 0),
    sponsor VARCHAR(255),
    imagen_url VARCHAR(255),
    numero_ganador INT NULL,
    ganador_id INT NULL,
    fecha_entrega TIMESTAMP NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
    FOREIGN KEY (ganador_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_orden_rifa (rifa_id, orden_premio),
    INDEX idx_rifa (rifa_id),
    INDEX idx_orden (orden_premio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 11. TABLA RESULTADOS DE SORTEO
-- =====================================================
CREATE TABLE resultados_sorteo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sorteo_id INT NOT NULL,
    premio_id INT NOT NULL,
    numero_ganador INT NOT NULL,
    numero_id INT NOT NULL,
    fecha_resultado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (sorteo_id) REFERENCES sorteos(id) ON DELETE CASCADE,
    FOREIGN KEY (premio_id) REFERENCES premios(id) ON DELETE CASCADE,
    FOREIGN KEY (numero_id) REFERENCES numeros_rifa(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_sorteo_premio (sorteo_id, premio_id),
    INDEX idx_sorteo (sorteo_id),
    INDEX idx_numero_ganador (numero_ganador)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 12. TABLA TRANSACCIONES (OPCIONAL)
-- =====================================================
CREATE TABLE transacciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rifa_id INT NOT NULL,
    comprador_id INT NOT NULL,
    numero_id INT NOT NULL,
    monto DECIMAL(10,2) NOT NULL CHECK (monto > 0),
    metodo_pago ENUM('efectivo', 'transferencia', 'tarjeta', 'mercadopago') NOT NULL,
    estado_pago ENUM('pendiente', 'completado', 'fallido', 'reembolsado') DEFAULT 'pendiente',
    referencia_externa VARCHAR(255),
    fecha_transaccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_confirmacion TIMESTAMP NULL,
    
    FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE RESTRICT,
    FOREIGN KEY (comprador_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    FOREIGN KEY (numero_id) REFERENCES numeros_rifa(id) ON DELETE RESTRICT,
    
    INDEX idx_rifa (rifa_id),
    INDEX idx_comprador (comprador_id),
    INDEX idx_estado (estado_pago),
    INDEX idx_fecha (fecha_transaccion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 13. TRIGGERS PARA AUTOMATIZACIÓN
-- =====================================================

-- Trigger para actualizar comisiones automáticamente
DELIMITER $$

CREATE TRIGGER actualizar_comisiones_venta
AFTER UPDATE ON numeros_rifa
FOR EACH ROW
BEGIN
    IF NEW.estado = 'vendido' AND OLD.estado != 'vendido' AND NEW.participacion_id IS NOT NULL THEN
        INSERT INTO rifa_comisiones (
            rifa_id, 
            participacion_id, 
            total_vendido, 
            numeros_vendidos, 
            porcentaje_comision,
            monto_comision,
            monto_liquido
        )
        SELECT 
            NEW.rifa_id,
            NEW.participacion_id,
            COALESCE(NEW.precio_venta, r.precio_numero),
            1,
            rp.comision_acordada,
            (COALESCE(NEW.precio_venta, r.precio_numero) * rp.comision_acordada / 100),
            (COALESCE(NEW.precio_venta, r.precio_numero) * (1 - rp.comision_acordada / 100))
        FROM rifas r
        JOIN rifa_participaciones rp ON r.id = rp.rifa_id
        WHERE r.id = NEW.rifa_id AND rp.id = NEW.participacion_id
        ON DUPLICATE KEY UPDATE
            total_vendido = total_vendido + COALESCE(NEW.precio_venta, VALUES(total_vendido)),
            numeros_vendidos = numeros_vendidos + 1,
            monto_comision = (total_vendido * porcentaje_comision / 100),
            monto_liquido = (total_vendido * (1 - porcentaje_comision / 100));
    END IF;
END$$

DELIMITER ;

-- =====================================================
-- 14. VISTAS ÚTILES
-- =====================================================

-- Vista de rifas con estadísticas
CREATE VIEW vista_rifas_estadisticas AS
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
    ip.nombre as institucion_promotora,
    ip.logo_url as institucion_promotora_logo,
    
    -- Estadísticas de participación
    COUNT(DISTINCT rp.id) as total_instituciones_participantes,
    COUNT(DISTINCT CASE WHEN rp.estado_participacion = 'aprobada' THEN rp.id END) as instituciones_aprobadas,
    
    -- Estadísticas de números
    COUNT(DISTINCT n.id) as total_numeros_generados,
    COUNT(DISTINCT CASE WHEN n.estado = 'vendido' THEN n.id END) as numeros_vendidos,
    COUNT(DISTINCT CASE WHEN n.estado = 'reservado' THEN n.id END) as numeros_reservados,
    
    -- Estadísticas financieras
    SUM(CASE WHEN n.estado = 'vendido' THEN COALESCE(n.precio_venta, r.precio_numero) ELSE 0 END) as total_recaudado,
    (r.cantidad_numeros * r.precio_numero) as total_potencial,
    
    -- Porcentajes
    ROUND(
        (COUNT(CASE WHEN n.estado = 'vendido' THEN 1 END) / r.cantidad_numeros) * 100, 
        2
    ) as porcentaje_vendido

FROM rifas r
LEFT JOIN instituciones ip ON r.institucion_promotora_id = ip.id
LEFT JOIN rifa_participaciones rp ON r.id = rp.rifa_id
LEFT JOIN numeros_rifa n ON r.id = n.rifa_id
GROUP BY r.id;

-- Vista de vendedores con asignaciones
CREATE VIEW vista_vendedores_asignaciones AS
SELECT 
    u.id as vendedor_id,
    u.nombre,
    u.apellido,
    u.email,
    i.nombre as institucion,
    r.nombre as rifa,
    na.numero_desde,
    na.numero_hasta,
    (na.numero_hasta - na.numero_desde + 1) as cantidad_numeros_asignados,
    COUNT(n.id) as numeros_vendidos,
    SUM(CASE WHEN n.estado = 'vendido' THEN COALESCE(n.precio_venta, r.precio_numero) ELSE 0 END) as total_vendido
    
FROM usuarios u
JOIN numero_asignaciones na ON u.id = na.vendedor_id
JOIN rifas r ON na.rifa_id = r.id
JOIN instituciones i ON u.institucion_id = i.id
LEFT JOIN numeros_rifa n ON na.id = n.asignacion_id AND n.estado = 'vendido'
WHERE u.rol = 'vendedor'
GROUP BY u.id, na.id;

-- =====================================================
-- 15. DATOS INICIALES
-- =====================================================

-- Insertar instituciones de ejemplo
INSERT INTO instituciones (nombre, descripcion, email, estado) VALUES
('Cruz Roja Argentina', 'Organización humanitaria dedicada a ayudar en emergencias', 'info@cruzroja.org.ar', 'activa'),
('Cáritas Argentina', 'Organización católica de asistencia social', 'contacto@caritas.org.ar', 'activa'),
('Fundación Huésped', 'Organización dedicada a la salud pública', 'info@huesped.org.ar', 'activa'),
('UNICEF Argentina', 'Fondo de las Naciones Unidas para la Infancia', 'argentina@unicef.org', 'activa');

-- Configuración por defecto para todas las instituciones
INSERT INTO instituciones_config_rifas (institucion_id, puede_participar_rifas, metodos_pago_habilitados)
SELECT id, TRUE, '["efectivo", "transferencia"]' FROM instituciones;

-- Dar permisos de creación a la primera institución (será la promotora de ejemplo)
UPDATE instituciones_config_rifas SET puede_crear_rifas = TRUE WHERE institucion_id = 1;

-- Crear usuario administrador global
INSERT INTO usuarios (nombre, apellido, email, password, rol, estado) VALUES
('Admin', 'Sistema', 'admin@rifas.com', '$2b$10$hash_de_ejemplo', 'admin_global', 'activo');

-- Crear usuarios admin por institución
INSERT INTO usuarios (nombre, apellido, email, password, rol, institucion_id, estado) VALUES
('Admin', 'Cruz Roja', 'admin@cruzroja.org.ar', '$2b$10$hash_de_ejemplo', 'admin_institucion', 1, 'activo'),
('Admin', 'Cáritas', 'admin@caritas.org.ar', '$2b$10$hash_de_ejemplo', 'admin_institucion', 2, 'activo'),
('Admin', 'Huésped', 'admin@huesped.org.ar', '$2b$10$hash_de_ejemplo', 'admin_institucion', 3, 'activo');

-- =====================================================
-- 16. PROCEDIMIENTOS ALMACENADOS
-- =====================================================

DELIMITER $$

-- Procedimiento para generar números de una rifa
CREATE PROCEDURE GenerarNumerosRifa(IN p_rifa_id INT)
BEGIN
    DECLARE v_cantidad_numeros INT;
    DECLARE v_contador INT DEFAULT 1;
    DECLARE v_qr_base VARCHAR(50);
    
    SELECT cantidad_numeros INTO v_cantidad_numeros
    FROM rifas WHERE id = p_rifa_id;
    
    SET v_qr_base = CONCAT('RIFA', p_rifa_id, '-');
    
    WHILE v_contador <= v_cantidad_numeros DO
        INSERT INTO numeros_rifa (rifa_id, numero, qr_code, estado)
        VALUES (
            p_rifa_id, 
            v_contador, 
            CONCAT(v_qr_base, LPAD(v_contador, 6, '0'), '-', UNIX_TIMESTAMP()),
            'disponible'
        );
        SET v_contador = v_contador + 1;
    END WHILE;
END$$

-- Procedimiento para asignar números por institución automáticamente
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
END$$

DELIMITER ;

-- =====================================================
-- 17. VERIFICACIÓN FINAL
-- =====================================================

-- Mostrar resumen de tablas creadas
SELECT 
    'instituciones' as tabla, 
    COUNT(*) as registros 
FROM instituciones
UNION ALL
SELECT 'usuarios' as tabla, COUNT(*) as registros FROM usuarios
UNION ALL
SELECT 'rifas' as tabla, COUNT(*) as registros FROM rifas
UNION ALL
SELECT 'rifa_participaciones' as tabla, COUNT(*) as registros FROM rifa_participaciones
UNION ALL
SELECT 'numero_asignaciones' as tabla, COUNT(*) as registros FROM numero_asignaciones
UNION ALL
SELECT 'numeros_rifa' as tabla, COUNT(*) as registros FROM numeros_rifa
UNION ALL
SELECT 'rifa_comisiones' as tabla, COUNT(*) as registros FROM rifa_comisiones
UNION ALL
SELECT 'instituciones_config_rifas' as tabla, COUNT(*) as registros FROM instituciones_config_rifas;

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================

/*
CARACTERÍSTICAS DE ESTE SCHEMA:

✅ COMPATIBLE CON MARIADB 10.5.x:
- Sin columnas GENERATED (calculadas manualmente)
- Sintaxis compatible con versión 10.5
- Charset UTF8MB4 correctamente configurado
- ENGINE InnoDB en todas las tablas

✅ SCHEMA LIMPIO Y NUEVO:
- Base de datos nueva: rifas_solidarias_nuevo
- Todas las tablas desde cero
- Datos de ejemplo incluidos
- Configuración inicial automática

✅ FUNCIONALIDADES COMPLETAS:
- Sistema multi-institución
- Asignación de números por bloques
- Comisiones automáticas
- Trazabilidad completa
- Reportes y estadísticas

✅ OPTIMIZADO:
- Índices en campos importantes
- Constraints para integridad
- Triggers para automatización
- Vistas para consultas complejas
- Procedimientos almacenados

PRÓXIMOS PASOS:
1. Ejecutar este script completo
2. Actualizar conexión en backend a "rifas_solidarias_nuevo"
3. ¡Listo para usar!
*/