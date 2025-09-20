USE `rifas_solidarias_nuevo`;

-- Permitir concatenados largos por si hay muchas tablas/objetos
SET SESSION group_concat_max_len = 1000000;

-- Desactivar validación de FK en la sesión
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- 1) Borrar VISTAS (si existen)
-- ----------------------------
SELECT GROUP_CONCAT(CONCAT('`', table_name, '`')) INTO @views
FROM information_schema.views
WHERE table_schema = 'rifas_solidarias_nuevo';

SET @views = COALESCE(@views, '');
SET @sql = IF(@views = '', 'SELECT 1', CONCAT('DROP VIEW IF EXISTS ', @views));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------
-- 2) Borrar TABLAS (si existen)
-- ----------------------------
SELECT GROUP_CONCAT(CONCAT('`', table_name, '`')) INTO @tables
FROM information_schema.tables
WHERE table_schema = 'rifas_solidarias_nuevo'
  AND table_type = 'BASE TABLE';

SET @tables = COALESCE(@tables, '');
SET @sql = IF(@tables = '', 'SELECT 1', CONCAT('DROP TABLE IF EXISTS ', @tables));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------
-- 3) Borrar PROCEDURES (si existen)
-- ----------------------------
SELECT GROUP_CONCAT(CONCAT('`', routine_name, '`')) INTO @procs
FROM information_schema.routines
WHERE routine_schema = 'rifas_solidarias_nuevo'
  AND routine_type = 'PROCEDURE';

SET @procs = COALESCE(@procs, '');
SET @sql = IF(@procs = '', 'SELECT 1', CONCAT('DROP PROCEDURE IF EXISTS ', @procs));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------
-- 4) Borrar FUNCTIONS (si existen)
-- ----------------------------
SELECT GROUP_CONCAT(CONCAT('`', routine_name, '`')) INTO @funcs
FROM information_schema.routines
WHERE routine_schema = 'rifas_solidarias_nuevo'
  AND routine_type = 'FUNCTION';

SET @funcs = COALESCE(@funcs, '');
SET @sql = IF(@funcs = '', 'SELECT 1', CONCAT('DROP FUNCTION IF EXISTS ', @funcs));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- NOTA: los TRIGGERS se eliminan automáticamente al dropear las tablas a las que pertenecen.
-- Si necesitás forzarlos a borrar previamente, puedo darte otro mecanismo.

-- Reactivar validación de FK
SET FOREIGN_KEY_CHECKS = 1;
