-- Migración 003: Corregir trigger trg_actualizar_monto_pagado
--
-- Bug: En MySQL, dentro de un mismo SET, las asignaciones posteriores leen
-- el valor ya actualizado por las anteriores. El trigger usaba
-- (monto_pagado + NEW.monto) en el CASE, pero monto_pagado ya había sido
-- actualizado a (monto_pagado + NEW.monto) en la línea anterior del SET.
-- Resultado: NEW.monto se contaba dos veces → estado='pagado' prematuro.

-- Paso 1: Recrear el trigger con la lógica corregida
DROP TRIGGER IF EXISTS trg_actualizar_monto_pagado;

DELIMITER $$
CREATE TRIGGER `trg_actualizar_monto_pagado`
AFTER INSERT ON `pagos_paciente` FOR EACH ROW
BEGIN
  UPDATE cuentas_cobro
  SET
    monto_pagado = monto_pagado + NEW.monto,
    estado = CASE
               WHEN monto_pagado >= monto_total THEN 'pagado'
               WHEN monto_pagado > 0            THEN 'pago_parcial'
               ELSE 'pendiente'
             END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.cuenta_cobro_id;
END$$
DELIMITER ;

-- Paso 2: Corregir registros existentes con estado incorrecto
-- (cuentas marcadas como 'pagado' que aún tienen saldo pendiente,
--  o 'pendiente' que ya tienen pagos parciales)
UPDATE cuentas_cobro
SET estado = CASE
               WHEN monto_pagado >= monto_total THEN 'pagado'
               WHEN monto_pagado > 0            THEN 'pago_parcial'
               ELSE 'pendiente'
             END
WHERE estado NOT IN ('anulado', 'anulada');
