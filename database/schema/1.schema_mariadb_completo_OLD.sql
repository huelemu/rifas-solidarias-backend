-- =====================================================
-- SCHEMA COMPLETO PARA MARIADB 10.5.x
-- Sistema de Rifas Solidarias Multi-Institución
-- BASE DE DATOS NUEVA Y LIMPIA
-- =====================================================

-- Crear nueva base de datos
DROP DATABASE IF EXISTS rifas_solidarias_nuevo;
CREATE DATABASE rifas_solidarias_nuevo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rifas_solidarias_nuevo;

-- =====================================================
-- 1. TABLA INSTITUCIONES
-- =====================================================
CREATE TABLE instituciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    direccion VARCHAR(255),
    telefono VARCHAR(20),
    email VARCHAR(100) UNIQUE,
    logo_url VARCHAR(255),
    cuit VARCHAR(15),
    estado ENUM('activa', 'inactiva') DEFAULT 'activa',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_estado (estado),
    INDEX idx_nombre (nombre),
    INDEX idx_email (email)
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
-- 3. TABLA CONFIGURACIÓN DE RIFAS POR INSTITUCIÓN
-- =====================================================
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
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_config_institucion (institucion_id),
    FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. TABLA RIFAS (MULTI-INSTITUCIÓN)
-- =====================================================
CREATE TABLE rifas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    institucion_promotora_id INT NOT NULL,
    cantidad_numeros INT NOT NULL CHECK (cantidad_numeros > 0),
    precio_numero DECIMAL(10,2) NOT NULL CHECK (precio_numero > 0),
    
    -- Fechas
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    fecha_sorteo DATE NOT NULL,
    fecha_limite_participacion DATE NULL,
    
    -- Multi-institución
    max_instituciones_participantes INT DEFAULT NULL,
    comision_promotora DECIMAL(5,2) DEFAULT 10.00,
    requiere_aprobacion BOOLEAN DEFAULT FALSE,
    numeros_por_institucion INT NULL,
    
    -- Estado y control
    estado ENUM('borrador', 'activa', 'finalizada', 'cancelada') DEFAULT 'borrador',
    creado_por INT NOT NULL,
    numero_ganador INT NULL,
    fecha_sorteo_realizado TIMESTAMP NULL,
    
    -- Metadatos
    imagen_url VARCHAR(255),
    bases_condiciones TEXT,
    observaciones TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (institucion_promotora_id) REFERENCES instituciones(id) ON DELETE RESTRICT,
    FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
    INDEX idx_promotora (institucion_promotora_id),
    INDEX idx_estado (estado),
    INDEX idx_fechas (fecha_inicio, fecha_fin),
    INDEX idx_creado_por (creado_por)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 5. TABLA PARTICIPACIONES DE RIFAS
