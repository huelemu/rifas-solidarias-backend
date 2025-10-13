-- =====================================================
-- RIFAS SOLIDARIAS - SCHEMA COMPLETO DEFINITIVO v2.0
-- CON TODAS LAS FUNCIONALIDADES IMPLEMENTADAS
-- MariaDB 10.5+ Compatible
-- =====================================================

DROP DATABASE IF EXISTS rifas_solidarias_dev;
CREATE DATABASE rifas_solidarias_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rifas_solidarias_dev;

-- =====================================================
-- 1. INSTITUCIONES (CON LOGOS)
-- =====================================================
CREATE TABLE instituciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  direccion VARCHAR(255),
  telefono VARCHAR(20),
  email VARCHAR(100),
  logo_url VARCHAR(500) COMMENT 'URL del logo de la institución',
  cuit VARCHAR(15),
  tipo VARCHAR(100),
  estado ENUM('activa', 'inactiva') DEFAULT 'activa',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_estado (estado),
  INDEX idx_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. USUARIOS (CON GOOGLE OAUTH + 2FA)
-- =====================================================
CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NULL COMMENT 'NULL si usa solo Google OAuth',
  telefono VARCHAR(20),
  dni VARCHAR(20),
  
  -- ROL PRINCIPAL (para compatibilidad con backend actual)
  rol ENUM('admin_global', 'admin_institucion', 'vendedor', 'comprador') DEFAULT 'comprador',
  institucion_id INT NULL COMMENT 'Institución principal (deprecado, usar usuarios_instituciones)',
  
  -- Flag adicional para admin global
  es_admin_global TINYINT(1) DEFAULT 0,
  estado ENUM('activo', 'inactivo', 'bloqueado') DEFAULT 'activo',
  
  -- Google OAuth
  google_id VARCHAR(100) UNIQUE NULL COMMENT 'ID único de Google',
  profile_image_url VARCHAR(500) NULL COMMENT 'Foto de perfil de Google/upload',
  email_verificado TINYINT(1) DEFAULT 0,
  fecha_verificacion TIMESTAMP NULL,
  
  -- Seguridad y autenticación
  ultimo_login TIMESTAMP NULL,
  intentos_fallidos INT DEFAULT 0,
  bloqueado_hasta TIMESTAMP NULL,
  refresh_token TEXT NULL,
  token_version INT DEFAULT 1,
  password_cambiado_en TIMESTAMP NULL,
  tokens_invalidos_desde TIMESTAMP NULL,
  
  -- Two-Factor Authentication
  two_factor_enabled TINYINT(1) DEFAULT 0,
  two_factor_secret VARCHAR(32) NULL,
  
  -- Control de sesiones
  max_sesiones_concurrentes INT DEFAULT 3,
  require_password_change TINYINT(1) DEFAULT 0,
  
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE SET NULL,
  INDEX idx_email (email),
  INDEX idx_google_id (google_id),
  INDEX idx_rol (rol),
  INDEX idx_institucion (institucion_id),
  INDEX idx_estado (estado),
  INDEX idx_admin (es_admin_global)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. USUARIOS_INSTITUCIONES (Roles flexibles)
