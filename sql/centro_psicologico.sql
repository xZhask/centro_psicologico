-- phpMyAdmin SQL Dump
-- version 6.0.0-dev+20260324.466df794d2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: May 14, 2026 at 06:00 AM
-- Server version: 11.8.2-MariaDB
-- PHP Version: 8.5.5

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `centro_psicologico`
--

-- --------------------------------------------------------

--
-- Table structure for table `adelantos_paciente`
--

CREATE TABLE `adelantos_paciente` (
  `id` int(10) UNSIGNED NOT NULL,
  `paciente_id` int(10) UNSIGNED NOT NULL,
  `profesional_id` int(10) UNSIGNED NOT NULL,
  `atencion_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Opcional: vincula el\r\n                             adelanto a una atención\r\n                             específica.',
  `concepto` varchar(300) NOT NULL COMMENT 'Ej: "Pago adelantado\r\n                             por 3 sesiones".',
  `sesiones_acordadas` tinyint(3) UNSIGNED DEFAULT NULL COMMENT 'Informativo: cuántas\r\n                             sesiones cubre.',
  `monto_total` decimal(10,2) NOT NULL,
  `monto_aplicado` decimal(10,2) NOT NULL DEFAULT 0.00,
  `saldo_disponible` decimal(10,2) GENERATED ALWAYS AS (`monto_total` - `monto_aplicado`) STORED,
  `estado` enum('activo','agotado','cancelado') NOT NULL DEFAULT 'activo',
  `created_by` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `adelantos_paciente`
--

INSERT INTO `adelantos_paciente` (`id`, `paciente_id`, `profesional_id`, `atencion_id`, `concepto`, `sesiones_acordadas`, `monto_total`, `monto_aplicado`, `estado`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 1, 1, NULL, 'Adelanto de 5 sesiones', NULL, 400.00, 0.00, 'activo', 1, '2026-05-14 04:51:11', '2026-05-14 04:51:11');

-- --------------------------------------------------------

--
-- Table structure for table `adelanto_sesion`
--

CREATE TABLE `adelanto_sesion` (
  `id` int(10) UNSIGNED NOT NULL,
  `adelanto_id` int(10) UNSIGNED NOT NULL,
  `sesion_id` int(10) UNSIGNED NOT NULL,
  `monto_aplicado` decimal(10,2) NOT NULL COMMENT 'Monto del adelanto usado\r\n                           en esta sesión.',
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Triggers `adelanto_sesion`
--
DELIMITER $$
CREATE TRIGGER `trg_aplicar_adelanto` AFTER INSERT ON `adelanto_sesion` FOR EACH ROW BEGIN
  UPDATE adelantos_paciente
  SET monto_aplicado = monto_aplicado + NEW.monto_aplicado,
      estado = CASE
        WHEN (monto_aplicado + NEW.monto_aplicado)
             >= monto_total THEN 'agotado'
        ELSE 'activo'
      END,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.adelanto_id;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `alertas`
--

CREATE TABLE `alertas` (
  `id` int(10) UNSIGNED NOT NULL,
  `atencion_id` int(10) UNSIGNED NOT NULL,
  `paciente_id` int(10) UNSIGNED NOT NULL,
  `profesional_id` int(10) UNSIGNED NOT NULL,
  `regla_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'NULL si es alerta manual',
  `tipo` enum('sin_respuesta','riesgo_emocional','tarea_pendiente','inasistencia','escala_critica','manual') NOT NULL,
  `nivel` enum('informativa','moderada','alta','critica') NOT NULL,
  `descripcion` text DEFAULT NULL,
  `estado` enum('activa','atendida','descartada') NOT NULL DEFAULT 'activa',
  `accion_tomada` text DEFAULT NULL,
  `atendida_por` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `atendida_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `alertas`
--

INSERT INTO `alertas` (`id`, `atencion_id`, `paciente_id`, `profesional_id`, `regla_id`, `tipo`, `nivel`, `descripcion`, `estado`, `accion_tomada`, `atendida_por`, `created_at`, `atendida_at`) VALUES
(1, 1, 1, 1, NULL, 'manual', 'informativa', 'Paciente con adelanto disponible', 'activa', NULL, NULL, '2026-05-14 04:51:11', NULL),
(2, 1, 2, 2, NULL, 'inasistencia', 'moderada', 'Cita pendiente de confirmaci??n', 'activa', NULL, NULL, '2026-05-14 04:51:11', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `apoderados`
--

CREATE TABLE `apoderados` (
  `id` int(10) UNSIGNED NOT NULL,
  `persona_id` int(10) UNSIGNED NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `apoderado_paciente`
--

CREATE TABLE `apoderado_paciente` (
  `id` int(10) UNSIGNED NOT NULL,
  `apoderado_id` int(10) UNSIGNED NOT NULL,
  `paciente_id` int(10) UNSIGNED NOT NULL,
  `parentesco` enum('padre','madre','tutor_legal','abuelo','hermano','otro') NOT NULL,
  `es_contacto_principal` tinyint(1) NOT NULL DEFAULT 0,
  `es_responsable_pago` tinyint(1) NOT NULL DEFAULT 0,
  `puede_ver_historial` tinyint(1) NOT NULL DEFAULT 1,
  `notas` varchar(300) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `atenciones`
--

CREATE TABLE `atenciones` (
  `id` int(10) UNSIGNED NOT NULL,
  `paciente_id` int(10) UNSIGNED NOT NULL,
  `profesional_id` int(10) UNSIGNED NOT NULL,
  `cita_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Cita de origen; NULL si se crea directamente',
  `subservicio_id` int(10) UNSIGNED NOT NULL,
  `grado_instruccion` enum('sin_instruccion','primaria_incompleta','primaria_completa','secundaria_incompleta','secundaria_completa','tecnico_incompleto','tecnico_completo','superior_incompleto','superior_completo','posgrado','no_especificado') DEFAULT 'no_especificado',
  `ocupacion` varchar(150) DEFAULT NULL,
  `estado_civil` enum('soltero','casado','conviviente','divorciado','separado','viudo','no_especificado') DEFAULT 'no_especificado',
  `edad` tinyint(3) UNSIGNED DEFAULT NULL,
  `motivo_consulta` text NOT NULL COMMENT 'Razón principal por la que el paciente acude',
  `observacion_general` text DEFAULT NULL COMMENT 'Observación general del paciente al inicio',
  `observacion_conducta` text DEFAULT NULL COMMENT 'Observación del comportamiento y actitud en consulta',
  `antecedentes_relevantes` text DEFAULT NULL COMMENT 'Antecedentes específicos relevantes para esta atención',
  `recomendaciones` text DEFAULT NULL COMMENT 'Recomendaciones generales del profesional al cierre',
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date DEFAULT NULL COMMENT 'NULL mientras la atención esté activa',
  `estado` enum('activa','pausada','completada','cancelada') NOT NULL DEFAULT 'activa',
  `numero_sesiones_plan` tinyint(3) UNSIGNED DEFAULT NULL COMMENT 'Número de sesiones planificadas',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `atenciones`
--

INSERT INTO `atenciones` (`id`, `paciente_id`, `profesional_id`, `cita_id`, `subservicio_id`, `grado_instruccion`, `ocupacion`, `estado_civil`, `edad`, `motivo_consulta`, `observacion_general`, `observacion_conducta`, `antecedentes_relevantes`, `recomendaciones`, `fecha_inicio`, `fecha_fin`, `estado`, `numero_sesiones_plan`, `created_at`, `updated_at`) VALUES
(1, 3, 1, NULL, 1, 'no_especificado', NULL, 'no_especificado', NULL, 'Motivo de consulta de prueba para Luis Mendoza', NULL, NULL, NULL, NULL, '2026-05-12', NULL, 'activa', NULL, '2026-05-14 04:51:11', '2026-05-14 04:51:11');

-- --------------------------------------------------------

--
-- Table structure for table `atenciones_vinculadas`
--

CREATE TABLE `atenciones_vinculadas` (
  `id` int(10) UNSIGNED NOT NULL,
  `nombre_grupo` varchar(150) DEFAULT NULL,
  `tipo_vinculo` enum('pareja','familiar','grupal') NOT NULL,
  `subservicio_id` int(10) UNSIGNED NOT NULL,
  `profesional_id` int(10) UNSIGNED NOT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date DEFAULT NULL,
  `estado` enum('activo','completado','cancelado') NOT NULL DEFAULT 'activo',
  `created_by` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `atencion_vinculo_detalle`
--

CREATE TABLE `atencion_vinculo_detalle` (
  `id` int(10) UNSIGNED NOT NULL,
  `vinculo_id` int(10) UNSIGNED NOT NULL,
  `atencion_id` int(10) UNSIGNED NOT NULL,
  `rol_en_grupo` enum('consultante','acompanante','familiar','participante','paciente_titular') NOT NULL DEFAULT 'participante',
  `relacion_con_titular` varchar(100) DEFAULT NULL,
  `es_responsable_pago` tinyint(1) NOT NULL DEFAULT 0,
  `precio_cuota` decimal(10,2) DEFAULT NULL,
  `descuento_monto` decimal(10,2) NOT NULL DEFAULT 0.00,
  `motivo_descuento` varchar(200) DEFAULT NULL,
  `precio_final` decimal(10,2) GENERATED ALWAYS AS (coalesce(`precio_cuota`,0) - `descuento_monto`) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `checkin_emocional`
--

CREATE TABLE `checkin_emocional` (
  `id` int(10) UNSIGNED NOT NULL,
  `paciente_id` int(10) UNSIGNED NOT NULL,
  `atencion_id` int(10) UNSIGNED NOT NULL,
  `fecha_hora` datetime NOT NULL DEFAULT current_timestamp(),
  `como_te_sientes` tinyint(3) UNSIGNED NOT NULL COMMENT 'Escala 0–10',
  `dormiste_bien` tinyint(3) UNSIGNED NOT NULL COMMENT 'Escala 0–10',
  `nivel_estres` tinyint(3) UNSIGNED NOT NULL COMMENT 'Escala 0–10',
  `hiciste_tarea` tinyint(1) DEFAULT NULL COMMENT '1=sí 0=no NULL=no aplica',
  `nota_opcional` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `cie10`
--

CREATE TABLE `cie10` (
  `codigo` varchar(10) NOT NULL,
  `codigo_padre` varchar(10) DEFAULT NULL,
  `descripcion` varchar(500) NOT NULL,
  `descripcion_corta` varchar(150) DEFAULT NULL,
  `capitulo` varchar(10) DEFAULT NULL,
  `bloque` varchar(20) DEFAULT NULL,
  `nivel` tinyint(3) UNSIGNED DEFAULT 1 COMMENT '1=capítulo 2=bloque 3=categoría 4=subcategoría',
  `activo` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `cie10`
--

INSERT INTO `cie10` (`codigo`, `codigo_padre`, `descripcion`, `descripcion_corta`, `capitulo`, `bloque`, `nivel`, `activo`) VALUES
('F', NULL, 'Trastornos mentales y del comportamiento', 'T. mentales', 'V', 'F00-F99', 1, 1),
('F32', 'F', 'Episodio depresivo', 'Ep. depresivo', 'V', 'F30-F39', 2, 1),
('F32.0', 'F32', 'Episodio depresivo leve', 'Dep. leve', 'V', 'F30-F39', 3, 1),
('F32.1', 'F32', 'Episodio depresivo moderado', 'Dep. moderado', 'V', 'F30-F39', 3, 1),
('F32.2', 'F32', 'Episodio depresivo grave sin psicosis', 'Dep. grave', 'V', 'F30-F39', 3, 1),
('F41', 'F', 'Otros trastornos de ansiedad', 'Ansiedad', 'V', 'F40-F48', 2, 1),
('F41.0', 'F41', 'Trastorno de pánico', 'Pánico', 'V', 'F40-F48', 3, 1),
('F41.1', 'F41', 'Trastorno de ansiedad generalizada', 'TAG', 'V', 'F40-F48', 3, 1),
('F43', 'F', 'Reacciones al estrés y trastornos de adaptación', 'Estrés/adapt.', 'V', 'F40-F48', 2, 1),
('F43.1', 'F43', 'Trastorno de estrés postraumático', 'TEPT', 'V', 'F40-F48', 3, 1),
('F43.2', 'F43', 'Trastornos de adaptación', 'Adapt.', 'V', 'F40-F48', 3, 1),
('F60', 'F', 'Trastornos específicos de la personalidad', 'T. personalidad', 'V', 'F60-F69', 2, 1),
('F90', 'F', 'Trastornos hipercinéticos', 'TDAH', 'V', 'F90-F98', 2, 1),
('F90.0', 'F90', 'Perturbación de la actividad y atención', 'TDAH', 'V', 'F90-F98', 3, 1),
('F93', 'F', 'Trastornos emocionales en la infancia', 'T. emoc. inf.', 'V', 'F90-F98', 2, 1),
('F94.0', 'F93', 'Mutismo selectivo', 'Mutismo selectivo', 'V', 'F90-F98', 3, 1);

-- --------------------------------------------------------

--
-- Table structure for table `citas`
--

CREATE TABLE `citas` (
  `id` int(10) UNSIGNED NOT NULL,
  `cita_origen_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Apunta a la cita original si es reprogramación',
  `paciente_id` int(10) UNSIGNED NOT NULL,
  `profesional_id` int(10) UNSIGNED NOT NULL,
  `subservicio_id` int(10) UNSIGNED NOT NULL,
  `tipo_cita` enum('nueva_atencion','sesion_existente') DEFAULT NULL COMMENT 'Intención declarada al agendar',
  `precio_acordado` decimal(10,2) DEFAULT NULL COMMENT 'Monto pactado al separar la cita',
  `modalidad_sesion` enum('presencial','virtual') NOT NULL DEFAULT 'presencial' COMMENT 'Modalidad acordada al separar la cita',
  `descuento_monto` decimal(10,2) NOT NULL DEFAULT 0.00,
  `motivo_descuento` varchar(200) DEFAULT NULL,
  `atencion_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Atención vinculada cuando tipo_cita = sesion_existente',
  `fecha_hora_inicio` datetime NOT NULL,
  `estado` enum('pendiente','confirmada','completada','cancelada','no_asistio','reprogramada') NOT NULL DEFAULT 'pendiente',
  `reprogramaciones_count` tinyint(3) UNSIGNED DEFAULT 0,
  `notas` text DEFAULT NULL,
  `creado_por` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `citas`
--

INSERT INTO `citas` (`id`, `cita_origen_id`, `paciente_id`, `profesional_id`, `subservicio_id`, `tipo_cita`, `precio_acordado`, `modalidad_sesion`, `descuento_monto`, `motivo_descuento`, `atencion_id`, `fecha_hora_inicio`, `estado`, `reprogramaciones_count`, `notas`, `creado_por`, `created_at`, `updated_at`) VALUES
(1, NULL, 1, 1, 1, 'nueva_atencion', 100.00, 'presencial', 0.00, NULL, NULL, '2026-05-14 23:51:11', 'confirmada', 0, NULL, 1, '2026-05-14 04:51:11', '2026-05-14 04:51:11'),
(2, NULL, 2, 2, 1, 'nueva_atencion', 120.00, 'virtual', 0.00, NULL, NULL, '2026-05-15 23:51:11', 'confirmada', 0, NULL, 1, '2026-05-14 04:51:11', '2026-05-14 04:56:54'),
(3, NULL, 3, 1, 1, 'nueva_atencion', 90.00, 'presencial', 0.00, NULL, 1, '2026-05-12 23:51:11', 'completada', 0, NULL, 1, '2026-05-14 04:51:11', '2026-05-14 04:51:11'),
(4, NULL, 4, 3, 1, 'nueva_atencion', 110.00, 'presencial', 0.00, NULL, NULL, '2026-05-16 23:51:11', 'confirmada', 0, NULL, 1, '2026-05-14 04:51:11', '2026-05-14 04:51:11');

-- --------------------------------------------------------

--
-- Table structure for table `cuentas_cobro`
--

CREATE TABLE `cuentas_cobro` (
  `id` int(10) UNSIGNED NOT NULL,
  `paciente_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'NULL si la cuenta es individual',
  `cita_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Cuenta generada al registrar el primer pago de una cita',
  `vinculo_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'NULL si la cuenta es grupal',
  `taller_id` int(10) UNSIGNED DEFAULT NULL,
  `atencion_id` int(10) UNSIGNED DEFAULT NULL,
  `sesion_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'FK a sesiones cuando la cuenta\r\n             es por sesión individual.',
  `concepto` varchar(300) NOT NULL,
  `monto_total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `descuento_aplicado` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Descuento ya reflejado en monto_total (informativo)',
  `motivo_descuento` varchar(200) DEFAULT NULL,
  `monto_pagado` decimal(10,2) NOT NULL DEFAULT 0.00,
  `saldo_pendiente` decimal(10,2) GENERATED ALWAYS AS (`monto_total` - `monto_pagado`) STORED,
  `estado` enum('pendiente','pago_parcial','pagado','anulado') NOT NULL DEFAULT 'pendiente',
  `fecha_emision` date NOT NULL,
  `fecha_vencimiento` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ;

--
-- Dumping data for table `cuentas_cobro`
--

INSERT INTO `cuentas_cobro` (`id`, `paciente_id`, `cita_id`, `vinculo_id`, `taller_id`, `atencion_id`, `sesion_id`, `concepto`, `monto_total`, `descuento_aplicado`, `motivo_descuento`, `monto_pagado`, `estado`, `fecha_emision`, `fecha_vencimiento`, `created_at`, `updated_at`) VALUES
(1, 3, 3, NULL, NULL, 1, 1, 'Cita 1ra Sesi??n - Luis Mendoza', 90.00, 0.00, NULL, 180.00, 'pagado', '2026-05-12', NULL, '2026-05-14 04:51:11', '2026-05-14 04:51:11'),
(2, 1, NULL, NULL, NULL, NULL, NULL, 'Adelanto de 5 sesiones', 400.00, 0.00, NULL, 800.00, 'pagado', '2026-05-13', NULL, '2026-05-14 04:51:11', '2026-05-14 04:51:11');

-- --------------------------------------------------------

--
-- Table structure for table `diagnosticos_atencion`
--

CREATE TABLE `diagnosticos_atencion` (
  `id` int(10) UNSIGNED NOT NULL,
  `atencion_id` int(10) UNSIGNED NOT NULL,
  `cie10_codigo` varchar(10) NOT NULL,
  `nivel_certeza` enum('definitivo','presuntivo','descartado') NOT NULL,
  `jerarquia` enum('principal','secundario') DEFAULT NULL COMMENT 'Jerarquía del diagnóstico en la atención',
  `fecha_dx` date NOT NULL,
  `observacion_clinica` text DEFAULT NULL,
  `registrado_por` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `grupo_participantes_pago`
--

CREATE TABLE `grupo_participantes_pago` (
  `id` int(10) UNSIGNED NOT NULL,
  `cuenta_cobro_id` int(10) UNSIGNED NOT NULL,
  `paciente_id` int(10) UNSIGNED NOT NULL,
  `pct_responsabilidad` decimal(5,2) NOT NULL DEFAULT 50.00,
  `es_responsable_pago` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `historial_citas`
--

CREATE TABLE `historial_citas` (
  `id` int(10) UNSIGNED NOT NULL,
  `cita_id` int(10) UNSIGNED NOT NULL,
  `fecha_hora_anterior` datetime NOT NULL,
  `fecha_hora_nueva` datetime NOT NULL,
  `motivo` enum('reprogramacion','cancelacion','ajuste_hora','otro') NOT NULL,
  `descripcion` text DEFAULT NULL,
  `registrado_por` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `pacientes`
--

CREATE TABLE `pacientes` (
  `id` int(10) UNSIGNED NOT NULL,
  `persona_id` int(10) UNSIGNED NOT NULL,
  `grado_instruccion` enum('sin_instruccion','primaria_incompleta','primaria_completa','secundaria_incompleta','secundaria_completa','tecnico_incompleto','tecnico_completo','superior_incompleto','superior_completo','posgrado','no_especificado') DEFAULT 'no_especificado',
  `ocupacion` varchar(150) DEFAULT NULL,
  `estado_civil` enum('soltero','casado','conviviente','divorciado','separado','viudo','no_especificado') DEFAULT 'no_especificado',
  `telefono_emergencia` varchar(20) DEFAULT NULL,
  `contacto_emergencia` varchar(150) DEFAULT NULL,
  `antecedentes` text DEFAULT NULL COMMENT 'Antecedentes clínicos generales del paciente',
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `pacientes`
--

INSERT INTO `pacientes` (`id`, `persona_id`, `grado_instruccion`, `ocupacion`, `estado_civil`, `telefono_emergencia`, `contacto_emergencia`, `antecedentes`, `activo`, `created_at`, `updated_at`) VALUES
(1, 5, 'no_especificado', NULL, 'no_especificado', NULL, NULL, NULL, 1, '2026-05-14 04:51:11', '2026-05-14 04:51:11'),
(2, 6, 'no_especificado', NULL, 'no_especificado', NULL, NULL, NULL, 1, '2026-05-14 04:51:11', '2026-05-14 04:51:11'),
(3, 7, 'no_especificado', NULL, 'no_especificado', NULL, NULL, NULL, 1, '2026-05-14 04:51:11', '2026-05-14 04:51:11'),
(4, 8, 'no_especificado', NULL, 'no_especificado', NULL, NULL, NULL, 1, '2026-05-14 04:51:11', '2026-05-14 04:51:11'),
(5, 9, 'no_especificado', NULL, 'no_especificado', NULL, NULL, NULL, 1, '2026-05-14 04:51:11', '2026-05-14 04:51:11');

-- --------------------------------------------------------

--
-- Table structure for table `paciente_paquetes`
--

CREATE TABLE `paciente_paquetes` (
  `id` int(10) UNSIGNED NOT NULL,
  `paquete_id` int(10) UNSIGNED NOT NULL,
  `paciente_id` int(10) UNSIGNED NOT NULL,
  `profesional_id` int(10) UNSIGNED NOT NULL,
  `sesiones_restantes` tinyint(3) UNSIGNED NOT NULL,
  `cuenta_cobro_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Generada automáticamente',
  `estado` enum('activo','agotado','vencido','cancelado') NOT NULL DEFAULT 'activo',
  `fecha_activacion` date NOT NULL,
  `fecha_vencimiento` date DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `created_by` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `pagos_paciente`
--

CREATE TABLE `pagos_paciente` (
  `id` int(10) UNSIGNED NOT NULL,
  `cuenta_cobro_id` int(10) UNSIGNED NOT NULL,
  `pagado_por_paciente` int(10) UNSIGNED DEFAULT NULL COMMENT 'Paciente registrado que paga',
  `pagado_por_apoderado` int(10) UNSIGNED DEFAULT NULL COMMENT 'Apoderado que paga por el menor',
  `pagado_por_externo` varchar(150) DEFAULT NULL COMMENT 'Nombre libre si no está en el sistema',
  `monto` decimal(10,2) NOT NULL,
  `fecha_pago` date NOT NULL,
  `metodo_pago` enum('efectivo','transferencia','tarjeta_debito','tarjeta_credito','yape','plin','otro') NOT NULL,
  `numero_comprobante` varchar(60) DEFAULT NULL,
  `registrado_por` int(10) UNSIGNED NOT NULL,
  `notas` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `pagos_paciente`
--

INSERT INTO `pagos_paciente` (`id`, `cuenta_cobro_id`, `pagado_por_paciente`, `pagado_por_apoderado`, `pagado_por_externo`, `monto`, `fecha_pago`, `metodo_pago`, `numero_comprobante`, `registrado_por`, `notas`, `created_at`) VALUES
(1, 1, 3, NULL, NULL, 90.00, '2026-05-12', 'efectivo', NULL, 1, NULL, '2026-05-14 04:51:11'),
(2, 2, 1, NULL, NULL, 400.00, '2026-05-13', 'transferencia', NULL, 1, NULL, '2026-05-14 04:51:11');

--
-- Triggers `pagos_paciente`
--
DELIMITER $$
CREATE TRIGGER `trg_actualizar_monto_pagado` AFTER INSERT ON `pagos_paciente` FOR EACH ROW BEGIN
  UPDATE cuentas_cobro
  SET
    monto_pagado = monto_pagado + NEW.monto,
    estado = CASE
               WHEN (monto_pagado + NEW.monto) >= monto_total THEN 'pagado'
               WHEN (monto_pagado + NEW.monto) > 0            THEN 'pago_parcial'
               ELSE 'pendiente'
             END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.cuenta_cobro_id;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `pagos_personal`
--

CREATE TABLE `pagos_personal` (
  `id` int(10) UNSIGNED NOT NULL,
  `planilla_id` int(10) UNSIGNED NOT NULL,
  `monto` decimal(10,2) NOT NULL,
  `fecha_pago` date NOT NULL,
  `metodo_pago` enum('transferencia','efectivo','cheque','otro') NOT NULL,
  `referencia` varchar(100) DEFAULT NULL,
  `registrado_por` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `paquetes`
--

CREATE TABLE `paquetes` (
  `id` int(10) UNSIGNED NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `sesiones_incluidas` tinyint(3) UNSIGNED NOT NULL,
  `precio_paquete` decimal(10,2) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `paquetes`
--

INSERT INTO `paquetes` (`id`, `nombre`, `descripcion`, `sesiones_incluidas`, `precio_paquete`, `activo`, `created_at`) VALUES
(1, 'Pack Inicio', '3 sesiones con tarifa especial para nuevos pacientes', 3, 270.00, 1, '2026-05-02 05:37:05'),
(2, 'Pack Continuidad', '5 sesiones para pacientes en proceso terapéutico', 5, 480.00, 1, '2026-05-02 05:37:05'),
(3, 'Pack Familiar', '4 sesiones de terapia familiar con descuento', 4, 480.00, 1, '2026-05-02 05:37:05');

-- --------------------------------------------------------

--
-- Table structure for table `personas`
--

CREATE TABLE `personas` (
  `id` int(10) UNSIGNED NOT NULL,
  `dni` varchar(15) NOT NULL,
  `nombres` varchar(100) NOT NULL,
  `apellidos` varchar(100) NOT NULL,
  `fecha_nacimiento` date DEFAULT NULL,
  `sexo` enum('masculino','femenino','otro','no_especificado') DEFAULT 'no_especificado',
  `telefono` varchar(20) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `foto_url` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `personas`
--

INSERT INTO `personas` (`id`, `dni`, `nombres`, `apellidos`, `fecha_nacimiento`, `sexo`, `telefono`, `email`, `foto_url`, `created_at`, `updated_at`) VALUES
(1, '48193845', 'Josué', 'Silva Aguilar', '1994-03-07', 'masculino', '987000001', 'admin@magusa.pe', NULL, '2026-05-02 05:37:05', '2026-05-02 05:49:46'),
(2, '11111111', 'Ana', 'García Pérez', '1988-03-12', 'femenino', '987654321', 'ana.garcia@gmail.com', NULL, '2026-05-14 04:51:11', '2026-05-14 04:55:40'),
(3, '22222222', 'Carlos', 'Rodríguez', '1985-07-22', 'masculino', '987654322', 'carlos.rod@outlook.com', NULL, '2026-05-14 04:51:11', '2026-05-14 04:55:47'),
(4, '33333333', 'Elena', 'Torres', '1992-11-05', 'femenino', '987654323', 'etorres@centro.com', NULL, '2026-05-14 04:51:11', '2026-05-14 04:51:11'),
(5, '44444444', 'Juan', 'Pérez Lozano', '1995-05-15', 'masculino', '999888771', 'jperez@gmail.com', NULL, '2026-05-14 04:51:11', '2026-05-14 04:55:53'),
(6, '55555555', 'María', 'Soto Ruiz', '1990-10-20', 'femenino', '999888772', 'msoto@hotmail.com', NULL, '2026-05-14 04:51:11', '2026-05-14 04:56:17'),
(7, '66666666', 'Luis', 'Mendoza', '2005-01-10', 'masculino', '999888773', 'lmendoza@yahoo.com', NULL, '2026-05-14 04:51:11', '2026-05-14 04:51:11'),
(8, '77777777', 'Sofía', 'Castro', '2015-08-30', 'femenino', '999888774', 'scastro@gmail.com', NULL, '2026-05-14 04:51:11', '2026-05-14 04:56:10'),
(9, '88888888', 'Diego', 'Ramírez', '1985-03-25', 'masculino', '999888775', 'dramirez@gmail.com', NULL, '2026-05-14 04:51:11', '2026-05-14 04:56:00');

-- --------------------------------------------------------

--
-- Table structure for table `planes_seguimiento`
--

CREATE TABLE `planes_seguimiento` (
  `id` int(10) UNSIGNED NOT NULL,
  `atencion_id` int(10) UNSIGNED NOT NULL,
  `profesional_id` int(10) UNSIGNED NOT NULL,
  `frecuencia_checkin` enum('diario','cada_2_dias','semanal','libre') NOT NULL DEFAULT 'libre',
  `alerta_sin_respuesta_dias` tinyint(3) UNSIGNED DEFAULT 7,
  `usar_phq9` tinyint(1) DEFAULT 0,
  `usar_gad7` tinyint(1) DEFAULT 0,
  `usar_escala_custom` tinyint(1) DEFAULT 0,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `planillas`
--

CREATE TABLE `planillas` (
  `id` int(10) UNSIGNED NOT NULL,
  `profesional_id` int(10) UNSIGNED NOT NULL,
  `periodo_inicio` date NOT NULL,
  `periodo_fin` date NOT NULL,
  `sesiones_realizadas` smallint(5) UNSIGNED DEFAULT 0,
  `porcentaje_profesional` decimal(5,2) DEFAULT NULL COMMENT '% del valor de cada sesión que\r\n             corresponde al profesional',
  `monto_bruto` decimal(10,2) NOT NULL DEFAULT 0.00,
  `descuentos` decimal(10,2) NOT NULL DEFAULT 0.00,
  `monto_neto` decimal(10,2) GENERATED ALWAYS AS (`monto_bruto` - `descuentos`) STORED,
  `estado` enum('borrador','aprobada','pagada','anulada') NOT NULL DEFAULT 'borrador',
  `observaciones` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `planilla_conceptos`
--

CREATE TABLE `planilla_conceptos` (
  `id` int(10) UNSIGNED NOT NULL,
  `planilla_id` int(10) UNSIGNED NOT NULL,
  `tipo` enum('sesion','taller') NOT NULL,
  `sesion_id` int(10) UNSIGNED DEFAULT NULL,
  `taller_fecha_id` int(10) UNSIGNED DEFAULT NULL,
  `descripcion` varchar(300) NOT NULL,
  `monto_base` decimal(10,2) NOT NULL,
  `porcentaje` decimal(5,2) NOT NULL,
  `monto_profesional` decimal(10,2) GENERATED ALWAYS AS (round(`monto_base` * `porcentaje` / 100,2)) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `profesionales`
--

CREATE TABLE `profesionales` (
  `id` int(10) UNSIGNED NOT NULL,
  `persona_id` int(10) UNSIGNED NOT NULL,
  `colegiatura` varchar(30) NOT NULL,
  `especialidad` varchar(150) DEFAULT NULL,
  `descripcion_bio` text DEFAULT NULL,
  `tarifa_hora` decimal(10,2) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `profesionales`
--

INSERT INTO `profesionales` (`id`, `persona_id`, `colegiatura`, `especialidad`, `descripcion_bio`, `tarifa_hora`, `activo`, `created_at`, `updated_at`) VALUES
(1, 2, 'PS-12345', 'Psicolog??a Cl??nica', NULL, NULL, 1, '2026-05-14 04:51:11', '2026-05-14 04:51:11'),
(2, 3, 'PS-22345', 'Terapia Cognitivo Conductual', NULL, NULL, 1, '2026-05-14 04:51:11', '2026-05-14 04:51:11'),
(3, 4, 'PS-33345', 'Psicoterapia Infantil', NULL, NULL, 1, '2026-05-14 04:51:11', '2026-05-14 04:51:11');

-- --------------------------------------------------------

--
-- Table structure for table `reglas_alerta`
--

CREATE TABLE `reglas_alerta` (
  `id` int(10) UNSIGNED NOT NULL,
  `plan_id` int(10) UNSIGNED NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `campo_origen` enum('como_te_sientes','dormiste_bien','nivel_estres','hiciste_tarea','dias_sin_checkin') NOT NULL,
  `operador` enum('mayor_que','menor_que','igual_a','mayor_igual','menor_igual') NOT NULL,
  `valor_umbral` decimal(5,2) NOT NULL,
  `dias_consecutivos` tinyint(3) UNSIGNED DEFAULT 1,
  `nivel_alerta` enum('informativa','moderada','alta','critica') NOT NULL DEFAULT 'moderada',
  `activa` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `servicios`
--

CREATE TABLE `servicios` (
  `id` int(10) UNSIGNED NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `tipo` enum('individual','grupal','taller') NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `orden` tinyint(3) UNSIGNED DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `servicios`
--

INSERT INTO `servicios` (`id`, `nombre`, `descripcion`, `tipo`, `activo`, `orden`, `created_at`) VALUES
(1, 'Atención Psicológica Niños y Adolescentes', 'Consultas y terapias para menores de 18 años', 'individual', 1, 1, '2026-05-02 05:37:05'),
(2, 'Atención Psicológica Adultos', 'Consultas y terapias para adultos', 'individual', 1, 2, '2026-05-02 05:37:05'),
(3, 'Talleres Psicológicos', 'Sesiones grupales y programas de bienestar', 'taller', 1, 3, '2026-05-02 05:37:05');

-- --------------------------------------------------------

--
-- Table structure for table `sesiones`
--

CREATE TABLE `sesiones` (
  `id` int(10) UNSIGNED NOT NULL,
  `atencion_id` int(10) UNSIGNED NOT NULL,
  `paciente_paquete_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Si esta sesión consume un paquete',
  `numero_sesion` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `fecha_hora` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Capturada automáticamente por el servidor al registrar',
  `duracion_min` smallint(5) UNSIGNED DEFAULT NULL,
  `modalidad_sesion` enum('presencial','virtual') NOT NULL DEFAULT 'presencial' COMMENT 'Puede variar sesión a sesión\r\n             dentro de la misma atención.',
  `precio_sesion` decimal(10,2) DEFAULT NULL COMMENT 'Precio real cobrado por esta sesión.\r\n             NULL hasta que se registre la sesión.\r\n             Pre-llenado desde atencion.precio_acordado\r\n             ajustado por modalidad.',
  `nota_clinica` text DEFAULT NULL COMMENT 'Nota SOAP o formato libre del profesional',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `sesiones`
--

INSERT INTO `sesiones` (`id`, `atencion_id`, `paciente_paquete_id`, `numero_sesion`, `fecha_hora`, `duracion_min`, `modalidad_sesion`, `precio_sesion`, `nota_clinica`, `created_at`, `updated_at`) VALUES
(1, 1, NULL, 1, '2026-05-12 23:51:11', NULL, 'presencial', 90.00, NULL, '2026-05-14 04:51:11', '2026-05-14 04:51:11');

--
-- Triggers `sesiones`
--
DELIMITER $$
CREATE TRIGGER `trg_consumir_paquete` AFTER INSERT ON `sesiones` FOR EACH ROW BEGIN
  IF NEW.paciente_paquete_id IS NOT NULL THEN
    UPDATE paciente_paquetes
    SET estado = CASE
          WHEN sesiones_restantes <= 1 THEN 'agotado'
          ELSE 'activo'
        END,
        sesiones_restantes = CASE
          WHEN sesiones_restantes > 0 THEN sesiones_restantes - 1
          ELSE 0
        END
    WHERE id = NEW.paciente_paquete_id;
  END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `sesiones_grupo`
--

CREATE TABLE `sesiones_grupo` (
  `id` int(10) UNSIGNED NOT NULL,
  `vinculo_id` int(10) UNSIGNED NOT NULL,
  `numero_sesion` tinyint(3) UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Número correlativo de sesión\r\n             dentro del vínculo grupal.',
  `fecha_hora` datetime NOT NULL,
  `duracion_min` smallint(5) UNSIGNED DEFAULT NULL,
  `nota_clinica_compartida` text DEFAULT NULL COMMENT 'Dinámica grupal, visible al profesional',
  `nota_privada_p1` text DEFAULT NULL COMMENT 'Observación individual — solo visible al profesional',
  `nota_privada_p2` text DEFAULT NULL,
  `nota_privada_p3` text DEFAULT NULL,
  `estado` enum('programada','realizada','cancelada','no_asistio') DEFAULT 'realizada',
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `sesion_archivos`
--

CREATE TABLE `sesion_archivos` (
  `id` int(10) UNSIGNED NOT NULL,
  `sesion_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'FK a sesiones si es individual',
  `sesion_grupo_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'FK a sesiones_grupo si es grupal',
  `nombre_original` varchar(255) NOT NULL,
  `nombre_display` varchar(255) DEFAULT NULL COMMENT 'Alias definido por el usuario al subir el archivo',
  `nombre_guardado` varchar(255) NOT NULL COMMENT 'UUID + extensión para evitar colisiones',
  `tipo_mime` varchar(100) NOT NULL,
  `tamano_bytes` int(10) UNSIGNED NOT NULL,
  `subido_por` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ;

-- --------------------------------------------------------

--
-- Table structure for table `subservicios`
--

CREATE TABLE `subservicios` (
  `id` int(10) UNSIGNED NOT NULL,
  `servicio_id` int(10) UNSIGNED NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `modalidad` enum('individual','pareja','familiar','grupal') NOT NULL,
  `duracion_min` smallint(5) UNSIGNED DEFAULT 50,
  `precio_base` decimal(10,2) NOT NULL DEFAULT 0.00,
  `descuento_virtual` decimal(10,2) NOT NULL DEFAULT 10.00 COMMENT 'Descuento aplicado cuando la sesión\r\n             es virtual. Sugerido, editable por\r\n             subservicio.',
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `subservicios`
--

INSERT INTO `subservicios` (`id`, `servicio_id`, `nombre`, `modalidad`, `duracion_min`, `precio_base`, `descuento_virtual`, `activo`, `created_at`) VALUES
(1, 1, 'Consulta psicológica niño', 'individual', 45, 80.00, 10.00, 1, '2026-05-02 05:37:05'),
(2, 1, 'Terapia psicológica niño', 'individual', 50, 100.00, 10.00, 1, '2026-05-02 05:37:05'),
(3, 1, 'Terapia psicológica adolescente', 'individual', 50, 100.00, 10.00, 1, '2026-05-02 05:37:05'),
(4, 2, 'Consulta psicológica adulto', 'individual', 50, 90.00, 10.00, 1, '2026-05-02 05:37:05'),
(5, 2, 'Terapia psicológica adulto', 'individual', 50, 110.00, 10.00, 1, '2026-05-02 05:37:05'),
(6, 2, 'Terapia emocional', 'individual', 50, 110.00, 10.00, 1, '2026-05-02 05:37:05'),
(7, 2, 'Terapia de pareja', 'pareja', 60, 130.00, 15.00, 1, '2026-05-02 05:37:05'),
(8, 2, 'Terapia familiar', 'familiar', 60, 140.00, 15.00, 1, '2026-05-02 05:37:05'),
(9, 3, 'Taller de manejo del estrés', 'grupal', 90, 60.00, 0.00, 1, '2026-05-02 05:37:05'),
(10, 3, 'Taller de habilidades sociales', 'grupal', 90, 60.00, 0.00, 1, '2026-05-02 05:37:05');

-- --------------------------------------------------------

--
-- Table structure for table `talleres_institucionales`
--

CREATE TABLE `talleres_institucionales` (
  `id` int(10) UNSIGNED NOT NULL,
  `profesional_id` int(10) UNSIGNED NOT NULL,
  `subservicio_id` int(10) UNSIGNED NOT NULL,
  `institucion` varchar(200) DEFAULT NULL,
  `tema` varchar(300) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `total_asistentes` smallint(5) UNSIGNED DEFAULT NULL,
  `precio_acordado` decimal(10,2) NOT NULL DEFAULT 0.00,
  `porcentaje_prof` decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT '% del precio que va al profesional',
  `estado` enum('programado','realizado','cancelado') NOT NULL DEFAULT 'programado',
  `notas` text DEFAULT NULL,
  `created_by` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `taller_fechas`
--

CREATE TABLE `taller_fechas` (
  `id` int(10) UNSIGNED NOT NULL,
  `taller_id` int(10) UNSIGNED NOT NULL,
  `fecha_hora` datetime NOT NULL,
  `duracion_min` smallint(5) UNSIGNED NOT NULL DEFAULT 90,
  `estado` enum('programada','realizada','cancelada') NOT NULL DEFAULT 'programada',
  `asistentes` smallint(5) UNSIGNED DEFAULT NULL COMMENT 'Asistentes específicos de esta fecha',
  `notas` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `tareas`
--

CREATE TABLE `tareas` (
  `id` int(10) UNSIGNED NOT NULL,
  `sesion_id` int(10) UNSIGNED NOT NULL,
  `paciente_id` int(10) UNSIGNED NOT NULL,
  `titulo` varchar(200) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `fecha_asignacion` date NOT NULL,
  `fecha_limite` date DEFAULT NULL,
  `estado` enum('pendiente','en_proceso','completada','no_realizada') NOT NULL DEFAULT 'pendiente',
  `respuesta_paciente` text DEFAULT NULL,
  `respondido_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int(10) UNSIGNED NOT NULL,
  `persona_id` int(10) UNSIGNED NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `rol` enum('administrador','profesional','paciente') NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `debe_cambiar_password` tinyint(1) NOT NULL DEFAULT 0,
  `ultimo_acceso` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `usuarios`
--

INSERT INTO `usuarios` (`id`, `persona_id`, `password_hash`, `rol`, `activo`, `debe_cambiar_password`, `ultimo_acceso`, `created_at`, `updated_at`) VALUES
(1, 1, '$2y$12$VSarL1OeqjBuCmDvr66U6ue6p6PT8ZpEYaaGHD2DXX.InHpk7P586', 'administrador', 1, 0, '2026-05-14 01:13:20', '2026-05-02 05:37:05', '2026-05-14 01:13:20'),
(2, 2, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'profesional', 1, 0, NULL, '2026-05-14 04:51:11', '2026-05-14 04:51:11'),
(3, 3, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'profesional', 1, 0, NULL, '2026-05-14 04:51:11', '2026-05-14 04:51:11'),
(4, 4, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'profesional', 1, 0, NULL, '2026-05-14 04:51:11', '2026-05-14 04:51:11');

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_agenda_dia`
-- (See below for the actual view)
--
CREATE TABLE `v_agenda_dia` (
`cita_id` int(10) unsigned
,`fecha_hora_inicio` datetime
,`estado` enum('pendiente','confirmada','completada','cancelada','no_asistio','reprogramada')
,`tipo_cita` enum('nueva_atencion','sesion_existente')
,`modalidad_sesion` enum('presencial','virtual')
,`precio_cita` decimal(10,2)
,`descuento_cita` decimal(10,2)
,`motivo_descuento_cita` varchar(200)
,`paciente` varchar(201)
,`telefono_paciente` varchar(20)
,`apoderado` varchar(201)
,`telefono_apoderado` varchar(20)
,`profesional` varchar(201)
,`subservicio` varchar(150)
,`modalidad` enum('individual','pareja','familiar','grupal')
,`duracion_min` smallint(5) unsigned
,`servicio` varchar(150)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_historial_paciente`
-- (See below for the actual view)
--
CREATE TABLE `v_historial_paciente` (
`paciente_id` int(10) unsigned
,`paciente` varchar(201)
,`atencion_id` int(10) unsigned
,`fecha_inicio` date
,`fecha_fin` date
,`estado_atencion` varchar(10)
,`motivo_consulta` mediumtext
,`grado_instruccion_atencion` varchar(21)
,`ocupacion_atencion` varchar(150)
,`estado_civil_atencion` varchar(15)
,`recomendaciones` mediumtext
,`subservicio` varchar(150)
,`modalidad` varchar(10)
,`profesional` varchar(201)
,`sesion_id` int(10) unsigned
,`numero_sesion` tinyint(3) unsigned
,`fecha_sesion` datetime /* mariadb-5.3 */
,`modalidad_sesion` varchar(10)
,`precio_sesion` decimal(10,2)
,`nota_clinica` mediumtext
,`cie10_codigo` varchar(10)
,`diagnostico` varchar(150)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_pacientes_apoderados`
-- (See below for the actual view)
--
CREATE TABLE `v_pacientes_apoderados` (
`paciente_id` int(10) unsigned
,`paciente` varchar(201)
,`fecha_nacimiento` date
,`edad` bigint(21)
,`parentesco` enum('padre','madre','tutor_legal','abuelo','hermano','otro')
,`es_contacto_principal` tinyint(1)
,`es_responsable_pago` tinyint(1)
,`puede_ver_historial` tinyint(1)
,`apoderado` varchar(201)
,`telefono_apoderado` varchar(20)
,`email_apoderado` varchar(150)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_resumen_checkin`
-- (See below for the actual view)
--
CREATE TABLE `v_resumen_checkin` (
`atencion_id` int(10) unsigned
,`paciente_id` int(10) unsigned
,`paciente` varchar(201)
,`total_checkins` bigint(21)
,`promedio_estado` decimal(6,2)
,`promedio_estres` decimal(6,2)
,`promedio_sueno` decimal(6,2)
,`primer_checkin` datetime
,`ultimo_checkin` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_saldo_pacientes`
-- (See below for the actual view)
--
CREATE TABLE `v_saldo_pacientes` (
`paciente_id` int(10) unsigned
,`paciente` varchar(201)
,`total_cuentas` bigint(21)
,`total_facturado` decimal(32,2)
,`total_pagado` decimal(32,2)
,`saldo_total_pendiente` decimal(32,2)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_sesiones_planilla`
-- (See below for the actual view)
--
CREATE TABLE `v_sesiones_planilla` (
`sesion_id` int(10) unsigned
,`atencion_id` int(10) unsigned
,`numero_sesion` tinyint(3) unsigned
,`fecha_hora` datetime
,`modalidad_sesion` enum('presencial','virtual')
,`precio_sesion` decimal(10,2)
,`paciente_paquete_id` int(10) unsigned
,`profesional_id` int(10) unsigned
,`paciente_id` int(10) unsigned
,`subservicio` varchar(150)
,`paciente_nombre` varchar(201)
,`tipo_cobertura` varchar(8)
,`valor_sesion` decimal(10,2)
,`paquete_nombre` varchar(150)
,`cuenta_cobro_id` int(10) unsigned
,`monto_facturado` decimal(10,2)
,`monto_cobrado` decimal(10,2)
,`saldo_pendiente` decimal(10,2)
);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `adelantos_paciente`
--
ALTER TABLE `adelantos_paciente`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_adel_paciente` (`paciente_id`),
  ADD KEY `fk_adel_profesional` (`profesional_id`),
  ADD KEY `fk_adel_atencion` (`atencion_id`),
  ADD KEY `fk_adel_creador` (`created_by`);

--
-- Indexes for table `adelanto_sesion`
--
ALTER TABLE `adelanto_sesion`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_adelanto_sesion` (`adelanto_id`,`sesion_id`),
  ADD KEY `fk_as_sesion` (`sesion_id`);

--
-- Indexes for table `alertas`
--
ALTER TABLE `alertas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_alertas_profesional` (`profesional_id`,`estado`),
  ADD KEY `fk_alertas_atencion` (`atencion_id`),
  ADD KEY `fk_alertas_paciente` (`paciente_id`),
  ADD KEY `fk_alertas_regla` (`regla_id`),
  ADD KEY `fk_alertas_atendida` (`atendida_por`);

--
-- Indexes for table `apoderados`
--
ALTER TABLE `apoderados`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_apoderados_persona` (`persona_id`);

--
-- Indexes for table `apoderado_paciente`
--
ALTER TABLE `apoderado_paciente`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_apoderado_paciente` (`apoderado_id`,`paciente_id`),
  ADD KEY `fk_ap_paciente` (`paciente_id`);

--
-- Indexes for table `atenciones`
--
ALTER TABLE `atenciones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_atenciones_paciente` (`paciente_id`),
  ADD KEY `fk_atenciones_profesional` (`profesional_id`),
  ADD KEY `fk_atenciones_cita` (`cita_id`),
  ADD KEY `fk_atenciones_subservicio` (`subservicio_id`);

--
-- Indexes for table `atenciones_vinculadas`
--
ALTER TABLE `atenciones_vinculadas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_av_subservicio` (`subservicio_id`),
  ADD KEY `fk_av_profesional` (`profesional_id`),
  ADD KEY `fk_av_creador` (`created_by`);

--
-- Indexes for table `atencion_vinculo_detalle`
--
ALTER TABLE `atencion_vinculo_detalle`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_avd` (`vinculo_id`,`atencion_id`),
  ADD KEY `fk_avd_atencion` (`atencion_id`);

--
-- Indexes for table `checkin_emocional`
--
ALTER TABLE `checkin_emocional`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_checkin_paciente_fecha` (`paciente_id`,`fecha_hora`),
  ADD KEY `fk_checkin_atencion` (`atencion_id`);

--
-- Indexes for table `cie10`
--
ALTER TABLE `cie10`
  ADD PRIMARY KEY (`codigo`),
  ADD KEY `fk_cie10_padre` (`codigo_padre`);
ALTER TABLE `cie10` ADD FULLTEXT KEY `ft_cie10_descripcion` (`descripcion`,`descripcion_corta`);

--
-- Indexes for table `citas`
--
ALTER TABLE `citas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_citas_fecha` (`fecha_hora_inicio`),
  ADD KEY `idx_citas_profesional` (`profesional_id`,`fecha_hora_inicio`),
  ADD KEY `idx_citas_paciente` (`paciente_id`),
  ADD KEY `fk_citas_origen` (`cita_origen_id`),
  ADD KEY `fk_citas_subservicio` (`subservicio_id`),
  ADD KEY `fk_citas_creador` (`creado_por`),
  ADD KEY `fk_citas_atencion` (`atencion_id`);

--
-- Indexes for table `cuentas_cobro`
--
ALTER TABLE `cuentas_cobro`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_cc_paciente` (`paciente_id`),
  ADD KEY `fk_cc_vinculo` (`vinculo_id`),
  ADD KEY `fk_cc_atencion` (`atencion_id`),
  ADD KEY `fk_cc_taller` (`taller_id`),
  ADD KEY `fk_cc_sesion` (`sesion_id`),
  ADD KEY `fk_cc_cita` (`cita_id`);

--
-- Indexes for table `diagnosticos_atencion`
--
ALTER TABLE `diagnosticos_atencion`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_dx_atencion` (`atencion_id`),
  ADD KEY `fk_dx_cie10` (`cie10_codigo`),
  ADD KEY `fk_dx_registrador` (`registrado_por`);

--
-- Indexes for table `grupo_participantes_pago`
--
ALTER TABLE `grupo_participantes_pago`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_gpp` (`cuenta_cobro_id`,`paciente_id`),
  ADD KEY `fk_gpp_paciente` (`paciente_id`);

--
-- Indexes for table `historial_citas`
--
ALTER TABLE `historial_citas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_hc_cita` (`cita_id`),
  ADD KEY `fk_hc_usuario` (`registrado_por`);

--
-- Indexes for table `pacientes`
--
ALTER TABLE `pacientes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_pacientes_persona` (`persona_id`);

--
-- Indexes for table `paciente_paquetes`
--
ALTER TABLE `paciente_paquetes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_ppq_paquete` (`paquete_id`),
  ADD KEY `fk_ppq_paciente` (`paciente_id`),
  ADD KEY `fk_ppq_profesional` (`profesional_id`),
  ADD KEY `fk_ppq_cuenta` (`cuenta_cobro_id`),
  ADD KEY `fk_ppq_creador` (`created_by`);

--
-- Indexes for table `pagos_paciente`
--
ALTER TABLE `pagos_paciente`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_pp_cuenta` (`cuenta_cobro_id`),
  ADD KEY `fk_pp_paciente` (`pagado_por_paciente`),
  ADD KEY `fk_pp_apoderado` (`pagado_por_apoderado`),
  ADD KEY `fk_pp_registrador` (`registrado_por`);

--
-- Indexes for table `pagos_personal`
--
ALTER TABLE `pagos_personal`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_pagos_personal_planilla` (`planilla_id`),
  ADD KEY `fk_pagos_personal_registrador` (`registrado_por`);

--
-- Indexes for table `paquetes`
--
ALTER TABLE `paquetes`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `personas`
--
ALTER TABLE `personas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_personas_dni` (`dni`),
  ADD UNIQUE KEY `uq_personas_email` (`email`);

--
-- Indexes for table `planes_seguimiento`
--
ALTER TABLE `planes_seguimiento`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_plan_atencion` (`atencion_id`),
  ADD KEY `fk_ps_profesional` (`profesional_id`);

--
-- Indexes for table `planillas`
--
ALTER TABLE `planillas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_planillas_profesional` (`profesional_id`);

--
-- Indexes for table `planilla_conceptos`
--
ALTER TABLE `planilla_conceptos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_pc_planilla` (`planilla_id`),
  ADD KEY `fk_pc_sesion` (`sesion_id`),
  ADD KEY `fk_pc_taller_fecha` (`taller_fecha_id`);

--
-- Indexes for table `profesionales`
--
ALTER TABLE `profesionales`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_profesionales_persona` (`persona_id`),
  ADD UNIQUE KEY `uq_profesionales_colegiatura` (`colegiatura`);

--
-- Indexes for table `reglas_alerta`
--
ALTER TABLE `reglas_alerta`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_ra_plan` (`plan_id`);

--
-- Indexes for table `servicios`
--
ALTER TABLE `servicios`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `sesiones`
--
ALTER TABLE `sesiones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_sesiones_atencion` (`atencion_id`),
  ADD KEY `fk_ses_paquete` (`paciente_paquete_id`);

--
-- Indexes for table `sesiones_grupo`
--
ALTER TABLE `sesiones_grupo`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_sg_vinculo` (`vinculo_id`);

--
-- Indexes for table `sesion_archivos`
--
ALTER TABLE `sesion_archivos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_sa_sesion` (`sesion_id`),
  ADD KEY `fk_sa_sesion_grupo` (`sesion_grupo_id`),
  ADD KEY `fk_sa_subido_por` (`subido_por`);

--
-- Indexes for table `subservicios`
--
ALTER TABLE `subservicios`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_subservicios_servicio` (`servicio_id`);

--
-- Indexes for table `talleres_institucionales`
--
ALTER TABLE `talleres_institucionales`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_ti_profesional` (`profesional_id`),
  ADD KEY `fk_ti_subservicio` (`subservicio_id`),
  ADD KEY `fk_ti_creador` (`created_by`);

--
-- Indexes for table `taller_fechas`
--
ALTER TABLE `taller_fechas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_tf_taller` (`taller_id`);

--
-- Indexes for table `tareas`
--
ALTER TABLE `tareas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_tareas_sesion` (`sesion_id`),
  ADD KEY `fk_tareas_paciente` (`paciente_id`);

--
-- Indexes for table `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_usuarios_persona` (`persona_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `adelantos_paciente`
--
ALTER TABLE `adelantos_paciente`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `adelanto_sesion`
--
ALTER TABLE `adelanto_sesion`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `alertas`
--
ALTER TABLE `alertas`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `apoderados`
--
ALTER TABLE `apoderados`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `apoderado_paciente`
--
ALTER TABLE `apoderado_paciente`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `atenciones`
--
ALTER TABLE `atenciones`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `atenciones_vinculadas`
--
ALTER TABLE `atenciones_vinculadas`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `atencion_vinculo_detalle`
--
ALTER TABLE `atencion_vinculo_detalle`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `checkin_emocional`
--
ALTER TABLE `checkin_emocional`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `citas`
--
ALTER TABLE `citas`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `cuentas_cobro`
--
ALTER TABLE `cuentas_cobro`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `diagnosticos_atencion`
--
ALTER TABLE `diagnosticos_atencion`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `grupo_participantes_pago`
--
ALTER TABLE `grupo_participantes_pago`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `historial_citas`
--
ALTER TABLE `historial_citas`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pacientes`
--
ALTER TABLE `pacientes`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `paciente_paquetes`
--
ALTER TABLE `paciente_paquetes`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pagos_paciente`
--
ALTER TABLE `pagos_paciente`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pagos_personal`
--
ALTER TABLE `pagos_personal`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `paquetes`
--
ALTER TABLE `paquetes`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `personas`
--
ALTER TABLE `personas`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `planes_seguimiento`
--
ALTER TABLE `planes_seguimiento`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `planillas`
--
ALTER TABLE `planillas`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `planilla_conceptos`
--
ALTER TABLE `planilla_conceptos`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `profesionales`
--
ALTER TABLE `profesionales`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `reglas_alerta`
--
ALTER TABLE `reglas_alerta`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `servicios`
--
ALTER TABLE `servicios`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `sesiones`
--
ALTER TABLE `sesiones`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `sesiones_grupo`
--
ALTER TABLE `sesiones_grupo`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sesion_archivos`
--
ALTER TABLE `sesion_archivos`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `subservicios`
--
ALTER TABLE `subservicios`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `talleres_institucionales`
--
ALTER TABLE `talleres_institucionales`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `taller_fechas`
--
ALTER TABLE `taller_fechas`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tareas`
--
ALTER TABLE `tareas`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

-- --------------------------------------------------------

--
-- Structure for view `v_agenda_dia`
--
DROP TABLE IF EXISTS `v_agenda_dia`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_agenda_dia`  AS SELECT `ci`.`id` AS `cita_id`, `ci`.`fecha_hora_inicio` AS `fecha_hora_inicio`, `ci`.`estado` AS `estado`, `ci`.`tipo_cita` AS `tipo_cita`, `ci`.`modalidad_sesion` AS `modalidad_sesion`, `ci`.`precio_acordado` AS `precio_cita`, `ci`.`descuento_monto` AS `descuento_cita`, `ci`.`motivo_descuento` AS `motivo_descuento_cita`, concat(`pe_p`.`nombres`,' ',`pe_p`.`apellidos`) AS `paciente`, `pe_p`.`telefono` AS `telefono_paciente`, concat(`pe_a`.`nombres`,' ',`pe_a`.`apellidos`) AS `apoderado`, `pe_a`.`telefono` AS `telefono_apoderado`, concat(`pe_r`.`nombres`,' ',`pe_r`.`apellidos`) AS `profesional`, `ss`.`nombre` AS `subservicio`, `ss`.`modalidad` AS `modalidad`, `ss`.`duracion_min` AS `duracion_min`, `se`.`nombre` AS `servicio` FROM (((((((((`citas` `ci` join `pacientes` `p` on(`p`.`id` = `ci`.`paciente_id`)) join `personas` `pe_p` on(`pe_p`.`id` = `p`.`persona_id`)) join `profesionales` `pr` on(`pr`.`id` = `ci`.`profesional_id`)) join `personas` `pe_r` on(`pe_r`.`id` = `pr`.`persona_id`)) join `subservicios` `ss` on(`ss`.`id` = `ci`.`subservicio_id`)) join `servicios` `se` on(`se`.`id` = `ss`.`servicio_id`)) left join `apoderado_paciente` `ap` on(`ap`.`paciente_id` = `p`.`id` and `ap`.`es_contacto_principal` = 1)) left join `apoderados` `ao` on(`ao`.`id` = `ap`.`apoderado_id`)) left join `personas` `pe_a` on(`pe_a`.`id` = `ao`.`persona_id`)) WHERE `ci`.`estado` not in ('cancelada','reprogramada') ;

-- --------------------------------------------------------

--
-- Structure for view `v_historial_paciente`
--
DROP TABLE IF EXISTS `v_historial_paciente`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_historial_paciente`  AS SELECT `p`.`id` AS `paciente_id`, concat(`pe`.`nombres`,' ',`pe`.`apellidos`) AS `paciente`, `a`.`id` AS `atencion_id`, `a`.`fecha_inicio` AS `fecha_inicio`, `a`.`fecha_fin` AS `fecha_fin`, `a`.`estado` AS `estado_atencion`, `a`.`motivo_consulta` AS `motivo_consulta`, `a`.`grado_instruccion` AS `grado_instruccion_atencion`, `a`.`ocupacion` AS `ocupacion_atencion`, `a`.`estado_civil` AS `estado_civil_atencion`, `a`.`recomendaciones` AS `recomendaciones`, `ss`.`nombre` AS `subservicio`, `ss`.`modalidad` AS `modalidad`, concat(`pf`.`nombres`,' ',`pf`.`apellidos`) AS `profesional`, `s`.`id` AS `sesion_id`, `s`.`numero_sesion` AS `numero_sesion`, `s`.`fecha_hora` AS `fecha_sesion`, `s`.`modalidad_sesion` AS `modalidad_sesion`, `s`.`precio_sesion` AS `precio_sesion`, `s`.`nota_clinica` AS `nota_clinica`, `d`.`cie10_codigo` AS `cie10_codigo`, `c`.`descripcion_corta` AS `diagnostico` FROM ((((((((`pacientes` `p` join `personas` `pe` on(`pe`.`id` = `p`.`persona_id`)) join `atenciones` `a` on(`a`.`paciente_id` = `p`.`id`)) join `subservicios` `ss` on(`ss`.`id` = `a`.`subservicio_id`)) join `profesionales` `pr` on(`pr`.`id` = `a`.`profesional_id`)) join `personas` `pf` on(`pf`.`id` = `pr`.`persona_id`)) left join `sesiones` `s` on(`s`.`atencion_id` = `a`.`id`)) left join `diagnosticos_atencion` `d` on(`d`.`atencion_id` = `a`.`id` and `d`.`jerarquia` = 'principal' and `d`.`nivel_certeza` in ('definitivo','presuntivo'))) left join `cie10` `c` on(`c`.`codigo` = `d`.`cie10_codigo`)) WHERE `ss`.`modalidad` = 'individual'union all select `p`.`id` AS `paciente_id`,concat(`pe`.`nombres`,' ',`pe`.`apellidos`) AS `paciente`,`a`.`id` AS `atencion_id`,`a`.`fecha_inicio` AS `fecha_inicio`,`a`.`fecha_fin` AS `fecha_fin`,`a`.`estado` AS `estado_atencion`,`a`.`motivo_consulta` AS `motivo_consulta`,`a`.`grado_instruccion` AS `grado_instruccion_atencion`,`a`.`ocupacion` AS `ocupacion_atencion`,`a`.`estado_civil` AS `estado_civil_atencion`,`a`.`recomendaciones` AS `recomendaciones`,`ss`.`nombre` AS `subservicio`,`ss`.`modalidad` AS `modalidad`,concat(`pf`.`nombres`,' ',`pf`.`apellidos`) AS `profesional`,`sg`.`id` AS `sesion_id`,`sg`.`numero_sesion` AS `numero_sesion`,`sg`.`fecha_hora` AS `fecha_sesion`,'presencial' AS `modalidad_sesion`,NULL AS `precio_sesion`,`sg`.`nota_clinica_compartida` AS `nota_clinica`,`d`.`cie10_codigo` AS `cie10_codigo`,`c`.`descripcion_corta` AS `diagnostico` from ((((((((((`pacientes` `p` join `personas` `pe` on(`pe`.`id` = `p`.`persona_id`)) join `atenciones` `a` on(`a`.`paciente_id` = `p`.`id`)) join `subservicios` `ss` on(`ss`.`id` = `a`.`subservicio_id`)) join `profesionales` `pr` on(`pr`.`id` = `a`.`profesional_id`)) join `personas` `pf` on(`pf`.`id` = `pr`.`persona_id`)) join `atencion_vinculo_detalle` `avd` on(`avd`.`atencion_id` = `a`.`id`)) join `atenciones_vinculadas` `av` on(`av`.`id` = `avd`.`vinculo_id`)) left join `sesiones_grupo` `sg` on(`sg`.`vinculo_id` = `av`.`id`)) left join `diagnosticos_atencion` `d` on(`d`.`atencion_id` = `a`.`id` and `d`.`jerarquia` = 'principal' and `d`.`nivel_certeza` in ('definitivo','presuntivo'))) left join `cie10` `c` on(`c`.`codigo` = `d`.`cie10_codigo`)) where `ss`.`modalidad` in ('pareja','familiar','grupal')  ;

-- --------------------------------------------------------

--
-- Structure for view `v_pacientes_apoderados`
--
DROP TABLE IF EXISTS `v_pacientes_apoderados`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_pacientes_apoderados`  AS SELECT `p`.`id` AS `paciente_id`, concat(`pe_p`.`nombres`,' ',`pe_p`.`apellidos`) AS `paciente`, `pe_p`.`fecha_nacimiento` AS `fecha_nacimiento`, timestampdiff(YEAR,`pe_p`.`fecha_nacimiento`,curdate()) AS `edad`, `ap`.`parentesco` AS `parentesco`, `ap`.`es_contacto_principal` AS `es_contacto_principal`, `ap`.`es_responsable_pago` AS `es_responsable_pago`, `ap`.`puede_ver_historial` AS `puede_ver_historial`, concat(`pe_a`.`nombres`,' ',`pe_a`.`apellidos`) AS `apoderado`, `pe_a`.`telefono` AS `telefono_apoderado`, `pe_a`.`email` AS `email_apoderado` FROM ((((`pacientes` `p` join `personas` `pe_p` on(`pe_p`.`id` = `p`.`persona_id`)) left join `apoderado_paciente` `ap` on(`ap`.`paciente_id` = `p`.`id`)) left join `apoderados` `ao` on(`ao`.`id` = `ap`.`apoderado_id`)) left join `personas` `pe_a` on(`pe_a`.`id` = `ao`.`persona_id`)) ORDER BY `p`.`id` ASC, `ap`.`es_contacto_principal` DESC ;

-- --------------------------------------------------------

--
-- Structure for view `v_resumen_checkin`
--
DROP TABLE IF EXISTS `v_resumen_checkin`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_resumen_checkin`  AS SELECT `ce`.`atencion_id` AS `atencion_id`, `ce`.`paciente_id` AS `paciente_id`, concat(`pe`.`nombres`,' ',`pe`.`apellidos`) AS `paciente`, count(0) AS `total_checkins`, round(avg(`ce`.`como_te_sientes`),2) AS `promedio_estado`, round(avg(`ce`.`nivel_estres`),2) AS `promedio_estres`, round(avg(`ce`.`dormiste_bien`),2) AS `promedio_sueno`, min(`ce`.`fecha_hora`) AS `primer_checkin`, max(`ce`.`fecha_hora`) AS `ultimo_checkin` FROM ((`checkin_emocional` `ce` join `pacientes` `p` on(`p`.`id` = `ce`.`paciente_id`)) join `personas` `pe` on(`pe`.`id` = `p`.`persona_id`)) GROUP BY `ce`.`atencion_id`, `ce`.`paciente_id`, `pe`.`nombres`, `pe`.`apellidos` ;

-- --------------------------------------------------------

--
-- Structure for view `v_saldo_pacientes`
--
DROP TABLE IF EXISTS `v_saldo_pacientes`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_saldo_pacientes`  AS SELECT `p`.`id` AS `paciente_id`, concat(`pe`.`nombres`,' ',`pe`.`apellidos`) AS `paciente`, count(`cc`.`id`) AS `total_cuentas`, sum(`cc`.`monto_total`) AS `total_facturado`, sum(`cc`.`monto_pagado`) AS `total_pagado`, sum(`cc`.`saldo_pendiente`) AS `saldo_total_pendiente` FROM ((`pacientes` `p` join `personas` `pe` on(`pe`.`id` = `p`.`persona_id`)) left join `cuentas_cobro` `cc` on(`cc`.`paciente_id` = `p`.`id` and `cc`.`estado` <> 'anulado')) GROUP BY `p`.`id`, `pe`.`nombres`, `pe`.`apellidos` ;

-- --------------------------------------------------------

--
-- Structure for view `v_sesiones_planilla`
--
DROP TABLE IF EXISTS `v_sesiones_planilla`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_sesiones_planilla`  AS SELECT `s`.`id` AS `sesion_id`, `s`.`atencion_id` AS `atencion_id`, `s`.`numero_sesion` AS `numero_sesion`, `s`.`fecha_hora` AS `fecha_hora`, `s`.`modalidad_sesion` AS `modalidad_sesion`, `s`.`precio_sesion` AS `precio_sesion`, `s`.`paciente_paquete_id` AS `paciente_paquete_id`, `a`.`profesional_id` AS `profesional_id`, `a`.`paciente_id` AS `paciente_id`, `ss`.`nombre` AS `subservicio`, concat(`pe`.`nombres`,' ',`pe`.`apellidos`) AS `paciente_nombre`, CASE WHEN `s`.`paciente_paquete_id` is not null THEN 'paquete' WHEN `ads`.`sesion_id` is not null THEN 'adelanto' ELSE 'directo' END AS `tipo_cobertura`, coalesce(`s`.`precio_sesion`,0) AS `valor_sesion`, `pk`.`nombre` AS `paquete_nombre`, `cc`.`id` AS `cuenta_cobro_id`, coalesce(`cc`.`monto_total`,0) AS `monto_facturado`, coalesce(`cc`.`monto_pagado`,0) AS `monto_cobrado`, coalesce(`cc`.`saldo_pendiente`,0) AS `saldo_pendiente` FROM ((((((((`sesiones` `s` join `atenciones` `a` on(`a`.`id` = `s`.`atencion_id`)) join `subservicios` `ss` on(`ss`.`id` = `a`.`subservicio_id`)) join `pacientes` `p` on(`p`.`id` = `a`.`paciente_id`)) join `personas` `pe` on(`pe`.`id` = `p`.`persona_id`)) left join `cuentas_cobro` `cc` on(`cc`.`sesion_id` = `s`.`id`)) left join `paciente_paquetes` `pp` on(`pp`.`id` = `s`.`paciente_paquete_id`)) left join `paquetes` `pk` on(`pk`.`id` = `pp`.`paquete_id`)) left join `adelanto_sesion` `ads` on(`ads`.`sesion_id` = `s`.`id`)) ;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `adelantos_paciente`
--
ALTER TABLE `adelantos_paciente`
  ADD CONSTRAINT `fk_adel_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`),
  ADD CONSTRAINT `fk_adel_creador` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  ADD CONSTRAINT `fk_adel_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`),
  ADD CONSTRAINT `fk_adel_profesional` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`);

--
-- Constraints for table `adelanto_sesion`
--
ALTER TABLE `adelanto_sesion`
  ADD CONSTRAINT `fk_as_adelanto` FOREIGN KEY (`adelanto_id`) REFERENCES `adelantos_paciente` (`id`),
  ADD CONSTRAINT `fk_as_sesion` FOREIGN KEY (`sesion_id`) REFERENCES `sesiones` (`id`);

--
-- Constraints for table `alertas`
--
ALTER TABLE `alertas`
  ADD CONSTRAINT `fk_alertas_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`),
  ADD CONSTRAINT `fk_alertas_atendida` FOREIGN KEY (`atendida_por`) REFERENCES `usuarios` (`id`),
  ADD CONSTRAINT `fk_alertas_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`),
  ADD CONSTRAINT `fk_alertas_profesional` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`),
  ADD CONSTRAINT `fk_alertas_regla` FOREIGN KEY (`regla_id`) REFERENCES `reglas_alerta` (`id`);

--
-- Constraints for table `apoderados`
--
ALTER TABLE `apoderados`
  ADD CONSTRAINT `fk_apoderados_persona` FOREIGN KEY (`persona_id`) REFERENCES `personas` (`id`);

--
-- Constraints for table `apoderado_paciente`
--
ALTER TABLE `apoderado_paciente`
  ADD CONSTRAINT `fk_ap_apoderado` FOREIGN KEY (`apoderado_id`) REFERENCES `apoderados` (`id`),
  ADD CONSTRAINT `fk_ap_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`);

--
-- Constraints for table `atenciones`
--
ALTER TABLE `atenciones`
  ADD CONSTRAINT `fk_atenciones_cita` FOREIGN KEY (`cita_id`) REFERENCES `citas` (`id`),
  ADD CONSTRAINT `fk_atenciones_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`),
  ADD CONSTRAINT `fk_atenciones_profesional` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`),
  ADD CONSTRAINT `fk_atenciones_subservicio` FOREIGN KEY (`subservicio_id`) REFERENCES `subservicios` (`id`);

--
-- Constraints for table `atenciones_vinculadas`
--
ALTER TABLE `atenciones_vinculadas`
  ADD CONSTRAINT `fk_av_creador` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  ADD CONSTRAINT `fk_av_profesional` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`),
  ADD CONSTRAINT `fk_av_subservicio` FOREIGN KEY (`subservicio_id`) REFERENCES `subservicios` (`id`);

--
-- Constraints for table `atencion_vinculo_detalle`
--
ALTER TABLE `atencion_vinculo_detalle`
  ADD CONSTRAINT `fk_avd_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`),
  ADD CONSTRAINT `fk_avd_vinculo` FOREIGN KEY (`vinculo_id`) REFERENCES `atenciones_vinculadas` (`id`);

--
-- Constraints for table `checkin_emocional`
--
ALTER TABLE `checkin_emocional`
  ADD CONSTRAINT `fk_checkin_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`),
  ADD CONSTRAINT `fk_checkin_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`);

--
-- Constraints for table `cie10`
--
ALTER TABLE `cie10`
  ADD CONSTRAINT `fk_cie10_padre` FOREIGN KEY (`codigo_padre`) REFERENCES `cie10` (`codigo`);

--
-- Constraints for table `citas`
--
ALTER TABLE `citas`
  ADD CONSTRAINT `fk_citas_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`),
  ADD CONSTRAINT `fk_citas_creador` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`),
  ADD CONSTRAINT `fk_citas_origen` FOREIGN KEY (`cita_origen_id`) REFERENCES `citas` (`id`),
  ADD CONSTRAINT `fk_citas_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`),
  ADD CONSTRAINT `fk_citas_profesional` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`),
  ADD CONSTRAINT `fk_citas_subservicio` FOREIGN KEY (`subservicio_id`) REFERENCES `subservicios` (`id`);

--
-- Constraints for table `cuentas_cobro`
--
ALTER TABLE `cuentas_cobro`
  ADD CONSTRAINT `fk_cc_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`),
  ADD CONSTRAINT `fk_cc_cita` FOREIGN KEY (`cita_id`) REFERENCES `citas` (`id`),
  ADD CONSTRAINT `fk_cc_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`),
  ADD CONSTRAINT `fk_cc_sesion` FOREIGN KEY (`sesion_id`) REFERENCES `sesiones` (`id`),
  ADD CONSTRAINT `fk_cc_taller` FOREIGN KEY (`taller_id`) REFERENCES `talleres_institucionales` (`id`),
  ADD CONSTRAINT `fk_cc_vinculo` FOREIGN KEY (`vinculo_id`) REFERENCES `atenciones_vinculadas` (`id`);

--
-- Constraints for table `diagnosticos_atencion`
--
ALTER TABLE `diagnosticos_atencion`
  ADD CONSTRAINT `fk_dx_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`),
  ADD CONSTRAINT `fk_dx_cie10` FOREIGN KEY (`cie10_codigo`) REFERENCES `cie10` (`codigo`),
  ADD CONSTRAINT `fk_dx_registrador` FOREIGN KEY (`registrado_por`) REFERENCES `usuarios` (`id`);

--
-- Constraints for table `grupo_participantes_pago`
--
ALTER TABLE `grupo_participantes_pago`
  ADD CONSTRAINT `fk_gpp_cuenta` FOREIGN KEY (`cuenta_cobro_id`) REFERENCES `cuentas_cobro` (`id`),
  ADD CONSTRAINT `fk_gpp_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`);

--
-- Constraints for table `historial_citas`
--
ALTER TABLE `historial_citas`
  ADD CONSTRAINT `fk_hc_cita` FOREIGN KEY (`cita_id`) REFERENCES `citas` (`id`),
  ADD CONSTRAINT `fk_hc_usuario` FOREIGN KEY (`registrado_por`) REFERENCES `usuarios` (`id`);

--
-- Constraints for table `pacientes`
--
ALTER TABLE `pacientes`
  ADD CONSTRAINT `fk_pacientes_persona` FOREIGN KEY (`persona_id`) REFERENCES `personas` (`id`);

--
-- Constraints for table `paciente_paquetes`
--
ALTER TABLE `paciente_paquetes`
  ADD CONSTRAINT `fk_ppq_creador` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  ADD CONSTRAINT `fk_ppq_cuenta` FOREIGN KEY (`cuenta_cobro_id`) REFERENCES `cuentas_cobro` (`id`),
  ADD CONSTRAINT `fk_ppq_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`),
  ADD CONSTRAINT `fk_ppq_paquete` FOREIGN KEY (`paquete_id`) REFERENCES `paquetes` (`id`),
  ADD CONSTRAINT `fk_ppq_profesional` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`);

--
-- Constraints for table `pagos_paciente`
--
ALTER TABLE `pagos_paciente`
  ADD CONSTRAINT `fk_pp_apoderado` FOREIGN KEY (`pagado_por_apoderado`) REFERENCES `apoderados` (`id`),
  ADD CONSTRAINT `fk_pp_cuenta` FOREIGN KEY (`cuenta_cobro_id`) REFERENCES `cuentas_cobro` (`id`),
  ADD CONSTRAINT `fk_pp_paciente` FOREIGN KEY (`pagado_por_paciente`) REFERENCES `pacientes` (`id`),
  ADD CONSTRAINT `fk_pp_registrador` FOREIGN KEY (`registrado_por`) REFERENCES `usuarios` (`id`);

--
-- Constraints for table `pagos_personal`
--
ALTER TABLE `pagos_personal`
  ADD CONSTRAINT `fk_pagos_personal_planilla` FOREIGN KEY (`planilla_id`) REFERENCES `planillas` (`id`),
  ADD CONSTRAINT `fk_pagos_personal_registrador` FOREIGN KEY (`registrado_por`) REFERENCES `usuarios` (`id`);

--
-- Constraints for table `planes_seguimiento`
--
ALTER TABLE `planes_seguimiento`
  ADD CONSTRAINT `fk_ps_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`),
  ADD CONSTRAINT `fk_ps_profesional` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`);

--
-- Constraints for table `planillas`
--
ALTER TABLE `planillas`
  ADD CONSTRAINT `fk_planillas_profesional` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`);

--
-- Constraints for table `planilla_conceptos`
--
ALTER TABLE `planilla_conceptos`
  ADD CONSTRAINT `fk_pc_planilla` FOREIGN KEY (`planilla_id`) REFERENCES `planillas` (`id`),
  ADD CONSTRAINT `fk_pc_sesion` FOREIGN KEY (`sesion_id`) REFERENCES `sesiones` (`id`),
  ADD CONSTRAINT `fk_pc_taller_fecha` FOREIGN KEY (`taller_fecha_id`) REFERENCES `taller_fechas` (`id`);

--
-- Constraints for table `profesionales`
--
ALTER TABLE `profesionales`
  ADD CONSTRAINT `fk_profesionales_persona` FOREIGN KEY (`persona_id`) REFERENCES `personas` (`id`);

--
-- Constraints for table `reglas_alerta`
--
ALTER TABLE `reglas_alerta`
  ADD CONSTRAINT `fk_ra_plan` FOREIGN KEY (`plan_id`) REFERENCES `planes_seguimiento` (`id`);

--
-- Constraints for table `sesiones`
--
ALTER TABLE `sesiones`
  ADD CONSTRAINT `fk_ses_paquete` FOREIGN KEY (`paciente_paquete_id`) REFERENCES `paciente_paquetes` (`id`),
  ADD CONSTRAINT `fk_sesiones_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`);

--
-- Constraints for table `sesiones_grupo`
--
ALTER TABLE `sesiones_grupo`
  ADD CONSTRAINT `fk_sg_vinculo` FOREIGN KEY (`vinculo_id`) REFERENCES `atenciones_vinculadas` (`id`);

--
-- Constraints for table `sesion_archivos`
--
ALTER TABLE `sesion_archivos`
  ADD CONSTRAINT `fk_sa_sesion` FOREIGN KEY (`sesion_id`) REFERENCES `sesiones` (`id`),
  ADD CONSTRAINT `fk_sa_sesion_grupo` FOREIGN KEY (`sesion_grupo_id`) REFERENCES `sesiones_grupo` (`id`),
  ADD CONSTRAINT `fk_sa_subido_por` FOREIGN KEY (`subido_por`) REFERENCES `usuarios` (`id`);

--
-- Constraints for table `subservicios`
--
ALTER TABLE `subservicios`
  ADD CONSTRAINT `fk_subservicios_servicio` FOREIGN KEY (`servicio_id`) REFERENCES `servicios` (`id`);

--
-- Constraints for table `talleres_institucionales`
--
ALTER TABLE `talleres_institucionales`
  ADD CONSTRAINT `fk_ti_creador` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  ADD CONSTRAINT `fk_ti_profesional` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`),
  ADD CONSTRAINT `fk_ti_subservicio` FOREIGN KEY (`subservicio_id`) REFERENCES `subservicios` (`id`);

--
-- Constraints for table `taller_fechas`
--
ALTER TABLE `taller_fechas`
  ADD CONSTRAINT `fk_tf_taller` FOREIGN KEY (`taller_id`) REFERENCES `talleres_institucionales` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `tareas`
--
ALTER TABLE `tareas`
  ADD CONSTRAINT `fk_tareas_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`),
  ADD CONSTRAINT `fk_tareas_sesion` FOREIGN KEY (`sesion_id`) REFERENCES `sesiones` (`id`);

--
-- Constraints for table `usuarios`
--
ALTER TABLE `usuarios`
  ADD CONSTRAINT `fk_usuarios_persona` FOREIGN KEY (`persona_id`) REFERENCES `personas` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
