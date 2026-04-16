<?php
namespace Src\Models;
use Src\Core\Database;

class Checkin {

    /**
     * Registra un nuevo check-in emocional.
     */
    public static function create(array $data): int {
        Database::query(
            "INSERT INTO checkin_emocional
                (paciente_id, atencion_id, fecha_hora, como_te_sientes,
                 dormiste_bien, nivel_estres, hiciste_tarea, nota_opcional)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                $data['paciente_id'],
                $data['atencion_id'],
                $data['fecha_hora']      ?? date('Y-m-d H:i:s'),
                $data['como_te_sientes'],
                $data['dormiste_bien'],
                $data['nivel_estres'],
                $data['hiciste_tarea']   ?? null,
                $data['nota_opcional']   ?? null,
            ]
        );
        return (int) Database::getInstance()->lastInsertId();
    }

    /**
     * Todos los check-ins de una atención, del más reciente al más antiguo.
     */
    public static function findByAtencion(int $atencionId): array {
        return Database::query(
            "SELECT id, fecha_hora, como_te_sientes, dormiste_bien,
                    nivel_estres, hiciste_tarea, nota_opcional
             FROM checkin_emocional
             WHERE atencion_id = ?
             ORDER BY fecha_hora DESC",
            [$atencionId]
        )->fetchAll();
    }

    /**
     * Promedios de los tres indicadores para una atención.
     */
    public static function promedioByAtencion(int $atencionId): array|false {
        return Database::query(
            "SELECT COUNT(*)                     AS total,
                    ROUND(AVG(como_te_sientes), 1) AS avg_estado,
                    ROUND(AVG(dormiste_bien), 1)    AS avg_sueno,
                    ROUND(AVG(nivel_estres), 1)     AS avg_estres
             FROM checkin_emocional
             WHERE atencion_id = ?",
            [$atencionId]
        )->fetch();
    }
}
