-- Migración 004: Redistribución de responsabilidades Fase 0 sin partir tablas existentes
-- Fecha: 2026-05-18
-- Base de datos: 11.8.2-MariaDB (soporta y valida CHECK constraints)

-- Paso 1: Enriquecer atenciones_vinculadas
ALTER TABLE `atenciones_vinculadas`
  ADD COLUMN `motivo_consulta_proceso` TEXT DEFAULT NULL AFTER `profesional_id`,
  ADD COLUMN `numero_sesiones_plan` TINYINT UNSIGNED DEFAULT NULL AFTER `motivo_consulta_proceso`,
  ADD COLUMN `recomendaciones` TEXT DEFAULT NULL AFTER `numero_sesiones_plan`,
  ADD COLUMN `hipotesis_sistemica` TEXT DEFAULT NULL AFTER `recomendaciones`;

-- Paso 2: Permitir atenciones.motivo_consulta como Nullable
ALTER TABLE `atenciones`
  MODIFY COLUMN `motivo_consulta` TEXT DEFAULT NULL;

-- Paso 3: Enriquecer atencion_vinculo_detalle
ALTER TABLE `atencion_vinculo_detalle`
  ADD COLUMN `fecha_incorporacion` DATE DEFAULT NULL AFTER `precio_final`,
  ADD COLUMN `fecha_retiro` DATE DEFAULT NULL AFTER `fecha_incorporacion`;

-- Paso 4: Arco exclusivo en diagnosticos_atencion
ALTER TABLE `diagnosticos_atencion`
  MODIFY COLUMN `atencion_id` INT UNSIGNED DEFAULT NULL,
  ADD COLUMN `vinculo_id` INT UNSIGNED DEFAULT NULL AFTER `atencion_id`,
  ADD CONSTRAINT `fk_dx_vinculo` FOREIGN KEY (`vinculo_id`) REFERENCES `atenciones_vinculadas` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `chk_dx_arco_exclusivo` CHECK (
    (`atencion_id` IS NOT NULL AND `vinculo_id` IS NULL) OR
    (`atencion_id` IS NULL AND `vinculo_id` IS NOT NULL)
  );

-- Paso 5: Campos del proceso a sesiones_grupo
ALTER TABLE `sesiones_grupo`
  ADD COLUMN `cita_id` INT UNSIGNED DEFAULT NULL AFTER `vinculo_id`,
  ADD COLUMN `modalidad_sesion` ENUM('presencial', 'virtual') NOT NULL DEFAULT 'presencial' AFTER `cita_id`,
  ADD CONSTRAINT `fk_sg_cita` FOREIGN KEY (`cita_id`) REFERENCES `citas` (`id`) ON DELETE SET NULL;

-- Paso 6: TRUNCATE limpio en orden seguro
-- Desactivar llaves foráneas temporalmente
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE `adelanto_sesion`;
TRUNCATE TABLE `adelantos_paciente`;
TRUNCATE TABLE `alertas`;
TRUNCATE TABLE `tareas`;
TRUNCATE TABLE `checkin_emocional`;
TRUNCATE TABLE `sesiones`;
TRUNCATE TABLE `sesiones_grupo`;
TRUNCATE TABLE `diagnosticos_atencion`;
TRUNCATE TABLE `atencion_vinculo_detalle`;
TRUNCATE TABLE `atenciones_vinculadas`;
TRUNCATE TABLE `atenciones`;
TRUNCATE TABLE `cuentas_cobro`;
TRUNCATE TABLE `citas`;

-- Reactivar llaves foráneas
SET FOREIGN_KEY_CHECKS = 1;

-- Paso 7: Actualizar vista v_historial_paciente
DROP VIEW IF EXISTS `v_historial_paciente`;

CREATE VIEW `v_historial_paciente` AS
SELECT 
    `p`.`id` AS `paciente_id`, 
    concat(`pe`.`nombres`,' ',`pe`.`apellidos`) AS `paciente`, 
    `a`.`id` AS `atencion_id`, 
    `a`.`fecha_inicio` AS `fecha_inicio`, 
    `a`.`fecha_fin` AS `fecha_fin`, 
    `a`.`estado` AS `estado_atencion`, 
    `a`.`motivo_consulta` AS `motivo_consulta`, 
    `a`.`grado_instruccion` AS `grado_instruccion_atencion`, 
    `a`.`ocupacion` AS `ocupacion_atencion`, 
    `a`.`estado_civil` AS `estado_civil_atencion`, 
    `a`.`observacion_general` AS `observacion_general`, 
    `a`.`observacion_conducta` AS `observacion_conducta`, 
    `a`.`antecedentes_relevantes` AS `antecedentes_relevantes`, 
    `a`.`recomendaciones` AS `recomendaciones`, 
    `ss`.`nombre` AS `subservicio`, 
    `ss`.`modalidad` AS `modalidad`, 
    concat(`pf`.`nombres`,' ',`pf`.`apellidos`) AS `profesional`, 
    `s`.`id` AS `sesion_id`, 
    `s`.`numero_sesion` AS `numero_sesion`, 
    `s`.`fecha_hora` AS `fecha_sesion`, 
    `s`.`modalidad_sesion` AS `modalidad_sesion`, 
    `s`.`precio_sesion` AS `precio_sesion`, 
    `s`.`nota_clinica` AS `nota_clinica`, 
    `d`.`cie10_codigo` AS `cie10_codigo`, 
    `c`.`descripcion_corta` AS `diagnostico` 
