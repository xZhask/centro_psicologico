<?php
namespace Src\Models;
use Src\Core\Database;

class TallerInstitucional {

    public static function findAll(?int $profesionalId = null): array {
        $where  = [];
        $params = [];

        if ($profesionalId !== null) {
            $where[]  = 'ti.profesional_id = ?';
            $params[] = $profesionalId;
        }

        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        return Database::query("
            SELECT ti.id,
                   ti.profesional_id,
                   ti.subservicio_id,
                   ti.institucion,
                   ti.tema,
                   ti.descripcion,
                   ti.total_asistentes,
                   ti.precio_acordado,
                   ti.porcentaje_prof,
                   ti.estado,
                   ti.notas,
                   ti.created_at,
                   CONCAT(pe.nombres, ' ', pe.apellidos) AS profesional,
                   ss.nombre                             AS subservicio,
                   COUNT(tf.id)                          AS total_fechas,
                   MIN(tf.fecha_hora)                    AS primera_fecha,
                   MAX(tf.fecha_hora)                    AS ultima_fecha
            FROM talleres_institucionales ti
            JOIN profesionales pr ON pr.id = ti.profesional_id
            JOIN personas      pe ON pe.id = pr.persona_id
            JOIN subservicios  ss ON ss.id = ti.subservicio_id
            LEFT JOIN taller_fechas tf ON tf.taller_id = ti.id
            {$whereClause}
            GROUP BY ti.id
            ORDER BY ti.created_at DESC
        ", $params)->fetchAll();
    }

    public static function findById(int $id): ?array {
        $taller = Database::query("
            SELECT ti.*,
                   CONCAT(pe.nombres, ' ', pe.apellidos) AS profesional,
                   ss.nombre                             AS subservicio
            FROM talleres_institucionales ti
            JOIN profesionales pr ON pr.id = ti.profesional_id
            JOIN personas      pe ON pe.id = pr.persona_id
            JOIN subservicios  ss ON ss.id = ti.subservicio_id
            WHERE ti.id = ?
        ", [$id])->fetch();

        if (!$taller) return null;

        $fechas = Database::query("
            SELECT id, taller_id, fecha_hora, duracion_min, estado, asistentes, notas, created_at
            FROM taller_fechas
            WHERE taller_id = ?
            ORDER BY fecha_hora ASC
        ", [$id])->fetchAll();

        $taller['fechas'] = $fechas;
        return $taller;
    }

    public static function create(array $data): int {
        Database::query("
            INSERT INTO talleres_institucionales
                (profesional_id, subservicio_id, institucion, tema, descripcion,
                 total_asistentes, precio_acordado, porcentaje_prof, notas, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ", [
            (int)    $data['profesional_id'],
            (int)    $data['subservicio_id'],
            !empty($data['institucion'])       ? trim($data['institucion'])  : null,
            trim($data['tema']),
            !empty($data['descripcion'])       ? trim($data['descripcion'])  : null,
            isset($data['total_asistentes'])   ? (int) $data['total_asistentes'] : null,
            (float) $data['precio_acordado'],
            (float) $data['porcentaje_prof'],
            !empty($data['notas'])             ? trim($data['notas'])        : null,
            $_SESSION['user']['id'],
        ]);
        return (int) Database::getInstance()->lastInsertId();
    }

    public static function update(int $id, array $data): bool {
        $stmt = Database::query("
            UPDATE talleres_institucionales
            SET profesional_id   = ?,
                subservicio_id   = ?,
                institucion      = ?,
                tema             = ?,
                descripcion      = ?,
                total_asistentes = ?,
                precio_acordado  = ?,
                porcentaje_prof  = ?,
                notas            = ?
            WHERE id = ?
        ", [
            (int)    $data['profesional_id'],
            (int)    $data['subservicio_id'],
            !empty($data['institucion'])       ? trim($data['institucion'])  : null,
            trim($data['tema']),
            !empty($data['descripcion'])       ? trim($data['descripcion'])  : null,
            isset($data['total_asistentes'])   ? (int) $data['total_asistentes'] : null,
            (float) $data['precio_acordado'],
            (float) $data['porcentaje_prof'],
            !empty($data['notas'])             ? trim($data['notas'])        : null,
            $id,
        ]);
        return $stmt->rowCount() > 0;
    }

    public static function cambiarEstado(int $id, string $estado): bool {
        $stmt = Database::query(
            "UPDATE talleres_institucionales SET estado = ? WHERE id = ?",
            [$estado, $id]
        );
        return $stmt->rowCount() > 0;
    }
}
