<?php
namespace Src\Models;

use Src\Core\Database;

class AdelantoPaciente {

    public static function findByPaciente(int $pacienteId): array {
        return Database::query("
            SELECT ap.id, ap.paciente_id, ap.profesional_id, ap.atencion_id,
                   ap.concepto, ap.sesiones_acordadas,
                   ap.monto_total, ap.monto_aplicado, ap.saldo_disponible,
                   ap.estado, ap.created_at,
                   CONCAT(pe.nombres, ' ', pe.apellidos) AS profesional_nombre
            FROM adelantos_paciente ap
            JOIN profesionales pr ON pr.id  = ap.profesional_id
            JOIN personas      pe ON pe.id  = pr.persona_id
            WHERE ap.paciente_id = ?
            ORDER BY
                FIELD(ap.estado, 'activo', 'agotado', 'cancelado'),
                ap.created_at DESC
        ", [$pacienteId])->fetchAll();
    }

    public static function findActivoByPaciente(int $pacienteId, ?int $atencionId = null): ?array {
        $extra  = $atencionId ? ' AND (ap.atencion_id IS NULL OR ap.atencion_id = ?)' : '';
        $params = $atencionId ? [$pacienteId, $atencionId] : [$pacienteId];

        $row = Database::query("
            SELECT ap.id, ap.paciente_id, ap.atencion_id, ap.concepto,
                   ap.sesiones_acordadas, ap.monto_total, ap.monto_aplicado,
                   ap.saldo_disponible, ap.estado
            FROM adelantos_paciente ap
            WHERE ap.paciente_id = ?
              AND ap.estado = 'activo'
              AND ap.saldo_disponible > 0
              {$extra}
            ORDER BY ap.created_at ASC
            LIMIT 1
        ", $params)->fetch();

        return $row ?: null;
    }

    public static function findById(int $id): ?array {
        $row = Database::query("
            SELECT id, paciente_id, atencion_id, concepto,
                   sesiones_acordadas, monto_total, monto_aplicado,
                   saldo_disponible, estado
            FROM adelantos_paciente
            WHERE id = ?
        ", [$id])->fetch();

        return $row ?: null;
    }

    public static function create(array $data): int {
        Database::query("
            INSERT INTO adelantos_paciente
                (paciente_id, profesional_id, atencion_id, concepto,
                 sesiones_acordadas, monto_total, estado, created_by)
            VALUES (?, ?, ?, ?, ?, ?, 'activo', ?)
        ", [
            (int) $data['paciente_id'],
            (int) $data['profesional_id'],
            !empty($data['atencion_id'])        ? (int) $data['atencion_id']        : null,
            trim($data['concepto']),
            !empty($data['sesiones_acordadas']) ? (int) $data['sesiones_acordadas'] : null,
            (float) $data['monto_total'],
            (int) $data['created_by'],
        ]);
        return (int) Database::getInstance()->lastInsertId();
    }

    public static function cancelar(int $id): bool {
        Database::query(
            "UPDATE adelantos_paciente SET estado = 'cancelado'
             WHERE id = ? AND estado = 'activo'",
            [$id]
        );
        return true;
    }
}
