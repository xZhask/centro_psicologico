<?php
namespace Src\Models;
use Src\Core\Database;

class Alerta {

    /**
     * Alertas de un profesional específico, ordenadas por criticidad y fecha.
     * $estado = 'activa' | 'atendida' | 'descartada' | null (todas)
     */
    public static function findByProfesional(int $profId, ?string $estado = 'activa'): array {
        $sql = "SELECT a.id, a.tipo, a.nivel, a.descripcion, a.estado,
                       a.created_at, a.atendida_at, a.accion_tomada,
                       CONCAT(pe_p.nombres,' ',pe_p.apellidos) AS paciente,
                       ss.nombre AS subservicio,
                       atn.id    AS atencion_id
                FROM alertas a
                JOIN atenciones  atn  ON atn.id   = a.atencion_id
                JOIN pacientes   p    ON p.id      = a.paciente_id
                JOIN personas    pe_p ON pe_p.id   = p.persona_id
                JOIN subservicios ss  ON ss.id     = atn.subservicio_id
                WHERE a.profesional_id = ?";
        $params = [$profId];

        if ($estado !== null) {
            $sql .= " AND a.estado = ?";
            $params[] = $estado;
        }

        $sql .= " ORDER BY FIELD(a.nivel,'critica','alta','moderada','informativa'), a.created_at DESC";

        return Database::query($sql, $params)->fetchAll();
    }

    /**
     * Todas las alertas del sistema (uso administrativo), con mismos joins.
     */
    public static function findAll(?string $estado = 'activa'): array {
        $sql = "SELECT a.id, a.tipo, a.nivel, a.descripcion, a.estado,
                       a.created_at, a.atendida_at, a.accion_tomada,
                       CONCAT(pe_p.nombres,' ',pe_p.apellidos) AS paciente,
                       CONCAT(pe_r.nombres,' ',pe_r.apellidos) AS profesional,
                       ss.nombre AS subservicio,
                       atn.id    AS atencion_id
                FROM alertas a
                JOIN atenciones  atn  ON atn.id   = a.atencion_id
                JOIN pacientes   p    ON p.id      = a.paciente_id
                JOIN personas    pe_p ON pe_p.id   = p.persona_id
                JOIN profesionales pr ON pr.id     = a.profesional_id
                JOIN personas    pe_r ON pe_r.id   = pr.persona_id
                JOIN subservicios ss  ON ss.id     = atn.subservicio_id";

        $params = [];
        if ($estado !== null) {
            $sql .= " WHERE a.estado = ?";
            $params[] = $estado;
        }

        $sql .= " ORDER BY FIELD(a.nivel,'critica','alta','moderada','informativa'), a.created_at DESC";

        return Database::query($sql, $params)->fetchAll();
    }

    /**
     * Crea una alerta.
     */
    public static function create(array $data): int {
        Database::query(
            "INSERT INTO alertas
                (atencion_id, paciente_id, profesional_id, regla_id,
                 tipo, nivel, descripcion, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'activa')",
            [
                $data['atencion_id'],
                $data['paciente_id'],
                $data['profesional_id'],
                $data['regla_id']    ?? null,
                $data['tipo'],
                $data['nivel'],
                $data['descripcion'] ?? null,
            ]
        );
        return (int) Database::getInstance()->lastInsertId();
    }

    /**
     * Marca una alerta como atendida y registra la acción tomada.
     */
    public static function atender(int $id, string $accion, int $userId): void {
        Database::query(
            "UPDATE alertas
             SET estado = 'atendida',
                 accion_tomada = ?,
                 atendida_por  = ?,
                 atendida_at   = NOW()
             WHERE id = ?",
            [$accion, $userId, $id]
        );
    }

    /**
     * Descarta una alerta sin registrar acción.
     */
    public static function descartar(int $id, int $userId): void {
        Database::query(
            "UPDATE alertas
             SET estado = 'descartada',
                 atendida_por = ?,
                 atendida_at  = NOW()
             WHERE id = ?",
            [$userId, $id]
        );
    }

    /**
     * Conteo de alertas activas para un profesional (para KPI de dashboard).
     */
    public static function conteoActivas(int $profId): int {
        $row = Database::query(
            "SELECT COUNT(*) AS total FROM alertas
             WHERE profesional_id = ? AND estado = 'activa'",
            [$profId]
        )->fetch();
        return $row ? (int) $row['total'] : 0;
    }

    /**
     * Conteo global de alertas activas (para dashboard de administrador).
     */
    public static function conteoActivasGlobal(): int {
        $row = Database::query(
            "SELECT COUNT(*) AS total FROM alertas WHERE estado = 'activa'"
        )->fetch();
        return $row ? (int) $row['total'] : 0;
    }
}
