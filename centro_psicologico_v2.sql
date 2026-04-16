-- ============================================================
--  BASE DE DATOS — CENTRO PSICOLÓGICO
--  Motor : MySQL 8.0+
--  Charset: utf8mb4 / Collation: utf8mb4_unicode_ci
-- ============================================================

CREATE DATABASE IF NOT EXISTS centro_psicologico
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE centro_psicologico;

SET FOREIGN_KEY_CHECKS = 0;


-- ============================================================
--  MÓDULO 1 — PERSONAS, USUARIOS, PROFESIONALES Y PACIENTES
-- ============================================================

-- Datos personales comunes a cualquier tipo de persona en el sistema
CREATE TABLE personas (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dni                   VARCHAR(15)   NOT NULL,
  nombres               VARCHAR(100)  NOT NULL,
  apellidos             VARCHAR(100)  NOT NULL,
  fecha_nacimiento      DATE,
  sexo                  ENUM('masculino','femenino','otro','no_especificado')
                          DEFAULT 'no_especificado',
  telefono              VARCHAR(20),
  email                 VARCHAR(150),
  foto_url              VARCHAR(500),
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_personas_dni   (dni),
  UNIQUE KEY uq_personas_email (email)
) ENGINE=InnoDB;

-- Autenticación y rol — separado de los datos personales
CREATE TABLE usuarios (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  persona_id            INT UNSIGNED  NOT NULL,
  password_hash         VARCHAR(255)  NOT NULL,
  rol                   ENUM('administrador','profesional','paciente') NOT NULL,
  activo                TINYINT(1)    NOT NULL DEFAULT 1,
  ultimo_acceso         TIMESTAMP     NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuarios_persona (persona_id),
  CONSTRAINT fk_usuarios_persona FOREIGN KEY (persona_id) REFERENCES personas(id)
) ENGINE=InnoDB;

-- Datos exclusivos del profesional
CREATE TABLE profesionales (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  persona_id            INT UNSIGNED  NOT NULL,
  colegiatura           VARCHAR(30)   NOT NULL,
  especialidad          VARCHAR(150),
  descripcion_bio       TEXT,
  tarifa_hora           DECIMAL(10,2),
  activo                TINYINT(1)    NOT NULL DEFAULT 1,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_profesionales_persona     (persona_id),
  UNIQUE KEY uq_profesionales_colegiatura (colegiatura),
  CONSTRAINT fk_profesionales_persona FOREIGN KEY (persona_id) REFERENCES personas(id)
) ENGINE=InnoDB;

-- Datos exclusivos del paciente
-- grado_instruccion, ocupacion y estado_civil: dato de ficha base (se pre-llena en atención)
CREATE TABLE pacientes (
  id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  persona_id              INT UNSIGNED  NOT NULL,
  grado_instruccion       ENUM('sin_instruccion','primaria_incompleta','primaria_completa',
                               'secundaria_incompleta','secundaria_completa',
                               'tecnico_incompleto','tecnico_completo',
                               'superior_incompleto','superior_completo',
                               'posgrado','no_especificado')
                            DEFAULT 'no_especificado',
  ocupacion               VARCHAR(150),
  estado_civil            ENUM('soltero','casado','conviviente','divorciado',
                               'separado','viudo','no_especificado')
                            DEFAULT 'no_especificado',
  telefono_emergencia     VARCHAR(20),
  contacto_emergencia     VARCHAR(150),
  antecedentes            TEXT          COMMENT 'Antecedentes clínicos generales del paciente',
  activo                  TINYINT(1)    NOT NULL DEFAULT 1,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pacientes_persona (persona_id),
  CONSTRAINT fk_pacientes_persona FOREIGN KEY (persona_id) REFERENCES personas(id)
) ENGINE=InnoDB;


-- ============================================================
--  MÓDULO 2 — APODERADOS
--  Padres, madres o tutores legales de pacientes menores.
--  No requieren cuenta de usuario en el sistema.
-- ============================================================

CREATE TABLE apoderados (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  persona_id            INT UNSIGNED  NOT NULL,
  activo                TINYINT(1)    NOT NULL DEFAULT 1,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_apoderados_persona (persona_id),
  CONSTRAINT fk_apoderados_persona FOREIGN KEY (persona_id) REFERENCES personas(id)
) ENGINE=InnoDB;

-- Relación N:M entre apoderados y pacientes
CREATE TABLE apoderado_paciente (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  apoderado_id          INT UNSIGNED  NOT NULL,
  paciente_id           INT UNSIGNED  NOT NULL,
  parentesco            ENUM('padre','madre','tutor_legal','abuelo',
                             'hermano','otro') NOT NULL,
  es_contacto_principal TINYINT(1)    NOT NULL DEFAULT 0,
  es_responsable_pago   TINYINT(1)    NOT NULL DEFAULT 0,
  puede_ver_historial   TINYINT(1)    NOT NULL DEFAULT 1,
  notas                 VARCHAR(300),
  UNIQUE KEY uq_apoderado_paciente (apoderado_id, paciente_id),
  CONSTRAINT fk_ap_apoderado FOREIGN KEY (apoderado_id) REFERENCES apoderados(id),
  CONSTRAINT fk_ap_paciente  FOREIGN KEY (paciente_id)  REFERENCES pacientes(id)
) ENGINE=InnoDB;


