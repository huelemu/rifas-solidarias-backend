-- =====================================================
-- SCHEMA CORREGIDO PARA MARIADB
-- database/schema/oauth_email_mariadb.sql
-- =====================================================

-- 1. Agregar campos para Google OAuth y verificación en usuarios
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS google_id VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fecha_verificacion TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS intentos_fallidos INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMP NULL;

-- Crear índice único para google_id después de agregar la columna
ALTER TABLE usuarios ADD UNIQUE KEY idx_google_id (google_id);

-- 2. Crear tabla para verificaciones de email
CREATE TABLE IF NOT EXISTS email_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_usuario (usuario_id),
    INDEX idx_expiracion (expires_at),
    INDEX idx_usuario_usado (usuario_id, usado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Crear tabla para reset de contraseñas
CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_usuario (usuario_id),
    INDEX idx_expiracion (expires_at),
    INDEX idx_usuario_usado (usuario_id, usado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Crear tabla para logs de emails enviados
CREATE TABLE IF NOT EXISTS email_logs (
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
    INDEX idx_estado (estado),
    INDEX idx_fecha (fecha_envio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Crear tabla para gestión de refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    jti VARCHAR(255) UNIQUE NOT NULL,
    usuario_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    fecha_expiracion TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario (usuario_id),
    INDEX idx_expiracion (fecha_expiracion),
    INDEX idx_jti (jti),
    INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Crear tabla para tokens invalidados (blacklist)
CREATE TABLE IF NOT EXISTS tokens_invalidados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    jti VARCHAR(255) UNIQUE NOT NULL,
    usuario_id INT NOT NULL,
    tipo ENUM('access', 'refresh') NOT NULL,
    razon ENUM('logout', 'cambio_password', 'revocado', 'expirado') NOT NULL,
    fecha_invalidacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion_original TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_jti (jti),
    INDEX idx_usuario (usuario_id),
    INDEX idx_tipo (tipo),
    INDEX idx_expiracion (fecha_expiracion_original)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Crear tabla para sesiones activas
CREATE TABLE IF NOT EXISTS sesiones_activas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    refresh_token_jti VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMP NOT NULL,
    ultima_actividad TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    activa BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario (usuario_id),
    INDEX idx_refresh_token (refresh_token_jti),
    INDEX idx_expiracion (fecha_expiracion),
    INDEX idx_activa (activa),
    INDEX idx_ultima_actividad (ultima_actividad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Crear tabla para logs de autenticación
CREATE TABLE IF NOT EXISTS auth_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NULL,
    email VARCHAR(100),
    accion ENUM('login_exitoso', 'login_fallido', 'logout', 'registro', 'cambio_password', 'bloqueo', 'desbloqueo', 'verificacion_email') NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    detalles JSON,
    fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_usuario (usuario_id),
    INDEX idx_email (email),
    INDEX idx_accion (accion),
    INDEX idx_fecha (fecha_accion),
    INDEX idx_ip (ip_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Crear índices adicionales para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_usuarios_email_verificado ON usuarios(email_verificado);
CREATE INDEX IF NOT EXISTS idx_usuarios_ultimo_login ON usuarios(ultimo_login);
CREATE INDEX IF NOT EXISTS idx_usuarios_estado_email ON usuarios(estado, email);

-- 10. Actualizar usuarios existentes para marcar emails como verificados
UPDATE usuarios 
SET email_verificado = TRUE, fecha_verificacion = NOW() 
WHERE google_id IS NULL AND password IS NOT NULL AND email_verificado = FALSE;

-- =====================================================
-- FUNCIONES Y PROCEDIMIENTOS PARA MARIADB
-- =====================================================

-- Verificar si el event scheduler está habilitado
SET GLOBAL event_scheduler = ON;

-- Función para generar JTI único (compatible con MariaDB)
DELIMITER $$

DROP FUNCTION IF EXISTS GenerarJTI$$
CREATE FUNCTION GenerarJTI() RETURNS VARCHAR(255)
READS SQL DATA
DETERMINISTIC
BEGIN
    RETURN CONCAT(
        UNIX_TIMESTAMP(),
        '-',
        CONNECTION_ID(),
        '-',
        SUBSTRING(MD5(RAND()), 1, 8)
    );
END$$

DELIMITER ;

-- Procedimiento para limpiar tokens expirados
DELIMITER $$

DROP PROCEDURE IF EXISTS LimpiarTokensExpirados$$
CREATE PROCEDURE LimpiarTokensExpirados()
BEGIN
    DECLARE tokens_email_eliminados INT DEFAULT 0;
    DECLARE tokens_password_eliminados INT DEFAULT 0;
    DECLARE refresh_tokens_eliminados INT DEFAULT 0;
    DECLARE sesiones_eliminadas INT DEFAULT 0;
    
    -- Limpiar verificaciones de email expiradas
    DELETE FROM email_verifications 
    WHERE expires_at < NOW() AND usado = FALSE;
    GET DIAGNOSTICS tokens_email_eliminados = ROW_COUNT;
    
    -- Limpiar resets de contraseña expirados
    DELETE FROM password_resets 
    WHERE expires_at < NOW() AND usado = FALSE;
    GET DIAGNOSTICS tokens_password_eliminados = ROW_COUNT;
    
    -- Limpiar refresh tokens expirados
    DELETE FROM refresh_tokens 
    WHERE fecha_expiracion < NOW();
    GET DIAGNOSTICS refresh_tokens_eliminados = ROW_COUNT;
    
    -- Limpiar sesiones expiradas
    DELETE FROM sesiones_activas 
    WHERE fecha_expiracion < NOW() OR activa = FALSE;
    GET DIAGNOSTICS sesiones_eliminadas = ROW_COUNT;
    
    -- Limpiar tokens invalidados antiguos (más de 30 días)
    DELETE FROM tokens_invalidados 
    WHERE fecha_invalidacion < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- Limpiar logs antiguos de emails (más de 90 días)
    DELETE FROM email_logs 
    WHERE fecha_envio < DATE_SUB(NOW(), INTERVAL 90 DAY);
    
    -- Limpiar logs antiguos de auth (más de 90 días)
    DELETE FROM auth_logs 
    WHERE fecha_accion < DATE_SUB(NOW(), INTERVAL 90 DAY);
    
    -- Log de limpieza
    INSERT INTO email_logs (email, tipo, asunto, estado, error_message) 
    VALUES ('system@cleanup', 'notification', 'Limpieza automática completada', 'enviado', 
            CONCAT('Eliminados: ', tokens_email_eliminados, ' tokens email, ', 
                   tokens_password_eliminados, ' tokens password, ',
                   refresh_tokens_eliminados, ' refresh tokens, ',
                   sesiones_eliminadas, ' sesiones'));
END$$

DELIMITER ;

-- Procedimiento para invalidar todas las sesiones de un usuario
DELIMITER $$

DROP PROCEDURE IF EXISTS InvalidarSesionesUsuario$$
CREATE PROCEDURE InvalidarSesionesUsuario(IN p_usuario_id INT, IN p_razon VARCHAR(50))
BEGIN
    -- Marcar refresh tokens como inactivos
    UPDATE refresh_tokens 
    SET activo = FALSE 
    WHERE usuario_id = p_usuario_id AND activo = TRUE;
    
    -- Marcar sesiones como inactivas
    UPDATE sesiones_activas 
    SET activa = FALSE 
    WHERE usuario_id = p_usuario_id AND activa = TRUE;
    
    -- Log de la acción
    INSERT INTO auth_logs (usuario_id, accion, detalles)
    VALUES (p_usuario_id, 'logout', CONCAT('{"razon":"', p_razon, '","todas_sesiones":true}'));
END$$

DELIMITER ;

-- =====================================================
-- CREAR EVENTOS PARA MARIADB
-- =====================================================

-- Eliminar evento si existe
DROP EVENT IF EXISTS limpiar_tokens_diario;

-- Crear evento para limpieza diaria (sintaxis compatible con MariaDB)
CREATE EVENT IF NOT EXISTS limpiar_tokens_diario
ON SCHEDULE EVERY 1 DAY
STARTS DATE_ADD(DATE_ADD(CURDATE(), INTERVAL 1 DAY), INTERVAL 2 HOUR)
ON COMPLETION PRESERVE
ENABLE
DO
  CALL LimpiarTokensExpirados();

-- =====================================================
-- VISTAS PARA REPORTES (Compatible con MariaDB)
-- =====================================================

-- Vista de usuarios con información de autenticación
CREATE OR REPLACE VIEW vista_usuarios_auth AS
SELECT 
    u.id,
    u.nombre,
    u.apellido,
    u.email,
    u.rol,
    u.estado,
    u.email_verificado,
    u.fecha_verificacion,
    CASE WHEN u.google_id IS NOT NULL THEN 1 ELSE 0 END as tiene_google,
    u.ultimo_login,
    u.fecha_creacion,
    COALESCE(i.nombre, 'Sin institución') as institucion_nombre,
    COALESCE(sesiones.activas, 0) as sesiones_activas
FROM usuarios u
LEFT JOIN instituciones i ON u.institucion_id = i.id
LEFT JOIN (
    SELECT usuario_id, COUNT(*) as activas
    FROM sesiones_activas 
    WHERE activa = TRUE 
    GROUP BY usuario_id
) sesiones ON u.id = sesiones.usuario_id;

-- Vista de estadísticas de emails
CREATE OR REPLACE VIEW vista_estadisticas_emails AS
SELECT 
    DATE(fecha_envio) as fecha,
    tipo,
    estado,
    COUNT(*) as cantidad
FROM email_logs 
WHERE fecha_envio >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(fecha_envio), tipo, estado
ORDER BY fecha DESC, tipo, estado;

-- Vista de estadísticas de autenticación
CREATE OR REPLACE VIEW vista_estadisticas_auth AS
SELECT 
    DATE(fecha_accion) as fecha,
    accion,
    COUNT(*) as cantidad,
    COUNT(DISTINCT usuario_id) as usuarios_unicos
FROM auth_logs 
WHERE fecha_accion >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(fecha_accion), accion
ORDER BY fecha DESC, accion;

-- =====================================================
-- TRIGGERS PARA AUDITORÍA (Compatible con MariaDB)
-- =====================================================

DELIMITER $$

DROP TRIGGER IF EXISTS trg_usuarios_cambios$$
CREATE TRIGGER trg_usuarios_cambios
AFTER UPDATE ON usuarios
FOR EACH ROW
BEGIN
    -- Log cuando se verifica email
    IF OLD.email_verificado = FALSE AND NEW.email_verificado = TRUE THEN
        INSERT INTO auth_logs (usuario_id, email, accion, detalles)
        VALUES (NEW.id, NEW.email, 'verificacion_email', 
                CONCAT('{"fecha_verificacion":"', NEW.fecha_verificacion, '"}'));
    END IF;
    
    -- Log cuando cambia contraseña
    IF OLD.password != NEW.password THEN
        INSERT INTO auth_logs (usuario_id, email, accion, detalles)
        VALUES (NEW.id, NEW.email, 'cambio_password', 
                CONCAT('{"fecha_cambio":"', NOW(), '"}'));
    END IF;
END$$

DELIMITER ;

-- =====================================================
-- CONSULTAS DE VERIFICACIÓN
-- =====================================================

-- Verificar que todas las tablas se crearon correctamente
SELECT 
    TABLE_NAME as tabla,
    TABLE_ROWS as filas,
    CREATE_TIME as fecha_creacion
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME IN (
    'usuarios',
    'email_verifications', 
    'password_resets', 
    'email_logs', 
    'refresh_tokens', 
    'tokens_invalidados', 
    'sesiones_activas', 
    'auth_logs'
)
ORDER BY TABLE_NAME;

-- Verificar que el event scheduler está activo
SHOW VARIABLES LIKE 'event_scheduler';

-- Verificar eventos creados
SHOW EVENTS LIKE 'limpiar%';

-- Estadísticas básicas
SELECT 
    'Total usuarios' as metrica,
    COUNT(*) as valor
FROM usuarios
UNION ALL
SELECT 
    'Usuarios verificados',
    COUNT(*)
FROM usuarios 
WHERE email_verificado = TRUE
UNION ALL
SELECT 
    'Usuarios con Google',
    COUNT(*)
FROM usuarios 
WHERE google_id IS NOT NULL
UNION ALL
SELECT 
    'Emails enviados (30d)',
    COUNT(*)
FROM email_logs 
WHERE fecha_envio >= DATE_SUB(NOW(), INTERVAL 30 DAY);

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================

/*
CAMBIOS REALIZADOS PARA MARIADB:

✅ SINTAXIS CORREGIDA:
- Eventos con sintaxis compatible con MariaDB
- Triggers sin JSON_OBJECT (usando CONCAT)
- Funciones con sintaxis correcta
- Vistas con COALESCE en lugar de funciones avanzadas

✅ CARACTERÍSTICAS MANTENIDAS:
- Todas las funcionalidades de autenticación
- Sistema completo de tokens y sesiones
- Logs y auditoría completa
- Limpieza automática
- Seguridad avanzada

✅ TESTING:
- Consultas de verificación incluidas
- Estadísticas básicas para validar
- Verificación de event scheduler

PARA EJECUTAR:
1. Copia este script completo
2. Ejecútalo en tu MariaDB
3. Verifica que no hay errores
4. Ejecuta las consultas de verificación al final
5. ¡Listo para usar!
*/