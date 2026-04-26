<?php
namespace Src\Models;
use Src\Core\Database;

class TallerFecha {

    /**
     * Inserta múltiples fechas para un taller.
     * @param int   $tallerId
     * @param array $fechas  array de ['fecha_hora' => string, 'duracion_min' => int]
     */
    public static function create(int $tallerId, array $fechas): void {
        foreach ($fechas as $f) {
            Database::query("
                INSERT INTO taller_fechas (taller_id, fecha_hora, duracion_min)
                VALUES (?, ?, ?)
            ", [
                $tallerId,
                $f['fecha_hora'],
                (int) ($f['duracion_min'] ?? 90),
            ]);
        }
    }

    public static function update(int $id, array $data): bool {
        $sets   = [];
        $params = [];

        if (array_key_exists('estado', $data)) {
            $sets[]   = 'estado = ?';
            $params[] = $data['estado'];
        }
        if (array_key_exists('asistentes', $data)) {
            $sets[]   = 'asistentes = ?';
            $params[] = $data['asistentes'] !== null ? (int) $data['asistentes'] : null;
        }
        if (array_key_exists('notas', $data)) {
            $sets[]   = 'notas = ?';
            $params[] = $data['notas'] ? trim($data['notas']) : null;
        }
        if (array_key_exists('fecha_hora', $data)) {
            $sets[]   = 'fecha_hora = ?';
            $params[] = $data['fecha_hora'];
        }
        if (array_key_exists('duracion_min', $data)) {
            $sets[]   = 'duracion_min = ?';
            $params[] = (int) $data['duracion_min'];
        }

        if (!$sets) return false;

        $params[] = $id;
        $stmt = Database::query(
            "UPDATE taller_fechas SET " . implode(', ', $sets) . " WHERE id = ?",
            $params
        );
        return $stmt->rowCount() > 0;
    }

    public static function eliminar(int $id): bool {
        $fecha = Database::query(
            "SELECT estado FROM taller_fechas WHERE id = ?",
            [$id]
        )->fetch();

        if (!$fecha || $fecha['estado'] === 'realizada') {
            return false;
        }

        $stmt = Database::query("DELETE FROM taller_fechas WHERE id = ?", [$id]);
        return $stmt->rowCount() > 0;
    }

    public static function findById(int $id): array|false {
        return Database::query(
            "SELECT tf.*, ti.profesional_id
             FROM taller_fechas tf
             JOIN talleres_institucionales ti ON ti.id = tf.taller_id
             WHERE tf.id = ?",
            [$id]
        )->fetch();
    }
}
