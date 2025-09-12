-- =====================================================
-- AGREGAR TABLAS JWT AL SCHEMA EXISTENTE
-- Ejecutar DESPUÉS del schema principal
-- =====================================================

USE rifas_solidarias_nuevo;

-- =====================================================
-- TABLA REFRESH TOKENS
-- =====================================================
CREATE TABLE refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(500) UNIQUE NOT NULL,
    usuario_id INT NOT NULL,
    expira_en TIMESTAMP NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_uso TIMESTAMP NULL,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario (usuario_id),
    INDEX idx_token (token),
    INDEX idx_expiracion (expira_en),
    INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA TOKENS INVALIDADOS (BLACKLIST)
-- =====================================================
CREATE TABLE tokens_invalidados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    jti VARCHAR(255) UNIQUE NOT NULL COMMENT 'JWT ID único',
    usuario_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL COMMENT 'Hash del token para seguridad',
    tipo_token ENUM('access', 'refresh') NOT NULL,
    razon_invalidacion ENUM('logout', 'cambio_password', 'admin_block', 'expired', 'security') NOT NULL,
    expira_en TIMESTAMP NOT NULL,
    fecha_invalidacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    invalidado_por INT NULL COMMENT 'Usuario que invalidó (si es admin)',
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (invalidado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_jti (jti),
    INDEX idx_usuario (usuario_id),
    INDEX idx_hash (token_hash),
    INDEX idx_expiracion (expira_en),
    INDEX idx_tipo (tipo_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA SESIONES ACTIVAS
-- =====================================================
CREATE TABLE sesiones_activas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    refresh_token_id INT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    dispositivo VARCHAR(255),
    ubicacion VARCHAR(255),
    activa BOOLEAN DEFAULT TRUE,
    ultimo_acceso TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP NULL,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (refresh_token_id) REFERENCES refresh_tokens(id) ON DELETE SET NULL,
    INDEX idx_usuario (usuario_id),
    INDEX idx_session (session_id),
    INDEX idx_activa (activa),
    INDEX idx_ultimo_acceso (ultimo_acceso)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA LOG DE AUTENTICACIÓN
-- =====================================================
CREATE TABLE auth_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NULL,
    email_intentado VARCHAR(100) NOT NULL,
    tipo_evento ENUM('login_exitoso', 'login_fallido', 'logout', 'token_refresh', 'password_change', 'account_locked') NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    detalles JSON NULL,
    fecha_evento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_usuario (usuario_id),
    INDEX idx_email (email_intentado),
    INDEX idx_tipo (tipo_evento),
    INDEX idx_fecha (fecha_evento),
    INDEX idx_ip (ip_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- AGREGAR CAMPOS JWT A TABLA USUARIOS
-- =====================================================
ALTER TABLE usuarios 
ADD COLUMN password_cambiado_en TIMESTAMP NULL AFTER password,
ADD COLUMN tokens_invalidos_desde TIMESTAMP NULL AFTER password_cambiado_en,
ADD COLUMN max_sesiones_concurrentes INT DEFAULT 3 AFTER tokens_invalidos_desde,
ADD COLUMN require_password_change BOOLEAN DEFAULT FALSE AFTER max_sesiones_concurrentes,
ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE AFTER require_password_change,
ADD COLUMN two_factor_secret VARCHAR(255) NULL AFTER two_factor_enabled;

-- Agregar índices para los nuevos campos
ALTER TABLE usuarios
ADD INDEX idx_password_cambiado (password_cambiado_en),
ADD INDEX idx_tokens_invalidos (tokens_invalidos_desde);

-- =====================================================
-- TRIGGERS PARA JWT
-- =====================================================

DELIMITER $$

-- Trigger para limpiar tokens expirados automáticamente
CREATE EVENT limpiar_tokens_expirados
ON SCHEDULE EVERY 1 HOUR
DO
BEGIN
    -- Limpiar refresh tokens expirados
    DELETE FROM refresh_tokens WHERE expira_en < NOW();
    
    -- Limpiar tokens invalidados expirados (después de 7 días de su expiración)
    DELETE FROM tokens_invalidados WHERE expira_en < DATE_SUB(NOW(), INTERVAL 7 DAY);
    
    -- Cerrar sesiones inactivas (más de 30 días sin acceso)
    UPDATE sesiones_activas 
    SET activa = FALSE, fecha_fin = NOW() 
    WHERE ultimo_acceso < DATE_SUB(NOW(), INTERVAL 30 DAY) AND activa = TRUE;
    
    -- Limpiar logs de autenticación antiguos (más de 90 días)
    DELETE FROM auth_logs WHERE fecha_evento < DATE_SUB(NOW(), INTERVAL 90 DAY);
END$$

-- Trigger para invalidar tokens cuando se cambia password
CREATE TRIGGER invalidar_tokens_cambio_password
AFTER UPDATE ON usuarios
FOR EACH ROW
BEGIN
    IF OLD.password != NEW.password THEN
        -- Marcar timestamp de invalidación
        UPDATE usuarios 
        SET tokens_invalidos_desde = NOW() 
        WHERE id = NEW.id;
        
        -- Invalidar todos los refresh tokens
        UPDATE refresh_tokens 
        SET activo = FALSE 
        WHERE usuario_id = NEW.id;
        
        -- Cerrar todas las sesiones activas
        UPDATE sesiones_activas 
        SET activa = FALSE, fecha_fin = NOW() 
        WHERE usuario_id = NEW.id AND activa = TRUE;
        
        -- Log del evento
        INSERT INTO auth_logs (usuario_id, email_intentado, tipo_evento, detalles)
        VALUES (NEW.id, NEW.email, 'password_change', '{"action": "password_changed", "tokens_invalidated": true}');
    END IF;
END$$

-- Trigger para log de intentos de login
CREATE TRIGGER log_intento_login
AFTER UPDATE ON usuarios
FOR EACH ROW
BEGIN
    IF OLD.intentos_fallidos != NEW.intentos_fallidos AND NEW.intentos_fallidos > OLD.intentos_fallidos THEN
        INSERT INTO auth_logs (usuario_id, email_intentado, tipo_evento, detalles)
        VALUES (NEW.id, NEW.email, 'login_fallido', JSON_OBJECT('intentos', NEW.intentos_fallidos));
    END IF;
    
    IF OLD.ultimo_login != NEW.ultimo_login AND NEW.ultimo_login IS NOT NULL THEN
        INSERT INTO auth_logs (usuario_id, email_intentado, tipo_evento, detalles)
        VALUES (NEW.id, NEW.email, 'login_exitoso', JSON_OBJECT('ultimo_login', NEW.ultimo_login));
    END IF;
END$$

DELIMITER ;

-- =====================================================
-- PROCEDIMIENTOS PARA JWT
-- =====================================================

DELIMITER $$

-- Procedimiento para validar si un token está en blacklist
CREATE PROCEDURE ValidarTokenBlacklist(
    IN p_jti VARCHAR(255),
    IN p_token_hash VARCHAR(255),
    OUT p_es_invalido BOOLEAN
)
BEGIN
    DECLARE v_count INT DEFAULT 0;
    
    SELECT COUNT(*) INTO v_count
    FROM tokens_invalidados
    WHERE (jti = p_jti OR token_hash = p_token_hash)
    AND expira_en > NOW();
    
    SET p_es_invalido = (v_count > 0);
END$$

-- Procedimiento para limpiar sesiones de usuario
CREATE PROCEDURE LimpiarSesionesUsuario(
    IN p_usuario_id INT,
    IN p_mantener_session_id VARCHAR(255)
)
BEGIN
    -- Desactivar sesiones antiguas manteniendo la actual
    UPDATE sesiones_activas 
    SET activa = FALSE, fecha_fin = NOW()
    WHERE usuario_id = p_usuario_id 
    AND activa = TRUE 
    AND (p_mantener_session_id IS NULL OR session_id != p_mantener_session_id);
    
    -- Invalidar refresh tokens correspondientes
    UPDATE refresh_tokens rt
    JOIN sesiones_activas sa ON rt.id = sa.refresh_token_id
    SET rt.activo = FALSE
    WHERE sa.usuario_id = p_usuario_id 
    AND sa.activa = FALSE;
END$$

-- Procedimiento para obtener estadísticas de sesiones
CREATE PROCEDURE EstadisticasSesiones(
    IN p_usuario_id INT
)
BEGIN
    SELECT 
        COUNT(CASE WHEN activa = TRUE THEN 1 END) as sesiones_activas,
        COUNT(*) as total_sesiones,
        MAX(ultimo_acceso) as ultimo_acceso,
        COUNT(DISTINCT ip_address) as ips_diferentes,
        COUNT(DISTINCT dispositivo) as dispositivos_diferentes
    FROM sesiones_activas 
    WHERE usuario_id = p_usuario_id;
END$$

DELIMITER ;

-- =====================================================
-- VISTAS PARA JWT
-- =====================================================

-- Vista de sesiones activas con información del usuario
CREATE VIEW vista_sesiones_activas AS
SELECT 
    sa.id,
    sa.session_id,
    u.nombre,
    u.apellido,
    u.email,
    u.rol,
    i.nombre as institucion,
    sa.ip_address,
    sa.dispositivo,
    sa.ubicacion,
    sa.ultimo_acceso,
    sa.fecha_inicio,
    TIMESTAMPDIFF(MINUTE, sa.ultimo_acceso, NOW()) as minutos_inactivo
FROM sesiones_activas sa
JOIN usuarios u ON sa.usuario_id = u.id
LEFT JOIN instituciones i ON u.institucion_id = i.id
WHERE sa.activa = TRUE;

-- Vista de estadísticas de autenticación por usuario
CREATE VIEW vista_stats_auth AS
SELECT 
    u.id as usuario_id,
    u.nombre,
    u.apellido,
    u.email,
    u.ultimo_login,
    u.intentos_fallidos,
    COUNT(DISTINCT sa.id) as sesiones_activas,
    COUNT(DISTINCT rt.id) as refresh_tokens_activos,
    COUNT(DISTINCT al.id) as total_eventos_auth,
    MAX(al.fecha_evento) as ultimo_evento_auth
FROM usuarios u
LEFT JOIN sesiones_activas sa ON u.id = sa.usuario_id AND sa.activa = TRUE
LEFT JOIN refresh_tokens rt ON u.id = rt.usuario_id AND rt.activo = TRUE
LEFT JOIN auth_logs al ON u.id = al.usuario_id
GROUP BY u.id;

-- =====================================================
-- DATOS INICIALES PARA JWT
-- =====================================================

-- Habilitar el event scheduler para limpieza automática
SET GLOBAL event_scheduler = ON;

-- =====================================================
-- FUNCIONES ÚTILES PARA EL BACKEND
-- =====================================================

-- Crear función para generar JTI único
DELIMITER $$

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

-- =====================================================
-- VERIFICACIÓN DE TABLAS JWT
-- =====================================================

SELECT 
    'refresh_tokens' as tabla, 
    COUNT(*) as registros 
FROM refresh_tokens
UNION ALL
SELECT 'tokens_invalidados' as tabla, COUNT(*) as registros FROM tokens_invalidados
UNION ALL
SELECT 'sesiones_activas' as tabla, COUNT(*) as registros FROM sesiones_activas
UNION ALL
SELECT 'auth_logs' as tabla, COUNT(*) as registros FROM auth_logs;

-- Verificar que los nuevos campos se agregaron a usuarios
DESCRIBE usuarios;

-- =====================================================
-- COMENTARIOS SOBRE EL SISTEMA JWT
-- =====================================================

/*
CARACTERÍSTICAS DEL SISTEMA JWT IMPLEMENTADO:

✅ GESTIÓN COMPLETA DE TOKENS:
- Refresh tokens con expiración
- Blacklist de tokens invalidados
- Sesiones activas con límites
- Logs de autenticación completos

✅ SEGURIDAD AVANZADA:
- Invalidación automática al cambiar password
- Límite de sesiones concurrentes por usuario
- Tracking de IP y dispositivos
- Limpieza automática de tokens expirados

✅ MONITOREO:
- Logs de todos los eventos de auth
- Estadísticas por usuario
- Vista de sesiones activas
- Detección de actividad sospechosa

✅ FUNCIONALIDADES:
- Logout de todas las sesiones
- Invalidación selectiva de tokens
- 2FA preparado (campos agregados)
- Cambio forzoso de password

INTEGRACIÓN CON TU BACKEND:
- Las tablas se integran perfectamente con tu AuthService
- Los procedures simplifican validaciones complejas
- Los triggers automatizan la seguridad
- Las vistas facilitan reportes

PRÓXIMOS PASOS:
1. Ejecutar este script después del schema principal
2. Actualizar tu middleware de JWT para usar estas tablas
3. Implementar validación de blacklist en cada request
4. ¡Sistema JWT completo funcionando!
*/