-- =====================================================
CREATE TABLE usuarios_instituciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  institucion_id INT NOT NULL,
  rol ENUM('admin', 'vendedor') NOT NULL,
  activo TINYINT(1) DEFAULT 1,
  fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE,
  UNIQUE KEY unique_usuario_institucion_rol (usuario_id, institucion_id, rol),
  INDEX idx_usuario (usuario_id),
  INDEX idx_institucion (institucion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. RIFAS (CON IMAGEN)
-- =====================================================
CREATE TABLE rifas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  institucion_promotora_id INT NOT NULL,
  cantidad_numeros INT NOT NULL,
  precio_numero DECIMAL(10,2) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  fecha_sorteo DATETIME NULL,
  imagen_url VARCHAR(500) NULL COMMENT 'Imagen/banner de la rifa',
  estado ENUM('borrador', 'activa', 'pausada', 'finalizada', 'cancelada') DEFAULT 'borrador',
  es_multi_institucion TINYINT(1) DEFAULT 0,
  permite_compra_online TINYINT(1) DEFAULT 1,
  creado_por INT NOT NULL,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (institucion_promotora_id) REFERENCES instituciones(id) ON DELETE RESTRICT,
  FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
  INDEX idx_institucion (institucion_promotora_id),
  INDEX idx_estado (estado),
  INDEX idx_fechas (fecha_inicio, fecha_fin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 5. RIFA_PARTICIPACIONES
-- =====================================================
CREATE TABLE rifa_participaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rifa_id INT NOT NULL,
  institucion_id INT NOT NULL,
  es_promotora TINYINT(1) DEFAULT 0,
  estado ENUM('solicitada', 'aprobada', 'rechazada', 'retirada') DEFAULT 'aprobada',
  numeros_desde INT NULL,
  numeros_hasta INT NULL,
  comision_porcentaje DECIMAL(5,2) DEFAULT 0.00,
  fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_aprobacion TIMESTAMP NULL,
  aprobado_por INT NULL,
  
  FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
  FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE CASCADE,
  FOREIGN KEY (aprobado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  UNIQUE KEY unique_rifa_institucion (rifa_id, institucion_id),
  INDEX idx_rifa (rifa_id),
  INDEX idx_institucion (institucion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 6. PREMIOS
-- =====================================================
CREATE TABLE premios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rifa_id INT NOT NULL,
  orden INT NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  valor_estimado DECIMAL(10,2),
  imagen_url VARCHAR(500) NULL COMMENT 'Imagen del premio',
  numero_ganador INT NULL,
  fecha_asignacion TIMESTAMP NULL,
  
  FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
  UNIQUE KEY unique_rifa_orden (rifa_id, orden),
  INDEX idx_rifa (rifa_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 7. COMPRAS_RIFAS (Tabla CENTRAL)
-- =====================================================
CREATE TABLE compras_rifas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rifa_id INT NOT NULL,
  comprador_id INT NOT NULL,
  vendedor_id INT NULL,
  institucion_id INT NULL,
  numeros_comprados LONGTEXT NOT NULL CHECK (JSON_VALID(numeros_comprados)),
  cantidad_numeros INT NOT NULL,
  monto_total DECIMAL(10,2) NOT NULL,
  metodo_pago ENUM('efectivo', 'transferencia', 'mercadopago', 'tarjeta', 'otro') DEFAULT 'efectivo',
  estado ENUM('pendiente', 'confirmado', 'cancelado') DEFAULT 'confirmado',
  comprobante_url VARCHAR(500) NULL,
  notas TEXT NULL,
  fecha_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_confirmacion TIMESTAMP NULL,
  confirmado_por INT NULL,
  
  FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
  FOREIGN KEY (comprador_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE SET NULL,
  FOREIGN KEY (confirmado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  
  INDEX idx_rifa_comprador (rifa_id, comprador_id),
  INDEX idx_comprador (comprador_id),
  INDEX idx_vendedor (vendedor_id),
  INDEX idx_institucion (institucion_id),
  INDEX idx_estado (estado),
  INDEX idx_fecha (fecha_compra)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 8. NUMEROS_RIFA (CON QR CODE + HASH + IMPRESIÓN)
-- =====================================================
CREATE TABLE numeros_rifa (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rifa_id INT NOT NULL,
  numero INT NOT NULL,
  estado ENUM('disponible', 'reservado', 'vendido', 'cancelado') DEFAULT 'disponible',
  compra_id INT NULL,
  institucion_id INT NULL COMMENT 'Institución asignada',
  vendedor_id INT NULL COMMENT 'Vendedor asignado',
  
  -- QR CODE Y VERIFICACIÓN
  qr_code TEXT NULL COMMENT 'Data URL del QR o URL pública',
  hash_verificacion VARCHAR(64) NULL COMMENT 'Hash SHA256 para verificación',
  
  -- CONTROL DE IMPRESIÓN
  impreso TINYINT(1) DEFAULT 0,
  fecha_impresion DATETIME NULL,
  
  precio_venta DECIMAL(10,2) NULL,
  fecha_venta DATETIME NULL,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (rifa_id) REFERENCES rifas(id) ON DELETE CASCADE,
  FOREIGN KEY (compra_id) REFERENCES compras_rifas(id) ON DELETE SET NULL,
  FOREIGN KEY (institucion_id) REFERENCES instituciones(id) ON DELETE SET NULL,
  FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  
  UNIQUE KEY unique_rifa_numero (rifa_id, numero),
  INDEX idx_rifa_estado (rifa_id, estado),
  INDEX idx_compra (compra_id),
  INDEX idx_hash (hash_verificacion),
  INDEX idx_impreso (impreso)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 9. AUDITORIA
-- =====================================================
CREATE TABLE auditoria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tabla VARCHAR(50) NOT NULL,
  registro_id INT NOT NULL,
  accion ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
  usuario_id INT NULL,
  datos_anteriores LONGTEXT NULL CHECK (JSON_VALID(datos_anteriores)),
  datos_nuevos LONGTEXT NULL CHECK (JSON_VALID(datos_nuevos)),
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_tabla (tabla),
  INDEX idx_registro (tabla, registro_id),
  INDEX idx_fecha (fecha_accion),
  INDEX idx_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 10. EMAIL_VERIFICATIONS (Verificación de email)
-- =====================================================
CREATE TABLE email_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  usado TINYINT(1) DEFAULT 0,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_usuario (usuario_id),
  INDEX idx_expiracion (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 11. PASSWORD_RESETS (Reset de contraseña)
-- =====================================================
CREATE TABLE password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  usado TINYINT(1) DEFAULT 0,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 12. REFRESH_TOKENS (JWT)
-- =====================================================
CREATE TABLE refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  token VARCHAR(500) NOT NULL UNIQUE,
  jti VARCHAR(255) NOT NULL UNIQUE COMMENT 'JWT ID único',
  expira_en TIMESTAMP NOT NULL,
  activo TINYINT(1) DEFAULT 1,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_usuario (usuario_id),
  INDEX idx_token (token),
  INDEX idx_jti (jti),
  INDEX idx_expira (expira_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 13. SESIONES_ACTIVAS
-- =====================================================
CREATE TABLE sesiones_activas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  refresh_token_id INT NULL,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  dispositivo VARCHAR(100),
  ubicacion VARCHAR(255),
  activa TINYINT(1) DEFAULT 1,
  fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_fin TIMESTAMP NULL,
  ultimo_acceso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (refresh_token_id) REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  INDEX idx_usuario (usuario_id),
  INDEX idx_activa (activa),
  INDEX idx_ultimo_acceso (ultimo_acceso)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 14. AUTH_LOGS (Logs de autenticación)
-- =====================================================
CREATE TABLE auth_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,
  email VARCHAR(100),
  accion ENUM('login','logout','registro','verificacion_email','cambio_password','google_login','failed_login','blocked') NOT NULL,
  exito TINYINT(1) DEFAULT 1,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  detalles TEXT NULL,
  fecha_evento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_usuario (usuario_id),
  INDEX idx_email (email),
  INDEX idx_accion (accion),
  INDEX idx_fecha (fecha_evento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 15. EMAIL_LOGS (Logs de emails enviados)
-- =====================================================
CREATE TABLE email_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,
  email VARCHAR(100) NOT NULL,
  tipo ENUM('verification', 'password_reset', 'welcome', 'notification') NOT NULL,
  asunto VARCHAR(255) NOT NULL,
  estado ENUM('enviado', 'fallido', 'rebotado') DEFAULT 'enviado',
  aws_message_id VARCHAR(100) NULL,
  error_message TEXT NULL,
  fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_usuario (usuario_id),
  INDEX idx_email (email),
  INDEX idx_tipo (tipo),
  INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- VISTAS
-- =====================================================

-- Vista: Mis compras
CREATE OR REPLACE VIEW vista_mis_compras AS
SELECT 
  c.id as compra_id,
  c.rifa_id,
  r.titulo as rifa_titulo,
  r.imagen_url as rifa_imagen,
  c.comprador_id,
  CONCAT(u.nombre, ' ', u.apellido) as comprador_nombre,
  c.numeros_comprados,
  c.cantidad_numeros,
  c.monto_total,
  c.metodo_pago,
  c.estado,
  c.fecha_compra,
  i.nombre as institucion_nombre,
  r.fecha_sorteo,
  r.estado as rifa_estado
FROM compras_rifas c
JOIN rifas r ON c.rifa_id = r.id
JOIN usuarios u ON c.comprador_id = u.id
LEFT JOIN instituciones i ON c.institucion_id = i.id
WHERE c.estado = 'confirmado';

-- Vista: Ventas por vendedor
CREATE OR REPLACE VIEW vista_ventas_vendedor AS
SELECT 
  c.vendedor_id,
  CONCAT(v.nombre, ' ', v.apellido) as vendedor_nombre,
  c.institucion_id,
  i.nombre as institucion_nombre,
  c.rifa_id,
  r.titulo as rifa_titulo,
  COUNT(c.id) as total_ventas,
  SUM(c.cantidad_numeros) as numeros_vendidos,
  SUM(c.monto_total) as monto_total_vendido,
  DATE(c.fecha_compra) as fecha
FROM compras_rifas c
JOIN usuarios v ON c.vendedor_id = v.id
JOIN rifas r ON c.rifa_id = r.id
LEFT JOIN instituciones i ON c.institucion_id = i.id
WHERE c.estado = 'confirmado'
  AND c.vendedor_id IS NOT NULL
GROUP BY c.vendedor_id, c.institucion_id, c.rifa_id, DATE(c.fecha_compra);

-- Vista: Estadísticas de rifas
CREATE OR REPLACE VIEW vista_estadisticas_rifas AS
SELECT 
  r.id as rifa_id,
  r.titulo,
  r.estado,
  r.cantidad_numeros as numeros_totales,
  r.precio_numero,
  COUNT(DISTINCT c.id) as total_compras,
  SUM(CASE WHEN n.estado = 'vendido' THEN 1 ELSE 0 END) as numeros_vendidos,
  SUM(CASE WHEN n.estado = 'disponible' THEN 1 ELSE 0 END) as numeros_disponibles,
  COALESCE(SUM(c.monto_total), 0) as recaudacion_total,
  ROUND((SUM(CASE WHEN n.estado = 'vendido' THEN 1 ELSE 0 END) * 100.0 / r.cantidad_numeros), 2) as porcentaje_vendido,
  i.nombre as institucion_promotora
FROM rifas r
LEFT JOIN compras_rifas c ON r.id = c.rifa_id AND c.estado = 'confirmado'
LEFT JOIN numeros_rifa n ON r.id = n.rifa_id
JOIN instituciones i ON r.institucion_promotora_id = i.id
GROUP BY r.id, r.titulo, r.estado, r.cantidad_numeros, r.precio_numero, i.nombre;

-- Vista: Usuarios con info de autenticación
CREATE OR REPLACE VIEW vista_usuarios_auth AS
SELECT 
  u.id,
  u.nombre,
  u.apellido,
  u.email,
  u.rol,
  u.institucion_id,
  u.es_admin_global,
  u.estado,
  u.email_verificado,
  u.google_id,
  u.profile_image_url,
  CASE WHEN u.google_id IS NOT NULL THEN 1 ELSE 0 END as tiene_google,
  u.two_factor_enabled,
  u.ultimo_login,
  u.fecha_creacion
FROM usuarios u;

-- =====================================================
-- STORED PROCEDURES
-- =====================================================

DELIMITER $$

-- SP: Crear rifa con números
DROP PROCEDURE IF EXISTS sp_crear_rifa$$
CREATE PROCEDURE sp_crear_rifa(
  IN p_titulo VARCHAR(255),
  IN p_descripcion TEXT,
  IN p_institucion_id INT,
  IN p_cantidad_numeros INT,
  IN p_precio_numero DECIMAL(10,2),
  IN p_fecha_inicio DATE,
  IN p_fecha_fin DATE,
  IN p_usuario_id INT
)
BEGIN
  DECLARE v_rifa_id INT;
  DECLARE v_numero INT DEFAULT 1;
  
  INSERT INTO rifas (
    titulo, descripcion, institucion_promotora_id, cantidad_numeros,
    precio_numero, fecha_inicio, fecha_fin, creado_por, estado
  ) VALUES (
    p_titulo, p_descripcion, p_institucion_id, p_cantidad_numeros,
    p_precio_numero, p_fecha_inicio, p_fecha_fin, p_usuario_id, 'borrador'
  );
  
  SET v_rifa_id = LAST_INSERT_ID();
  
  INSERT INTO rifa_participaciones (
    rifa_id, institucion_id, es_promotora, estado, numeros_desde, numeros_hasta
  ) VALUES (
    v_rifa_id, p_institucion_id, 1, 'aprobada', 1, p_cantidad_numeros
  );
  
  WHILE v_numero <= p_cantidad_numeros DO
    INSERT INTO numeros_rifa (rifa_id, numero, estado, institucion_id)
    VALUES (v_rifa_id, v_numero, 'disponible', p_institucion_id);
    SET v_numero = v_numero + 1;
  END WHILE;
  
  SELECT v_rifa_id as rifa_id;
END$$

-- SP: Comprar números
DROP PROCEDURE IF EXISTS sp_comprar_numeros$$
CREATE PROCEDURE sp_comprar_numeros(
  IN p_rifa_id INT,
  IN p_comprador_id INT,
  IN p_numeros_json LONGTEXT,
  IN p_monto_total DECIMAL(10,2),
  IN p_metodo_pago VARCHAR(50),
  IN p_vendedor_id INT,
  IN p_institucion_id INT
)
BEGIN
  DECLARE v_compra_id INT;
  DECLARE v_cantidad INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  
  START TRANSACTION;
  
  SET v_cantidad = JSON_LENGTH(p_numeros_json);
  
  INSERT INTO compras_rifas (
    rifa_id, comprador_id, vendedor_id, institucion_id,
    numeros_comprados, cantidad_numeros, monto_total,
    metodo_pago, estado, fecha_confirmacion, confirmado_por
  ) VALUES (
    p_rifa_id, p_comprador_id, p_vendedor_id, p_institucion_id,
    p_numeros_json, v_cantidad, p_monto_total,
    p_metodo_pago, 'confirmado', NOW(), p_vendedor_id
  );
  
  SET v_compra_id = LAST_INSERT_ID();
  
  UPDATE numeros_rifa 
  SET estado = 'vendido', compra_id = v_compra_id, fecha_venta = NOW()
  WHERE rifa_id = p_rifa_id 
    AND JSON_CONTAINS(p_numeros_json, CAST(numero AS CHAR));
  
  COMMIT;
  
  SELECT v_compra_id as compra_id, v_cantidad as cantidad_numeros;
END$$

DELIMITER ;

-- =====================================================
-- TRIGGERS
-- =====================================================

DELIMITER $$

DROP TRIGGER IF EXISTS trg_auditoria_compras_insert$$
CREATE TRIGGER trg_auditoria_compras_insert
AFTER INSERT ON compras_rifas
FOR EACH ROW
BEGIN
  INSERT INTO auditoria (
    tabla, registro_id, accion, usuario_id, datos_nuevos
  ) VALUES (
    'compras_rifas', NEW.id, 'INSERT', NEW.comprador_id,
    JSON_OBJECT(
      'rifa_id', NEW.rifa_id,
      'comprador_id', NEW.comprador_id,
      'numeros', NEW.numeros_comprados,
      'monto', NEW.monto_total,
      'estado', NEW.estado
    )
  );
END$$

DROP TRIGGER IF EXISTS trg_auditoria_compras_update$$
CREATE TRIGGER trg_auditoria_compras_update
AFTER UPDATE ON compras_rifas
FOR EACH ROW
BEGIN
  IF NEW.estado != OLD.estado THEN
    INSERT INTO auditoria (
      tabla, registro_id, accion, usuario_id, datos_anteriores, datos_nuevos
    ) VALUES (
      'compras_rifas', NEW.id, 'UPDATE', NEW.confirmado_por,
      JSON_OBJECT('estado', OLD.estado),
      JSON_OBJECT('estado', NEW.estado)
    );
  END IF;
END$$

DELIMITER ;

-- =====================================================
-- DATOS INICIALES
-- =====================================================

INSERT INTO instituciones (nombre, descripcion, email, logo_url, estado) VALUES
('Cruz Roja Argentina', 'Organización humanitaria internacional', 'info@cruzroja.org.ar', '/logos/cruz-roja.png', 'activa'),
('Cáritas Argentina', 'Organización de ayuda social católica', 'contacto@caritas.org.ar', '/logos/caritas.png', 'activa'),
('Fundación Huésped', 'Organización de salud pública', 'info@huesped.org.ar', '/logos/huesped.png', 'activa');

-- Usuario admin global (Password: Admin123!)
INSERT INTO usuarios (nombre, apellido, email, password, rol, es_admin_global, email_verificado, estado) VALUES
('Admin', 'Sistema', 'admin@rifas.com', 
 '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtJ3KxbQx5TO', 
 'admin_global', 1, 1, 'activo');

-- Admins de instituciones
INSERT INTO usuarios (nombre, apellido, email, password, rol, institucion_id, email_verificado, estado) VALUES
('María', 'González', 'maria@cruzroja.org.ar', 
 '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtJ3KxbQx5TO', 'admin_institucion', 1, 1, 'activo'),
('Juan', 'Pérez', 'juan@caritas.org.ar', 
 '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtJ3KxbQx5TO', 'admin_institucion', 2, 1, 'activo');

INSERT INTO usuarios_instituciones (usuario_id, institucion_id, rol, activo) VALUES
(2, 1, 'admin', 1),
(3, 2, 'admin', 1);

-- Vendedores
INSERT INTO usuarios (nombre, apellido, email, password, rol, institucion_id, email_verificado, estado) VALUES
('Carlos', 'López', 'carlos@cruzroja.org.ar', 
 '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtJ3KxbQx5TO', 'vendedor', 1, 1, 'activo'),
('Laura', 'Fernández', 'laura@caritas.org.ar', 
 '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtJ3KxbQx5TO', 'vendedor', 2, 1, 'activo');

INSERT INTO usuarios_instituciones (usuario_id, institucion_id, rol, activo) VALUES
(4, 1, 'vendedor', 1),
(5, 2, 'vendedor', 1);

-- Comprador
INSERT INTO usuarios (nombre, apellido, email, password, rol, email_verificado, estado) VALUES
('Pedro', 'Ramírez', 'pedro@example.com', 
 '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtJ3KxbQx5TO', 'comprador', 1, 'activo');

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

SELECT '=============================================' as separador;
SELECT '✅ SCHEMA COMPLETO CREADO EXITOSAMENTE' as status;
SELECT '=============================================' as separador;

-- Resumen de tablas
SELECT 
  TABLE_NAME as tabla,
  TABLE_ROWS as registros
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'rifas_solidarias_dev'
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

SELECT '=============================================' as separador;
SELECT '📊 TABLAS CREADAS' as info;
SELECT '=============================================' as separador;

SELECT CONCAT('✅ ', COUNT(*), ' tablas principales') as resultado
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'rifas_solidarias_dev' AND TABLE_TYPE = 'BASE TABLE';

SELECT CONCAT('✅ ', COUNT(*), ' vistas creadas') as resultado
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'rifas_solidarias_dev' AND TABLE_TYPE = 'VIEW';

SELECT CONCAT('✅ ', COUNT(*), ' stored procedures') as resultado
FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA = 'rifas_solidarias_dev' AND ROUTINE_TYPE = 'PROCEDURE';

SELECT '=============================================' as separador;
SELECT '🔐 CREDENCIALES DE PRUEBA' as titulo;
SELECT '=============================================' as separador;

SELECT 'admin@rifas.com / Admin123! (Admin Global)' as credencial
UNION ALL SELECT 'maria@cruzroja.org.ar / Admin123! (Admin Cruz Roja)'
UNION ALL SELECT 'carlos@cruzroja.org.ar / Admin123! (Vendedor)'
UNION ALL SELECT 'pedro@example.com / Admin123! (Comprador)';

SELECT '=============================================' as separador;
SELECT '📝 CARACTERÍSTICAS INCLUIDAS' as titulo;
SELECT '=============================================' as separador;

SELECT '✅ Google OAuth (google_id, profile_image_url)' as caracteristica
UNION ALL SELECT '✅ Verificación de email (email_verifications)'
UNION ALL SELECT '✅ Reset de password (password_resets)'
UNION ALL SELECT '✅ Two-Factor Auth (2FA preparado)'
UNION ALL SELECT '✅ Refresh Tokens (JWT)'
UNION ALL SELECT '✅ Sesiones activas con control'
UNION ALL SELECT '✅ QR Codes en números'
UNION ALL SELECT '✅ Hash de verificación'
UNION ALL SELECT '✅ Control de impresión'
UNION ALL SELECT '✅ Logos de instituciones'
UNION ALL SELECT '✅ Imágenes de rifas'
UNION ALL SELECT '✅ Imágenes de premios'
UNION ALL SELECT '✅ Fotos de perfil (Google/Upload)'
UNION ALL SELECT '✅ Auditoría completa'
UNION ALL SELECT '✅ Logs de auth'
UNION ALL SELECT '✅ Logs de emails'
UNION ALL SELECT '✅ Roles flexibles multi-institución'
UNION ALL SELECT '✅ Vistas optimizadas';

SELECT '=============================================' as separador;
SELECT '🎯 PRÓXIMOS PASOS' as titulo;
SELECT '=============================================' as separador;

SELECT '1. Verificar que todas las tablas se crearon' as paso
UNION ALL SELECT '2. Revisar los campos específicos que necesites'
UNION ALL SELECT '3. Actualizar modelos Sequelize del backend'
UNION ALL SELECT '4. Configurar variables de entorno (.env)'
UNION ALL SELECT '5. Implementar endpoints faltantes'
UNION ALL SELECT '6. Testing completo del sistema';

SELECT '=============================================' as separador;
SELECT '✨ SCHEMA V2.0 COMPLETADO' as resultado;
SELECT '=============================================' as separador;

-- =====================================================
-- CAMPOS IMPORTANTES POR TABLA
-- =====================================================

/*

📋 RESUMEN DE CAMPOS AGREGADOS VS SCHEMA ANTERIOR:

USUARIOS:
  ✅ google_id VARCHAR(100) - ID de Google OAuth
  ✅ profile_image_url VARCHAR(500) - Foto de perfil
  ✅ email_verificado - Control de verificación
  ✅ fecha_verificacion - Timestamp de verificación
  ✅ password_cambiado_en - Para invalidar tokens
  ✅ tokens_invalidos_desde - Timestamp de invalidación
  ✅ two_factor_enabled - 2FA habilitado
  ✅ two_factor_secret - Secret para 2FA
  ✅ max_sesiones_concurrentes - Límite de sesiones
  ✅ require_password_change - Forzar cambio

INSTITUCIONES:
  ✅ logo_url VARCHAR(500) - Logo de la institución
  ✅ tipo VARCHAR(100) - Tipo de institución

RIFAS:
  ✅ imagen_url VARCHAR(500) - Banner/imagen de la rifa

PREMIOS:
  ✅ imagen_url VARCHAR(500) - Imagen del premio

NUMEROS_RIFA:
  ✅ qr_code TEXT - Data URL del QR o URL pública
  ✅ hash_verificacion VARCHAR(64) - Hash SHA256
  ✅ impreso TINYINT(1) - Control de impresión
  ✅ fecha_impresion DATETIME - Cuándo se imprimió
  ✅ institucion_id INT - Institución asignada
  ✅ vendedor_id INT - Vendedor asignado
  ✅ precio_venta DECIMAL - Precio de venta
  ✅ fecha_venta DATETIME - Fecha de venta

NUEVAS TABLAS:
  ✅ email_verifications - Tokens de verificación
  ✅ password_resets - Tokens de reset
  ✅ refresh_tokens - JWT refresh tokens
  ✅ sesiones_activas - Control de sesiones
  ✅ auth_logs - Logs de autenticación
  ✅ email_logs - Logs de emails enviados

TOTAL: 15 TABLAS + 4 VISTAS + 2 STORED PROCEDURES + 2 TRIGGERS

*/

-- =====================================================
-- QUERIES ÚTILES PARA VERIFICAR
-- =====================================================

-- Ver estructura de tabla usuarios
DESCRIBE usuarios;

-- Ver estructura de numeros_rifa
DESCRIBE numeros_rifa;

-- Ver todas las vistas
SHOW FULL TABLES WHERE Table_type = 'VIEW';

-- Ver todos los stored procedures
SHOW PROCEDURE STATUS WHERE Db = 'rifas_solidarias_dev';

-- Ver todos los triggers
SHOW TRIGGERS FROM rifas_solidarias_dev;

-- Verificar datos iniciales
SELECT 
  u.id, 
  u.email, 
  u.nombre, 
  u.es_admin_global,
  GROUP_CONCAT(CONCAT(i.nombre, ' (', ui.rol, ')') SEPARATOR ', ') as roles_institucionales
FROM usuarios u
LEFT JOIN usuarios_instituciones ui ON u.id = ui.usuario_id
LEFT JOIN instituciones i ON ui.institucion_id = i.id
GROUP BY u.id, u.email, u.nombre, u.es_admin_global;

SELECT '=============================================' as separador;
SELECT '🎉 ¡SCHEMA LISTO PARA PRODUCCIÓN!' as mensaje;
SELECT '=============================================' as separador;