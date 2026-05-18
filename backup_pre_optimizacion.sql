-- MySQL dump 10.13  Distrib 8.4.3, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: centro_psicologico
-- ------------------------------------------------------
-- Server version	11.8.2-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `adelanto_sesion`
--

DROP TABLE IF EXISTS `adelanto_sesion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `adelanto_sesion` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `adelanto_id` int(10) unsigned NOT NULL,
  `sesion_id` int(10) unsigned NOT NULL,
  `monto_aplicado` decimal(10,2) NOT NULL COMMENT 'Monto del adelanto usado\r\n                           en esta sesión.',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_adelanto_sesion` (`adelanto_id`,`sesion_id`),
  KEY `fk_as_sesion` (`sesion_id`),
  CONSTRAINT `fk_as_adelanto` FOREIGN KEY (`adelanto_id`) REFERENCES `adelantos_paciente` (`id`),
  CONSTRAINT `fk_as_sesion` FOREIGN KEY (`sesion_id`) REFERENCES `sesiones` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `adelanto_sesion`
--

LOCK TABLES `adelanto_sesion` WRITE;
/*!40000 ALTER TABLE `adelanto_sesion` DISABLE KEYS */;
/*!40000 ALTER TABLE `adelanto_sesion` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER trg_aplicar_adelanto
AFTER INSERT ON adelanto_sesion
FOR EACH ROW
BEGIN
  UPDATE adelantos_paciente
  SET monto_aplicado = monto_aplicado + NEW.monto_aplicado,
      estado = CASE
        WHEN (monto_aplicado + NEW.monto_aplicado)
             >= monto_total THEN 'agotado'
        ELSE 'activo'
      END,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.adelanto_id;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `adelantos_paciente`
--

DROP TABLE IF EXISTS `adelantos_paciente`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `adelantos_paciente` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `paciente_id` int(10) unsigned NOT NULL,
  `profesional_id` int(10) unsigned NOT NULL,
  `atencion_id` int(10) unsigned DEFAULT NULL COMMENT 'Opcional: vincula el\r\n                             adelanto a una atención\r\n                             específica.',
  `concepto` varchar(300) NOT NULL COMMENT 'Ej: "Pago adelantado\r\n                             por 3 sesiones".',
  `sesiones_acordadas` tinyint(3) unsigned DEFAULT NULL COMMENT 'Informativo: cuántas\r\n                             sesiones cubre.',
  `monto_total` decimal(10,2) NOT NULL,
  `monto_aplicado` decimal(10,2) NOT NULL DEFAULT 0.00,
  `saldo_disponible` decimal(10,2) GENERATED ALWAYS AS (`monto_total` - `monto_aplicado`) STORED,
  `estado` enum('activo','agotado','cancelado') NOT NULL DEFAULT 'activo',
  `created_by` int(10) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_adel_paciente` (`paciente_id`),
  KEY `fk_adel_profesional` (`profesional_id`),
  KEY `fk_adel_atencion` (`atencion_id`),
  KEY `fk_adel_creador` (`created_by`),
  CONSTRAINT `fk_adel_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`),
  CONSTRAINT `fk_adel_creador` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_adel_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`),
  CONSTRAINT `fk_adel_profesional` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `adelantos_paciente`
--

LOCK TABLES `adelantos_paciente` WRITE;
/*!40000 ALTER TABLE `adelantos_paciente` DISABLE KEYS */;
/*!40000 ALTER TABLE `adelantos_paciente` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `alertas`
--

DROP TABLE IF EXISTS `alertas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alertas` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `atencion_id` int(10) unsigned NOT NULL,
  `paciente_id` int(10) unsigned NOT NULL,
  `profesional_id` int(10) unsigned NOT NULL,
  `regla_id` int(10) unsigned DEFAULT NULL COMMENT 'NULL si es alerta manual',
  `tipo` enum('sin_respuesta','riesgo_emocional','tarea_pendiente','inasistencia','escala_critica','manual') NOT NULL,
  `nivel` enum('informativa','moderada','alta','critica') NOT NULL,
  `descripcion` text DEFAULT NULL,
  `estado` enum('activa','atendida','descartada') NOT NULL DEFAULT 'activa',
  `accion_tomada` text DEFAULT NULL,
  `atendida_por` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `atendida_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_alertas_profesional` (`profesional_id`,`estado`),
  KEY `fk_alertas_atencion` (`atencion_id`),
  KEY `fk_alertas_paciente` (`paciente_id`),
  KEY `fk_alertas_regla` (`regla_id`),
  KEY `fk_alertas_atendida` (`atendida_por`),
  CONSTRAINT `fk_alertas_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`),
  CONSTRAINT `fk_alertas_atendida` FOREIGN KEY (`atendida_por`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_alertas_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`),
  CONSTRAINT `fk_alertas_profesional` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`),
  CONSTRAINT `fk_alertas_regla` FOREIGN KEY (`regla_id`) REFERENCES `reglas_alerta` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `alertas`
--

LOCK TABLES `alertas` WRITE;
/*!40000 ALTER TABLE `alertas` DISABLE KEYS */;
/*!40000 ALTER TABLE `alertas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `apoderado_paciente`
--

DROP TABLE IF EXISTS `apoderado_paciente`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `apoderado_paciente` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `apoderado_id` int(10) unsigned NOT NULL,
  `paciente_id` int(10) unsigned NOT NULL,
  `parentesco` enum('padre','madre','tutor_legal','abuelo','hermano','otro') NOT NULL,
  `es_contacto_principal` tinyint(1) NOT NULL DEFAULT 0,
  `es_responsable_pago` tinyint(1) NOT NULL DEFAULT 0,
  `puede_ver_historial` tinyint(1) NOT NULL DEFAULT 1,
  `notas` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_apoderado_paciente` (`apoderado_id`,`paciente_id`),
  KEY `fk_ap_paciente` (`paciente_id`),
  CONSTRAINT `fk_ap_apoderado` FOREIGN KEY (`apoderado_id`) REFERENCES `apoderados` (`id`),
  CONSTRAINT `fk_ap_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `apoderado_paciente`
--

LOCK TABLES `apoderado_paciente` WRITE;
/*!40000 ALTER TABLE `apoderado_paciente` DISABLE KEYS */;
INSERT INTO `apoderado_paciente` VALUES (1,1,8,'madre',1,1,1,'Madre a cargo. Autoriza compartir evoluci??n con pediatra.'),(2,2,3,'padre',1,1,1,'Padre responsable del pago. Asiste a sesiones de familia.');
/*!40000 ALTER TABLE `apoderado_paciente` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `apoderados`
--

DROP TABLE IF EXISTS `apoderados`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `apoderados` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `persona_id` int(10) unsigned NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_apoderados_persona` (`persona_id`),
  CONSTRAINT `fk_apoderados_persona` FOREIGN KEY (`persona_id`) REFERENCES `personas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `apoderados`
--

LOCK TABLES `apoderados` WRITE;
/*!40000 ALTER TABLE `apoderados` DISABLE KEYS */;
INSERT INTO `apoderados` VALUES (1,14,1,'2026-05-15 01:36:31','2026-05-15 01:36:31'),(2,15,1,'2026-05-15 01:36:31','2026-05-15 01:36:31');
/*!40000 ALTER TABLE `apoderados` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `atencion_vinculo_detalle`
--

DROP TABLE IF EXISTS `atencion_vinculo_detalle`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `atencion_vinculo_detalle` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vinculo_id` int(10) unsigned NOT NULL,
  `atencion_id` int(10) unsigned NOT NULL,
  `rol_en_grupo` enum('consultante','acompanante','familiar','participante','paciente_titular') NOT NULL DEFAULT 'participante',
  `relacion_con_titular` varchar(100) DEFAULT NULL,
  `es_responsable_pago` tinyint(1) NOT NULL DEFAULT 0,
  `precio_cuota` decimal(10,2) DEFAULT NULL,
  `descuento_monto` decimal(10,2) NOT NULL DEFAULT 0.00,
  `motivo_descuento` varchar(200) DEFAULT NULL,
  `precio_final` decimal(10,2) GENERATED ALWAYS AS (coalesce(`precio_cuota`,0) - `descuento_monto`) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_avd` (`vinculo_id`,`atencion_id`),
  KEY `fk_avd_atencion` (`atencion_id`),
  CONSTRAINT `fk_avd_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`),
  CONSTRAINT `fk_avd_vinculo` FOREIGN KEY (`vinculo_id`) REFERENCES `atenciones_vinculadas` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `atencion_vinculo_detalle`
--

LOCK TABLES `atencion_vinculo_detalle` WRITE;
/*!40000 ALTER TABLE `atencion_vinculo_detalle` DISABLE KEYS */;
/*!40000 ALTER TABLE `atencion_vinculo_detalle` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `atenciones`
--

DROP TABLE IF EXISTS `atenciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `atenciones` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `paciente_id` int(10) unsigned NOT NULL,
  `profesional_id` int(10) unsigned NOT NULL,
  `cita_id` int(10) unsigned DEFAULT NULL COMMENT 'Cita de origen; NULL si se crea directamente',
  `subservicio_id` int(10) unsigned NOT NULL,
  `grado_instruccion` enum('sin_instruccion','primaria_incompleta','primaria_completa','secundaria_incompleta','secundaria_completa','tecnico_incompleto','tecnico_completo','superior_incompleto','superior_completo','posgrado','no_especificado') DEFAULT 'no_especificado',
  `ocupacion` varchar(150) DEFAULT NULL,
  `estado_civil` enum('soltero','casado','conviviente','divorciado','separado','viudo','no_especificado') DEFAULT 'no_especificado',
  `edad` tinyint(3) unsigned DEFAULT NULL,
  `motivo_consulta` text NOT NULL COMMENT 'Razón principal por la que el paciente acude',
  `observacion_general` text DEFAULT NULL COMMENT 'Observación general del paciente al inicio',
  `observacion_conducta` text DEFAULT NULL COMMENT 'Observación del comportamiento y actitud en consulta',
  `antecedentes_relevantes` text DEFAULT NULL COMMENT 'Antecedentes específicos relevantes para esta atención',
  `recomendaciones` text DEFAULT NULL COMMENT 'Recomendaciones generales del profesional al cierre',
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date DEFAULT NULL COMMENT 'NULL mientras la atención esté activa',
  `estado` enum('activa','pausada','completada','cancelada') NOT NULL DEFAULT 'activa',
  `numero_sesiones_plan` tinyint(3) unsigned DEFAULT NULL COMMENT 'Número de sesiones planificadas',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_atenciones_paciente` (`paciente_id`),
  KEY `fk_atenciones_profesional` (`profesional_id`),
  KEY `fk_atenciones_cita` (`cita_id`),
  KEY `fk_atenciones_subservicio` (`subservicio_id`),
  CONSTRAINT `fk_atenciones_cita` FOREIGN KEY (`cita_id`) REFERENCES `citas` (`id`),
  CONSTRAINT `fk_atenciones_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`),
  CONSTRAINT `fk_atenciones_profesional` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`),
  CONSTRAINT `fk_atenciones_subservicio` FOREIGN KEY (`subservicio_id`) REFERENCES `subservicios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `atenciones`
--

LOCK TABLES `atenciones` WRITE;
/*!40000 ALTER TABLE `atenciones` DISABLE KEYS */;
INSERT INTO `atenciones` VALUES (1,10,1,1,4,'posgrado','psicoloca','soltero',30,'motivo prueba 1','obs general prueba 1','obs conducta prueba 1','recluida por comer makis','miau','2026-05-15',NULL,'activa',4,'2026-05-16 05:41:44','2026-05-16 06:11:57'),(2,11,2,2,4,'superior_completo','ventas','casado',61,'asd','asd','asd','asd','as','2026-05-15',NULL,'activa',4,'2026-05-16 06:49:57','2026-05-16 06:49:57');
/*!40000 ALTER TABLE `atenciones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `atenciones_vinculadas`
--

DROP TABLE IF EXISTS `atenciones_vinculadas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `atenciones_vinculadas` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `nombre_grupo` varchar(150) DEFAULT NULL,
  `tipo_vinculo` enum('pareja','familiar','grupal') NOT NULL,
  `subservicio_id` int(10) unsigned NOT NULL,
  `profesional_id` int(10) unsigned NOT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date DEFAULT NULL,
  `estado` enum('activo','completado','cancelado') NOT NULL DEFAULT 'activo',
  `created_by` int(10) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_av_subservicio` (`subservicio_id`),
  KEY `fk_av_profesional` (`profesional_id`),
  KEY `fk_av_creador` (`created_by`),
  CONSTRAINT `fk_av_creador` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_av_profesional` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`),
  CONSTRAINT `fk_av_subservicio` FOREIGN KEY (`subservicio_id`) REFERENCES `subservicios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `atenciones_vinculadas`
--

LOCK TABLES `atenciones_vinculadas` WRITE;
/*!40000 ALTER TABLE `atenciones_vinculadas` DISABLE KEYS */;
/*!40000 ALTER TABLE `atenciones_vinculadas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `checkin_emocional`
--

DROP TABLE IF EXISTS `checkin_emocional`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `checkin_emocional` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `paciente_id` int(10) unsigned NOT NULL,
  `atencion_id` int(10) unsigned NOT NULL,
  `fecha_hora` datetime NOT NULL DEFAULT current_timestamp(),
  `como_te_sientes` tinyint(3) unsigned NOT NULL COMMENT 'Escala 0–10',
  `dormiste_bien` tinyint(3) unsigned NOT NULL COMMENT 'Escala 0–10',
  `nivel_estres` tinyint(3) unsigned NOT NULL COMMENT 'Escala 0–10',
  `hiciste_tarea` tinyint(1) DEFAULT NULL COMMENT '1=sí 0=no NULL=no aplica',
  `nota_opcional` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_checkin_paciente_fecha` (`paciente_id`,`fecha_hora`),
  KEY `fk_checkin_atencion` (`atencion_id`),
  CONSTRAINT `fk_checkin_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`),
  CONSTRAINT `fk_checkin_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `checkin_emocional`
--

LOCK TABLES `checkin_emocional` WRITE;
/*!40000 ALTER TABLE `checkin_emocional` DISABLE KEYS */;
/*!40000 ALTER TABLE `checkin_emocional` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cie10`
--

DROP TABLE IF EXISTS `cie10`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cie10` (
  `codigo` varchar(10) NOT NULL,
  `codigo_padre` varchar(10) DEFAULT NULL,
  `descripcion` varchar(500) NOT NULL,
  `descripcion_corta` varchar(150) DEFAULT NULL,
  `capitulo` varchar(10) DEFAULT NULL,
  `bloque` varchar(20) DEFAULT NULL,
  `nivel` tinyint(3) unsigned DEFAULT 1 COMMENT '1=capítulo 2=bloque 3=categoría 4=subcategoría',
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`codigo`),
  KEY `fk_cie10_padre` (`codigo_padre`),
  FULLTEXT KEY `ft_cie10_descripcion` (`descripcion`,`descripcion_corta`),
  CONSTRAINT `fk_cie10_padre` FOREIGN KEY (`codigo_padre`) REFERENCES `cie10` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cie10`
--

LOCK TABLES `cie10` WRITE;
/*!40000 ALTER TABLE `cie10` DISABLE KEYS */;
INSERT INTO `cie10` VALUES ('F',NULL,'Trastornos mentales y del comportamiento','T. mentales','V','F00-F99',1,1),('F32','F','Episodio depresivo','Ep. depresivo','V','F30-F39',2,1),('F32.0','F32','Episodio depresivo leve','Dep. leve','V','F30-F39',3,1),('F32.1','F32','Episodio depresivo moderado','Dep. moderado','V','F30-F39',3,1),('F32.2','F32','Episodio depresivo grave sin psicosis','Dep. grave','V','F30-F39',3,1),('F41','F','Otros trastornos de ansiedad','Ansiedad','V','F40-F48',2,1),('F41.0','F41','Trastorno de pánico','Pánico','V','F40-F48',3,1),('F41.1','F41','Trastorno de ansiedad generalizada','TAG','V','F40-F48',3,1),('F43','F','Reacciones al estrés y trastornos de adaptación','Estrés/adapt.','V','F40-F48',2,1),('F43.1','F43','Trastorno de estrés postraumático','TEPT','V','F40-F48',3,1),('F43.2','F43','Trastornos de adaptación','Adapt.','V','F40-F48',3,1),('F60','F','Trastornos específicos de la personalidad','T. personalidad','V','F60-F69',2,1),('F90','F','Trastornos hipercinéticos','TDAH','V','F90-F98',2,1),('F90.0','F90','Perturbación de la actividad y atención','TDAH','V','F90-F98',3,1),('F93','F','Trastornos emocionales en la infancia','T. emoc. inf.','V','F90-F98',2,1),('F94.0','F93','Mutismo selectivo','Mutismo selectivo','V','F90-F98',3,1);
/*!40000 ALTER TABLE `cie10` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `citas`
--

DROP TABLE IF EXISTS `citas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `citas` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `cita_origen_id` int(10) unsigned DEFAULT NULL COMMENT 'Apunta a la cita original si es reprogramación',
  `paciente_id` int(10) unsigned NOT NULL,
  `profesional_id` int(10) unsigned NOT NULL,
  `subservicio_id` int(10) unsigned NOT NULL,
  `tipo_cita` enum('nueva_atencion','sesion_existente') DEFAULT NULL COMMENT 'Intención declarada al agendar',
  `precio_acordado` decimal(10,2) DEFAULT NULL COMMENT 'Monto pactado al separar la cita',
  `modalidad_sesion` enum('presencial','virtual') NOT NULL DEFAULT 'presencial' COMMENT 'Modalidad acordada al separar la cita',
  `descuento_monto` decimal(10,2) NOT NULL DEFAULT 0.00,
  `motivo_descuento` varchar(200) DEFAULT NULL,
  `atencion_id` int(10) unsigned DEFAULT NULL COMMENT 'Atención vinculada cuando tipo_cita = sesion_existente',
  `fecha_hora_inicio` datetime NOT NULL,
  `estado` enum('pendiente','confirmada','completada','cancelada','no_asistio','reprogramada') NOT NULL DEFAULT 'pendiente',
  `reprogramaciones_count` tinyint(3) unsigned DEFAULT 0,
  `notas` text DEFAULT NULL,
  `creado_por` int(10) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_citas_fecha` (`fecha_hora_inicio`),
  KEY `idx_citas_profesional` (`profesional_id`,`fecha_hora_inicio`),
  KEY `idx_citas_paciente` (`paciente_id`),
  KEY `fk_citas_origen` (`cita_origen_id`),
  KEY `fk_citas_subservicio` (`subservicio_id`),
  KEY `fk_citas_creador` (`creado_por`),
  KEY `fk_citas_atencion` (`atencion_id`),
  CONSTRAINT `fk_citas_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`),
  CONSTRAINT `fk_citas_creador` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_citas_origen` FOREIGN KEY (`cita_origen_id`) REFERENCES `citas` (`id`),
  CONSTRAINT `fk_citas_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`),
  CONSTRAINT `fk_citas_profesional` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`),
  CONSTRAINT `fk_citas_subservicio` FOREIGN KEY (`subservicio_id`) REFERENCES `subservicios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `citas`
--

LOCK TABLES `citas` WRITE;
/*!40000 ALTER TABLE `citas` DISABLE KEYS */;
INSERT INTO `citas` VALUES (1,NULL,10,1,4,'nueva_atencion',90.00,'presencial',0.00,NULL,1,'2026-05-15 23:50:00','completada',0,NULL,1,'2026-05-16 04:44:27','2026-05-16 05:41:44'),(2,NULL,11,2,4,'nueva_atencion',90.00,'presencial',0.00,NULL,2,'2026-05-15 23:50:00','completada',0,NULL,1,'2026-05-16 04:45:46','2026-05-16 06:49:57'),(3,NULL,10,1,4,'sesion_existente',90.00,'presencial',0.00,NULL,1,'2026-05-16 07:00:00','completada',0,NULL,1,'2026-05-16 05:43:09','2026-05-16 06:10:01'),(4,NULL,10,1,4,'sesion_existente',90.00,'virtual',0.00,NULL,1,'2026-05-16 11:00:00','completada',0,NULL,1,'2026-05-16 06:24:02','2026-05-16 06:26:12'),(5,NULL,10,1,4,'sesion_existente',70.00,'presencial',0.00,NULL,1,'2026-05-16 20:00:00','completada',0,NULL,1,'2026-05-16 06:29:32','2026-05-16 06:31:57');
/*!40000 ALTER TABLE `citas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cuentas_cobro`
--

DROP TABLE IF EXISTS `cuentas_cobro`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cuentas_cobro` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `paciente_id` int(10) unsigned DEFAULT NULL COMMENT 'NULL si la cuenta es individual',
  `cita_id` int(10) unsigned DEFAULT NULL COMMENT 'Cuenta generada al registrar el primer pago de una cita',
  `vinculo_id` int(10) unsigned DEFAULT NULL COMMENT 'NULL si la cuenta es grupal',
  `taller_id` int(10) unsigned DEFAULT NULL,
  `sesion_id` int(10) unsigned DEFAULT NULL COMMENT 'FK a sesiones cuando la cuenta\r\n             es por sesión individual.',
  `atencion_id` int(10) unsigned DEFAULT NULL,
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
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_cc_paciente` (`paciente_id`),
  KEY `fk_cc_vinculo` (`vinculo_id`),
  KEY `fk_cc_taller` (`taller_id`),
  KEY `fk_cc_sesion` (`sesion_id`),
  KEY `fk_cc_cita` (`cita_id`),
  KEY `fk_cc_atencion` (`atencion_id`),
  CONSTRAINT `fk_cc_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cc_cita` FOREIGN KEY (`cita_id`) REFERENCES `citas` (`id`),
  CONSTRAINT `fk_cc_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`),
  CONSTRAINT `fk_cc_sesion` FOREIGN KEY (`sesion_id`) REFERENCES `sesiones` (`id`),
  CONSTRAINT `fk_cc_taller` FOREIGN KEY (`taller_id`) REFERENCES `talleres_institucionales` (`id`),
  CONSTRAINT `fk_cc_vinculo` FOREIGN KEY (`vinculo_id`) REFERENCES `atenciones_vinculadas` (`id`),
  CONSTRAINT `chk_cc_titular` CHECK (`paciente_id` is not null or `vinculo_id` is not null or `taller_id` is not null)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cuentas_cobro`
--

LOCK TABLES `cuentas_cobro` WRITE;
/*!40000 ALTER TABLE `cuentas_cobro` DISABLE KEYS */;
INSERT INTO `cuentas_cobro` (`id`, `paciente_id`, `cita_id`, `vinculo_id`, `taller_id`, `sesion_id`, `atencion_id`, `concepto`, `monto_total`, `descuento_aplicado`, `motivo_descuento`, `monto_pagado`, `estado`, `fecha_emision`, `fecha_vencimiento`, `created_at`, `updated_at`) VALUES (1,10,NULL,NULL,NULL,NULL,1,'Paquete: Pack Inicio',270.00,0.00,NULL,200.00,'pagado','2026-05-16',NULL,'2026-05-16 05:38:43','2026-05-16 07:13:43'),(2,11,2,NULL,NULL,NULL,NULL,'Cita 15/05/2026 — Consulta psicológica adulto',90.00,0.00,NULL,50.00,'pagado','2026-05-16',NULL,'2026-05-16 05:39:37','2026-05-16 05:39:37'),(3,10,5,NULL,NULL,4,1,'Cita 16/05/2026 — Consulta psicológica adulto',70.00,0.00,NULL,50.00,'pagado','2026-05-16',NULL,'2026-05-16 06:30:20','2026-05-16 06:31:57'),(4,11,NULL,NULL,NULL,5,NULL,'Sesión #1 — Sesión',90.00,0.00,NULL,0.00,'pendiente','2026-05-16',NULL,'2026-05-16 06:49:57','2026-05-16 06:49:57');
/*!40000 ALTER TABLE `cuentas_cobro` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `diagnosticos_atencion`
--

DROP TABLE IF EXISTS `diagnosticos_atencion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `diagnosticos_atencion` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `atencion_id` int(10) unsigned NOT NULL,
  `cie10_codigo` varchar(10) NOT NULL,
  `nivel_certeza` enum('definitivo','presuntivo','descartado') NOT NULL,
  `jerarquia` enum('principal','secundario') DEFAULT NULL COMMENT 'Jerarquía del diagnóstico en la atención',
  `fecha_dx` date NOT NULL,
  `observacion_clinica` text DEFAULT NULL,
  `registrado_por` int(10) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_dx_atencion` (`atencion_id`),
  KEY `fk_dx_cie10` (`cie10_codigo`),
  KEY `fk_dx_registrador` (`registrado_por`),
  CONSTRAINT `fk_dx_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`),
  CONSTRAINT `fk_dx_cie10` FOREIGN KEY (`cie10_codigo`) REFERENCES `cie10` (`codigo`),
  CONSTRAINT `fk_dx_registrador` FOREIGN KEY (`registrado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `diagnosticos_atencion`
--

LOCK TABLES `diagnosticos_atencion` WRITE;
/*!40000 ALTER TABLE `diagnosticos_atencion` DISABLE KEYS */;
INSERT INTO `diagnosticos_atencion` VALUES (1,1,'F90.0','definitivo','principal','2026-05-16',NULL,1,'2026-05-16 05:41:44'),(2,2,'F90.0','definitivo','principal','2026-05-16',NULL,1,'2026-05-16 06:49:57');
/*!40000 ALTER TABLE `diagnosticos_atencion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `historial_citas`
--

DROP TABLE IF EXISTS `historial_citas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `historial_citas` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `cita_id` int(10) unsigned NOT NULL,
  `estado_anterior` varchar(50) DEFAULT NULL,
  `estado_nuevo` varchar(50) DEFAULT NULL,
  `fecha_hora_anterior` datetime DEFAULT NULL,
  `fecha_hora_nueva` datetime DEFAULT NULL,
  `motivo` varchar(255) DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `registrado_por` int(10) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_hc_cita` (`cita_id`),
  KEY `fk_hc_usuario` (`registrado_por`),
  CONSTRAINT `fk_hc_cita` FOREIGN KEY (`cita_id`) REFERENCES `citas` (`id`),
  CONSTRAINT `fk_hc_usuario` FOREIGN KEY (`registrado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `historial_citas`
--

LOCK TABLES `historial_citas` WRITE;
/*!40000 ALTER TABLE `historial_citas` DISABLE KEYS */;
/*!40000 ALTER TABLE `historial_citas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paciente_paquetes`
--

DROP TABLE IF EXISTS `paciente_paquetes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paciente_paquetes` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `paquete_id` int(10) unsigned NOT NULL,
  `paciente_id` int(10) unsigned NOT NULL,
  `profesional_id` int(10) unsigned NOT NULL,
  `sesiones_restantes` tinyint(3) unsigned NOT NULL,
  `cuenta_cobro_id` int(10) unsigned DEFAULT NULL COMMENT 'Generada automáticamente',
  `estado` enum('activo','agotado','vencido','cancelado') NOT NULL DEFAULT 'activo',
  `fecha_activacion` date NOT NULL,
  `fecha_vencimiento` date DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `created_by` int(10) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_ppq_paquete` (`paquete_id`),
  KEY `fk_ppq_paciente` (`paciente_id`),
  KEY `fk_ppq_profesional` (`profesional_id`),
  KEY `fk_ppq_cuenta` (`cuenta_cobro_id`),
  KEY `fk_ppq_creador` (`created_by`),
  CONSTRAINT `fk_ppq_creador` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_ppq_cuenta` FOREIGN KEY (`cuenta_cobro_id`) REFERENCES `cuentas_cobro` (`id`),
  CONSTRAINT `fk_ppq_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`),
  CONSTRAINT `fk_ppq_paquete` FOREIGN KEY (`paquete_id`) REFERENCES `paquetes` (`id`),
  CONSTRAINT `fk_ppq_profesional` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paciente_paquetes`
--

LOCK TABLES `paciente_paquetes` WRITE;
/*!40000 ALTER TABLE `paciente_paquetes` DISABLE KEYS */;
INSERT INTO `paciente_paquetes` VALUES (1,1,10,1,0,1,'agotado','2026-05-16',NULL,NULL,1,'2026-05-16 04:44:27');
/*!40000 ALTER TABLE `paciente_paquetes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pacientes`
--

DROP TABLE IF EXISTS `pacientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pacientes` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `persona_id` int(10) unsigned NOT NULL,
  `grado_instruccion` enum('sin_instruccion','primaria_incompleta','primaria_completa','secundaria_incompleta','secundaria_completa','tecnico_incompleto','tecnico_completo','superior_incompleto','superior_completo','posgrado','no_especificado') DEFAULT 'no_especificado',
  `ocupacion` varchar(150) DEFAULT NULL,
  `estado_civil` enum('soltero','casado','conviviente','divorciado','separado','viudo','no_especificado') DEFAULT 'no_especificado',
  `telefono_emergencia` varchar(20) DEFAULT NULL,
  `contacto_emergencia` varchar(150) DEFAULT NULL,
  `antecedentes` text DEFAULT NULL COMMENT 'Antecedentes clínicos generales del paciente',
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pacientes_persona` (`persona_id`),
  CONSTRAINT `fk_pacientes_persona` FOREIGN KEY (`persona_id`) REFERENCES `personas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pacientes`
--

LOCK TABLES `pacientes` WRITE;
/*!40000 ALTER TABLE `pacientes` DISABLE KEYS */;
INSERT INTO `pacientes` VALUES (1,5,'no_especificado',NULL,'no_especificado',NULL,NULL,NULL,1,'2026-05-14 04:51:11','2026-05-14 04:51:11'),(2,6,'no_especificado',NULL,'no_especificado',NULL,NULL,NULL,1,'2026-05-14 04:51:11','2026-05-14 04:51:11'),(3,7,'no_especificado',NULL,'no_especificado',NULL,NULL,NULL,1,'2026-05-14 04:51:11','2026-05-14 04:51:11'),(4,8,'no_especificado',NULL,'no_especificado',NULL,NULL,NULL,1,'2026-05-14 04:51:11','2026-05-14 04:51:11'),(5,9,'no_especificado',NULL,'no_especificado',NULL,NULL,NULL,1,'2026-05-14 04:51:11','2026-05-14 04:51:11'),(6,10,'superior_completo','Contadora','casado','991000010','Esposo Jorge Garc??a',NULL,1,'2026-05-15 01:36:31','2026-05-15 01:36:31'),(7,11,'superior_completo','Ingeniero civil','soltero','991000011','Madre Carmen Vega',NULL,1,'2026-05-15 01:36:31','2026-05-15 01:36:31'),(8,12,'sin_instruccion',NULL,'no_especificado','991000014','Madre Patricia Castro',NULL,1,'2026-05-15 01:36:31','2026-05-15 01:36:31'),(9,13,'secundaria_completa','T??cnico mec??nico','divorciado','991000013','Hermana Rosa Ram??rez','Episodio depresivo previo hace 3 a??os sin tratamiento formal.',1,'2026-05-15 01:36:31','2026-05-15 01:36:31'),(10,16,'no_especificado',NULL,'no_especificado',NULL,NULL,NULL,1,'2026-05-15 16:06:50','2026-05-15 16:06:50'),(11,17,'no_especificado',NULL,'no_especificado',NULL,NULL,NULL,1,'2026-05-15 17:22:54','2026-05-15 17:22:54'),(12,18,'no_especificado',NULL,'no_especificado',NULL,NULL,NULL,1,'2026-05-15 17:47:26','2026-05-15 17:47:26');
/*!40000 ALTER TABLE `pacientes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pagos_paciente`
--

DROP TABLE IF EXISTS `pagos_paciente`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pagos_paciente` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `cuenta_cobro_id` int(10) unsigned NOT NULL,
  `pagado_por_paciente` int(10) unsigned DEFAULT NULL COMMENT 'Paciente registrado que paga',
  `pagado_por_apoderado` int(10) unsigned DEFAULT NULL COMMENT 'Apoderado que paga por el menor',
  `pagado_por_externo` varchar(150) DEFAULT NULL COMMENT 'Nombre libre si no está en el sistema',
  `monto` decimal(10,2) NOT NULL,
  `fecha_pago` date NOT NULL,
  `metodo_pago` enum('efectivo','transferencia','tarjeta_debito','tarjeta_credito','yape','plin','otro') NOT NULL,
  `numero_comprobante` varchar(60) DEFAULT NULL,
  `registrado_por` int(10) unsigned NOT NULL,
  `notas` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_pp_cuenta` (`cuenta_cobro_id`),
  KEY `fk_pp_paciente` (`pagado_por_paciente`),
  KEY `fk_pp_apoderado` (`pagado_por_apoderado`),
  KEY `fk_pp_registrador` (`registrado_por`),
  CONSTRAINT `fk_pp_apoderado` FOREIGN KEY (`pagado_por_apoderado`) REFERENCES `apoderados` (`id`),
  CONSTRAINT `fk_pp_cuenta` FOREIGN KEY (`cuenta_cobro_id`) REFERENCES `cuentas_cobro` (`id`),
  CONSTRAINT `fk_pp_paciente` FOREIGN KEY (`pagado_por_paciente`) REFERENCES `pacientes` (`id`),
  CONSTRAINT `fk_pp_registrador` FOREIGN KEY (`registrado_por`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `chk_pagador` CHECK (`pagado_por_paciente` is not null or `pagado_por_apoderado` is not null or `pagado_por_externo` is not null)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pagos_paciente`
--

LOCK TABLES `pagos_paciente` WRITE;
/*!40000 ALTER TABLE `pagos_paciente` DISABLE KEYS */;
INSERT INTO `pagos_paciente` VALUES (1,1,10,NULL,NULL,100.00,'2026-05-16','efectivo',NULL,1,NULL,'2026-05-16 05:38:43'),(2,2,11,NULL,NULL,50.00,'2026-05-16','efectivo',NULL,1,NULL,'2026-05-16 05:39:37'),(3,3,10,NULL,NULL,50.00,'2026-05-16','efectivo',NULL,1,NULL,'2026-05-16 06:30:20'),(4,1,10,NULL,NULL,100.00,'2026-05-16','efectivo',NULL,1,NULL,'2026-05-16 06:35:00');
/*!40000 ALTER TABLE `pagos_paciente` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER trg_actualizar_monto_pagado
AFTER INSERT ON pagos_paciente
FOR EACH ROW
BEGIN
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
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `pagos_personal`
--

DROP TABLE IF EXISTS `pagos_personal`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pagos_personal` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `planilla_id` int(10) unsigned NOT NULL,
  `monto` decimal(10,2) NOT NULL,
  `fecha_pago` date NOT NULL,
  `metodo_pago` enum('transferencia','efectivo','cheque','otro') NOT NULL,
  `referencia` varchar(100) DEFAULT NULL,
  `registrado_por` int(10) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_pagos_personal_planilla` (`planilla_id`),
  KEY `fk_pagos_personal_registrador` (`registrado_por`),
  CONSTRAINT `fk_pagos_personal_planilla` FOREIGN KEY (`planilla_id`) REFERENCES `planillas` (`id`),
  CONSTRAINT `fk_pagos_personal_registrador` FOREIGN KEY (`registrado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pagos_personal`
--

LOCK TABLES `pagos_personal` WRITE;
/*!40000 ALTER TABLE `pagos_personal` DISABLE KEYS */;
/*!40000 ALTER TABLE `pagos_personal` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paquetes`
--

DROP TABLE IF EXISTS `paquetes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paquetes` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `sesiones_incluidas` tinyint(3) unsigned NOT NULL,
  `precio_paquete` decimal(10,2) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paquetes`
--

LOCK TABLES `paquetes` WRITE;
/*!40000 ALTER TABLE `paquetes` DISABLE KEYS */;
INSERT INTO `paquetes` VALUES (1,'Pack Inicio','3 sesiones con tarifa especial para nuevos pacientes',3,270.00,1,'2026-05-02 05:37:05'),(2,'Pack Continuidad','5 sesiones para pacientes en proceso terapéutico',5,480.00,1,'2026-05-02 05:37:05'),(3,'Pack Familiar','4 sesiones de terapia familiar con descuento',4,480.00,1,'2026-05-02 05:37:05');
/*!40000 ALTER TABLE `paquetes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personas`
--

DROP TABLE IF EXISTS `personas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personas` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `dni` varchar(15) NOT NULL,
  `nombres` varchar(100) NOT NULL,
  `apellidos` varchar(100) NOT NULL,
  `fecha_nacimiento` date DEFAULT NULL,
  `sexo` enum('masculino','femenino','otro','no_especificado') DEFAULT 'no_especificado',
  `telefono` varchar(20) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `foto_url` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_personas_dni` (`dni`),
  UNIQUE KEY `uq_personas_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personas`
--

LOCK TABLES `personas` WRITE;
/*!40000 ALTER TABLE `personas` DISABLE KEYS */;
INSERT INTO `personas` VALUES (1,'48193845','Josué','Silva Aguilar','1994-03-07','masculino','987000001','admin@magusa.pe',NULL,'2026-05-02 05:37:05','2026-05-02 05:49:46'),(2,'11111111','Ana','García Pérez','1988-03-12','femenino','987654321','ana.garcia@gmail.com',NULL,'2026-05-14 04:51:11','2026-05-14 04:55:40'),(3,'22222222','Carlos','Rodríguez','1985-07-22','masculino','987654322','carlos.rod@outlook.com',NULL,'2026-05-14 04:51:11','2026-05-14 04:55:47'),(4,'33333333','Elena','Torres','1992-11-05','femenino','987654323','etorres@centro.com',NULL,'2026-05-14 04:51:11','2026-05-14 04:51:11'),(5,'44444444','Juan','Pérez Lozano','1995-05-15','masculino','999888771','jperez@gmail.com',NULL,'2026-05-14 04:51:11','2026-05-14 04:55:53'),(6,'55555555','María','Soto Ruiz','1990-10-20','femenino','999888772','msoto@hotmail.com',NULL,'2026-05-14 04:51:11','2026-05-14 04:56:17'),(7,'66666666','Luis','Mendoza','2005-01-10','masculino','999888773','lmendoza@yahoo.com',NULL,'2026-05-14 04:51:11','2026-05-14 04:51:11'),(8,'77777777','Sofía','Castro','2015-08-30','femenino','999888774','scastro@gmail.com',NULL,'2026-05-14 04:51:11','2026-05-14 04:56:10'),(9,'88888888','Diego','Ramírez','1985-03-25','masculino','999888775','dramirez@gmail.com',NULL,'2026-05-14 04:51:11','2026-05-14 04:56:00'),(10,'10101010','Ana','Garc??a P??rez','1988-03-12','femenino','991000010','ana.garcia.p@gmail.com',NULL,'2026-05-15 01:36:31','2026-05-15 01:36:31'),(11,'10101011','Carlos','Rodr??guez Vega','1985-07-22','masculino','991000011','c.rodriguez.v@outlook.com',NULL,'2026-05-15 01:36:31','2026-05-15 01:36:31'),(12,'10101012','Sof??a','Castro R??os','2015-08-30','femenino','991000012','sofiacastro2015@gmail.com',NULL,'2026-05-15 01:36:31','2026-05-15 01:36:31'),(13,'10101013','Diego','Ram??rez Lara','1985-03-25','masculino','991000013','d.ramirez.l@gmail.com',NULL,'2026-05-15 01:36:31','2026-05-15 01:36:31'),(14,'10101014','Patricia','Castro R??os','1983-11-02','femenino','991000014','patricia.castro@gmail.com',NULL,'2026-05-15 01:36:31','2026-05-15 01:36:31'),(15,'10101015','Roberto','Mendoza Ccama','1975-09-20','masculino','991000015','roberto.mendoza@gmail.com',NULL,'2026-05-15 01:36:31','2026-05-15 01:36:31'),(16,'77332033','Kerly Zuleydy','Bautista Sanchez','1995-07-15','femenino','234561578','kerly@yahoo.com',NULL,'2026-05-15 16:06:50','2026-05-15 16:22:50'),(17,'16456828','Cesar Augusto','Silva Sanchez','1964-05-26','masculino','456789123','cesar@gmail.com',NULL,'2026-05-15 17:22:54','2026-05-15 17:26:18'),(18,'16689581','Margot Alejandria','Aguilar Sandoval','1970-06-10','femenino','578456965','ajosu994@gmail.com',NULL,'2026-05-15 17:47:26','2026-05-15 17:49:19');
/*!40000 ALTER TABLE `personas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `planes_seguimiento`
--

DROP TABLE IF EXISTS `planes_seguimiento`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `planes_seguimiento` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `atencion_id` int(10) unsigned NOT NULL,
  `profesional_id` int(10) unsigned NOT NULL,
  `frecuencia_checkin` enum('diario','cada_2_dias','semanal','libre') NOT NULL DEFAULT 'libre',
  `alerta_sin_respuesta_dias` tinyint(3) unsigned DEFAULT 7,
  `usar_phq9` tinyint(1) DEFAULT 0,
  `usar_gad7` tinyint(1) DEFAULT 0,
  `usar_escala_custom` tinyint(1) DEFAULT 0,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_plan_atencion` (`atencion_id`),
  KEY `fk_ps_profesional` (`profesional_id`),
  CONSTRAINT `fk_ps_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`),
  CONSTRAINT `fk_ps_profesional` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `planes_seguimiento`
--

LOCK TABLES `planes_seguimiento` WRITE;
/*!40000 ALTER TABLE `planes_seguimiento` DISABLE KEYS */;
/*!40000 ALTER TABLE `planes_seguimiento` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `planilla_conceptos`
--

DROP TABLE IF EXISTS `planilla_conceptos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `planilla_conceptos` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `planilla_id` int(10) unsigned NOT NULL,
  `tipo` enum('sesion','taller') NOT NULL,
  `sesion_id` int(10) unsigned DEFAULT NULL,
  `taller_fecha_id` int(10) unsigned DEFAULT NULL,
  `descripcion` varchar(300) NOT NULL,
  `monto_base` decimal(10,2) NOT NULL,
  `porcentaje` decimal(5,2) NOT NULL,
  `monto_profesional` decimal(10,2) GENERATED ALWAYS AS (round(`monto_base` * `porcentaje` / 100,2)) STORED,
  PRIMARY KEY (`id`),
  KEY `fk_pc_planilla` (`planilla_id`),
  KEY `fk_pc_sesion` (`sesion_id`),
  KEY `fk_pc_taller_fecha` (`taller_fecha_id`),
  CONSTRAINT `fk_pc_planilla` FOREIGN KEY (`planilla_id`) REFERENCES `planillas` (`id`),
  CONSTRAINT `fk_pc_sesion` FOREIGN KEY (`sesion_id`) REFERENCES `sesiones` (`id`),
  CONSTRAINT `fk_pc_taller_fecha` FOREIGN KEY (`taller_fecha_id`) REFERENCES `taller_fechas` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `planilla_conceptos`
--

LOCK TABLES `planilla_conceptos` WRITE;
/*!40000 ALTER TABLE `planilla_conceptos` DISABLE KEYS */;
/*!40000 ALTER TABLE `planilla_conceptos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `planillas`
--

DROP TABLE IF EXISTS `planillas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `planillas` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `profesional_id` int(10) unsigned NOT NULL,
  `periodo_inicio` date NOT NULL,
  `periodo_fin` date NOT NULL,
  `sesiones_realizadas` smallint(5) unsigned DEFAULT 0,
  `porcentaje_profesional` decimal(5,2) DEFAULT NULL COMMENT '% del valor de cada sesión que\r\n             corresponde al profesional',
  `monto_bruto` decimal(10,2) NOT NULL DEFAULT 0.00,
  `descuentos` decimal(10,2) NOT NULL DEFAULT 0.00,
  `monto_neto` decimal(10,2) GENERATED ALWAYS AS (`monto_bruto` - `descuentos`) STORED,
  `estado` enum('borrador','aprobada','pagada','anulada') NOT NULL DEFAULT 'borrador',
  `observaciones` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_planillas_profesional` (`profesional_id`),
  CONSTRAINT `fk_planillas_profesional` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `planillas`
--

LOCK TABLES `planillas` WRITE;
/*!40000 ALTER TABLE `planillas` DISABLE KEYS */;
/*!40000 ALTER TABLE `planillas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `profesionales`
--

DROP TABLE IF EXISTS `profesionales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `profesionales` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `persona_id` int(10) unsigned NOT NULL,
  `colegiatura` varchar(30) NOT NULL,
  `especialidad` varchar(150) DEFAULT NULL,
  `descripcion_bio` text DEFAULT NULL,
  `tarifa_hora` decimal(10,2) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_profesionales_persona` (`persona_id`),
  UNIQUE KEY `uq_profesionales_colegiatura` (`colegiatura`),
  CONSTRAINT `fk_profesionales_persona` FOREIGN KEY (`persona_id`) REFERENCES `personas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `profesionales`
--

LOCK TABLES `profesionales` WRITE;
/*!40000 ALTER TABLE `profesionales` DISABLE KEYS */;
INSERT INTO `profesionales` VALUES (1,2,'PS-12345','Psicolog??a Cl??nica',NULL,NULL,1,'2026-05-14 04:51:11','2026-05-14 04:51:11'),(2,3,'PS-22345','Terapia Cognitivo Conductual',NULL,NULL,1,'2026-05-14 04:51:11','2026-05-14 04:51:11'),(3,4,'PS-33345','Psicoterapia Infantil',NULL,NULL,1,'2026-05-14 04:51:11','2026-05-14 04:51:11');
/*!40000 ALTER TABLE `profesionales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reglas_alerta`
--

DROP TABLE IF EXISTS `reglas_alerta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reglas_alerta` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `plan_id` int(10) unsigned NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `campo_origen` enum('como_te_sientes','dormiste_bien','nivel_estres','hiciste_tarea','dias_sin_checkin') NOT NULL,
  `operador` enum('mayor_que','menor_que','igual_a','mayor_igual','menor_igual') NOT NULL,
  `valor_umbral` decimal(5,2) NOT NULL,
  `dias_consecutivos` tinyint(3) unsigned DEFAULT 1,
  `nivel_alerta` enum('informativa','moderada','alta','critica') NOT NULL DEFAULT 'moderada',
  `activa` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_ra_plan` (`plan_id`),
  CONSTRAINT `fk_ra_plan` FOREIGN KEY (`plan_id`) REFERENCES `planes_seguimiento` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reglas_alerta`
--

LOCK TABLES `reglas_alerta` WRITE;
/*!40000 ALTER TABLE `reglas_alerta` DISABLE KEYS */;
/*!40000 ALTER TABLE `reglas_alerta` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `servicios`
--

DROP TABLE IF EXISTS `servicios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `servicios` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `tipo` enum('individual','grupal','taller') NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `orden` tinyint(3) unsigned DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `servicios`
--

LOCK TABLES `servicios` WRITE;
/*!40000 ALTER TABLE `servicios` DISABLE KEYS */;
INSERT INTO `servicios` VALUES (1,'Atención Psicológica Niños y Adolescentes','Consultas y terapias para menores de 18 años','individual',1,1,'2026-05-02 05:37:05'),(2,'Atención Psicológica Adultos','Consultas y terapias para adultos','individual',1,2,'2026-05-02 05:37:05'),(3,'Talleres Psicológicos','Sesiones grupales y programas de bienestar','taller',1,3,'2026-05-02 05:37:05');
/*!40000 ALTER TABLE `servicios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sesion_archivos`
--

DROP TABLE IF EXISTS `sesion_archivos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sesion_archivos` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `sesion_id` int(10) unsigned DEFAULT NULL COMMENT 'FK a sesiones si es individual',
  `sesion_grupo_id` int(10) unsigned DEFAULT NULL COMMENT 'FK a sesiones_grupo si es grupal',
  `nombre_original` varchar(255) NOT NULL,
  `nombre_display` varchar(255) DEFAULT NULL COMMENT 'Alias definido por el usuario al subir el archivo',
  `nombre_guardado` varchar(255) NOT NULL COMMENT 'UUID + extensión para evitar colisiones',
  `tipo_mime` varchar(100) NOT NULL,
  `tamano_bytes` int(10) unsigned NOT NULL,
  `subido_por` int(10) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_sa_sesion` (`sesion_id`),
  KEY `fk_sa_sesion_grupo` (`sesion_grupo_id`),
  KEY `fk_sa_subido_por` (`subido_por`),
  CONSTRAINT `fk_sa_sesion` FOREIGN KEY (`sesion_id`) REFERENCES `sesiones` (`id`),
  CONSTRAINT `fk_sa_sesion_grupo` FOREIGN KEY (`sesion_grupo_id`) REFERENCES `sesiones_grupo` (`id`),
  CONSTRAINT `fk_sa_subido_por` FOREIGN KEY (`subido_por`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `chk_sa_sesion` CHECK (`sesion_id` is not null or `sesion_grupo_id` is not null)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sesion_archivos`
--

LOCK TABLES `sesion_archivos` WRITE;
/*!40000 ALTER TABLE `sesion_archivos` DISABLE KEYS */;
INSERT INTO `sesion_archivos` VALUES (1,1,NULL,'logo_magusa.jpeg','logo','f3ec640e785bd508a270f0fbc190d483.jpeg','image/jpeg',50231,1,'2026-05-16 05:41:44'),(2,2,NULL,'historial_8_20260513.pdf','test','07847986592820293ed26d2a6b321db5.pdf','application/pdf',5213,1,'2026-05-16 06:10:01'),(3,4,NULL,'tbc-resp.png','tbc-resp','a1fe771a01538ecaef7051e0e5dfeba3.png','image/png',78049,1,'2026-05-16 06:31:57');
/*!40000 ALTER TABLE `sesion_archivos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sesiones`
--

DROP TABLE IF EXISTS `sesiones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sesiones` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `atencion_id` int(10) unsigned NOT NULL,
  `paciente_paquete_id` int(10) unsigned DEFAULT NULL COMMENT 'Si esta sesión consume un paquete',
  `numero_sesion` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `fecha_hora` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Capturada automáticamente por el servidor al registrar',
  `duracion_min` smallint(5) unsigned DEFAULT NULL,
  `modalidad_sesion` enum('presencial','virtual') NOT NULL DEFAULT 'presencial' COMMENT 'Puede variar sesión a sesión\r\n             dentro de la misma atención.',
  `precio_sesion` decimal(10,2) DEFAULT NULL COMMENT 'Precio real cobrado por esta sesión.\r\n             NULL hasta que se registre la sesión.\r\n             Pre-llenado desde atencion.precio_acordado\r\n             ajustado por modalidad.',
  `nota_clinica` text DEFAULT NULL COMMENT 'Nota SOAP o formato libre del profesional',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_sesiones_atencion` (`atencion_id`),
  KEY `fk_ses_paquete` (`paciente_paquete_id`),
  CONSTRAINT `fk_ses_paquete` FOREIGN KEY (`paciente_paquete_id`) REFERENCES `paciente_paquetes` (`id`),
  CONSTRAINT `fk_sesiones_atencion` FOREIGN KEY (`atencion_id`) REFERENCES `atenciones` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sesiones`
--

LOCK TABLES `sesiones` WRITE;
/*!40000 ALTER TABLE `sesiones` DISABLE KEYS */;
INSERT INTO `sesiones` VALUES (1,1,1,1,'2026-05-16 00:41:44',50,'presencial',90.00,'nota clinica de prueba 1','2026-05-16 05:41:44','2026-05-16 05:41:44'),(2,1,1,2,'2026-05-16 01:10:01',50,'presencial',90.00,'nota clinica de prueba 2','2026-05-16 06:10:01','2026-05-16 06:10:01'),(3,1,1,3,'2026-05-16 01:26:12',50,'virtual',90.00,'nota sesión 3','2026-05-16 06:26:12','2026-05-16 06:26:12'),(4,1,NULL,4,'2026-05-16 01:31:57',50,'presencial',70.00,'nota clinica 4 prueba','2026-05-16 06:31:57','2026-05-16 06:31:57'),(5,2,NULL,1,'2026-05-16 01:49:57',50,'presencial',90.00,'wfrfr','2026-05-16 06:49:57','2026-05-16 06:49:57');
/*!40000 ALTER TABLE `sesiones` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_consumir_paquete` AFTER INSERT ON `sesiones` FOR EACH ROW BEGIN
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
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `sesiones_grupo`
--

DROP TABLE IF EXISTS `sesiones_grupo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sesiones_grupo` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vinculo_id` int(10) unsigned NOT NULL,
  `numero_sesion` tinyint(3) unsigned NOT NULL DEFAULT 1 COMMENT 'Número correlativo de sesión\r\n             dentro del vínculo grupal.',
  `fecha_hora` datetime NOT NULL,
  `duracion_min` smallint(5) unsigned DEFAULT NULL,
  `nota_clinica_compartida` text DEFAULT NULL COMMENT 'Dinámica grupal, visible al profesional',
  `estado` enum('programada','realizada','cancelada','no_asistio') DEFAULT 'realizada',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_sg_vinculo` (`vinculo_id`),
  CONSTRAINT `fk_sg_vinculo` FOREIGN KEY (`vinculo_id`) REFERENCES `atenciones_vinculadas` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sesiones_grupo`
--

LOCK TABLES `sesiones_grupo` WRITE;
/*!40000 ALTER TABLE `sesiones_grupo` DISABLE KEYS */;
/*!40000 ALTER TABLE `sesiones_grupo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subservicios`
--

DROP TABLE IF EXISTS `subservicios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subservicios` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `servicio_id` int(10) unsigned NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `modalidad` enum('individual','pareja','familiar','grupal') NOT NULL,
  `duracion_min` smallint(5) unsigned DEFAULT 50,
  `precio_base` decimal(10,2) NOT NULL DEFAULT 0.00,
  `descuento_virtual` decimal(10,2) NOT NULL DEFAULT 10.00 COMMENT 'Descuento aplicado cuando la sesión\r\n             es virtual. Sugerido, editable por\r\n             subservicio.',
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_subservicios_servicio` (`servicio_id`),
  CONSTRAINT `fk_subservicios_servicio` FOREIGN KEY (`servicio_id`) REFERENCES `servicios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subservicios`
--

LOCK TABLES `subservicios` WRITE;
/*!40000 ALTER TABLE `subservicios` DISABLE KEYS */;
INSERT INTO `subservicios` VALUES (1,1,'Consulta psicológica niño','individual',45,80.00,10.00,1,'2026-05-02 05:37:05'),(2,1,'Terapia psicológica niño','individual',50,100.00,10.00,1,'2026-05-02 05:37:05'),(3,1,'Terapia psicológica adolescente','individual',50,100.00,10.00,1,'2026-05-02 05:37:05'),(4,2,'Consulta psicológica adulto','individual',50,90.00,10.00,1,'2026-05-02 05:37:05'),(5,2,'Terapia psicológica adulto','individual',50,110.00,10.00,1,'2026-05-02 05:37:05'),(6,2,'Terapia emocional','individual',50,110.00,10.00,1,'2026-05-02 05:37:05'),(7,2,'Terapia de pareja','pareja',60,130.00,15.00,1,'2026-05-02 05:37:05'),(8,2,'Terapia familiar','familiar',60,140.00,15.00,1,'2026-05-02 05:37:05'),(9,3,'Taller de manejo del estrés','grupal',90,60.00,0.00,1,'2026-05-02 05:37:05'),(10,3,'Taller de habilidades sociales','grupal',90,60.00,0.00,1,'2026-05-02 05:37:05');
/*!40000 ALTER TABLE `subservicios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `taller_fechas`
--

DROP TABLE IF EXISTS `taller_fechas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `taller_fechas` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `taller_id` int(10) unsigned NOT NULL,
  `fecha_hora` datetime NOT NULL,
  `duracion_min` smallint(5) unsigned NOT NULL DEFAULT 90,
  `estado` enum('programada','realizada','cancelada') NOT NULL DEFAULT 'programada',
  `asistentes` smallint(5) unsigned DEFAULT NULL COMMENT 'Asistentes específicos de esta fecha',
  `notas` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_tf_taller` (`taller_id`),
  CONSTRAINT `fk_tf_taller` FOREIGN KEY (`taller_id`) REFERENCES `talleres_institucionales` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `taller_fechas`
--

LOCK TABLES `taller_fechas` WRITE;
/*!40000 ALTER TABLE `taller_fechas` DISABLE KEYS */;
/*!40000 ALTER TABLE `taller_fechas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `talleres_institucionales`
--

DROP TABLE IF EXISTS `talleres_institucionales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `talleres_institucionales` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `profesional_id` int(10) unsigned NOT NULL,
  `subservicio_id` int(10) unsigned NOT NULL,
  `institucion` varchar(200) DEFAULT NULL,
  `tema` varchar(300) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `total_asistentes` smallint(5) unsigned DEFAULT NULL,
  `precio_acordado` decimal(10,2) NOT NULL DEFAULT 0.00,
  `porcentaje_prof` decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT '% del precio que va al profesional',
  `estado` enum('programado','realizado','cancelado') NOT NULL DEFAULT 'programado',
  `notas` text DEFAULT NULL,
  `created_by` int(10) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_ti_profesional` (`profesional_id`),
  KEY `fk_ti_subservicio` (`subservicio_id`),
  KEY `fk_ti_creador` (`created_by`),
  CONSTRAINT `fk_ti_creador` FOREIGN KEY (`created_by`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_ti_profesional` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`),
  CONSTRAINT `fk_ti_subservicio` FOREIGN KEY (`subservicio_id`) REFERENCES `subservicios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `talleres_institucionales`
--

LOCK TABLES `talleres_institucionales` WRITE;
/*!40000 ALTER TABLE `talleres_institucionales` DISABLE KEYS */;
/*!40000 ALTER TABLE `talleres_institucionales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tareas`
--

DROP TABLE IF EXISTS `tareas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tareas` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `sesion_id` int(10) unsigned NOT NULL,
  `paciente_id` int(10) unsigned NOT NULL,
  `titulo` varchar(200) DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `fecha_asignacion` date NOT NULL,
  `fecha_limite` date DEFAULT NULL,
  `estado` enum('pendiente','en_proceso','completada','no_realizada','no_completada') DEFAULT 'pendiente',
  `respuesta_paciente` text DEFAULT NULL,
  `respondido_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_tareas_sesion` (`sesion_id`),
  KEY `fk_tareas_paciente` (`paciente_id`),
  CONSTRAINT `fk_tareas_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`),
  CONSTRAINT `fk_tareas_sesion` FOREIGN KEY (`sesion_id`) REFERENCES `sesiones` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tareas`
--

LOCK TABLES `tareas` WRITE;
/*!40000 ALTER TABLE `tareas` DISABLE KEYS */;
INSERT INTO `tareas` VALUES (1,1,10,'tarea prueba 1','descripcion tarea prueba 1','2026-05-16','2026-05-19','pendiente',NULL,NULL,'2026-05-16 05:41:44','2026-05-16 05:41:44'),(2,3,10,'tarea 3','desc tarea 3','2026-05-16','2026-05-22','pendiente',NULL,NULL,'2026-05-16 06:26:12','2026-05-16 06:26:12');
/*!40000 ALTER TABLE `tareas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `persona_id` int(10) unsigned NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `rol` enum('administrador','profesional','paciente') NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `debe_cambiar_password` tinyint(1) NOT NULL DEFAULT 0,
  `ultimo_acceso` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_usuarios_persona` (`persona_id`),
  CONSTRAINT `fk_usuarios_persona` FOREIGN KEY (`persona_id`) REFERENCES `personas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` VALUES (1,1,'$2y$12$VSarL1OeqjBuCmDvr66U6ue6p6PT8ZpEYaaGHD2DXX.InHpk7P586','administrador',1,0,'2026-05-15 18:20:51','2026-05-02 05:37:05','2026-05-15 18:20:51'),(2,2,'$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','profesional',1,0,NULL,'2026-05-14 04:51:11','2026-05-14 04:51:11'),(3,3,'$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','profesional',1,0,NULL,'2026-05-14 04:51:11','2026-05-14 04:51:11'),(4,4,'$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','profesional',1,0,NULL,'2026-05-14 04:51:11','2026-05-14 04:51:11');
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `v_agenda_dia`
--

DROP TABLE IF EXISTS `v_agenda_dia`;
/*!50001 DROP VIEW IF EXISTS `v_agenda_dia`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_agenda_dia` AS SELECT 
 1 AS `cita_id`,
 1 AS `fecha_hora_inicio`,
 1 AS `estado`,
 1 AS `tipo_cita`,
 1 AS `modalidad_sesion`,
 1 AS `precio_cita`,
 1 AS `descuento_cita`,
 1 AS `motivo_descuento_cita`,
 1 AS `paciente`,
 1 AS `telefono_paciente`,
 1 AS `apoderado`,
 1 AS `telefono_apoderado`,
 1 AS `profesional`,
 1 AS `subservicio`,
 1 AS `modalidad`,
 1 AS `duracion_min`,
 1 AS `servicio`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_historial_paciente`
--

DROP TABLE IF EXISTS `v_historial_paciente`;
/*!50001 DROP VIEW IF EXISTS `v_historial_paciente`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_historial_paciente` AS SELECT 
 1 AS `paciente_id`,
 1 AS `paciente`,
 1 AS `atencion_id`,
 1 AS `fecha_inicio`,
 1 AS `fecha_fin`,
 1 AS `estado_atencion`,
 1 AS `motivo_consulta`,
 1 AS `grado_instruccion_atencion`,
 1 AS `ocupacion_atencion`,
 1 AS `estado_civil_atencion`,
 1 AS `observacion_general`,
 1 AS `observacion_conducta`,
 1 AS `antecedentes_relevantes`,
 1 AS `recomendaciones`,
 1 AS `subservicio`,
 1 AS `modalidad`,
 1 AS `profesional`,
 1 AS `sesion_id`,
 1 AS `numero_sesion`,
 1 AS `fecha_sesion`,
 1 AS `modalidad_sesion`,
 1 AS `precio_sesion`,
 1 AS `nota_clinica`,
 1 AS `cie10_codigo`,
 1 AS `diagnostico`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_pacientes_apoderados`
--

DROP TABLE IF EXISTS `v_pacientes_apoderados`;
/*!50001 DROP VIEW IF EXISTS `v_pacientes_apoderados`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_pacientes_apoderados` AS SELECT 
 1 AS `paciente_id`,
 1 AS `paciente`,
 1 AS `fecha_nacimiento`,
 1 AS `edad`,
 1 AS `parentesco`,
 1 AS `es_contacto_principal`,
 1 AS `es_responsable_pago`,
 1 AS `puede_ver_historial`,
 1 AS `apoderado`,
 1 AS `telefono_apoderado`,
 1 AS `email_apoderado`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_resumen_checkin`
--

DROP TABLE IF EXISTS `v_resumen_checkin`;
/*!50001 DROP VIEW IF EXISTS `v_resumen_checkin`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_resumen_checkin` AS SELECT 
 1 AS `atencion_id`,
 1 AS `paciente_id`,
 1 AS `paciente`,
 1 AS `total_checkins`,
 1 AS `promedio_estado`,
 1 AS `promedio_estres`,
 1 AS `promedio_sueno`,
 1 AS `primer_checkin`,
 1 AS `ultimo_checkin`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_saldo_pacientes`
--

DROP TABLE IF EXISTS `v_saldo_pacientes`;
/*!50001 DROP VIEW IF EXISTS `v_saldo_pacientes`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_saldo_pacientes` AS SELECT 
 1 AS `paciente_id`,
 1 AS `paciente`,
 1 AS `total_cuentas`,
 1 AS `total_facturado`,
 1 AS `total_pagado`,
 1 AS `saldo_total_pendiente`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_sesiones_planilla`
--

DROP TABLE IF EXISTS `v_sesiones_planilla`;
/*!50001 DROP VIEW IF EXISTS `v_sesiones_planilla`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_sesiones_planilla` AS SELECT 
 1 AS `sesion_id`,
 1 AS `atencion_id`,
 1 AS `numero_sesion`,
 1 AS `fecha_hora`,
 1 AS `modalidad_sesion`,
 1 AS `precio_sesion`,
 1 AS `paciente_paquete_id`,
 1 AS `profesional_id`,
 1 AS `paciente_id`,
 1 AS `subservicio`,
 1 AS `paciente_nombre`,
 1 AS `tipo_cobertura`,
 1 AS `valor_sesion`,
 1 AS `paquete_nombre`,
 1 AS `cuenta_cobro_id`,
 1 AS `monto_facturado`,
 1 AS `monto_cobrado`,
 1 AS `saldo_pendiente`*/;
