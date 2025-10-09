-- =====================================================
-- MIGRACIÓN: Sistema de Instituciones y Vendedores
-- =====================================================

-- Tabla: Instituciones participantes
CREATE TABLE IF NOT EXISTS instituciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    logo_url VARCHAR(500),
    contacto_nombre VARCHAR(255),
    contacto_email VARCHAR(255),
    contacto_telefono VARCHAR(50),
    activo BOOLEAN DEFAULT TRUE,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla: Asignación de bloques a instituciones
CREATE TABLE IF NOT EXISTS rifa_instituciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rifa_id INT NOT NULL,
    institucion_id INT NOT NULL,
    numero_desde INT NOT NULL,
    numero_hasta INT NOT NULL,
    cantidad_numeros INT NOT NULL,
    fecha_asignacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    estado ENUM('activo', 'agotado', 'suspendido') DEFAULT 'activo',
    FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
    FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE,
    UNIQUE KEY unique_rango (rifa_id, numero_desde, numero_hasta),
    INDEX idx_rifa_institucion (rifa_id, institucion_id)
);

-- Tabla: Asignación de números a vendedores
CREATE TABLE IF NOT EXISTS rifa_vendedores (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rifa_institucion_id INT NOT NULL,
    vendedor_id INT NOT NULL,
    numero_desde INT NOT NULL,
    numero_hasta INT NOT NULL,
    cantidad_asignada INT NOT NULL,
    cantidad_vendida INT DEFAULT 0,
    fecha_asignacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rifa_institucion_id) REFERENCES rifa_instituciones(id) ON DELETE CASCADE,
    FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_vendedor (vendedor_id),
    INDEX idx_rifa_institucion (rifa_institucion_id)
);

-- ✅ Modificar tabla numeros_rifa (nombre correcto)
ALTER TABLE numeros_rifa 
ADD COLUMN IF NOT EXISTS institucion_id INT,
ADD COLUMN IF NOT EXISTS vendedor_id INT,
ADD COLUMN IF NOT EXISTS qr_code VARCHAR(500),
ADD COLUMN IF NOT EXISTS hash_verificacion VARCHAR(64),
ADD COLUMN IF NOT EXISTS impreso BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fecha_impresion DATETIME;

-- Agregar foreign keys si no existen
ALTER TABLE numeros_rifa 
ADD CONSTRAINT fk_numeros_institucion 
    FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE SET NULL;

ALTER TABLE numeros_rifa 
ADD CONSTRAINT fk_numeros_vendedor 
    FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_numeros_institucion ON numeros_rifa(institucion_id);
CREATE INDEX IF NOT EXISTS idx_numeros_vendedor ON numeros_rifa(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_numeros_hash ON numeros_rifa(hash_verificacion);


CREATE TABLE IF NOT EXISTS participantes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telefono VARCHAR(50),
  dni VARCHAR(20),
  direccion VARCHAR(500),
  ciudad VARCHAR(100),
  provincia VARCHAR(100),
  codigo_postal VARCHAR(20),
  fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_email (email),
  INDEX idx_dni (dni)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


ALTER TABLE numeros_rifa 
ADD COLUMN participante_id INT NULL AFTER institucion_id,
ADD CONSTRAINT fk_numeros_participante 
  FOREIGN KEY (participante_id) REFERENCES participantes(id) ON DELETE SET NULL;

CREATE INDEX idx_participante ON numeros_rifa(participante_id);