-- =====================================================
CREATE TABLE rifa_participaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rifa_id INT NOT NULL,
    institucion_id INT NOT NULL,
    es_promotora BOOLEAN DEFAULT FALSE,
    estado_participacion ENUM('solicitada','aprobada','rechazada','retirada') NOT NULL DEFAULT 'solicitada',
    
    -- Fechas
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_aprobacion TIMESTAMP NULL,
    aprobada_por INT NULL,
    
    -- Asignación de números
    numeros_asignados_desde INT NULL,
    numeros_asignados_hasta INT NULL,
    cantidad_numeros_asignados INT DEFAULT 0,
    
    -- Comisiones
    comision_acordada DECIMAL(5,2) DEFAULT 0.00,
    
    -- Metadatos
    observaciones TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_rifa_institucion (rifa_id, institucion_id),
    FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
    FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE,
    FOREIGN KEY (aprobada_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_rifa (rifa_id),
    INDEX idx_institucion (institucion_id),
    INDEX idx_estado (estado_participacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 6. TABLA ASIGNACIONES DE NÚMEROS A VENDEDORES
-- =====================================================
CREATE TABLE numero_asignaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    participacion_id INT NOT NULL,
    vendedor_id INT NOT NULL,
    numeros_desde INT NOT NULL,
    numeros_hasta INT NOT NULL,
    cantidad_numeros INT NOT NULL,
    estado_asignacion ENUM('asignada', 'en_venta', 'completada', 'cancelada') DEFAULT 'asignada',
    
    -- Estadísticas de venta
    numeros_vendidos INT DEFAULT 0,
    numeros_disponibles INT NOT NULL,
    monto_vendido DECIMAL(12,2) DEFAULT 0.00,
    
    -- Fechas
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_completada TIMESTAMP NULL,
    observaciones TEXT,
    
    FOREIGN KEY (participacion_id) REFERENCES rifa_participaciones(id) ON DELETE CASCADE,
    FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_participacion (participacion_id),
    INDEX idx_vendedor (vendedor_id),
    INDEX idx_estado (estado_asignacion),
    INDEX idx_numeros (numeros_desde, numeros_hasta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 7. TABLA NÚMEROS DE RIFA
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
    comprador_email VARCHAR(100) NULL,
    
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
-- 8. TABLA COMISIONES Y LIQUIDACIONES
-- =====================================================
CREATE TABLE rifa_comisiones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rifa_id INT NOT NULL,
    participacion_id INT NOT NULL,
    
    -- Montos
    total_vendido DECIMAL(12,2) DEFAULT 0.00,
    numeros_vendidos INT DEFAULT 0,
    porcentaje_comision DECIMAL(5,2) NOT NULL,
    monto_comision DECIMAL(12,2) DEFAULT 0.00,
    monto_liquido DECIMAL(12,2) DEFAULT 0.00,
    
    -- Estado de liquidación
    estado_liquidacion ENUM('pendiente','procesando','pagada') NOT NULL DEFAULT 'pendiente',
    fecha_liquidacion TIMESTAMP NULL,
    observaciones_liquidacion TEXT,
    
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_rifa_participacion (rifa_id, participacion_id),
    FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
    FOREIGN KEY (participacion_id) REFERENCES rifa_participaciones(id) ON DELETE CASCADE,
    INDEX idx_rifa (rifa_id),
    INDEX idx_estado (estado_liquidacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 9. INSERTAR DATOS DE EJEMPLO
-- =====================================================

-- Instituciones de ejemplo
INSERT INTO instituciones (nombre, descripcion, email, estado) VALUES
('Cruz Roja Argentina', 'Organización humanitaria dedicada a ayudar en emergencias', 'info@cruzroja.org.ar', 'activa'),
('Cáritas Argentina', 'Organización católica de asistencia social', 'contacto@caritas.org.ar', 'activa'),
('Fundación Huésped', 'Organización dedicada a la salud pública', 'info@huesped.org.ar', 'activa'),
('UNICEF Argentina', 'Fondo de las Naciones Unidas para la Infancia', 'argentina@unicef.org', 'activa');

-- Configuración por defecto para instituciones
INSERT INTO instituciones_config_rifas (institucion_id, puede_participar_rifas, metodos_pago_habilitados)
SELECT id, TRUE, '["efectivo", "transferencia"]' FROM instituciones;

-- Dar permisos de creación a la primera institución
UPDATE instituciones_config_rifas SET puede_crear_rifas = TRUE WHERE institucion_id = 1;

-- Usuarios de ejemplo (password = '123456' hasheado con bcrypt)
INSERT INTO usuarios (nombre, apellido, email, password, rol, estado) VALUES
('Admin', 'Sistema', 'admin@rifas.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin_global', 'activo');

INSERT INTO usuarios (nombre, apellido, email, password, rol, institucion_id, estado) VALUES
('Admin', 'Cruz Roja', 'admin@cruzroja.org.ar', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin_institucion', 1, 'activo'),
('Vendedor', 'Cruz Roja', 'vendedor@cruzroja.org.ar', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'vendedor', 1, 'activo'),
('Admin', 'Cáritas', 'admin@caritas.org.ar', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin_institucion', 2, 'activo'),
('Juan', 'Pérez', 'juan@example.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'comprador', NULL, 'activo');

-- Rifa de ejemplo para testing
INSERT INTO rifas (
    nombre, descripcion, institucion_promotora_id, cantidad_numeros, 
    precio_numero, fecha_inicio, fecha_fin, fecha_sorteo, estado, creado_por,
    max_instituciones_participantes, comision_promotora
) VALUES (
    'Gran Rifa Solidaria 2025',
    'Rifa solidaria para recaudar fondos para múltiples instituciones',
    1, -- Cruz Roja como promotora
    1000,
    100.00,
    CURDATE(),
    DATE_ADD(CURDATE(), INTERVAL 30 DAY),
    DATE_ADD(CURDATE(), INTERVAL 32 DAY),
    'borrador',
    2, -- ID del admin de Cruz Roja
    5, -- Máximo 5 instituciones participantes
    15.00 -- 15% de comisión para promotora
);

-- Participación automática de la promotora
INSERT INTO rifa_participaciones (
    rifa_id, institucion_id, es_promotora, estado_participacion,
    fecha_aprobacion, aprobada_por, numeros_asignados_desde, 
    numeros_asignados_hasta, cantidad_numeros_asignados, comision_acordada
) VALUES (
    1, 1, TRUE, 'aprobada', NOW(), 2, 1, 200, 200, 15.00
);

-- Participación de Cáritas (pendiente de aprobación)
INSERT INTO rifa_participaciones (
    rifa_id, institucion_id, es_promotora, estado_participacion
) VALUES (
    1, 2, FALSE, 'solicitada'
);

-- =====================================================
-- 10. VERIFICACIÓN FINAL
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
-- SCHEMA COMPLETADO EXITOSAMENTE
-- =====================================================

/*
RESUMEN DE LA NUEVA BASE DE DATOS:

✅ BASE DE DATOS: rifas_solidarias_nuevo
✅ TABLAS: 8 tablas principales
✅ DATOS: Instituciones y usuarios de ejemplo
✅ RIFA: Una rifa de ejemplo para testing
✅ USUARIOS DE PRUEBA: 
   - admin@rifas.com (admin_global)
   - admin@cruzroja.org.ar (admin_institucion)
   - vendedor@cruzroja.org.ar (vendedor)
   - juan@example.com (comprador)
   - PASSWORD PARA TODOS: "123456"

PRÓXIMO PASO:
Actualizar archivo .env del backend:
DB_NAME=rifas_solidarias_nuevo

¡LISTO PARA USAR!
*/