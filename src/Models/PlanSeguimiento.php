<?php
namespace Src\Models;
use Src\Core\Database;

class PlanSeguimiento {

    /**
     * Crea un plan de seguimiento para una atención.
     * La tabla tiene UNIQUE KEY en atencion_id, por lo que solo existe un plan por atención.
     */
    public static function create(array $data): int {
        Database::query(
            "INSERT INTO planes_seguimiento
                (atencion_id, profesional_id, frecuencia_checkin,
                 alerta_sin_respuesta_dias, usar_phq9, usar_gad7, usar_escala_custom)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                $data['atencion_id'],
                $data['profesional_id'],
                $data['frecuencia_checkin']         ?? 'libre',
                $data['alerta_sin_respuesta_dias']  ?? 7,
                $data['usar_phq9']                  ?? 0,
                $data['usar_gad7']                  ?? 0,
                $data['usar_escala_custom']          ?? 0,
            ]
        );
        return (int) Database::getInstance()->lastInsertId();
    }

    /**
     * Devuelve el plan de seguimiento de una atención, o false si no existe.
     */
    public static function findByAtencion(int $atencionId): array|false {
        return Database::query(
            "SELECT ps.*,
                    CONCAT(pe.nombres,' ',pe.apellidos) AS profesional_nombre
             FROM planes_seguimiento ps
             JOIN profesionales pr ON pr.id  = ps.profesional_id
             JOIN personas      pe ON pe.id  = pr.persona_id
             WHERE ps.atencion_id = ?",
            [$atencionId]
        )->fetch();
    }
}
