<?php
namespace Src\Models;
use Src\Core\Database;

class PagoPersonal {

    /**
     * Registra un pago a un profesional contra una planilla.
     */
    public static function create(array $data): int {
        Database::query(
            "INSERT INTO pagos_personal
                (planilla_id, monto, fecha_pago, metodo_pago, referencia, registrado_por)
             VALUES (?, ?, ?, ?, ?, ?)",
            [
                (int)   $data['planilla_id'],
                (float) $data['monto'],
                        $data['fecha_pago'],
                        $data['metodo_pago'],
                !empty($data['referencia']) ? trim($data['referencia']) : null,
                (int)   $_SESSION['user']['id'],
            ]
        );
        return (int) Database::getInstance()->lastInsertId();
    }

    /**
     * Pagos registrados para una planilla, con nombre del usuario registrador.
     */
    public static function findByPlanilla(int $planillaId): array {
        return Database::query(
            "SELECT pp.id,
                    pp.monto,
                    pp.fecha_pago,
                    pp.metodo_pago,
                    pp.referencia,
                    pp.created_at,
                    CONCAT(pe.nombres, ' ', pe.apellidos) AS registrado_por_nombre
             FROM pagos_personal pp
             JOIN usuarios u  ON u.id  = pp.registrado_por
             JOIN personas pe ON pe.id = u.persona_id
             WHERE pp.planilla_id = ?
             ORDER BY pp.fecha_pago DESC, pp.id DESC",
            [$planillaId]
        )->fetchAll();
    }
}