SET character_set_client = @saved_cs_client;

--
-- Final view structure for view `v_agenda_dia`
--

/*!50001 DROP VIEW IF EXISTS `v_agenda_dia`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_agenda_dia` AS select `ci`.`id` AS `cita_id`,`ci`.`fecha_hora_inicio` AS `fecha_hora_inicio`,`ci`.`estado` AS `estado`,`ci`.`tipo_cita` AS `tipo_cita`,`ci`.`modalidad_sesion` AS `modalidad_sesion`,`ci`.`precio_acordado` AS `precio_cita`,`ci`.`descuento_monto` AS `descuento_cita`,`ci`.`motivo_descuento` AS `motivo_descuento_cita`,concat(`pe_p`.`nombres`,' ',`pe_p`.`apellidos`) AS `paciente`,`pe_p`.`telefono` AS `telefono_paciente`,concat(`pe_a`.`nombres`,' ',`pe_a`.`apellidos`) AS `apoderado`,`pe_a`.`telefono` AS `telefono_apoderado`,concat(`pe_r`.`nombres`,' ',`pe_r`.`apellidos`) AS `profesional`,`ss`.`nombre` AS `subservicio`,`ss`.`modalidad` AS `modalidad`,`ss`.`duracion_min` AS `duracion_min`,`se`.`nombre` AS `servicio` from (((((((((`citas` `ci` join `pacientes` `p` on(`p`.`id` = `ci`.`paciente_id`)) join `personas` `pe_p` on(`pe_p`.`id` = `p`.`persona_id`)) join `profesionales` `pr` on(`pr`.`id` = `ci`.`profesional_id`)) join `personas` `pe_r` on(`pe_r`.`id` = `pr`.`persona_id`)) join `subservicios` `ss` on(`ss`.`id` = `ci`.`subservicio_id`)) join `servicios` `se` on(`se`.`id` = `ss`.`servicio_id`)) left join `apoderado_paciente` `ap` on(`ap`.`paciente_id` = `p`.`id` and `ap`.`es_contacto_principal` = 1)) left join `apoderados` `ao` on(`ao`.`id` = `ap`.`apoderado_id`)) left join `personas` `pe_a` on(`pe_a`.`id` = `ao`.`persona_id`)) where `ci`.`estado` not in ('cancelada','reprogramada') */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_historial_paciente`
--

/*!50001 DROP VIEW IF EXISTS `v_historial_paciente`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_historial_paciente` AS select `p`.`id` AS `paciente_id`,concat(`pe`.`nombres`,' ',`pe`.`apellidos`) AS `paciente`,`a`.`id` AS `atencion_id`,`a`.`fecha_inicio` AS `fecha_inicio`,`a`.`fecha_fin` AS `fecha_fin`,`a`.`estado` AS `estado_atencion`,`a`.`motivo_consulta` AS `motivo_consulta`,`a`.`grado_instruccion` AS `grado_instruccion_atencion`,`a`.`ocupacion` AS `ocupacion_atencion`,`a`.`estado_civil` AS `estado_civil_atencion`,`a`.`observacion_general` AS `observacion_general`,`a`.`observacion_conducta` AS `observacion_conducta`,`a`.`antecedentes_relevantes` AS `antecedentes_relevantes`,`a`.`recomendaciones` AS `recomendaciones`,`ss`.`nombre` AS `subservicio`,`ss`.`modalidad` AS `modalidad`,concat(`pf`.`nombres`,' ',`pf`.`apellidos`) AS `profesional`,`s`.`id` AS `sesion_id`,`s`.`numero_sesion` AS `numero_sesion`,`s`.`fecha_hora` AS `fecha_sesion`,`s`.`modalidad_sesion` AS `modalidad_sesion`,`s`.`precio_sesion` AS `precio_sesion`,`s`.`nota_clinica` AS `nota_clinica`,`d`.`cie10_codigo` AS `cie10_codigo`,`c`.`descripcion_corta` AS `diagnostico` from ((((((((`pacientes` `p` join `personas` `pe` on(`pe`.`id` = `p`.`persona_id`)) join `atenciones` `a` on(`a`.`paciente_id` = `p`.`id`)) join `subservicios` `ss` on(`ss`.`id` = `a`.`subservicio_id`)) join `profesionales` `pr` on(`pr`.`id` = `a`.`profesional_id`)) join `personas` `pf` on(`pf`.`id` = `pr`.`persona_id`)) left join `sesiones` `s` on(`s`.`atencion_id` = `a`.`id`)) left join `diagnosticos_atencion` `d` on(`d`.`atencion_id` = `a`.`id` and `d`.`jerarquia` = 'principal' and `d`.`nivel_certeza` in ('definitivo','presuntivo'))) left join `cie10` `c` on(`c`.`codigo` = `d`.`cie10_codigo`)) where `ss`.`modalidad` = 'individual' union all select `p`.`id` AS `paciente_id`,concat(`pe`.`nombres`,' ',`pe`.`apellidos`) AS `paciente`,`a`.`id` AS `atencion_id`,`a`.`fecha_inicio` AS `fecha_inicio`,`a`.`fecha_fin` AS `fecha_fin`,`a`.`estado` AS `estado_atencion`,`a`.`motivo_consulta` AS `motivo_consulta`,`a`.`grado_instruccion` AS `grado_instruccion_atencion`,`a`.`ocupacion` AS `ocupacion_atencion`,`a`.`estado_civil` AS `estado_civil_atencion`,`a`.`observacion_general` AS `observacion_general`,`a`.`observacion_conducta` AS `observacion_conducta`,`a`.`antecedentes_relevantes` AS `antecedentes_relevantes`,`a`.`recomendaciones` AS `recomendaciones`,`ss`.`nombre` AS `subservicio`,`ss`.`modalidad` AS `modalidad`,concat(`pf`.`nombres`,' ',`pf`.`apellidos`) AS `profesional`,`sg`.`id` AS `sesion_id`,`sg`.`numero_sesion` AS `numero_sesion`,`sg`.`fecha_hora` AS `fecha_sesion`,'presencial' AS `modalidad_sesion`,NULL AS `precio_sesion`,`sg`.`nota_clinica_compartida` AS `nota_clinica`,`d`.`cie10_codigo` AS `cie10_codigo`,`c`.`descripcion_corta` AS `diagnostico` from ((((((((((`pacientes` `p` join `personas` `pe` on(`pe`.`id` = `p`.`persona_id`)) join `atenciones` `a` on(`a`.`paciente_id` = `p`.`id`)) join `subservicios` `ss` on(`ss`.`id` = `a`.`subservicio_id`)) join `profesionales` `pr` on(`pr`.`id` = `a`.`profesional_id`)) join `personas` `pf` on(`pf`.`id` = `pr`.`persona_id`)) join `atencion_vinculo_detalle` `avd` on(`avd`.`atencion_id` = `a`.`id`)) join `atenciones_vinculadas` `av` on(`av`.`id` = `avd`.`vinculo_id`)) left join `sesiones_grupo` `sg` on(`sg`.`vinculo_id` = `av`.`id`)) left join `diagnosticos_atencion` `d` on(`d`.`atencion_id` = `a`.`id` and `d`.`jerarquia` = 'principal' and `d`.`nivel_certeza` in ('definitivo','presuntivo'))) left join `cie10` `c` on(`c`.`codigo` = `d`.`cie10_codigo`)) where `ss`.`modalidad` in ('pareja','familiar','grupal') */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_pacientes_apoderados`
--

/*!50001 DROP VIEW IF EXISTS `v_pacientes_apoderados`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_pacientes_apoderados` AS select `p`.`id` AS `paciente_id`,concat(`pe_p`.`nombres`,' ',`pe_p`.`apellidos`) AS `paciente`,`pe_p`.`fecha_nacimiento` AS `fecha_nacimiento`,timestampdiff(YEAR,`pe_p`.`fecha_nacimiento`,curdate()) AS `edad`,`ap`.`parentesco` AS `parentesco`,`ap`.`es_contacto_principal` AS `es_contacto_principal`,`ap`.`es_responsable_pago` AS `es_responsable_pago`,`ap`.`puede_ver_historial` AS `puede_ver_historial`,concat(`pe_a`.`nombres`,' ',`pe_a`.`apellidos`) AS `apoderado`,`pe_a`.`telefono` AS `telefono_apoderado`,`pe_a`.`email` AS `email_apoderado` from ((((`pacientes` `p` join `personas` `pe_p` on(`pe_p`.`id` = `p`.`persona_id`)) left join `apoderado_paciente` `ap` on(`ap`.`paciente_id` = `p`.`id`)) left join `apoderados` `ao` on(`ao`.`id` = `ap`.`apoderado_id`)) left join `personas` `pe_a` on(`pe_a`.`id` = `ao`.`persona_id`)) order by `p`.`id`,`ap`.`es_contacto_principal` desc */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_resumen_checkin`
--

/*!50001 DROP VIEW IF EXISTS `v_resumen_checkin`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_resumen_checkin` AS select `ce`.`atencion_id` AS `atencion_id`,`ce`.`paciente_id` AS `paciente_id`,concat(`pe`.`nombres`,' ',`pe`.`apellidos`) AS `paciente`,count(0) AS `total_checkins`,round(avg(`ce`.`como_te_sientes`),2) AS `promedio_estado`,round(avg(`ce`.`nivel_estres`),2) AS `promedio_estres`,round(avg(`ce`.`dormiste_bien`),2) AS `promedio_sueno`,min(`ce`.`fecha_hora`) AS `primer_checkin`,max(`ce`.`fecha_hora`) AS `ultimo_checkin` from ((`checkin_emocional` `ce` join `pacientes` `p` on(`p`.`id` = `ce`.`paciente_id`)) join `personas` `pe` on(`pe`.`id` = `p`.`persona_id`)) group by `ce`.`atencion_id`,`ce`.`paciente_id`,`pe`.`nombres`,`pe`.`apellidos` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_saldo_pacientes`
--

/*!50001 DROP VIEW IF EXISTS `v_saldo_pacientes`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_saldo_pacientes` AS select `p`.`id` AS `paciente_id`,concat(`pe`.`nombres`,' ',`pe`.`apellidos`) AS `paciente`,count(`cc`.`id`) AS `total_cuentas`,sum(`cc`.`monto_total`) AS `total_facturado`,sum(`cc`.`monto_pagado`) AS `total_pagado`,sum(`cc`.`saldo_pendiente`) AS `saldo_total_pendiente` from ((`pacientes` `p` join `personas` `pe` on(`pe`.`id` = `p`.`persona_id`)) left join `cuentas_cobro` `cc` on(`cc`.`paciente_id` = `p`.`id` and `cc`.`estado` <> 'anulado')) group by `p`.`id`,`pe`.`nombres`,`pe`.`apellidos` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_sesiones_planilla`
--

/*!50001 DROP VIEW IF EXISTS `v_sesiones_planilla`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_sesiones_planilla` AS select `s`.`id` AS `sesion_id`,`s`.`atencion_id` AS `atencion_id`,`s`.`numero_sesion` AS `numero_sesion`,`s`.`fecha_hora` AS `fecha_hora`,`s`.`modalidad_sesion` AS `modalidad_sesion`,`s`.`precio_sesion` AS `precio_sesion`,`s`.`paciente_paquete_id` AS `paciente_paquete_id`,`a`.`profesional_id` AS `profesional_id`,`a`.`paciente_id` AS `paciente_id`,`ss`.`nombre` AS `subservicio`,concat(`pe`.`nombres`,' ',`pe`.`apellidos`) AS `paciente_nombre`,case when `s`.`paciente_paquete_id` is not null then 'paquete' when `ads`.`sesion_id` is not null then 'adelanto' else 'directo' end AS `tipo_cobertura`,coalesce(`s`.`precio_sesion`,0) AS `valor_sesion`,`pk`.`nombre` AS `paquete_nombre`,`cc`.`id` AS `cuenta_cobro_id`,coalesce(`cc`.`monto_total`,0) AS `monto_facturado`,coalesce(`cc`.`monto_pagado`,0) AS `monto_cobrado`,coalesce(`cc`.`saldo_pendiente`,0) AS `saldo_pendiente` from ((((((((`sesiones` `s` join `atenciones` `a` on(`a`.`id` = `s`.`atencion_id`)) join `subservicios` `ss` on(`ss`.`id` = `a`.`subservicio_id`)) join `pacientes` `p` on(`p`.`id` = `a`.`paciente_id`)) join `personas` `pe` on(`pe`.`id` = `p`.`persona_id`)) left join `cuentas_cobro` `cc` on(`cc`.`sesion_id` = `s`.`id`)) left join `paciente_paquetes` `pp` on(`pp`.`id` = `s`.`paciente_paquete_id`)) left join `paquetes` `pk` on(`pk`.`id` = `pp`.`paquete_id`)) left join `adelanto_sesion` `ads` on(`ads`.`sesion_id` = `s`.`id`)) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-16 16:11:53
