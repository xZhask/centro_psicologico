-- Migración 002: Agregar columna cita_id a la tabla sesiones
-- Fecha: 2026-05-17
-- Reversible: SÍ (ver sección de reversión al final)
--
-- Problema resuelto: Cita.php referencia sesiones.cita_id para resolver cobertura
-- de paquetes sin pasar por atenciones. La columna existe en el schema SQL pero
-- no fue aplicada a la BD con ALTER TABLE, produciendo:
--   SQLSTATE[42S22]: Unknown column 's.cita_id' in 'WHERE'
--
-- Esta migración:
--   1. Agrega la columna (idempotente con IF NOT EXISTS).
--   2. Agrega el índice.
--   3. Backfill de sesiones existentes via atencion_id → atenciones.cita_id.

-- Paso 1: Agregar columna si no existe
ALTER TABLE `sesiones`
  ADD COLUMN IF NOT EXISTS `cita_id` int UNSIGNED DEFAULT NULL
  AFTER `atencion_id`;

-- Paso 2: Agregar índice si no existe
-- (ignorar error 1061 si el índice ya existe)
ALTER TABLE `sesiones`
  ADD KEY IF NOT EXISTS `idx_sesiones_cita_id` (`cita_id`);

-- Paso 3: Backfill — vincular sesiones existentes a su cita correspondiente
UPDATE `sesiones` s
  JOIN `atenciones` a ON a.id = s.atencion_id
SET s.cita_id = a.cita_id
WHERE s.cita_id IS NULL
  AND a.cita_id IS NOT NULL;

-- Verificación post-migración:
--   SELECT COUNT(*) FROM sesiones WHERE cita_id IS NOT NULL;
--   -- Debe ser > 0 si hay sesiones ligadas a citas vía atenciones
--
--   SELECT COUNT(*) FROM sesiones WHERE cita_id IS NULL AND atencion_id IN
--     (SELECT id FROM atenciones WHERE cita_id IS NOT NULL);
--   -- Debe ser 0 (todas las sesiones ligables fueron actualizadas)

-- ===================== REVERSIÓN =====================
-- ALTER TABLE `sesiones` DROP KEY `idx_sesiones_cita_id`;
-- ALTER TABLE `sesiones` DROP COLUMN `cita_id`;
