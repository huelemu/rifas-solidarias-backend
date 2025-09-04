-- Schema para Rifas Solidarias
-- Crear la base de datos
CREATE DATABASE IF NOT EXISTS rifas_solidarias_dev;
USE rifas_solidarias_dev;

-- 1. Tabla Instituciones
CREATE TABLE instituciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    direccion VARCHAR(255),
    telefono VARCHAR(20),
    email VARCHAR(100),
    logo_url VARCHAR(255),
    estado ENUM('activa', 'inactiva') DEFAULT 'activa',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Tabla Usuarios
CREATE TABLE usuarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    dni VARCHAR(20),
    rol ENUM('admin_global', 'admin_institucion', 'vendedor', 'comprador') NOT NULL,
    institucion_id INT,
    estado ENUM('activo', 'inactivo') DEFAULT 'activo',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE SET NULL,
    INDEX idx_email (email),
    INDEX idx_rol (rol)
);

-- 3. Tabla Rifas
CREATE TABLE rifas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    institucion_id INT NOT NULL,
    cantidad_numeros INT NOT NULL,
    precio_numero DECIMAL(10,2) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    fecha_sorteo DATETIME,
    imagen_url VARCHAR(255),
    estado ENUM('borrador', 'activa', 'finalizada', 'cancelada') DEFAULT 'borrador',
    creado_por INT NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE,
    FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
    INDEX idx_institucion (institucion_id),
    INDEX idx_estado (estado),
    INDEX idx_fechas (fecha_inicio, fecha_fin)
);

-- 4. Tabla Premios
CREATE TABLE premios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rifa_id INT NOT NULL,
    orden_premio INT NOT NULL, -- 1er premio, 2do premio, etc.
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    valor_estimado DECIMAL(10,2),
    sponsor VARCHAR(255), -- Empresa o persona que patrocina el premio
    imagen_url VARCHAR(255),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
    UNIQUE KEY unique_orden_rifa (rifa_id, orden_premio),
    INDEX idx_rifa (rifa_id)
);

-- 5. Tabla Números/Tickets
CREATE TABLE numeros (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rifa_id INT NOT NULL,
    numero INT NOT NULL,
    qr_code VARCHAR(255) UNIQUE NOT NULL, -- Hash único para QR
    estado ENUM('disponible', 'reservado', 'vendido') DEFAULT 'disponible',
    comprador_id INT NULL,
    vendedor_id INT NULL,
    fecha_reserva TIMESTAMP NULL,
    fecha_venta TIMESTAMP NULL,
    metodo_pago ENUM('efectivo', 'transferencia', 'tarjeta') NULL,
    observaciones TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
    FOREIGN KEY (comprador_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    UNIQUE KEY unique_numero_rifa (rifa_id, numero),
    UNIQUE KEY unique_qr (qr_code),
    INDEX idx_rifa (rifa_id),
    INDEX idx_estado (estado),
    INDEX idx_comprador (comprador_id)
);

-- 6. Tabla Sorteos
CREATE TABLE sorteos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rifa_id INT NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    fecha_sorteo DATETIME NOT NULL,
    metodo_sorteo ENUM('manual', 'aleatorio', 'loteria_nacional') NOT NULL,
    referencia_externa VARCHAR(255), -- Para lotería nacional o sorteos externos
    estado ENUM('programado', 'en_curso', 'finalizado') DEFAULT 'programado',
    observaciones TEXT,
    realizado_por INT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_finalizacion TIMESTAMP NULL,
    FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
    FOREIGN KEY (realizado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_rifa (rifa_id),
    INDEX idx_fecha (fecha_sorteo)
);

-- 7. Tabla Resultados de Sorteo
CREATE TABLE resultados_sorteo (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sorteo_id INT NOT NULL,
    premio_id INT NOT NULL,
    numero_ganador INT NOT NULL,
    numero_id INT NOT NULL, -- Referencia al registro específico del número
    fecha_resultado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sorteo_id) REFERENCES sorteos(id) ON DELETE CASCADE,
    FOREIGN KEY (premio_id) REFERENCES premios(id) ON DELETE CASCADE,
    FOREIGN KEY (numero_id) REFERENCES numeros(id) ON DELETE CASCADE,
    UNIQUE KEY unique_sorteo_premio (sorteo_id, premio_id),
    INDEX idx_sorteo (sorteo_id),
    INDEX idx_numero_ganador (numero_ganador)
);

-- 8. Tabla de Auditoría (opcional pero recomendada)
CREATE TABLE auditoria (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tabla VARCHAR(50) NOT NULL,
    registro_id INT NOT NULL,
    accion ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    usuario_id INT,
    datos_anteriores JSON,
    datos_nuevos JSON,
    fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_tabla (tabla),
    INDEX idx_fecha (fecha_accion),
    INDEX idx_usuario (usuario_id)
);

-- Insertar datos iniciales

-- Insertar institución de ejemplo
INSERT INTO instituciones (nombre, descripcion, email) VALUES 
('Club Deportivo Ejemplo', 'Club deportivo local que organiza rifas para recaudar fondos', 'admin@clubejemplo.com');

-- Insertar usuario administrador global
INSERT INTO usuarios (nombre, apellido, email, password, rol) VALUES 
('Admin', 'Sistema', 'admin@rifas.com', '$2b$10$example_hash', 'admin_global');

-- Insertar usuario admin de institución
INSERT INTO usuarios (nombre, apellido, email, password, rol, institucion_id) VALUES 
('Juan', 'Pérez', 'admin@clubejemplo.com', '$2b$10$example_hash', 'admin_institucion', 1);

-- Crear índices adicionales para optimización
CREATE INDEX idx_usuarios_institucion_rol ON usuarios(institucion_id, rol);
CREATE INDEX idx_numeros_rifa_estado ON numeros(rifa_id, estado);
CREATE INDEX idx_rifas_fechas_estado ON rifas(fecha_inicio, fecha_fin, estado);