FROM ((((((((`pacientes` `p` 
  join `personas` `pe` on(`pe`.`id` = `p`.`persona_id`)) 
  join `atenciones` `a` on(`a`.`paciente_id` = `p`.`id`)) 
  join `subservicios` `ss` on(`ss`.`id` = `a`.`subservicio_id`)) 
  join `profesionales` `pr` on(`pr`.`id` = `a`.`profesional_id`)) 
  join `personas` `pf` on(`pf`.`id` = `pr`.`persona_id`)) 
  left join `sesiones` `s` on(`s`.`atencion_id` = `a`.`id`)) 
  left join `diagnosticos_atencion` `d` on(`d`.`atencion_id` = `a`.`id` and `d`.`jerarquia` = 'principal' and `d`.`nivel_certeza` in ('definitivo','presuntivo'))) 
  left join `cie10` `c` on(`c`.`codigo` = `d`.`cie10_codigo`)) 
WHERE `ss`.`modalidad` = 'individual'

UNION ALL 

SELECT 
    `p`.`id` AS `paciente_id`, 
    concat(`pe`.`nombres`,' ',`pe`.`apellidos`) AS `paciente`, 
    `a`.`id` AS `atencion_id`, 
    `a`.`fecha_inicio` AS `fecha_inicio`, 
    `a`.`fecha_fin` AS `fecha_fin`, 
    `a`.`estado` AS `estado_atencion`, 
    coalesce(`av`.`motivo_consulta_proceso`, `a`.`motivo_consulta`) AS `motivo_consulta`, 
    `a`.`grado_instruccion` AS `grado_instruccion_atencion`, 
    `a`.`ocupacion` AS `ocupacion_atencion`, 
    `a`.`estado_civil` AS `estado_civil_atencion`, 
    `a`.`observacion_general` AS `observacion_general`, 
    `a`.`observacion_conducta` AS `observacion_conducta`, 
    `a`.`antecedentes_relevantes` AS `antecedentes_relevantes`, 
    `a`.`recomendaciones` AS `recomendaciones`, 
    `ss`.`nombre` AS `subservicio`, 
    `ss`.`modalidad` AS `modalidad`, 
    concat(`pf`.`nombres`,' ',`pf`.`apellidos`) AS `profesional`, 
    `sg`.`id` AS `sesion_id`, 
    `sg`.`numero_sesion` AS `numero_sesion`, 
    `sg`.`fecha_hora` AS `fecha_sesion`, 
    'presencial' AS `modalidad_sesion`, 
    NULL AS `precio_sesion`, 
    `sg`.`nota_clinica_compartida` AS `nota_clinica`, 
    `d`.`cie10_codigo` AS `cie10_codigo`, 
    `c`.`descripcion_corta` AS `diagnostico` 
FROM ((((((((((`pacientes` `p` 
  join `personas` `pe` on(`pe`.`id` = `p`.`persona_id`)) 
  join `atenciones` `a` on(`a`.`paciente_id` = `p`.`id`)) 
  join `subservicios` `ss` on(`ss`.`id` = `a`.`subservicio_id`)) 
  join `profesionales` `pr` on(`pr`.`id` = `a`.`profesional_id`)) 
  join `personas` `pf` on(`pf`.`id` = `pr`.`persona_id`)) 
  join `atencion_vinculo_detalle` `avd` on(`avd`.`atencion_id` = `a`.`id`)) 
  join `atenciones_vinculadas` `av` on(`av`.`id` = `avd`.`vinculo_id`)) 
  left join `sesiones_grupo` `sg` on(`sg`.`vinculo_id` = `av`.`id`)) 
  left join `diagnosticos_atencion` `d` on((`d`.`atencion_id` = `a`.`id` OR `d`.`vinculo_id` = `av`.`id`) and `d`.`jerarquia` = 'principal' and `d`.`nivel_certeza` in ('definitivo','presuntivo'))) 
  left join `cie10` `c` on(`c`.`codigo` = `d`.`cie10_codigo`)) 
WHERE `ss`.`modalidad` in ('pareja','familiar','grupal');
