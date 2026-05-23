ALTER TABLE paciente_paquetes ADD COLUMN atencion_id INT UNSIGNED NULL AFTER profesional_id;
ALTER TABLE paciente_paquetes ADD CONSTRAINT fk_paquetes_atencion FOREIGN KEY (atencion_id) REFERENCES atenciones(id) ON DELETE SET NULL;
