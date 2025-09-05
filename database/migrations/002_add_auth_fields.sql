-- Migración para agregar campos de autenticación JWT
-- Archivo: database/migrations/002_add_auth_fields.sql

USE rifas_solidarias_dev;

-- Agregar columnas para JWT y tracking de sesiones
ALTER TABLE usuarios 
ADD COLUMN refresh_token TEXT NULL AFTER password,
ADD COLUMN ultimo_login TIMESTAMP NULL AFTER fecha_actualizacion,
ADD COLUMN intentos_login INT DEFAULT 0 AFTER ultimo_login,
ADD COLUMN bloqueado_hasta TIMESTAMP NULL AFTER intentos_login;

-- Agregar índice para búsquedas por refresh token
ALTER TABLE usuarios 
ADD INDEX idx_refresh_token (refresh_token(100));

-- Crear tabla para tracking de sesiones activas (opcional, para mayor seguridad)
CREATE TABLE sesiones_activas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    refresh_token TEXT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMP NOT NULL,
    activa BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario (usuario_id),
    INDEX idx_token (refresh_token(100)),
    INDEX idx_expiracion (fecha_expiracion)
);

-- Crear tabla para log de intentos de login (seguridad)
CREATE TABLE log_intentos_login (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    exito BOOLEAN DEFAULT FALSE,
    motivo_fallo VARCHAR(100),
    fecha_intento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_fecha (fecha_intento),
    INDEX idx_ip (ip_address)
);

-- Insertar configuraciones del sistema para JWT
CREATE TABLE configuraciones_sistema (
    id INT PRIMARY KEY AUTO_INCREMENT,
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    descripcion TEXT,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO configuraciones_sistema (clave, valor, descripcion) VALUES
('jwt_access_expires', '15m', 'Tiempo de expiración del access token'),
('jwt_refresh_expires', '7d', 'Tiempo de expiración del refresh token'),
('max_intentos_login', '5', 'Máximo número de intentos de login antes de bloqueo'),
('tiempo_bloqueo_minutos', '30', 'Tiempo de bloqueo en minutos después de exceder intentos');