-- ============================================================
--  MÓDULO 3 — CIE-10
-- ============================================================

-- Catálogo jerárquico: codigo_padre NULL = nivel capítulo
CREATE TABLE cie10 (
  codigo                VARCHAR(10)   PRIMARY KEY,
  codigo_padre          VARCHAR(10)   NULL,
  descripcion           VARCHAR(500)  NOT NULL,
  descripcion_corta     VARCHAR(150),
  capitulo              VARCHAR(10),
  bloque                VARCHAR(20),
  nivel                 TINYINT UNSIGNED DEFAULT 1
                          COMMENT '1=capítulo 2=bloque 3=categoría 4=subcategoría',
  activo                TINYINT(1)    NOT NULL DEFAULT 1,
  CONSTRAINT fk_cie10_padre FOREIGN KEY (codigo_padre) REFERENCES cie10(codigo)
) ENGINE=InnoDB;

CREATE FULLTEXT INDEX ft_cie10_descripcion ON cie10(descripcion, descripcion_corta);


-- ============================================================
--  MÓDULO 4 — SERVICIOS Y SUBSERVICIOS
-- ============================================================

CREATE TABLE servicios (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre                VARCHAR(150)  NOT NULL,
  descripcion           TEXT,
  tipo                  ENUM('individual','grupal','taller') NOT NULL,
  activo                TINYINT(1)    NOT NULL DEFAULT 1,
  orden                 TINYINT UNSIGNED DEFAULT 0,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- precio_base = referencia de catálogo; el precio real se acuerda en cada atención
CREATE TABLE subservicios (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  servicio_id           INT UNSIGNED  NOT NULL,
  nombre                VARCHAR(150)  NOT NULL,
  modalidad             ENUM('individual','pareja','familiar','grupal') NOT NULL,
  duracion_min          SMALLINT UNSIGNED DEFAULT 50,
  precio_base           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  activo                TINYINT(1)    NOT NULL DEFAULT 1,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_subservicios_servicio FOREIGN KEY (servicio_id) REFERENCES servicios(id)
) ENGINE=InnoDB;


-- ============================================================
--  MÓDULO 5 — CITAS Y AGENDA
--  Sin fecha_hora_fin: la duración se infiere del subservicio.
-- ============================================================

CREATE TABLE citas (
  id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cita_origen_id          INT UNSIGNED  NULL
                            COMMENT 'Apunta a la cita original si es reprogramación',
  paciente_id             INT UNSIGNED  NOT NULL,
  profesional_id          INT UNSIGNED  NOT NULL,
  subservicio_id          INT UNSIGNED  NOT NULL,
  fecha_hora_inicio       DATETIME      NOT NULL,
  estado                  ENUM('pendiente','confirmada','completada',
                               'cancelada','no_asistio','reprogramada')
                            NOT NULL DEFAULT 'pendiente',
  reprogramaciones_count  TINYINT UNSIGNED DEFAULT 0,
  notas                   TEXT,
  creado_por              INT UNSIGNED  NOT NULL,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_citas_fecha        (fecha_hora_inicio),
  INDEX idx_citas_profesional  (profesional_id, fecha_hora_inicio),
  INDEX idx_citas_paciente     (paciente_id),
  CONSTRAINT fk_citas_origen      FOREIGN KEY (cita_origen_id) REFERENCES citas(id),
  CONSTRAINT fk_citas_paciente    FOREIGN KEY (paciente_id)    REFERENCES pacientes(id),
  CONSTRAINT fk_citas_profesional FOREIGN KEY (profesional_id) REFERENCES profesionales(id),
  CONSTRAINT fk_citas_subservicio FOREIGN KEY (subservicio_id) REFERENCES subservicios(id),
  CONSTRAINT fk_citas_creador     FOREIGN KEY (creado_por)     REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- Trazabilidad completa de reprogramaciones y cambios de horario
CREATE TABLE historial_citas (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cita_id               INT UNSIGNED  NOT NULL,
  fecha_hora_anterior   DATETIME      NOT NULL,
  fecha_hora_nueva      DATETIME      NOT NULL,
  motivo                ENUM('reprogramacion','cancelacion','ajuste_hora','otro') NOT NULL,
  descripcion           TEXT,
  registrado_por        INT UNSIGNED  NOT NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hc_cita    FOREIGN KEY (cita_id)        REFERENCES citas(id),
  CONSTRAINT fk_hc_usuario FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;


-- ============================================================
--  MÓDULO 6 — ATENCIONES
--  Una atención = proceso terapéutico completo con N sesiones.
--  Precio acordado editable en la interfaz al registrar la cita.
--  Datos contextuales del momento (estado civil, ocupación, etc.)
--  se capturan aquí para historial longitudinal.
-- ============================================================

CREATE TABLE atenciones (
  id                        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id               INT UNSIGNED  NOT NULL,
  profesional_id            INT UNSIGNED  NOT NULL,
  cita_id                   INT UNSIGNED  NULL
                              COMMENT 'Cita de origen; NULL si se crea directamente',
  subservicio_id            INT UNSIGNED  NOT NULL,

  -- Precio pactado al momento de registrar (editable en la interfaz)
  precio_acordado           DECIMAL(10,2) NULL
                              COMMENT 'Monto final pactado con el paciente',
  descuento_monto           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  descuento_pct             DECIMAL(5,2)  NOT NULL DEFAULT 0.00
                              COMMENT 'Porcentaje referencial para mostrar en pantalla',
  motivo_descuento          VARCHAR(200)  NULL,
  precio_final              DECIMAL(10,2) GENERATED ALWAYS AS
                              (COALESCE(precio_acordado, 0) - descuento_monto) STORED,

  -- Contexto clínico del momento de la atención
  grado_instruccion         ENUM('sin_instruccion','primaria_incompleta','primaria_completa',
                                 'secundaria_incompleta','secundaria_completa',
                                 'tecnico_incompleto','tecnico_completo',
                                 'superior_incompleto','superior_completo',
                                 'posgrado','no_especificado')
                              DEFAULT 'no_especificado',
  ocupacion                 VARCHAR(150),
  estado_civil              ENUM('soltero','casado','conviviente','divorciado',
                                 'separado','viudo','no_especificado')
                              DEFAULT 'no_especificado',

  -- Campos clínicos de apertura del proceso
  motivo_consulta           TEXT          NOT NULL
                              COMMENT 'Razón principal por la que el paciente acude',
  observacion_general       TEXT
                              COMMENT 'Observación general del paciente al inicio',
  observacion_conducta      TEXT
                              COMMENT 'Observación del comportamiento y actitud en consulta',
  antecedentes_relevantes   TEXT
                              COMMENT 'Antecedentes específicos relevantes para esta atención',
  recomendaciones           TEXT
                              COMMENT 'Recomendaciones generales del profesional al cierre',

  -- Control del proceso
  fecha_inicio              DATE          NOT NULL,
  fecha_fin                 DATE          NULL
                              COMMENT 'NULL mientras la atención esté activa',
  estado                    ENUM('activa','pausada','completada','cancelada')
                              NOT NULL DEFAULT 'activa',
  numero_sesiones_plan      TINYINT UNSIGNED
                              COMMENT 'Número de sesiones planificadas',
  created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_atenciones_paciente    FOREIGN KEY (paciente_id)    REFERENCES pacientes(id),
  CONSTRAINT fk_atenciones_profesional FOREIGN KEY (profesional_id) REFERENCES profesionales(id),
  CONSTRAINT fk_atenciones_cita        FOREIGN KEY (cita_id)        REFERENCES citas(id),
  CONSTRAINT fk_atenciones_subservicio FOREIGN KEY (subservicio_id) REFERENCES subservicios(id)
) ENGINE=InnoDB;

-- Diagnósticos CIE-10 por atención (múltiples, con rol clínico)
CREATE TABLE diagnosticos_atencion (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  atencion_id           INT UNSIGNED  NOT NULL,
  cie10_codigo          VARCHAR(10)   NOT NULL,
  tipo                  ENUM('principal','secundario','presuntivo','descartado')
                          NOT NULL DEFAULT 'presuntivo',
  fecha_dx              DATE          NOT NULL,
  observacion_clinica   TEXT,
  registrado_por        INT UNSIGNED  NOT NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dx_atencion    FOREIGN KEY (atencion_id)    REFERENCES atenciones(id),
  CONSTRAINT fk_dx_cie10       FOREIGN KEY (cie10_codigo)   REFERENCES cie10(codigo),
  CONSTRAINT fk_dx_registrador FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- Vínculo grupal: agrupa atenciones individuales de un mismo proceso
CREATE TABLE atenciones_vinculadas (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre_grupo          VARCHAR(150),
  tipo_vinculo          ENUM('pareja','familiar','grupal') NOT NULL,
  subservicio_id        INT UNSIGNED  NOT NULL,
  profesional_id        INT UNSIGNED  NOT NULL,
  fecha_inicio          DATE          NOT NULL,
  fecha_fin             DATE          NULL,
  estado                ENUM('activo','completado','cancelado') NOT NULL DEFAULT 'activo',
  created_by            INT UNSIGNED  NOT NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_av_subservicio FOREIGN KEY (subservicio_id) REFERENCES subservicios(id),
  CONSTRAINT fk_av_profesional FOREIGN KEY (profesional_id) REFERENCES profesionales(id),
  CONSTRAINT fk_av_creador     FOREIGN KEY (created_by)     REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- Detalle: qué atención individual pertenece a qué vínculo grupal
CREATE TABLE atencion_vinculo_detalle (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vinculo_id            INT UNSIGNED  NOT NULL,
  atencion_id           INT UNSIGNED  NOT NULL,
  rol_en_grupo          ENUM('consultante','acompanante','familiar','participante')
                          NOT NULL DEFAULT 'participante',
  es_responsable_pago   TINYINT(1)    NOT NULL DEFAULT 0,
  -- Precio individual editable (para talleres con cuota por participante)
  precio_cuota          DECIMAL(10,2) NULL,
  descuento_monto       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  motivo_descuento      VARCHAR(200)  NULL,
  precio_final          DECIMAL(10,2) GENERATED ALWAYS AS
                          (COALESCE(precio_cuota, 0) - descuento_monto) STORED,
  UNIQUE KEY uq_avd (vinculo_id, atencion_id),
  CONSTRAINT fk_avd_vinculo  FOREIGN KEY (vinculo_id)  REFERENCES atenciones_vinculadas(id),
  CONSTRAINT fk_avd_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id)
) ENGINE=InnoDB;


-- ============================================================
--  MÓDULO 7 — SESIONES Y TAREAS
-- ============================================================

CREATE TABLE sesiones (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  atencion_id           INT UNSIGNED  NOT NULL,
  numero_sesion         TINYINT UNSIGNED NOT NULL DEFAULT 1,
  fecha_hora            DATETIME      NOT NULL,
  duracion_min          SMALLINT UNSIGNED,
  nota_clinica          TEXT          COMMENT 'Nota SOAP o formato libre del profesional',
  estado                ENUM('programada','realizada','cancelada','no_asistio')
                          NOT NULL DEFAULT 'programada',
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sesiones_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id)
) ENGINE=InnoDB;

-- Nota compartida para sesiones de vínculo grupal (pareja / familiar / taller)
CREATE TABLE sesiones_grupo (
  id                        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vinculo_id                INT UNSIGNED  NOT NULL,
  fecha_hora                DATETIME      NOT NULL,
  duracion_min              SMALLINT UNSIGNED,
  nota_clinica_compartida   TEXT
                              COMMENT 'Dinámica grupal, visible al profesional',
  nota_privada_p1           TEXT
                              COMMENT 'Observación individual — solo visible al profesional',
  nota_privada_p2           TEXT,
  nota_privada_p3           TEXT,
  estado                    ENUM('programada','realizada','cancelada','no_asistio')
                              NOT NULL DEFAULT 'programada',
  created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sg_vinculo FOREIGN KEY (vinculo_id) REFERENCES atenciones_vinculadas(id)
) ENGINE=InnoDB;

-- Tareas psicológicas asignadas dentro de una sesión activa
CREATE TABLE tareas (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sesion_id             INT UNSIGNED  NOT NULL,
  paciente_id           INT UNSIGNED  NOT NULL,
  titulo                VARCHAR(200)  NOT NULL,
  descripcion           TEXT,
  fecha_asignacion      DATE          NOT NULL,
  fecha_limite          DATE,
  estado                ENUM('pendiente','en_proceso','completada','no_realizada')
                          NOT NULL DEFAULT 'pendiente',
  respuesta_paciente    TEXT,
  respondido_at         TIMESTAMP     NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tareas_sesion   FOREIGN KEY (sesion_id)   REFERENCES sesiones(id),
  CONSTRAINT fk_tareas_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
) ENGINE=InnoDB;


-- ============================================================
--  MÓDULO 8 — CHECK-IN EMOCIONAL
--  Solo disponible durante una atención activa (atencion_id requerido)
-- ============================================================

CREATE TABLE checkin_emocional (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id           INT UNSIGNED  NOT NULL,
  atencion_id           INT UNSIGNED  NOT NULL,
  fecha_hora            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  como_te_sientes       TINYINT UNSIGNED NOT NULL COMMENT 'Escala 0–10',
  dormiste_bien         TINYINT UNSIGNED NOT NULL COMMENT 'Escala 0–10',
  nivel_estres          TINYINT UNSIGNED NOT NULL COMMENT 'Escala 0–10',
  hiciste_tarea         TINYINT(1)    NULL       COMMENT '1=sí 0=no NULL=no aplica',
  nota_opcional         TEXT,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_checkin_paciente_fecha (paciente_id, fecha_hora),
  CONSTRAINT fk_checkin_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  CONSTRAINT fk_checkin_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id)
) ENGINE=InnoDB;


-- ============================================================
--  MÓDULO 9 — SEGUIMIENTO Y ALERTAS
-- ============================================================

CREATE TABLE planes_seguimiento (
  id                          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  atencion_id                 INT UNSIGNED  NOT NULL,
  profesional_id              INT UNSIGNED  NOT NULL,
  frecuencia_checkin          ENUM('diario','cada_2_dias','semanal','libre')
                                NOT NULL DEFAULT 'libre',
  alerta_sin_respuesta_dias   TINYINT UNSIGNED DEFAULT 7,
  usar_phq9                   TINYINT(1) DEFAULT 0,
  usar_gad7                   TINYINT(1) DEFAULT 0,
  usar_escala_custom          TINYINT(1) DEFAULT 0,
  activo                      TINYINT(1) DEFAULT 1,
  created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_plan_atencion (atencion_id),
  CONSTRAINT fk_ps_atencion    FOREIGN KEY (atencion_id)    REFERENCES atenciones(id),
  CONSTRAINT fk_ps_profesional FOREIGN KEY (profesional_id) REFERENCES profesionales(id)
) ENGINE=InnoDB;

-- Reglas automáticas basadas en umbrales de check-in
CREATE TABLE reglas_alerta (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  plan_id               INT UNSIGNED  NOT NULL,
  nombre                VARCHAR(150)  NOT NULL,
  campo_origen          ENUM('como_te_sientes','dormiste_bien','nivel_estres',
                             'hiciste_tarea','dias_sin_checkin') NOT NULL,
  operador              ENUM('mayor_que','menor_que','igual_a',
                             'mayor_igual','menor_igual') NOT NULL,
  valor_umbral          DECIMAL(5,2)  NOT NULL,
  dias_consecutivos     TINYINT UNSIGNED DEFAULT 1,
  nivel_alerta          ENUM('informativa','moderada','alta','critica')
                          NOT NULL DEFAULT 'moderada',
  activa                TINYINT(1) DEFAULT 1,
  CONSTRAINT fk_ra_plan FOREIGN KEY (plan_id) REFERENCES planes_seguimiento(id)
) ENGINE=InnoDB;

-- Alertas generadas manualmente o por proceso automático (cron)
CREATE TABLE alertas (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  atencion_id           INT UNSIGNED  NOT NULL,
  paciente_id           INT UNSIGNED  NOT NULL,
  profesional_id        INT UNSIGNED  NOT NULL,
  regla_id              INT UNSIGNED  NULL COMMENT 'NULL si es alerta manual',
  tipo                  ENUM('sin_respuesta','riesgo_emocional','tarea_pendiente',
                             'inasistencia','escala_critica','manual') NOT NULL,
  nivel                 ENUM('informativa','moderada','alta','critica') NOT NULL,
  descripcion           TEXT,
  estado                ENUM('activa','atendida','descartada') NOT NULL DEFAULT 'activa',
  accion_tomada         TEXT,
  atendida_por          INT UNSIGNED  NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atendida_at           TIMESTAMP     NULL,
  INDEX idx_alertas_profesional (profesional_id, estado),
  CONSTRAINT fk_alertas_atencion    FOREIGN KEY (atencion_id)    REFERENCES atenciones(id),
  CONSTRAINT fk_alertas_paciente    FOREIGN KEY (paciente_id)    REFERENCES pacientes(id),
  CONSTRAINT fk_alertas_profesional FOREIGN KEY (profesional_id) REFERENCES profesionales(id),
  CONSTRAINT fk_alertas_regla       FOREIGN KEY (regla_id)       REFERENCES reglas_alerta(id),
  CONSTRAINT fk_alertas_atendida    FOREIGN KEY (atendida_por)   REFERENCES usuarios(id)
) ENGINE=InnoDB;


-- ============================================================
--  MÓDULO 10 — PAGOS DE PACIENTES
-- ============================================================

-- Cuenta de cobro: individual (paciente_id) o grupal (vinculo_id)
CREATE TABLE cuentas_cobro (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id           INT UNSIGNED  NULL COMMENT 'NULL si la cuenta es del grupo',
  vinculo_id            INT UNSIGNED  NULL COMMENT 'NULL si la cuenta es individual',
  atencion_id           INT UNSIGNED  NULL,
  concepto              VARCHAR(300)  NOT NULL,
  monto_total           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  descuento_aplicado    DECIMAL(10,2) NOT NULL DEFAULT 0.00
                          COMMENT 'Descuento ya reflejado en monto_total (informativo)',
  motivo_descuento      VARCHAR(200)  NULL,
  monto_pagado          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  saldo_pendiente       DECIMAL(10,2) GENERATED ALWAYS AS
                          (monto_total - monto_pagado) STORED,
  estado                ENUM('pendiente','pago_parcial','pagado','anulado')
                          NOT NULL DEFAULT 'pendiente',
  fecha_emision         DATE          NOT NULL,
  fecha_vencimiento     DATE,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cc_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  CONSTRAINT fk_cc_vinculo  FOREIGN KEY (vinculo_id)  REFERENCES atenciones_vinculadas(id),
  CONSTRAINT fk_cc_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id),
  CONSTRAINT chk_cc_titular CHECK (paciente_id IS NOT NULL OR vinculo_id IS NOT NULL)
) ENGINE=InnoDB;

-- Distribución de responsabilidad de pago en cuentas grupales
CREATE TABLE grupo_participantes_pago (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cuenta_cobro_id       INT UNSIGNED  NOT NULL,
  paciente_id           INT UNSIGNED  NOT NULL,
  pct_responsabilidad   DECIMAL(5,2)  NOT NULL DEFAULT 50.00,
  es_responsable_pago   TINYINT(1)    NOT NULL DEFAULT 0,
  UNIQUE KEY uq_gpp (cuenta_cobro_id, paciente_id),
  CONSTRAINT fk_gpp_cuenta   FOREIGN KEY (cuenta_cobro_id) REFERENCES cuentas_cobro(id),
  CONSTRAINT fk_gpp_paciente FOREIGN KEY (paciente_id)     REFERENCES pacientes(id)
) ENGINE=InnoDB;

-- Abonos contra una cuenta de cobro (parciales o totales)
-- El pagador puede ser: paciente registrado, apoderado o persona externa
CREATE TABLE pagos_paciente (
  id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cuenta_cobro_id         INT UNSIGNED  NOT NULL,
  pagado_por_paciente     INT UNSIGNED  NULL COMMENT 'Paciente registrado que paga',
  pagado_por_apoderado    INT UNSIGNED  NULL COMMENT 'Apoderado que paga por el menor',
  pagado_por_externo      VARCHAR(150)  NULL COMMENT 'Nombre libre si no está en el sistema',
  monto                   DECIMAL(10,2) NOT NULL,
  fecha_pago              DATE          NOT NULL,
  metodo_pago             ENUM('efectivo','transferencia','tarjeta_debito',
                               'tarjeta_credito','yape','plin','otro') NOT NULL,
  numero_comprobante      VARCHAR(60),
  registrado_por          INT UNSIGNED  NOT NULL,
  notas                   TEXT,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pp_cuenta      FOREIGN KEY (cuenta_cobro_id)    REFERENCES cuentas_cobro(id),
  CONSTRAINT fk_pp_paciente    FOREIGN KEY (pagado_por_paciente) REFERENCES pacientes(id),
  CONSTRAINT fk_pp_apoderado   FOREIGN KEY (pagado_por_apoderado) REFERENCES apoderados(id),
  CONSTRAINT fk_pp_registrador FOREIGN KEY (registrado_por)      REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- Restricción: al menos un tipo de pagador debe estar presente
ALTER TABLE pagos_paciente
  ADD CONSTRAINT chk_pagador CHECK (
    pagado_por_paciente  IS NOT NULL OR
    pagado_por_apoderado IS NOT NULL OR
    pagado_por_externo   IS NOT NULL
  );

-- Trigger: actualiza monto_pagado y estado tras cada abono
DELIMITER $$
CREATE TRIGGER trg_actualizar_monto_pagado
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
END$$
DELIMITER ;


-- ============================================================
--  MÓDULO 11 — PAGOS AL PERSONAL
-- ============================================================

CREATE TABLE planillas (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profesional_id        INT UNSIGNED  NOT NULL,
  periodo_inicio        DATE          NOT NULL,
  periodo_fin           DATE          NOT NULL,
  sesiones_realizadas   SMALLINT UNSIGNED DEFAULT 0,
  monto_bruto           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  descuentos            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  monto_neto            DECIMAL(10,2) GENERATED ALWAYS AS (monto_bruto - descuentos) STORED,
  estado                ENUM('borrador','aprobada','pagada','anulada')
                          NOT NULL DEFAULT 'borrador',
  observaciones         TEXT,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_planillas_profesional FOREIGN KEY (profesional_id) REFERENCES profesionales(id)
) ENGINE=InnoDB;

CREATE TABLE pagos_personal (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  planilla_id           INT UNSIGNED  NOT NULL,
  monto                 DECIMAL(10,2) NOT NULL,
  fecha_pago            DATE          NOT NULL,
  metodo_pago           ENUM('transferencia','efectivo','cheque','otro') NOT NULL,
  referencia            VARCHAR(100),
  registrado_por        INT UNSIGNED  NOT NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pagos_personal_planilla    FOREIGN KEY (planilla_id)    REFERENCES planillas(id),
  CONSTRAINT fk_pagos_personal_registrador FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;


-- ============================================================
--  VISTAS
-- ============================================================

-- Historial clínico completo de un paciente
CREATE OR REPLACE VIEW v_historial_paciente AS
SELECT
  p.id                                        AS paciente_id,
  CONCAT(pe.nombres, ' ', pe.apellidos)       AS paciente,
  a.id                                        AS atencion_id,
  a.fecha_inicio,
  a.fecha_fin,
  a.estado                                    AS estado_atencion,
  a.motivo_consulta,
  a.grado_instruccion                         AS grado_instruccion_atencion,
  a.ocupacion                                 AS ocupacion_atencion,
  a.estado_civil                              AS estado_civil_atencion,
  a.recomendaciones,
  ss.nombre                                   AS subservicio,
  ss.modalidad,
  CONCAT(pf.nombres, ' ', pf.apellidos)       AS profesional,
  s.id                                        AS sesion_id,
  s.numero_sesion,
  s.fecha_hora                                AS fecha_sesion,
  s.estado                                    AS estado_sesion,
  s.nota_clinica,
  d.cie10_codigo,
  c.descripcion_corta                         AS diagnostico
FROM pacientes       p
JOIN personas        pe ON pe.id = p.persona_id
JOIN atenciones      a  ON a.paciente_id = p.id
JOIN subservicios    ss ON ss.id = a.subservicio_id
JOIN profesionales   pr ON pr.id = a.profesional_id
JOIN personas        pf ON pf.id = pr.persona_id
LEFT JOIN sesiones   s  ON s.atencion_id = a.id
LEFT JOIN diagnosticos_atencion d
       ON d.atencion_id = a.id AND d.tipo = 'principal'
LEFT JOIN cie10      c  ON c.codigo = d.cie10_codigo;

-- Agenda del día con apoderado y precio final
CREATE OR REPLACE VIEW v_agenda_dia AS
SELECT
  ci.id                                       AS cita_id,
  ci.fecha_hora_inicio,
  ci.estado,
  CONCAT(pe_p.nombres, ' ', pe_p.apellidos)   AS paciente,
  pe_p.telefono                               AS telefono_paciente,
  CONCAT(pe_a.nombres, ' ', pe_a.apellidos)   AS apoderado,
  pe_a.telefono                               AS telefono_apoderado,
  CONCAT(pe_r.nombres, ' ', pe_r.apellidos)   AS profesional,
  ss.nombre                                   AS subservicio,
  ss.modalidad,
  ss.duracion_min,
  se.nombre                                   AS servicio,
  ss.precio_base,
  a.precio_acordado,
  a.descuento_monto,
  a.precio_final
FROM citas           ci
JOIN pacientes       p     ON p.id    = ci.paciente_id
JOIN personas        pe_p  ON pe_p.id = p.persona_id
JOIN profesionales   pr    ON pr.id   = ci.profesional_id
JOIN personas        pe_r  ON pe_r.id = pr.persona_id
JOIN subservicios    ss    ON ss.id   = ci.subservicio_id
JOIN servicios       se    ON se.id   = ss.servicio_id
LEFT JOIN atenciones a     ON a.cita_id = ci.id
LEFT JOIN apoderado_paciente ap
       ON ap.paciente_id = p.id AND ap.es_contacto_principal = 1
LEFT JOIN apoderados      ao   ON ao.id    = ap.apoderado_id
LEFT JOIN personas        pe_a ON pe_a.id  = ao.persona_id
WHERE ci.estado NOT IN ('cancelada','reprogramada');

-- Saldo pendiente por paciente
CREATE OR REPLACE VIEW v_saldo_pacientes AS
SELECT
  p.id                                        AS paciente_id,
  CONCAT(pe.nombres, ' ', pe.apellidos)       AS paciente,
  COUNT(cc.id)                                AS total_cuentas,
  SUM(cc.monto_total)                         AS total_facturado,
  SUM(cc.monto_pagado)                        AS total_pagado,
  SUM(cc.saldo_pendiente)                     AS saldo_total_pendiente
FROM pacientes       p
JOIN personas        pe ON pe.id = p.persona_id
LEFT JOIN cuentas_cobro cc
       ON cc.paciente_id = p.id AND cc.estado != 'anulado'
GROUP BY p.id, pe.nombres, pe.apellidos;

-- Resumen de check-ins emocionales por atención
CREATE OR REPLACE VIEW v_resumen_checkin AS
SELECT
  ce.atencion_id,
  ce.paciente_id,
  CONCAT(pe.nombres, ' ', pe.apellidos)       AS paciente,
  COUNT(*)                                    AS total_checkins,
  ROUND(AVG(ce.como_te_sientes), 2)           AS promedio_estado,
  ROUND(AVG(ce.nivel_estres), 2)              AS promedio_estres,
  ROUND(AVG(ce.dormiste_bien), 2)             AS promedio_sueno,
  MIN(ce.fecha_hora)                          AS primer_checkin,
  MAX(ce.fecha_hora)                          AS ultimo_checkin
FROM checkin_emocional ce
JOIN pacientes         p  ON p.id  = ce.paciente_id
JOIN personas          pe ON pe.id = p.persona_id
GROUP BY ce.atencion_id, ce.paciente_id, pe.nombres, pe.apellidos;

-- Pacientes menores con sus apoderados
CREATE OR REPLACE VIEW v_pacientes_apoderados AS
SELECT
  p.id                                        AS paciente_id,
  CONCAT(pe_p.nombres, ' ', pe_p.apellidos)   AS paciente,
  pe_p.fecha_nacimiento,
  TIMESTAMPDIFF(YEAR, pe_p.fecha_nacimiento, CURDATE()) AS edad,
  ap.parentesco,
  ap.es_contacto_principal,
  ap.es_responsable_pago,
  ap.puede_ver_historial,
  CONCAT(pe_a.nombres, ' ', pe_a.apellidos)   AS apoderado,
  pe_a.telefono                               AS telefono_apoderado,
  pe_a.email                                  AS email_apoderado
FROM pacientes           p
JOIN personas            pe_p ON pe_p.id = p.persona_id
LEFT JOIN apoderado_paciente ap  ON ap.paciente_id = p.id
LEFT JOIN apoderados     ao   ON ao.id    = ap.apoderado_id
LEFT JOIN personas       pe_a ON pe_a.id  = ao.persona_id
ORDER BY p.id, ap.es_contacto_principal DESC;


-- ============================================================
--  DATOS INICIALES
-- ============================================================

INSERT INTO servicios (nombre, descripcion, tipo) VALUES
  ('Atención Psicológica Niños y Adolescentes',
   'Consultas y terapias para menores de 18 años', 'individual'),
  ('Atención Psicológica Adultos',
   'Consultas y terapias para adultos', 'individual'),
  ('Talleres Psicológicos',
   'Sesiones grupales y programas de bienestar', 'taller');

INSERT INTO subservicios (servicio_id, nombre, modalidad, duracion_min, precio_base) VALUES
  (1, 'Consulta psicológica niño',       'individual', 45,  80.00),
  (1, 'Terapia psicológica niño',        'individual', 50, 100.00),
  (1, 'Terapia psicológica adolescente', 'individual', 50, 100.00),
  (2, 'Consulta psicológica adulto',     'individual', 50,  90.00),
  (2, 'Terapia psicológica adulto',      'individual', 50, 110.00),
  (2, 'Terapia emocional',              'individual', 50, 110.00),
  (2, 'Terapia de pareja',              'pareja',     60, 130.00),
  (2, 'Terapia familiar',               'familiar',   60, 140.00),
  (3, 'Taller de manejo del estrés',    'grupal',     90,  60.00),
  (3, 'Taller de habilidades sociales', 'grupal',     90,  60.00);

INSERT INTO cie10 (codigo, codigo_padre, descripcion, descripcion_corta, capitulo, bloque, nivel) VALUES
  ('F',     NULL,  'Trastornos mentales y del comportamiento', 'T. mentales',      'V', 'F00-F99', 1),
  ('F30',   'F',   'Episodio maníaco',                         'Ep. maníaco',      'V', 'F30-F39', 2),
  ('F32',   'F',   'Episodio depresivo',                       'Ep. depresivo',    'V', 'F30-F39', 2),
  ('F32.0', 'F32', 'Episodio depresivo leve',                  'Dep. leve',        'V', 'F30-F39', 3),
  ('F32.1', 'F32', 'Episodio depresivo moderado',              'Dep. moderado',    'V', 'F30-F39', 3),
  ('F32.2', 'F32', 'Episodio depresivo grave sin síntomas psicóticos', 'Dep. grave','V','F30-F39', 3),
  ('F40',   'F',   'Trastornos fóbicos de ansiedad',           'Fobia',            'V', 'F40-F48', 2),
  ('F41',   'F',   'Otros trastornos de ansiedad',             'Ansiedad',         'V', 'F40-F48', 2),
  ('F41.0', 'F41', 'Trastorno de pánico',                      'Pánico',           'V', 'F40-F48', 3),
  ('F41.1', 'F41', 'Trastorno de ansiedad generalizada',       'TAG',              'V', 'F40-F48', 3),
  ('F43',   'F',   'Reacciones al estrés grave y trastornos de adaptación', 'Estrés/adapt.', 'V', 'F40-F48', 2),
  ('F43.1', 'F43', 'Trastorno de estrés postraumático',        'TEPT',             'V', 'F40-F48', 3),
  ('F43.2', 'F43', 'Trastornos de adaptación',                 'Adapt.',           'V', 'F40-F48', 3),
  ('F60',   'F',   'Trastornos específicos de la personalidad','T. personalidad',  'V', 'F60-F69', 2),
  ('F90',   'F',   'Trastornos hipercinéticos',                'TDAH',             'V', 'F90-F98', 2),
  ('F90.0', 'F90', 'Perturbación de la actividad y de la atención (TDAH)', 'TDAH', 'V', 'F90-F98', 3),
  ('F93',   'F',   'Trastornos emocionales de comienzo en la infancia', 'T. emocionales inf.', 'V', 'F90-F98', 2),
  ('F98',   'F',   'Otros trastornos emocionales y del comportamiento en niñez', 'Otros niñez', 'V', 'F90-F98', 2);


SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
--  FIN DEL SCRIPT
-- ============================================================
