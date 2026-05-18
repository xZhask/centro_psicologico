-- Migración 001: Trigger para evitar deudas fantasma al cancelar citas
-- Fecha: 2026-05-16
-- Reversible: SÍ (DROP TRIGGER IF EXISTS trg_anular_cuenta_cita_cancelada)

DELIMITER $$

DROP TRIGGER IF EXISTS trg_anular_cuenta_cita_cancelada $$

CREATE TRIGGER trg_anular_cuenta_cita_cancelada
AFTER UPDATE ON citas
FOR EACH ROW
BEGIN
  -- Solo actuar cuando la cita transiciona A un estado terminal sin asistencia
  IF NEW.estado IN ('cancelada', 'no_asistio')
     AND OLD.estado NOT IN ('cancelada', 'no_asistio') THEN

    UPDATE cuentas_cobro
    SET estado = 'anulado',
        updated_at = CURRENT_TIMESTAMP
    WHERE cita_id = NEW.id
      AND monto_pagado = 0.00
      AND estado <> 'anulado';

  END IF;
END $$

DELIMITER ;
