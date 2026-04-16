-- ============================================================
-- Módulo: Atenciones Grupales (pareja, familiar, grupal, taller)
-- Ejecutar una sola vez sobre la BD centro_psicologico
-- ============================================================

CREATE TABLE vinculos_grupales (
    id             INT            NOT NULL AUTO_INCREMENT,
    tipo           ENUM('pareja','familiar','grupal','taller') NOT NULL,
    nombre         VARCHAR(150)   NOT NULL,
    profesional_id INT            NOT NULL,
    fecha_inicio   DATE           NOT NULL,
    estado         ENUM('activo','cerrado') NOT NULL DEFAULT 'activo',
    descripcion    TEXT           NULL,
    created_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_vg_profesional FOREIGN KEY (profesional_id)
        REFERENCES profesionales(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cada fila = una atención individual que participa en el proceso grupal
CREATE TABLE vinculo_participantes (
    id          INT          NOT NULL AUTO_INCREMENT,
    vinculo_id  INT          NOT NULL,
    atencion_id INT          NOT NULL,
    rol         VARCHAR(100) NULL COMMENT 'Ej: cónyuge, madre, hijo, participante',
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_vinculo_atencion (vinculo_id, atencion_id),
    CONSTRAINT fk_vp_vinculo  FOREIGN KEY (vinculo_id)  REFERENCES vinculos_grupales(id) ON DELETE CASCADE,
    CONSTRAINT fk_vp_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sesiones del proceso grupal (nota compartida visible para el profesional)
CREATE TABLE sesiones_grupo (
    id               INT     NOT NULL AUTO_INCREMENT,
    vinculo_id       INT     NOT NULL,
    numero_sesion    INT     NOT NULL,
    fecha_hora       DATETIME NOT NULL,
    duracion_min     INT     NOT NULL DEFAULT 60,
    nota_compartida  TEXT    NULL,
    estado           ENUM('programada','realizada','cancelada','no_asistio') NOT NULL DEFAULT 'programada',
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_sg_vinculo FOREIGN KEY (vinculo_id) REFERENCES vinculos_grupales(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
