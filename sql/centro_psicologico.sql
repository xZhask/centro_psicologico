-- phpMyAdmin SQL Dump
-- version 6.0.0-dev+20260324.466df794d2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Apr 18, 2026 at 04:51 AM
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
(1, 3, 3, 2, 3, 'tarea_pendiente', 'moderada', 'Roberto no completó tarea psicológica en 2 sesiones consecutivas.', 'atendida', 'Se conversó con el paciente. Ajustó la tarea a una versión más simple.', 2, '2026-04-15 06:14:58', '2026-03-05 15:00:00'),
(2, 9, 9, 3, 7, 'sin_respuesta', 'alta', 'Diego no ha realizado check-in en 8 días. Última sesión con indicadores preocupantes.', 'activa', NULL, NULL, '2026-04-15 06:14:58', NULL),
(3, 9, 9, 3, 8, 'riesgo_emocional', 'moderada', 'Nivel de estrés ≥ 7 en los tres últimos check-ins registrados.', 'activa', NULL, NULL, '2026-04-15 06:14:58', NULL);

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

--
-- Dumping data for table `apoderados`
--

INSERT INTO `apoderados` (`id`, `persona_id`, `activo`, `created_at`, `updated_at`) VALUES
(1, 14, 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(2, 15, 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(3, 16, 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27');

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

--
-- Dumping data for table `apoderado_paciente`
--

INSERT INTO `apoderado_paciente` (`id`, `apoderado_id`, `paciente_id`, `parentesco`, `es_contacto_principal`, `es_responsable_pago`, `puede_ver_historial`, `notas`) VALUES
(1, 1, 7, 'madre', 1, 1, 1, NULL),
(2, 2, 8, 'padre', 1, 1, 1, NULL),
(3, 3, 9, 'madre', 1, 1, 1, NULL);

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
  `precio_acordado` decimal(10,2) DEFAULT NULL COMMENT 'Monto final pactado con el paciente',
  `descuento_monto` decimal(10,2) NOT NULL DEFAULT 0.00,
  `descuento_pct` decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Porcentaje referencial para mostrar en pantalla',
  `motivo_descuento` varchar(200) DEFAULT NULL,
  `precio_final` decimal(10,2) GENERATED ALWAYS AS (coalesce(`precio_acordado`,0) - `descuento_monto`) STORED,
  `grado_instruccion` enum('sin_instruccion','primaria_incompleta','primaria_completa','secundaria_incompleta','secundaria_completa','tecnico_incompleto','tecnico_completo','superior_incompleto','superior_completo','posgrado','no_especificado') DEFAULT 'no_especificado',
  `ocupacion` varchar(150) DEFAULT NULL,
  `estado_civil` enum('soltero','casado','conviviente','divorciado','separado','viudo','no_especificado') DEFAULT 'no_especificado',
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

INSERT INTO `atenciones` (`id`, `paciente_id`, `profesional_id`, `cita_id`, `subservicio_id`, `precio_acordado`, `descuento_monto`, `descuento_pct`, `motivo_descuento`, `grado_instruccion`, `ocupacion`, `estado_civil`, `motivo_consulta`, `observacion_general`, `observacion_conducta`, `antecedentes_relevantes`, `recomendaciones`, `fecha_inicio`, `fecha_fin`, `estado`, `numero_sesiones_plan`, `created_at`, `updated_at`) VALUES
(1, 1, 2, 1, 4, 90.00, 0.00, 0.00, NULL, 'superior_completo', 'Ingeniero de sistemas', 'soltero', 'Dificultades para manejar el estrés laboral y problemas para conciliar el sueño.', 'Paciente colaborador, orientado en tiempo y espacio. Aspecto cuidado.', 'Lenguaje fluido, coherente. Contacto visual adecuado. Leve tensión muscular observable.', 'Sin antecedentes psiquiátricos. Refiere estrés crónico desde hace 8 meses por cambio de proyecto.', 'Se recomienda iniciar proceso terapéutico enfocado en manejo del estrés y técnicas de relajación.', '2026-01-08', '2026-01-08', 'completada', 1, '2026-04-15 06:14:57', '2026-04-15 06:14:57'),
(2, 2, 2, 2, 5, 110.00, 10.00, 9.09, 'Descuento por derivación interna', 'superior_completo', 'Docente universitaria', 'casado', 'Estado de ánimo deprimido persistente, pérdida de interés en actividades que antes disfrutaba, fatiga constante.', 'Paciente con apariencia cansada, vestimenta adecuada. Refiere llanto frecuente durante la semana.', 'Discurso lento, pausado. Afecto aplanado. Mantiene contacto visual pero con expresión de tristeza.', 'Episodio depresivo leve previo en 2020 tratado con psicoterapia breve. Remisión completa. Recaída actual desde noviembre 2025.', NULL, '2026-01-10', NULL, 'activa', 12, '2026-04-15 06:14:57', '2026-04-15 06:14:57'),
(3, 3, 2, 3, 5, 110.00, 0.00, 0.00, NULL, 'tecnico_completo', 'Técnico electricista', 'divorciado', 'Dificultades en el control de impulsos, irritabilidad y conflictos interpersonales frecuentes.', 'Paciente puntual, aspecto descuidado. Refiere noches sin dormir bien.', 'Lenguaje directo, tono elevado en momentos. Muestra resistencia inicial al proceso.', 'Antecedente de consumo problemático de alcohol. Abstinente hace 14 meses. Divorcio hace 2 años.', NULL, '2026-01-12', NULL, 'activa', 16, '2026-04-15 06:14:57', '2026-04-15 06:14:57'),
(4, 4, 3, 4, 5, 110.00, 0.00, 0.00, NULL, 'superior_incompleto', 'Estudiante universitaria', 'soltero', 'Crisis de ansiedad recurrentes, dificultad para asistir a clases, pensamientos rumiativos.', 'Paciente joven, aspecto prolijo. Refiere nerviosismo durante la entrevista.', 'Habla rápida, voz entrecortada en momentos. Se muestra ansiosa pero colaboradora.', 'Trastorno de ansiedad generalizada diagnosticado en 2022. Abandonó tratamiento farmacológico hace 6 meses.', NULL, '2026-01-14', NULL, 'activa', 12, '2026-04-15 06:14:57', '2026-04-15 06:14:57'),
(5, 5, 3, 5, 7, 130.00, 0.00, 0.00, NULL, 'superior_completo', 'Administrador de empresas', 'casado', 'Conflictos de comunicación recurrentes, distanciamiento emocional y dificultades en la intimidad.', 'Pareja que acude por iniciativa mutua. Ambos muestran disposición al proceso.', 'Miguel se muestra más reservado; Carmen toma la iniciativa en la narración.', 'Cinco años de matrimonio. Sin hijos. Conflictos se intensificaron tras cambio laboral de Miguel.', NULL, '2026-01-16', NULL, 'activa', 12, '2026-04-15 06:14:57', '2026-04-15 06:14:57'),
(6, 6, 3, NULL, 7, 130.00, 0.00, 0.00, NULL, 'superior_completo', 'Contadora', 'casado', 'Conflictos de comunicación recurrentes, distanciamiento emocional y dificultades en la intimidad.', 'Participante activa, expresa con facilidad sus emociones.', 'Afecto visible, llanto breve al inicio. Lenguaje fluido y ordenado.', 'Sin antecedentes psicológicos previos.', NULL, '2026-01-16', NULL, 'activa', 12, '2026-04-15 06:14:57', '2026-04-15 06:14:57'),
(7, 7, 1, 6, 2, 100.00, 10.00, 10.00, 'Descuento familiar', 'primaria_incompleta', 'Estudiante', 'no_especificado', 'Dificultades de atención y concentración en el aula. Impulsividad reportada por docentes y padres.', 'Niño activo, curioso. Dificultad para permanecer sentado durante la sesión.', 'Habla con entusiasmo, cambia de tema frecuentemente. Responde bien al juego estructurado.', 'Dificultades de atención desde los 5 años. Evaluación psicopedagógica pendiente.', NULL, '2026-01-18', NULL, 'activa', 16, '2026-04-15 06:14:57', '2026-04-15 06:14:57'),
(8, 8, 1, 7, 2, 100.00, 10.00, 10.00, 'Descuento familiar', 'primaria_incompleta', 'Estudiante', 'no_especificado', 'Mutismo selectivo en contextos escolares. Habla con fluidez en casa.', 'Niña tímida inicialmente. Con el tiempo mostró mayor apertura a través del juego.', 'Comunicación no verbal predominante en primera sesión. Sonríe con facilidad.', 'Episodio de mutismo en jardín. Actualmente habla con familiares cercanos pero no con maestros.', NULL, '2026-01-20', NULL, 'activa', 20, '2026-04-15 06:14:57', '2026-04-15 06:14:57'),
(9, 9, 3, 8, 3, 100.00, 0.00, 0.00, NULL, 'primaria_completa', 'Estudiante', 'no_especificado', 'Bajo rendimiento escolar, desmotivación, conflictos con pares y figuras de autoridad.', 'Adolescente que acude con resistencia inicial (traído por madre). Aspecto descuidado.', 'Respuestas cortas al inicio. Lenguaje coloquial. Mayor apertura al hablar de intereses personales.', 'Posible TDAH no diagnosticado. Repitió segundo de primaria.', NULL, '2026-01-22', NULL, 'activa', 16, '2026-04-15 06:14:57', '2026-04-15 06:14:57');

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

--
-- Dumping data for table `atenciones_vinculadas`
--

INSERT INTO `atenciones_vinculadas` (`id`, `nombre_grupo`, `tipo_vinculo`, `subservicio_id`, `profesional_id`, `fecha_inicio`, `fecha_fin`, `estado`, `created_by`, `created_at`) VALUES
(1, 'Terapia de Pareja — Castro Navarro', 'pareja', 7, 2, '2026-01-16', NULL, 'activo', 1, '2026-04-15 06:14:57');

-- --------------------------------------------------------

--
-- Table structure for table `atencion_vinculo_detalle`
--

CREATE TABLE `atencion_vinculo_detalle` (
  `id` int(10) UNSIGNED NOT NULL,
  `vinculo_id` int(10) UNSIGNED NOT NULL,
  `atencion_id` int(10) UNSIGNED NOT NULL,
  `rol_en_grupo` enum('consultante','acompanante','familiar','participante') NOT NULL DEFAULT 'participante',
  `es_responsable_pago` tinyint(1) NOT NULL DEFAULT 0,
  `precio_cuota` decimal(10,2) DEFAULT NULL,
  `descuento_monto` decimal(10,2) NOT NULL DEFAULT 0.00,
  `motivo_descuento` varchar(200) DEFAULT NULL,
  `precio_final` decimal(10,2) GENERATED ALWAYS AS (coalesce(`precio_cuota`,0) - `descuento_monto`) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `atencion_vinculo_detalle`
--

INSERT INTO `atencion_vinculo_detalle` (`id`, `vinculo_id`, `atencion_id`, `rol_en_grupo`, `es_responsable_pago`, `precio_cuota`, `descuento_monto`, `motivo_descuento`) VALUES
(1, 1, 5, 'consultante', 1, NULL, 0.00, NULL),
(2, 1, 6, 'consultante', 0, NULL, 0.00, NULL);

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

--
-- Dumping data for table `checkin_emocional`
--

INSERT INTO `checkin_emocional` (`id`, `paciente_id`, `atencion_id`, `fecha_hora`, `como_te_sientes`, `dormiste_bien`, `nivel_estres`, `hiciste_tarea`, `nota_opcional`, `created_at`) VALUES
(1, 2, 2, '2026-02-15 08:30:00', 4, 5, 7, 1, 'Semana difícil pero puse en práctica lo de los pensamientos.', '2026-04-15 06:14:58'),
(2, 2, 2, '2026-02-22 09:00:00', 5, 6, 6, 1, NULL, '2026-04-15 06:14:58'),
(3, 2, 2, '2026-03-01 08:45:00', 6, 7, 5, 1, 'Me siento un poco mejor. Las caminatas ayudan.', '2026-04-15 06:14:58'),
(4, 2, 2, '2026-03-08 09:15:00', 7, 7, 4, 1, NULL, '2026-04-15 06:14:58'),
(5, 2, 2, '2026-03-15 08:30:00', 7, 8, 3, 1, 'Dormí bien toda la semana. Primera vez en meses.', '2026-04-15 06:14:58'),
(6, 2, 2, '2026-03-22 09:00:00', 8, 8, 3, 1, 'Me siento mucho mejor. Volví a disfrutar el trabajo.', '2026-04-15 06:14:58'),
(7, 3, 3, '2026-02-10 20:00:00', 4, 4, 8, 1, 'Semana tensa. Discutí con un compañero.', '2026-04-15 06:14:58'),
(8, 3, 3, '2026-02-17 20:30:00', 5, 5, 7, 1, NULL, '2026-04-15 06:14:58'),
(9, 3, 3, '2026-02-24 21:00:00', 4, 4, 9, 0, 'No pude hacer el diario esta semana. Mucho trabajo.', '2026-04-15 06:14:58'),
(10, 3, 3, '2026-03-03 20:00:00', 6, 6, 6, 1, 'La técnica asertiva funcionó hoy con mi jefe.', '2026-04-15 06:14:58'),
(11, 3, 3, '2026-03-10 20:30:00', 6, 7, 5, 1, NULL, '2026-04-15 06:14:58'),
(12, 3, 3, '2026-03-17 20:00:00', 7, 7, 5, 1, 'Semana tranquila. Logré no explotar en dos situaciones.', '2026-04-15 06:14:58'),
(13, 4, 4, '2026-02-12 07:30:00', 3, 4, 9, 1, 'Mañana tengo que ir a Estadística. No puedo dormir pensando en eso.', '2026-04-15 06:14:58'),
(14, 4, 4, '2026-02-15 08:00:00', 7, 7, 5, 1, 'Fui a la clase ayer. No lo puedo creer. Lloré de alegría en casa.', '2026-04-15 06:14:58'),
(15, 4, 4, '2026-02-19 08:30:00', 6, 6, 6, 1, NULL, '2026-04-15 06:14:58'),
(16, 4, 4, '2026-02-26 07:45:00', 6, 7, 5, 1, 'Esta semana asistí a todas mis clases.', '2026-04-15 06:14:58'),
(17, 4, 4, '2026-03-05 08:00:00', 7, 7, 4, 1, NULL, '2026-04-15 06:14:58'),
(18, 4, 4, '2026-03-12 08:30:00', 7, 8, 4, 1, 'Exposición a grupo de estudio realizada. Ansiedad controlable.', '2026-04-15 06:14:58'),
(19, 7, 7, '2026-02-10 17:00:00', 7, 8, 3, 1, 'Hoy terminé la tarea sin parar. Mamá me dio una ficha.', '2026-04-15 06:14:58'),
(20, 7, 7, '2026-02-17 17:30:00', 6, 7, 4, 1, NULL, '2026-04-15 06:14:58'),
(21, 7, 7, '2026-02-24 17:00:00', 8, 8, 2, 1, 'Gané el juego con mis fichas!', '2026-04-15 06:14:58'),
(22, 7, 7, '2026-03-03 17:00:00', 7, 8, 3, 1, NULL, '2026-04-15 06:14:58'),
(23, 9, 9, '2026-02-06 19:00:00', 4, 5, 7, 0, 'No hice el horario. No sé pa qué sirve.', '2026-04-15 06:14:58'),
(24, 9, 9, '2026-02-13 19:30:00', 3, 4, 8, 0, 'Peleé con un chico en el colegio.', '2026-04-15 06:14:58'),
(25, 9, 9, '2026-02-20 20:00:00', 5, 5, 7, 0, NULL, '2026-04-15 06:14:58');

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
('F30', 'F', 'Episodio maníaco', 'Ep. maníaco', 'V', 'F30-F39', 2, 1),
('F32', 'F', 'Episodio depresivo', 'Ep. depresivo', 'V', 'F30-F39', 2, 1),
('F32.0', 'F32', 'Episodio depresivo leve', 'Dep. leve', 'V', 'F30-F39', 3, 1),
('F32.1', 'F32', 'Episodio depresivo moderado', 'Dep. moderado', 'V', 'F30-F39', 3, 1),
('F32.2', 'F32', 'Episodio depresivo grave sin síntomas psicóticos', 'Dep. grave', 'V', 'F30-F39', 3, 1),
('F40', 'F', 'Trastornos fóbicos de ansiedad', 'Fobia', 'V', 'F40-F48', 2, 1),
('F41', 'F', 'Otros trastornos de ansiedad', 'Ansiedad', 'V', 'F40-F48', 2, 1),
('F41.0', 'F41', 'Trastorno de pánico', 'Pánico', 'V', 'F40-F48', 3, 1),
('F41.1', 'F41', 'Trastorno de ansiedad generalizada', 'TAG', 'V', 'F40-F48', 3, 1),
('F43', 'F', 'Reacciones al estrés grave y trastornos de adaptación', 'Estrés/adapt.', 'V', 'F40-F48', 2, 1),
('F43.1', 'F43', 'Trastorno de estrés postraumático', 'TEPT', 'V', 'F40-F48', 3, 1),
('F43.2', 'F43', 'Trastornos de adaptación', 'Adapt.', 'V', 'F40-F48', 3, 1),
('F60', 'F', 'Trastornos específicos de la personalidad', 'T. personalidad', 'V', 'F60-F69', 2, 1),
('F90', 'F', 'Trastornos hipercinéticos', 'TDAH', 'V', 'F90-F98', 2, 1),
('F90.0', 'F90', 'Perturbación de la actividad y de la atención (TDAH)', 'TDAH', 'V', 'F90-F98', 3, 1),
('F93', 'F', 'Trastornos emocionales de comienzo en la infancia', 'T. emocionales inf.', 'V', 'F90-F98', 2, 1),
('F98', 'F', 'Otros trastornos emocionales y del comportamiento en niñez', 'Otros niñez', 'V', 'F90-F98', 2, 1);

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

INSERT INTO `citas` (`id`, `cita_origen_id`, `paciente_id`, `profesional_id`, `subservicio_id`, `tipo_cita`, `atencion_id`, `fecha_hora_inicio`, `estado`, `reprogramaciones_count`, `notas`, `creado_por`, `created_at`, `updated_at`) VALUES
(1, NULL, 1, 2, 4, NULL, NULL, '2026-01-08 10:00:00', 'completada', 0, NULL, 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(2, NULL, 2, 2, 5, NULL, NULL, '2026-01-10 11:00:00', 'completada', 0, NULL, 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(3, NULL, 3, 2, 5, NULL, NULL, '2026-01-12 09:00:00', 'completada', 0, NULL, 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(4, NULL, 4, 3, 5, NULL, NULL, '2026-01-14 15:00:00', 'completada', 0, NULL, 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(5, NULL, 5, 3, 7, NULL, NULL, '2026-01-16 10:00:00', 'completada', 0, NULL, 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(6, NULL, 7, 1, 2, NULL, NULL, '2026-01-18 09:00:00', 'confirmada', 0, NULL, 1, '2026-04-15 06:09:27', '2026-04-15 06:44:36'),
(7, NULL, 8, 1, 2, NULL, NULL, '2026-01-20 10:00:00', 'confirmada', 0, NULL, 1, '2026-04-15 06:09:27', '2026-04-17 02:40:04'),
(8, NULL, 9, 3, 3, NULL, NULL, '2026-01-22 16:00:00', 'completada', 0, NULL, 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(9, NULL, 1, 2, 5, NULL, NULL, '2026-04-16 10:00:00', 'confirmada', 0, NULL, 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(10, NULL, 2, 2, 5, NULL, NULL, '2026-04-16 11:00:00', 'confirmada', 0, NULL, 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(11, NULL, 4, 3, 5, NULL, NULL, '2026-04-17 15:00:00', 'pendiente', 0, NULL, 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(12, NULL, 7, 1, 2, NULL, NULL, '2026-04-18 09:00:00', 'confirmada', 0, NULL, 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(13, NULL, 3, 2, 5, NULL, NULL, '2026-03-05 09:00:00', 'reprogramada', 0, NULL, 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(14, 13, 3, 2, 5, NULL, NULL, '2026-04-19 09:00:00', 'confirmada', 1, NULL, 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(15, NULL, 6, 3, 7, NULL, NULL, '2026-02-10 10:00:00', 'reprogramada', 0, NULL, 1, '2026-04-15 06:09:27', '2026-04-17 04:11:07'),
(16, NULL, 5, 3, 5, NULL, NULL, '2026-02-20 10:00:00', 'cancelada', 0, NULL, 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(17, 15, 6, 3, 7, NULL, NULL, '2026-04-18 08:30:00', 'pendiente', 1, NULL, 1, '2026-04-17 04:11:07', '2026-04-17 04:11:07'),
(18, NULL, 8, 1, 2, 'sesion_existente', 8, '2026-04-18 15:00:00', 'confirmada', 0, NULL, 1, '2026-04-18 03:23:28', '2026-04-18 03:29:38');

-- --------------------------------------------------------

--
-- Table structure for table `cuentas_cobro`
--

CREATE TABLE `cuentas_cobro` (
  `id` int(10) UNSIGNED NOT NULL,
  `paciente_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'NULL si la cuenta es del grupo',
  `vinculo_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'NULL si la cuenta es individual',
  `atencion_id` int(10) UNSIGNED DEFAULT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `cuentas_cobro`
--

INSERT INTO `cuentas_cobro` (`id`, `paciente_id`, `vinculo_id`, `atencion_id`, `concepto`, `monto_total`, `descuento_aplicado`, `motivo_descuento`, `monto_pagado`, `estado`, `fecha_emision`, `fecha_vencimiento`, `created_at`, `updated_at`) VALUES
(1, 1, NULL, 1, 'Consulta psicológica adulto — 08/01/2026', 90.00, 0.00, NULL, 90.00, 'pagado', '2026-01-08', NULL, '2026-04-15 06:14:58', '2026-04-17 03:38:07'),
(2, 2, NULL, 2, 'Terapia psicológica adulto — proceso completo', 1080.00, 120.00, NULL, 600.00, 'pago_parcial', '2026-01-10', NULL, '2026-04-15 06:14:58', '2026-04-17 03:38:07'),
(3, 3, NULL, 3, 'Terapia psicológica adulto — 5 sesiones', 550.00, 0.00, NULL, 550.00, 'pagado', '2026-01-12', NULL, '2026-04-15 06:14:58', '2026-04-17 03:38:07'),
(4, 4, NULL, 4, 'Terapia psicológica adulto — 4 sesiones', 440.00, 0.00, NULL, 220.00, 'pago_parcial', '2026-01-14', NULL, '2026-04-15 06:14:58', '2026-04-17 03:38:07'),
(5, NULL, 1, NULL, 'Terapia de pareja — 3 sesiones', 390.00, 0.00, NULL, 390.00, 'pagado', '2026-01-16', NULL, '2026-04-15 06:14:58', '2026-04-17 03:38:07'),
(6, 7, NULL, 7, 'Terapia psicológica niño — 4 sesiones', 360.00, 40.00, NULL, 180.00, 'pago_parcial', '2026-01-18', NULL, '2026-04-15 06:14:58', '2026-04-17 03:38:07'),
(7, 8, NULL, 8, 'Terapia psicológica niño — 5 sesiones', 450.00, 50.00, NULL, 225.00, 'pago_parcial', '2026-01-20', NULL, '2026-04-15 06:14:58', '2026-04-17 03:38:07'),
(8, 9, NULL, 9, 'Terapia psicológica adolescente — 3 sesiones', 300.00, 0.00, NULL, 0.00, 'pendiente', '2026-01-22', NULL, '2026-04-15 06:14:58', '2026-04-15 06:14:58');

-- --------------------------------------------------------

--
-- Table structure for table `diagnosticos_atencion`
--

CREATE TABLE `diagnosticos_atencion` (
  `id` int(10) UNSIGNED NOT NULL,
  `atencion_id` int(10) UNSIGNED NOT NULL,
  `cie10_codigo` varchar(10) NOT NULL,
  `tipo` enum('principal','secundario','presuntivo','descartado') NOT NULL DEFAULT 'presuntivo',
  `fecha_dx` date NOT NULL,
  `observacion_clinica` text DEFAULT NULL,
  `registrado_por` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `diagnosticos_atencion`
--

INSERT INTO `diagnosticos_atencion` (`id`, `atencion_id`, `cie10_codigo`, `tipo`, `fecha_dx`, `observacion_clinica`, `registrado_por`, `created_at`) VALUES
(1, 2, 'F32.1', 'principal', '2026-01-10', 'Cumple criterios DSM-5 para episodio depresivo moderado. Sin ideación suicida.', 2, '2026-04-15 06:14:57'),
(2, 3, 'F43.2', 'principal', '2026-01-12', 'Reacción adaptativa disfuncional post-divorcio con componente irritable.', 2, '2026-04-15 06:14:57'),
(3, 4, 'F41.1', 'principal', '2026-01-14', 'Ansiedad generalizada con crisis recurrentes. Evitación conductual marcada.', 3, '2026-04-15 06:14:57'),
(4, 7, 'F90.0', 'presuntivo', '2026-01-18', 'Síntomas compatibles con TDAH tipo combinado. Pendiente evaluación neuropsicológica.', 1, '2026-04-15 06:14:57'),
(5, 9, 'F90.0', 'presuntivo', '2026-01-22', 'Inatención e impulsividad en contexto escolar y familiar.', 3, '2026-04-15 06:14:57'),
(6, 9, 'F43.2', 'secundario', '2026-01-22', 'Dificultades de adaptación al entorno escolar como factor contribuyente.', 3, '2026-04-15 06:14:57');

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

--
-- Dumping data for table `grupo_participantes_pago`
--

INSERT INTO `grupo_participantes_pago` (`id`, `cuenta_cobro_id`, `paciente_id`, `pct_responsabilidad`, `es_responsable_pago`) VALUES
(1, 5, 5, 100.00, 1),
(2, 5, 6, 0.00, 0);

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

--
-- Dumping data for table `historial_citas`
--

INSERT INTO `historial_citas` (`id`, `cita_id`, `fecha_hora_anterior`, `fecha_hora_nueva`, `motivo`, `descripcion`, `registrado_por`, `created_at`) VALUES
(1, 14, '2026-03-05 09:00:00', '2026-04-19 09:00:00', 'reprogramacion', 'Paciente solicitó cambio por viaje de trabajo.', 1, '2026-04-15 06:09:27'),
(2, 15, '2026-02-10 10:00:00', '2026-04-18 08:30:00', 'reprogramacion', 'viaje', 1, '2026-04-17 04:11:07');

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
(1, 5, 'superior_completo', 'Ingeniero de sistemas', 'soltero', '987100001', 'Rosa Quispe (madre)', 'Sin antecedentes relevantes.', 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(2, 6, 'superior_completo', 'Docente universitaria', 'casado', '987100002', 'Pedro Flores (esposo)', 'Diagnóstico previo de episodio depresivo leve (2020).', 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(3, 7, 'tecnico_completo', 'Técnico electricista', 'divorciado', '987100003', 'Ana Contreras (hermana)', 'Antecedente de consumo de alcohol. Actualmente en abstinencia.', 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(4, 8, 'superior_incompleto', 'Estudiante universitaria', 'soltero', '987100004', 'Marco Vega (padre)', 'Trastorno de ansiedad generalizada diagnosticado en 2022.', 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(5, 9, 'superior_completo', 'Administrador de empresas', 'casado', '987100005', 'Rosa Castro (madre)', NULL, 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(6, 10, 'superior_completo', 'Contadora', 'casado', '987100006', 'Luis Navarro (padre)', NULL, 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(7, 11, 'primaria_incompleta', 'Estudiante', 'no_especificado', '987000014', 'Patricia Herrera (madre)', 'Dificultades de atención reportadas por docentes desde los 5 años.', 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(8, 12, 'primaria_incompleta', 'Estudiante', 'no_especificado', '987000015', 'Juan Cruz (padre)', 'Episodio de mutismo selectivo en jardín de infantes.', 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27'),
(9, 13, 'primaria_completa', 'Estudiante', 'no_especificado', '987000016', 'Elena Rivas (madre)', 'Historial de bajo rendimiento escolar. Evaluación pendiente de TDAH.', 1, '2026-04-15 06:09:27', '2026-04-15 06:09:27');

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `pagos_paciente`
--

INSERT INTO `pagos_paciente` (`id`, `cuenta_cobro_id`, `pagado_por_paciente`, `pagado_por_apoderado`, `pagado_por_externo`, `monto`, `fecha_pago`, `metodo_pago`, `numero_comprobante`, `registrado_por`, `notas`, `created_at`) VALUES
(1, 1, 1, NULL, NULL, 90.00, '2026-01-08', 'yape', 'YP-001-2026', 1, NULL, '2026-04-15 06:14:58'),
(2, 2, 2, NULL, NULL, 200.00, '2026-01-10', 'transferencia', 'TR-002-2026', 1, NULL, '2026-04-15 06:14:58'),
(3, 2, 2, NULL, NULL, 200.00, '2026-02-10', 'transferencia', 'TR-015-2026', 1, NULL, '2026-04-15 06:14:58'),
(4, 2, 2, NULL, NULL, 200.00, '2026-03-10', 'efectivo', NULL, 1, NULL, '2026-04-15 06:14:58'),
(5, 3, 3, NULL, NULL, 300.00, '2026-01-12', 'efectivo', NULL, 1, NULL, '2026-04-15 06:14:58'),
(6, 3, 3, NULL, NULL, 250.00, '2026-02-12', 'yape', 'YP-020-2026', 1, NULL, '2026-04-15 06:14:58'),
(7, 4, 4, NULL, NULL, 220.00, '2026-01-14', 'transferencia', 'TR-008-2026', 1, NULL, '2026-04-15 06:14:58'),
(8, 5, 5, NULL, NULL, 390.00, '2026-02-13', 'tarjeta_debito', 'TD-010-2026', 1, NULL, '2026-04-15 06:14:58'),
(9, 6, NULL, 1, NULL, 180.00, '2026-01-18', 'efectivo', NULL, 1, NULL, '2026-04-15 06:14:58'),
(10, 7, NULL, 2, NULL, 225.00, '2026-01-20', 'plin', 'PL-012-2026', 1, NULL, '2026-04-15 06:14:58');

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

--
-- Dumping data for table `pagos_personal`
--

INSERT INTO `pagos_personal` (`id`, `planilla_id`, `monto`, `fecha_pago`, `metodo_pago`, `referencia`, `registrado_por`, `created_at`) VALUES
(19, 33, 900.00, '2026-02-05', 'transferencia', 'BCP-ANA-ENE26', 1, '2026-04-15 06:29:16'),
(20, 34, 1200.00, '2026-02-05', 'transferencia', 'BCP-LUIS-ENE26', 1, '2026-04-15 06:29:16'),
(21, 35, 819.00, '2026-02-05', 'transferencia', 'BCP-SOF-ENE26', 1, '2026-04-15 06:29:16'),
(22, 36, 1100.00, '2026-03-05', 'transferencia', 'BCP-ANA-FEB26', 1, '2026-04-15 06:29:16'),
(23, 37, 1000.00, '2026-03-05', 'transferencia', 'BCP-LUIS-FEB26', 1, '2026-04-15 06:29:16'),
(24, 38, 936.00, '2026-03-05', 'transferencia', 'BCP-SOF-FEB26', 1, '2026-04-15 06:29:16');

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
(1, '48193845', 'Carlos', 'Mendoza Ríos', '1985-03-12', 'masculino', '987000001', 'admin@centropsi.pe', NULL, '2026-04-15 06:03:11', '2026-04-17 01:59:08'),
(2, '20000001', 'Ana María', 'Torres Villanueva', '1982-07-25', 'femenino', '987000002', 'ana.torres@centropsi.pe', NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(3, '20000002', 'Luis', 'Paredes Castillo', '1978-11-08', 'masculino', '987000003', 'luis.paredes@centropsi.pe', NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(4, '20000003', 'Sofía', 'Ramírez Lozano', '1990-04-15', 'femenino', '987000004', 'sofia.ramirez@centropsi.pe', NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(5, '30000001', 'Jorge', 'Huamán Quispe', '1990-06-20', 'masculino', '987000005', 'jorge.huaman@gmail.com', NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(6, '30000002', 'María', 'Quispe Flores', '1988-09-14', 'femenino', '987000006', 'maria.quispe@gmail.com', NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(7, '30000003', 'Roberto', 'Salas Contreras', '1975-02-28', 'masculino', '987000007', 'roberto.salas@gmail.com', NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(8, '30000004', 'Lucía', 'Fernández Vega', '1992-12-05', 'femenino', '987000008', 'lucia.fernandez@gmail.com', NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(9, '30000005', 'Miguel', 'Castro Navarro', '1987-05-18', 'masculino', '987000009', 'miguel.castro@gmail.com', NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(10, '30000006', 'Carmen', 'Navarro de Castro', '1989-08-22', 'femenino', '987000010', 'carmen.navarro@gmail.com', NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(11, '30000007', 'Sebastián', 'López Herrera', '2015-01-10', 'masculino', NULL, NULL, NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(12, '30000008', 'Valentina', 'Cruz Mamani', '2016-07-30', 'femenino', NULL, NULL, NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(13, '30000009', 'Diego', 'Morales Rivas', '2013-04-22', 'masculino', NULL, NULL, NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(14, '40000001', 'Patricia', 'Herrera Díaz', '1985-03-10', 'femenino', '987000014', 'patricia.herrera@gmail.com', NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(15, '40000002', 'Juan', 'Cruz Apaza', '1983-11-25', 'masculino', '987000015', 'juan.cruz@gmail.com', NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(16, '40000003', 'Elena', 'Rivas Condori', '1980-09-05', 'femenino', '987000016', 'elena.rivas@gmail.com', NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11');

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

--
-- Dumping data for table `planes_seguimiento`
--

INSERT INTO `planes_seguimiento` (`id`, `atencion_id`, `profesional_id`, `frecuencia_checkin`, `alerta_sin_respuesta_dias`, `usar_phq9`, `usar_gad7`, `usar_escala_custom`, `activo`, `created_at`) VALUES
(1, 2, 2, 'semanal', 7, 1, 0, 0, 1, '2026-04-15 06:14:58'),
(2, 3, 2, 'semanal', 7, 0, 0, 0, 1, '2026-04-15 06:14:58'),
(3, 4, 3, 'semanal', 7, 0, 1, 0, 1, '2026-04-15 06:14:58'),
(4, 7, 1, 'semanal', 10, 0, 0, 0, 1, '2026-04-15 06:14:58'),
(5, 9, 3, 'cada_2_dias', 5, 0, 0, 0, 1, '2026-04-15 06:14:58');

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
  `monto_bruto` decimal(10,2) NOT NULL DEFAULT 0.00,
  `descuentos` decimal(10,2) NOT NULL DEFAULT 0.00,
  `monto_neto` decimal(10,2) GENERATED ALWAYS AS (`monto_bruto` - `descuentos`) STORED,
  `estado` enum('borrador','aprobada','pagada','anulada') NOT NULL DEFAULT 'borrador',
  `observaciones` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `planillas`
--

INSERT INTO `planillas` (`id`, `profesional_id`, `periodo_inicio`, `periodo_fin`, `sesiones_realizadas`, `monto_bruto`, `descuentos`, `estado`, `observaciones`, `created_at`, `updated_at`) VALUES
(33, 1, '2026-01-01', '2026-01-31', 9, 990.00, 90.00, 'pagada', NULL, '2026-04-15 06:27:55', '2026-04-15 06:27:55'),
(34, 2, '2026-01-01', '2026-01-31', 12, 1320.00, 120.00, 'pagada', NULL, '2026-04-15 06:27:55', '2026-04-15 06:27:55'),
(35, 3, '2026-01-01', '2026-01-31', 7, 910.00, 91.00, 'pagada', NULL, '2026-04-15 06:27:55', '2026-04-15 06:27:55'),
(36, 1, '2026-02-01', '2026-02-28', 11, 1210.00, 110.00, 'pagada', NULL, '2026-04-15 06:27:55', '2026-04-15 06:27:55'),
(37, 2, '2026-02-01', '2026-02-28', 10, 1100.00, 100.00, 'pagada', NULL, '2026-04-15 06:27:55', '2026-04-15 06:27:55'),
(38, 3, '2026-02-01', '2026-02-28', 8, 1040.00, 104.00, 'aprobada', NULL, '2026-04-15 06:27:55', '2026-04-15 06:27:55'),
(39, 1, '2026-03-01', '2026-03-31', 10, 1100.00, 100.00, 'borrador', NULL, '2026-04-15 06:27:55', '2026-04-15 06:27:55'),
(40, 2, '2026-03-01', '2026-03-31', 9, 990.00, 90.00, 'borrador', NULL, '2026-04-15 06:27:55', '2026-04-15 06:27:55');

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
(1, 2, 'CPP-12345', 'Psicología Clínica Infantil', 'Especialista en terapia cognitivo-conductual para niños y adolescentes con 10 años de experiencia.', 120.00, 1, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(2, 3, 'CPP-23456', 'Psicología Clínica Adultos', 'Enfoque humanista y sistémico. Experiencia en terapia de pareja y familia.', 110.00, 1, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(3, 4, 'CPP-34567', 'Neuropsicología', 'Evaluación y rehabilitación neuropsicológica. Especialización en TDAH y trastornos del aprendizaje.', 130.00, 1, '2026-04-15 06:03:11', '2026-04-15 06:03:11');

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

--
-- Dumping data for table `reglas_alerta`
--

INSERT INTO `reglas_alerta` (`id`, `plan_id`, `nombre`, `campo_origen`, `operador`, `valor_umbral`, `dias_consecutivos`, `nivel_alerta`, `activa`) VALUES
(1, 1, 'Estrés elevado sostenido', 'nivel_estres', 'mayor_igual', 8.00, 3, 'alta', 1),
(2, 1, 'Estado emocional muy bajo', 'como_te_sientes', 'menor_igual', 3.00, 2, 'critica', 1),
(3, 2, 'Tarea no realizada recurrente', 'hiciste_tarea', 'igual_a', 0.00, 2, 'moderada', 1),
(4, 2, 'Estrés crítico', 'nivel_estres', 'mayor_igual', 9.00, 1, 'alta', 1),
(5, 3, 'Ansiedad severa sostenida', 'nivel_estres', 'mayor_igual', 8.00, 2, 'alta', 1),
(6, 3, 'Estado muy bajo', 'como_te_sientes', 'menor_igual', 3.00, 1, 'critica', 1),
(7, 5, 'Sin check-in prolongado', 'dias_sin_checkin', 'mayor_igual', 5.00, 1, 'alta', 1),
(8, 5, 'Estrés alto persistente', 'nivel_estres', 'mayor_igual', 7.00, 3, 'moderada', 1);

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
(1, 'Atención Psicológica Niños y Adolescentes', 'Consultas y terapias para menores de 18 años', 'individual', 1, 0, '2026-04-02 17:50:24'),
(2, 'Atención Psicológica Adultos', 'Consultas y terapias para adultos', 'individual', 1, 0, '2026-04-02 17:50:24'),
(3, 'Talleres Psicológicos', 'Sesiones grupales y programas de bienestar', 'taller', 1, 0, '2026-04-02 17:50:24');

-- --------------------------------------------------------

--
-- Table structure for table `sesiones`
--

CREATE TABLE `sesiones` (
  `id` int(10) UNSIGNED NOT NULL,
  `atencion_id` int(10) UNSIGNED NOT NULL,
  `numero_sesion` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `fecha_hora` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Capturada automáticamente por el servidor al registrar',
  `duracion_min` smallint(5) UNSIGNED DEFAULT NULL,
  `nota_clinica` text DEFAULT NULL COMMENT 'Nota SOAP o formato libre del profesional',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `sesiones`
--

INSERT INTO `sesiones` (`id`, `atencion_id`, `numero_sesion`, `fecha_hora`, `duracion_min`, `nota_clinica`, `created_at`, `updated_at`) VALUES
(1, 2, 1, '2026-01-10 11:00:00', 50, 'Sesión de evaluación inicial. Aplicación de PHQ-9: puntaje 14 (depresión moderada). Establecimiento de encuadre terapéutico.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(2, 2, 2, '2026-01-24 11:00:00', 50, 'Exploración de historia de vida. Identificación de patrones cognitivos negativos. Tarea: registro de pensamientos automáticos.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(3, 2, 3, '2026-02-07 11:00:00', 50, 'Revisión de registro de pensamientos. Introduce técnica de reestructuración cognitiva. Paciente muestra motivación.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(4, 2, 4, '2026-02-21 11:00:00', 50, 'Trabajo con creencias centrales. PHQ-9: puntaje 10 (depresión leve). Mejora progresiva.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(5, 2, 5, '2026-03-07 11:00:00', 50, 'Técnicas de activación conductual. Paciente retomó actividades de ocio abandonadas.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(6, 2, 6, '2026-03-21 11:00:00', 50, 'Consolidación de estrategias. Trabajo en prevención de recaídas. PHQ-9: puntaje 6 (mínimo).', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(7, 3, 1, '2026-01-12 09:00:00', 50, 'Primera sesión. Resistencia inicial superada. Exploración de detonantes de irritabilidad.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(8, 3, 2, '2026-01-26 09:00:00', 50, 'Técnicas de regulación emocional. Identificación de señales físicas de activación.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(9, 3, 3, '2026-02-09 09:00:00', 50, 'Trabajo en comunicación asertiva. Rol playing de situaciones conflictivas.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(10, 3, 4, '2026-02-23 09:00:00', 50, 'Exploración de duelo por divorcio. Paciente llora por primera vez en sesión. Avance significativo.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(11, 3, 5, '2026-03-09 09:00:00', 50, 'Consolidación de habilidades. Manejo de relación con ex pareja. Planificación de red de apoyo.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(12, 4, 1, '2026-01-14 15:00:00', 50, 'Evaluación inicial. GAD-7: puntaje 16 (ansiedad severa). Psicoeducación sobre ansiedad.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(13, 4, 2, '2026-01-28 15:00:00', 50, 'Técnicas de respiración y relajación muscular progresiva. Tarea: práctica diaria 10 min.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(14, 4, 3, '2026-02-11 15:00:00', 50, 'Exposición gradual a situaciones evitadas. Jerarquía de miedos construida.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(15, 4, 4, '2026-02-25 15:00:00', 50, 'Primera exposición en vivo: asistió a clase magistral. GAD-7: puntaje 11 (moderado).', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(16, 5, 1, '2026-01-16 10:00:00', 60, 'Ver nota grupal en sesiones_grupo.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(17, 5, 2, '2026-01-30 10:00:00', 60, 'Ver nota grupal en sesiones_grupo.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(18, 5, 3, '2026-02-13 10:00:00', 60, 'Ver nota grupal en sesiones_grupo.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(19, 6, 1, '2026-01-16 10:00:00', 60, 'Ver nota grupal en sesiones_grupo.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(20, 6, 2, '2026-01-30 10:00:00', 60, 'Ver nota grupal en sesiones_grupo.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(21, 6, 3, '2026-02-13 10:00:00', 60, 'Ver nota grupal en sesiones_grupo.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(22, 7, 1, '2026-01-18 09:00:00', 45, 'Primera sesión con técnica de juego. Evaluación de atención con tareas lúdicas estructuradas.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(23, 7, 2, '2026-02-01 09:00:00', 45, 'Trabajo en autorregulación a través del juego. Se introduce sistema de fichas.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(24, 7, 3, '2026-02-15 09:00:00', 45, 'Coordinación con madre sobre estrategias en casa. Sebastián muestra mayor tolerancia a la frustración.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(25, 7, 4, '2026-03-01 09:00:00', 45, 'Sesión de seguimiento. Docente reportó mejora en permanencia en el asiento.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(26, 8, 1, '2026-01-20 10:00:00', 45, 'Primera sesión con técnica de juego proyectivo. Sin verbalización directa.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(27, 8, 2, '2026-02-03 10:00:00', 45, 'Valentina habló por primera vez en sesión. Palabras cortas pero significativas.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(28, 8, 3, '2026-02-17 10:00:00', 45, 'Conversación fluida dentro de la sesión. Generalización al contexto escolar aún no lograda.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(29, 8, 4, '2026-03-03 10:00:00', 45, 'Coordinación con docente. Plan de exposición gradual en el aula.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(30, 8, 5, '2026-03-17 10:00:00', 45, 'Valentina respondió preguntas a su maestra. Hito terapéutico importante.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(31, 9, 1, '2026-01-22 16:00:00', 50, 'Resistencia inicial. Apertura al hablar de videojuegos y fútbol.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(32, 9, 2, '2026-02-05 16:00:00', 50, 'Trabajo en motivación escolar. Identificación de intereses y fortalezas.', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(33, 9, 3, '2026-02-19 16:00:00', 50, 'Técnicas de organización y planificación del estudio adaptadas a su perfil.', '2026-04-15 06:14:58', '2026-04-15 06:14:58');

-- --------------------------------------------------------

--
-- Table structure for table `sesiones_grupo`
--

CREATE TABLE `sesiones_grupo` (
  `id` int(10) UNSIGNED NOT NULL,
  `vinculo_id` int(10) UNSIGNED NOT NULL,
  `fecha_hora` datetime NOT NULL,
  `duracion_min` smallint(5) UNSIGNED DEFAULT NULL,
  `nota_clinica_compartida` text DEFAULT NULL COMMENT 'Dinámica grupal, visible al profesional',
  `nota_privada_p1` text DEFAULT NULL COMMENT 'Observación individual — solo visible al profesional',
  `nota_privada_p2` text DEFAULT NULL,
  `nota_privada_p3` text DEFAULT NULL,
  `estado` enum('programada','realizada','cancelada','no_asistio') NOT NULL DEFAULT 'programada',
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `sesiones_grupo`
--

INSERT INTO `sesiones_grupo` (`id`, `vinculo_id`, `fecha_hora`, `duracion_min`, `nota_clinica_compartida`, `nota_privada_p1`, `nota_privada_p2`, `nota_privada_p3`, `estado`, `created_at`) VALUES
(1, 1, '2026-01-16 10:00:00', 60, 'Primera sesión conjunta. Exploración de historia de la relación y motivos de consulta. Ambos reconocen el distanciamiento como problema principal. Establecimiento de reglas de comunicación básicas.', 'Miguel muestra dificultad para verbalizar emociones. Posible alexitimia leve a explorar.', 'Carmen tiene expectativas elevadas del proceso. Trabajar en gestión de expectativas.', NULL, 'realizada', '2026-04-15 06:14:58'),
(2, 1, '2026-01-30 10:00:00', 60, 'Trabajo en patrones de comunicación. Identificación de ciclo perseguidor-distanciador. Tarea: tiempo de conexión de 15 minutos diarios sin pantallas.', 'Miguel mostró mayor apertura esta sesión. Buen progreso.', 'Carmen expresó frustración acumulada. Validar emociones en próxima sesión.', NULL, 'realizada', '2026-04-15 06:14:58'),
(3, 1, '2026-02-13 10:00:00', 60, 'Revisión de tarea: cumplieron 4 de 7 días. Trabajo en escucha activa. Role playing de conversación difícil sobre finanzas.', 'Miguel interrumpió menos. Avance notable en escucha.', 'Carmen más tranquila esta sesión. Refirió sentirse más escuchada.', NULL, 'realizada', '2026-04-15 06:14:58');

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
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `subservicios`
--

INSERT INTO `subservicios` (`id`, `servicio_id`, `nombre`, `modalidad`, `duracion_min`, `precio_base`, `activo`, `created_at`) VALUES
(1, 1, 'Consulta psicológica niño', 'individual', 45, 80.00, 1, '2026-04-02 17:50:24'),
(2, 1, 'Terapia psicológica niño', 'individual', 50, 100.00, 1, '2026-04-02 17:50:24'),
(3, 1, 'Terapia psicológica adolescente', 'individual', 50, 100.00, 1, '2026-04-02 17:50:24'),
(4, 2, 'Consulta psicológica adulto', 'individual', 50, 90.00, 1, '2026-04-02 17:50:24'),
(5, 2, 'Terapia psicológica adulto', 'individual', 50, 110.00, 1, '2026-04-02 17:50:24'),
(6, 2, 'Terapia emocional', 'individual', 50, 110.00, 1, '2026-04-02 17:50:24'),
(7, 2, 'Terapia de pareja', 'pareja', 60, 130.00, 1, '2026-04-02 17:50:24'),
(8, 2, 'Terapia familiar', 'familiar', 60, 140.00, 1, '2026-04-02 17:50:24'),
(9, 3, 'Taller de manejo del estrés', 'grupal', 90, 60.00, 1, '2026-04-02 17:50:24'),
(10, 3, 'Taller de habilidades sociales', 'grupal', 90, 60.00, 1, '2026-04-02 17:50:24');

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

--
-- Dumping data for table `tareas`
--

INSERT INTO `tareas` (`id`, `sesion_id`, `paciente_id`, `titulo`, `descripcion`, `fecha_asignacion`, `fecha_limite`, `estado`, `respuesta_paciente`, `respondido_at`, `created_at`, `updated_at`) VALUES
(1, 2, 2, 'Registro de pensamientos automáticos', 'Anotar en una libreta los pensamientos negativos que surjan durante el día, la situación que los provocó y cómo te sentiste.', '2026-01-24', '2026-02-06', 'completada', 'Pude registrar pensamientos varios días. Los más frecuentes fueron \"no sirvo para nada\" y \"todo me sale mal\". Me costó al principio pero luego se hizo más fácil.', '2026-02-06 01:30:00', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(2, 3, 2, 'Actividad placentera diaria', 'Realizar al menos una actividad que antes te generara placer (leer, caminar, escuchar música). Registrar cómo te sentiste antes y después.', '2026-02-07', '2026-02-20', 'completada', 'Retomé las caminatas por el parque. El primer día me costó salir pero cuando llegué me sentí mejor. Lo hice 5 de 14 días.', '2026-02-20 00:00:00', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(3, 8, 3, 'Diario de emociones', 'Escribir al final del día: qué situación generó malestar, qué emoción sentiste (de 0 a 10) y qué hiciste al respecto.', '2026-01-26', '2026-02-08', 'completada', 'Lo hice casi todos los días. Me di cuenta que la mayoría de mis enojos son con compañeros de trabajo, no con mi ex como pensaba.', '2026-02-08 02:00:00', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(4, 9, 3, 'Práctica de comunicación asertiva', 'Elegir una situación de la semana donde normalmente reaccionarías con irritabilidad. Aplicar la técnica \"yo siento... cuando... necesito...\" y registrar el resultado.', '2026-02-09', '2026-02-22', 'completada', 'Lo usé con mi jefe cuando me asignó trabajo extra. No me salió perfecto pero tampoco exploté como antes. Él se sorprendió.', '2026-02-22 01:00:00', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(5, 13, 4, 'Práctica de respiración diafragmática', 'Practicar 10 minutos de respiración diafragmática cada mañana. Usar el audio de la sesión como guía.', '2026-01-28', '2026-02-10', 'completada', 'Lo hice 8 de 14 días. Noto que cuando lo hago antes de ir a la universidad la ansiedad es menor.', '2026-02-09 13:00:00', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(6, 14, 4, 'Exposición gradual — nivel 1', 'Asistir a la clase de Estadística que has estado evitando. Si la ansiedad supera 7/10 puedes retirarte, pero intenta quedarte al menos 20 minutos.', '2026-02-11', '2026-02-24', 'completada', 'Fui a la clase. La ansiedad llegó a 8 al entrar pero bajó a 5 después de 15 minutos. Me quedé toda la clase. Nunca pensé que podría.', '2026-02-15 03:00:00', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(7, 23, 7, 'Sistema de fichas en casa', 'Con ayuda de mamá, practicar el sistema de fichas: ganar una ficha por cada tarea escolar completada sin levantarse de la silla. 5 fichas = premio elegido por Sebastián.', '2026-02-01', '2026-02-14', 'completada', 'Gané 12 fichas en dos semanas. Me compré el juego que quería. Mamá dice que mejoré mucho.', '2026-02-13 23:00:00', '2026-04-15 06:14:58', '2026-04-15 06:14:58'),
(8, 32, 9, 'Horario de estudio personalizado', 'Con ayuda de tu mamá, crear un horario semanal de estudio con bloques de 25 minutos y descansos de 5 minutos (técnica Pomodoro adaptada). Probar durante una semana.', '2026-02-05', '2026-02-18', 'no_realizada', NULL, NULL, '2026-04-15 06:14:58', '2026-04-15 06:14:58');

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
(1, 1, '$2y$12$VSarL1OeqjBuCmDvr66U6ue6p6PT8ZpEYaaGHD2DXX.InHpk7P586', 'administrador', 1, 0, NULL, '2026-04-15 06:03:11', '2026-04-15 06:32:37'),
(2, 2, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'profesional', 1, 0, NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(3, 3, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'profesional', 1, 0, NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(4, 4, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'profesional', 1, 0, NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(5, 5, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'paciente', 1, 0, NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(6, 6, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'paciente', 1, 0, NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(7, 7, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'paciente', 1, 0, NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(8, 8, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'paciente', 1, 0, NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(9, 9, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'paciente', 1, 0, NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11'),
(10, 10, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'paciente', 1, 0, NULL, '2026-04-15 06:03:11', '2026-04-15 06:03:11');

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_agenda_dia`
-- (See below for the actual view)
--
CREATE TABLE `v_agenda_dia` (
`cita_id` int(10) unsigned
,`fecha_hora_inicio` datetime
,`estado` enum('pendiente','confirmada','completada','cancelada','no_asistio','reprogramada')
,`paciente` varchar(201)
,`telefono_paciente` varchar(20)
,`apoderado` varchar(201)
,`telefono_apoderado` varchar(20)
,`profesional` varchar(201)
,`subservicio` varchar(150)
,`modalidad` enum('individual','pareja','familiar','grupal')
,`duracion_min` smallint(5) unsigned
,`servicio` varchar(150)
,`precio_base` decimal(10,2)
,`precio_acordado` decimal(10,2)
,`descuento_monto` decimal(10,2)
,`precio_final` decimal(10,2)
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
,`estado_atencion` enum('activa','pausada','completada','cancelada')
,`motivo_consulta` text
,`grado_instruccion_atencion` varchar(50)
,`ocupacion_atencion` varchar(150)
,`estado_civil_atencion` varchar(50)
,`recomendaciones` text
,`subservicio` varchar(150)
,`modalidad` enum('individual','pareja','familiar','grupal')
,`profesional` varchar(201)
,`sesion_id` int(10) unsigned
,`numero_sesion` tinyint(3) unsigned
,`fecha_sesion` datetime
,`nota_clinica` text
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

--
-- Indexes for dumped tables
--

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
  ADD KEY `fk_cc_atencion` (`atencion_id`);

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
  ADD KEY `fk_sesiones_atencion` (`atencion_id`);

--
-- Indexes for table `sesiones_grupo`
--
ALTER TABLE `sesiones_grupo`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_sg_vinculo` (`vinculo_id`);

--
-- Indexes for table `subservicios`
--
ALTER TABLE `subservicios`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_subservicios_servicio` (`servicio_id`);

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
-- AUTO_INCREMENT for table `alertas`
--
ALTER TABLE `alertas`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `apoderados`
--
ALTER TABLE `apoderados`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `apoderado_paciente`
--
ALTER TABLE `apoderado_paciente`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `atenciones`
--
ALTER TABLE `atenciones`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `atenciones_vinculadas`
--
ALTER TABLE `atenciones_vinculadas`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `atencion_vinculo_detalle`
--
ALTER TABLE `atencion_vinculo_detalle`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `checkin_emocional`
--
ALTER TABLE `checkin_emocional`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `citas`
--
ALTER TABLE `citas`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `cuentas_cobro`
--
ALTER TABLE `cuentas_cobro`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `diagnosticos_atencion`
--
ALTER TABLE `diagnosticos_atencion`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `grupo_participantes_pago`
--
ALTER TABLE `grupo_participantes_pago`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `historial_citas`
--
ALTER TABLE `historial_citas`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `pacientes`
--
ALTER TABLE `pacientes`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `pagos_paciente`
--
ALTER TABLE `pagos_paciente`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pagos_personal`
--
ALTER TABLE `pagos_personal`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `personas`
--
ALTER TABLE `personas`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `planes_seguimiento`
--
ALTER TABLE `planes_seguimiento`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `planillas`
--
ALTER TABLE `planillas`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=41;

--
-- AUTO_INCREMENT for table `profesionales`
--
ALTER TABLE `profesionales`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `reglas_alerta`
--
ALTER TABLE `reglas_alerta`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `servicios`
--
ALTER TABLE `servicios`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `sesiones`
--
ALTER TABLE `sesiones`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT for table `sesiones_grupo`
--
ALTER TABLE `sesiones_grupo`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `subservicios`
--
ALTER TABLE `subservicios`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `tareas`
--
ALTER TABLE `tareas`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

-- --------------------------------------------------------

--
-- Structure for view `v_agenda_dia`
--
DROP TABLE IF EXISTS `v_agenda_dia`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_agenda_dia`  AS SELECT `ci`.`id` AS `cita_id`, `ci`.`fecha_hora_inicio` AS `fecha_hora_inicio`, `ci`.`estado` AS `estado`, concat(`pe_p`.`nombres`,' ',`pe_p`.`apellidos`) AS `paciente`, `pe_p`.`telefono` AS `telefono_paciente`, concat(`pe_a`.`nombres`,' ',`pe_a`.`apellidos`) AS `apoderado`, `pe_a`.`telefono` AS `telefono_apoderado`, concat(`pe_r`.`nombres`,' ',`pe_r`.`apellidos`) AS `profesional`, `ss`.`nombre` AS `subservicio`, `ss`.`modalidad` AS `modalidad`, `ss`.`duracion_min` AS `duracion_min`, `se`.`nombre` AS `servicio`, `ss`.`precio_base` AS `precio_base`, `a`.`precio_acordado` AS `precio_acordado`, `a`.`descuento_monto` AS `descuento_monto`, `a`.`precio_final` AS `precio_final` FROM ((((((((((`citas` `ci` join `pacientes` `p` on(`p`.`id` = `ci`.`paciente_id`)) join `personas` `pe_p` on(`pe_p`.`id` = `p`.`persona_id`)) join `profesionales` `pr` on(`pr`.`id` = `ci`.`profesional_id`)) join `personas` `pe_r` on(`pe_r`.`id` = `pr`.`persona_id`)) join `subservicios` `ss` on(`ss`.`id` = `ci`.`subservicio_id`)) join `servicios` `se` on(`se`.`id` = `ss`.`servicio_id`)) left join `atenciones` `a` on(`a`.`cita_id` = `ci`.`id`)) left join `apoderado_paciente` `ap` on(`ap`.`paciente_id` = `p`.`id` and `ap`.`es_contacto_principal` = 1)) left join `apoderados` `ao` on(`ao`.`id` = `ap`.`apoderado_id`)) left join `personas` `pe_a` on(`pe_a`.`id` = `ao`.`persona_id`)) WHERE `ci`.`estado` not in ('cancelada','reprogramada') ;

-- --------------------------------------------------------

--
-- Structure for view `v_historial_paciente`
--
DROP TABLE IF EXISTS `v_historial_paciente`;

CREATE OR REPLACE VIEW `v_historial_paciente` AS
SELECT
  `p`.`id`                                          AS `paciente_id`,
  CONCAT(`pe`.`nombres`,' ',`pe`.`apellidos`)       AS `paciente`,
  `a`.`id`                                          AS `atencion_id`,
  `a`.`fecha_inicio`                                AS `fecha_inicio`,
  `a`.`fecha_fin`                                   AS `fecha_fin`,
  `a`.`estado`                                      AS `estado_atencion`,
  `a`.`motivo_consulta`                             AS `motivo_consulta`,
  `a`.`grado_instruccion`                           AS `grado_instruccion_atencion`,
  `a`.`ocupacion`                                   AS `ocupacion_atencion`,
  `a`.`estado_civil`                                AS `estado_civil_atencion`,
  `a`.`recomendaciones`                             AS `recomendaciones`,
  `ss`.`nombre`                                     AS `subservicio`,
  `ss`.`modalidad`                                  AS `modalidad`,
  CONCAT(`pf`.`nombres`,' ',`pf`.`apellidos`)       AS `profesional`,
  `s`.`id`                                          AS `sesion_id`,
  `s`.`numero_sesion`                               AS `numero_sesion`,
  `s`.`fecha_hora`                                  AS `fecha_sesion`,
  `s`.`nota_clinica`                                AS `nota_clinica`,
  `d`.`cie10_codigo`                                AS `cie10_codigo`,
  `c`.`descripcion_corta`                           AS `diagnostico`
FROM `pacientes` `p`
JOIN `personas`        `pe` ON `pe`.`id` = `p`.`persona_id`
JOIN `atenciones`      `a`  ON `a`.`paciente_id` = `p`.`id`
JOIN `subservicios`    `ss` ON `ss`.`id` = `a`.`subservicio_id`
JOIN `profesionales`   `pr` ON `pr`.`id` = `a`.`profesional_id`
JOIN `personas`        `pf` ON `pf`.`id` = `pr`.`persona_id`
LEFT JOIN `sesiones`   `s`  ON `s`.`atencion_id` = `a`.`id`
LEFT JOIN `diagnosticos_atencion` `d`
       ON `d`.`atencion_id` = `a`.`id` AND `d`.`tipo` = 'principal'
LEFT JOIN `cie10`      `c`  ON `c`.`codigo` = `d`.`cie10_codigo`;

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

--
-- Constraints for dumped tables
--

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
  ADD CONSTRAINT `fk_cc_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`),
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
  ADD CONSTRAINT `fk_sesiones_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`);

--
-- Constraints for table `sesiones_grupo`
--
ALTER TABLE `sesiones_grupo`
  ADD CONSTRAINT `fk_sg_vinculo` FOREIGN KEY (`vinculo_id`) REFERENCES `atenciones_vinculadas` (`id`);

--
-- Constraints for table `subservicios`
--
ALTER TABLE `subservicios`
  ADD CONSTRAINT `fk_subservicios_servicio` FOREIGN KEY (`servicio_id`) REFERENCES `servicios` (`id`);

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