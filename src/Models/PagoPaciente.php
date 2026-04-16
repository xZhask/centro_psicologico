<?php
namespace Src\Models;
use Src\Core\Database;

class PagoPaciente {

    /**
     * Registra un pago.
     * Exactamente uno de pagado_por_paciente, pagado_por_apoderado,
     * pagado_por_externo debe ser distinto de null (validado en el controlador).
     */
    public static function registrar(array $data): void {
        Database::query(
            "INSERT INTO pagos_paciente
                (cuenta_cobro_id, pagado_por_paciente, pagado_por_apoderado,
                 pagado_por_externo, monto, fecha_pago, metodo_pago,
                 numero_comprobante, notas, registrado_por)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (int)   $data['cuenta_cobro_id'],
                !empty($data['pagado_por_paciente'])  ? (int) $data['pagado_por_paciente']  : null,
                !empty($data['pagado_por_apoderado']) ? (int) $data['pagado_por_apoderado'] : null,
                !empty($data['pagado_por_externo'])   ? trim($data['pagado_por_externo'])   : null,
                (float) $data['monto'],
                $data['fecha_pago'],
                $data['metodo_pago'],
                !empty($data['numero_comprobante']) ? trim($data['numero_comprobante']) : null,
                !empty($data['notas'])              ? trim($data['notas'])              : null,
                (int)   $_SESSION['user']['id'],
            ]
        );
    }

    /**
     * Devuelve todos los pagos de una cuenta con datos del pagador
     * y del usuario que los registró.
     */
    public static function findByCuenta(int $id): array {
        return Database::query(
            "SELECT pp.id,
                    pp.monto,
                    pp.fecha_pago,
                    pp.metodo_pago,
                    pp.numero_comprobante,
                    pp.notas,
                    pp.created_at,
                    pp.pagado_por_externo,
                    CONCAT(pe_pac.nombres, ' ', pe_pac.apellidos) AS nombre_paciente,
                    CONCAT(pe_apo.nombres, ' ', pe_apo.apellidos) AS nombre_apoderado,
                    CONCAT(pe_reg.nombres, ' ', pe_reg.apellidos) AS registrado_por_nombre
             FROM pagos_paciente pp
             LEFT JOIN pacientes  pac     ON pac.id     = pp.pagado_por_paciente
             LEFT JOIN personas   pe_pac  ON pe_pac.id  = pac.persona_id
             LEFT JOIN apoderados apo     ON apo.id     = pp.pagado_por_apoderado
             LEFT JOIN personas   pe_apo  ON pe_apo.id  = apo.persona_id
             LEFT JOIN usuarios   usr     ON usr.id     = pp.registrado_por
             LEFT JOIN personas   pe_reg  ON pe_reg.id  = usr.persona_id
             WHERE pp.cuenta_cobro_id = ?
             ORDER BY pp.fecha_pago DESC, pp.id DESC",
            [$id]
        )->fetchAll();
    }
}
