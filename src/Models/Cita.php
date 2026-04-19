<?php
namespace Src\Models;
use Src\Core\Database;

class Cita {

    /**
     * Lista de citas con joins completos.
     * Acepta filtros opcionales: ['estado' => string, 'fecha' => 'Y-m-d']
     */
    public static function findAll(array $filtros = []): array {
        $where  = [];
        $params = [];

        if (!empty($filtros['estado'])) {
            $where[]  = 'ci.estado = ?';
            $params[] = $filtros['estado'];
        }
        if (!empty($filtros['fecha'])) {
            $where[]  = 'DATE(ci.fecha_hora_inicio) = ?';
            $params[] = $filtros['fecha'];
        }
        if (!empty($filtros['profesional_id'])) {
            $where[]  = 'ci.profesional_id = ?';
            $params[] = (int) $filtros['profesional_id'];
        }

        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        return Database::query("
            SELECT ci.id                                              AS cita_id,
                   ci.paciente_id,
                   ci.profesional_id,
                   ci.fecha_hora_inicio,
                   ci.estado,
                   ci.reprogramaciones_count,
                   ci.cita_origen_id,
                   ci.tipo_cita,
                   ci.atencion_id,
                   ci.subservicio_id,
                   CONCAT(pe_p.nombres, ' ', pe_p.apellidos)         AS paciente,
                   CONCAT(pe_r.nombres, ' ', pe_r.apellidos)         AS profesional,
                   ss.nombre                                          AS subservicio,
                   ss.modalidad,
                   ss.duracion_min,
                   se.nombre                                          AS servicio,
                   ss.precio_base
            FROM citas ci
            JOIN pacientes    p    ON p.id    = ci.paciente_id
            JOIN personas     pe_p ON pe_p.id = p.persona_id
            JOIN profesionales pr  ON pr.id   = ci.profesional_id
            JOIN personas     pe_r ON pe_r.id = pr.persona_id
            JOIN subservicios ss   ON ss.id   = ci.subservicio_id
            JOIN servicios    se   ON se.id   = ss.servicio_id
            $whereClause
            ORDER BY ci.fecha_hora_inicio DESC
        ", $params)->fetchAll();
    }

    public static function findById($id): array|false {
        return Database::query("
            SELECT ci.*,
                   CONCAT(pe_p.nombres, ' ', pe_p.apellidos) AS paciente,
                   CONCAT(pe_r.nombres, ' ', pe_r.apellidos) AS profesional,
                   ss.nombre    AS subservicio,
                   ss.duracion_min
            FROM citas ci
            JOIN pacientes    p    ON p.id    = ci.paciente_id
            JOIN personas     pe_p ON pe_p.id = p.persona_id
            JOIN profesionales pr  ON pr.id   = ci.profesional_id
            JOIN personas     pe_r ON pe_r.id = pr.persona_id
            JOIN subservicios ss   ON ss.id   = ci.subservicio_id
            WHERE ci.id = ?
        ", [$id])->fetch();
    }

    /** Devuelve solo las citas del paciente vinculado a la persona dada. */
    public static function findByPersona(int $personaId): array {
        return Database::query("
            SELECT ci.id AS cita_id,
                   ci.fecha_hora_inicio,
                   ci.estado,
                   ci.reprogramaciones_count,
                   CONCAT(pe_r.nombres, ' ', pe_r.apellidos) AS profesional,
                   ss.nombre    AS subservicio,
                   ss.duracion_min
            FROM citas ci
            JOIN pacientes    p    ON p.id    = ci.paciente_id
            JOIN profesionales pr  ON pr.id   = ci.profesional_id
            JOIN personas     pe_r ON pe_r.id = pr.persona_id
            JOIN subservicios ss   ON ss.id   = ci.subservicio_id
            WHERE p.persona_id = ?
            ORDER BY ci.fecha_hora_inicio DESC
        ", [$personaId])->fetchAll();
    }

    /** Devuelve la cita solo si pertenece al paciente vinculado a la persona dada. */
    public static function findByIdAndPersona(int $id, int $personaId): array|false {
        return Database::query("
            SELECT c.*
            FROM citas c
            JOIN pacientes p ON p.id = c.paciente_id
            WHERE c.id = ? AND p.persona_id = ?
        ", [$id, $personaId])->fetch();
    }

    public static function existeCruce(
        int    $profesional_id,
        string $nuevaFecha,
        int    $nuevaDuracion,
        ?int   $excluirCitaId = null
    ): bool {
        $sql = "
            SELECT c.id
            FROM citas c
            JOIN subservicios ss ON ss.id = c.subservicio_id
            WHERE c.profesional_id = ?
              AND c.estado IN ('pendiente','confirmada')
              AND ? < DATE_ADD(c.fecha_hora_inicio,
                      INTERVAL ss.duracion_min MINUTE)
              AND DATE_ADD(?, INTERVAL ? MINUTE)
                      > c.fecha_hora_inicio
        ";

        $params = [
            $profesional_id,
            $nuevaFecha,
            $nuevaFecha,
            $nuevaDuracion,
        ];

        if ($excluirCitaId !== null) {
            $sql      .= " AND c.id != ?";
            $params[]  = $excluirCitaId;
        }

        return (bool) Database::query($sql, $params)->fetch();
    }

    public static function create(array $data): void {
        Database::query("
            INSERT INTO citas (paciente_id, profesional_id, subservicio_id, fecha_hora_inicio, atencion_id, tipo_cita, creado_por)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ", [
            $data['paciente_id'],
            $data['profesional_id'],
            $data['subservicio_id'],
            $data['fecha_hora_inicio'],
            $data['atencion_id'] ?? null,
            $data['tipo_cita']   ?? null,
            $_SESSION['user']['id'],
        ]);
    }

    /**
     * Reprograma una cita:
     *  1. Marca la original como 'reprogramada'
     *  2. Crea nueva cita con cita_origen_id apuntando a la original
     *  3. Inserta registro en historial_citas
     *  4. La nueva cita hereda reprogramaciones_count + 1
     */
    public static function reprogramar(int $id, string $nuevaFecha, string $descripcion, int $registradoPor): int {
        $original = Database::query("
            SELECT id, paciente_id, profesional_id, subservicio_id,
                   fecha_hora_inicio, estado, reprogramaciones_count
            FROM citas WHERE id = ?
        ", [$id])->fetch();

        if (!$original) {
            throw new \Exception('Cita no encontrada');
        }

        if (!in_array($original['estado'], ['pendiente', 'confirmada'], true)) {
            throw new \Exception('Solo se pueden reprogramar citas pendientes o confirmadas');
        }

        $pdo = Database::getInstance();
        $pdo->beginTransaction();
        try {
            // 1. Marcar original como reprogramada
            Database::query(
                "UPDATE citas SET estado = 'reprogramada' WHERE id = ?",
                [$id]
            );

            // 2. Crear nueva cita
            Database::query("
                INSERT INTO citas
                    (paciente_id, profesional_id, subservicio_id,
                     fecha_hora_inicio, cita_origen_id, reprogramaciones_count, creado_por)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ", [
                $original['paciente_id'],
                $original['profesional_id'],
                $original['subservicio_id'],
                $nuevaFecha,
                $id,
                (int) $original['reprogramaciones_count'] + 1,
                $registradoPor,
            ]);

            $nuevaCitaId = (int) $pdo->lastInsertId();

            // 3. Registrar en historial_citas
            Database::query("
                INSERT INTO historial_citas
                    (cita_id, fecha_hora_anterior, fecha_hora_nueva,
                     motivo, descripcion, registrado_por)
                VALUES (?, ?, ?, 'reprogramacion', ?, ?)
            ", [
                $id,
                $original['fecha_hora_inicio'],
                $nuevaFecha,
                $descripcion ?: null,
                $registradoPor,
            ]);

            $pdo->commit();
            return $nuevaCitaId;
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public static function updateEstado(int $id, string $estado): void {
        Database::query("UPDATE citas SET estado = ? WHERE id = ?", [$estado, $id]);
    }

    public static function delete(int $id): void {
        Database::query("DELETE FROM citas WHERE id = ?", [$id]);
    }
}
