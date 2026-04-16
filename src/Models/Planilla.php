<?php
namespace Src\Models;
use Src\Core\Database;

class Planilla {

    /**
     * Todas las planillas, opcionalmente filtradas por profesional.
     * Incluye nombre del profesional y monto ya pagado (SUM pagos_personal).
     * monto_neto es GENERATED; nunca se inserta desde PHP.
     */
    public static function findAll(?int $profesionalId = null): array {
        $where  = $profesionalId ? "WHERE pl.profesional_id = ?" : "";
        $params = $profesionalId ? [$profesionalId] : [];

        return Database::query(
            "SELECT pl.id,
                    pl.profesional_id,
                    pl.periodo_inicio,
                    pl.periodo_fin,
                    pl.sesiones_realizadas,
                    pl.monto_bruto,
                    pl.descuentos,
                    pl.monto_neto,
                    pl.estado,
                    pl.observaciones,
                    pl.created_at,
                    CONCAT(pe.nombres, ' ', pe.apellidos) AS profesional_nombre,
                    pe.dni                                AS profesional_dni,
                    COALESCE(SUM(pp.monto), 0)            AS monto_pagado
             FROM planillas pl
             JOIN profesionales pro ON pro.id  = pl.profesional_id
             JOIN personas       pe  ON pe.id  = pro.persona_id
             LEFT JOIN pagos_personal pp ON pp.planilla_id = pl.id
             {$where}
             GROUP BY pl.id
             ORDER BY pl.periodo_inicio DESC, pl.id DESC",
            $params
        )->fetchAll();
    }

    /**
     * Planillas de un profesional específico.
     */
    public static function findByProfesional(int $profesionalId): array {
        return self::findAll($profesionalId);
    }

    /**
     * Crea una planilla en estado 'borrador'.
     * monto_neto es GENERATED; no se inserta.
     */
    public static function create(array $data): int {
        Database::query(
            "INSERT INTO planillas
                (profesional_id, periodo_inicio, periodo_fin,
                 sesiones_realizadas, monto_bruto, descuentos, observaciones)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                (int)   $data['profesional_id'],
                        $data['periodo_inicio'],
                        $data['periodo_fin'],
                (int)  ($data['sesiones_realizadas'] ?? 0),
                (float) $data['monto_bruto'],
                (float)($data['descuentos'] ?? 0),
                !empty($data['observaciones']) ? trim($data['observaciones']) : null,
            ]
        );
        return (int) Database::getInstance()->lastInsertId();
    }

    /**
     * Aprueba una planilla (borrador → aprobada).
     * Solo aplica si el estado actual es 'borrador'.
     */
    public static function aprobar(int $id): bool {
        $stmt = Database::query(
            "UPDATE planillas SET estado = 'aprobada'
             WHERE id = ? AND estado = 'borrador'",
            [$id]
        );
        return $stmt->rowCount() > 0;
    }

    /**
     * Marca como pagada (aprobada → pagada).
     * Solo aplica si el estado actual es 'aprobada'.
     */
    public static function marcarPagada(int $id): bool {
        $stmt = Database::query(
            "UPDATE planillas SET estado = 'pagada'
             WHERE id = ? AND estado = 'aprobada'",
            [$id]
        );
        return $stmt->rowCount() > 0;
    }

    /**
     * Busca una planilla por id (incluye monto_pagado).
     */
    public static function findById(int $id): array|false {
        return Database::query(
            "SELECT pl.*,
                    CONCAT(pe.nombres, ' ', pe.apellidos) AS profesional_nombre,
                    COALESCE(SUM(pp.monto), 0)            AS monto_pagado
             FROM planillas pl
             JOIN profesionales pro ON pro.id  = pl.profesional_id
             JOIN personas       pe  ON pe.id  = pro.persona_id
             LEFT JOIN pagos_personal pp ON pp.planilla_id = pl.id
             WHERE pl.id = ?
             GROUP BY pl.id",
            [$id]
        )->fetch();
    }
}
