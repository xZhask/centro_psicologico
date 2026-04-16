<?php
namespace Src\Models;

use Src\Core\Database;

class AtencionVinculada {

    // ----------------------------------------------------------------
    // Vínculos grupales  (tabla: atenciones_vinculadas)
    // ----------------------------------------------------------------

    public static function findAll(): array {
        return Database::query("
            SELECT av.id,
                   av.tipo_vinculo,
                   av.nombre_grupo,
                   av.fecha_inicio,
                   av.fecha_fin,
                   av.estado,
                   av.subservicio_id,
                   av.profesional_id,
                   CONCAT(pe.nombres, ' ', pe.apellidos) AS profesional,
                   COUNT(avd.id)                         AS total_participantes
            FROM atenciones_vinculadas av
            JOIN profesionales pr  ON pr.id  = av.profesional_id
            JOIN personas      pe  ON pe.id  = pr.persona_id
            LEFT JOIN atencion_vinculo_detalle avd ON avd.vinculo_id = av.id
            GROUP BY av.id
            ORDER BY av.fecha_inicio DESC
        ")->fetchAll();
    }

    public static function findById(int|string $id): array|false {
        return Database::query("
            SELECT av.id,
                   av.tipo_vinculo,
                   av.nombre_grupo,
                   av.fecha_inicio,
                   av.fecha_fin,
                   av.estado,
                   av.subservicio_id,
                   av.profesional_id,
                   CONCAT(pe.nombres, ' ', pe.apellidos) AS profesional
            FROM atenciones_vinculadas av
            JOIN profesionales pr ON pr.id = av.profesional_id
            JOIN personas      pe ON pe.id = pr.persona_id
            WHERE av.id = ?
        ", [$id])->fetch();
    }

    public static function create(array $data): int {
        Database::query("
            INSERT INTO atenciones_vinculadas
                (tipo_vinculo, nombre_grupo, subservicio_id, profesional_id, fecha_inicio, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        ", [
            $data['tipo_vinculo'],
            $data['nombre_grupo']    ?? null,
            $data['subservicio_id'],
            $data['profesional_id'],
            $data['fecha_inicio'],
            $data['created_by'],
        ]);
        return (int) Database::getInstance()->lastInsertId();
    }

    public static function completar(int $id): void {
        Database::query(
            "UPDATE atenciones_vinculadas SET estado = 'completado', fecha_fin = CURDATE() WHERE id = ?",
            [$id]
        );
    }

    // ----------------------------------------------------------------
    // Participantes del vínculo  (tabla: atencion_vinculo_detalle)
    // ----------------------------------------------------------------

    /**
     * Agrega (o actualiza el rol de) una atención individual al vínculo grupal.
     * Usa INSERT … ON DUPLICATE KEY para idempotencia.
     */
    public static function addParticipante(int $vinculoId, int $atencionId, string $rolEnGrupo): void {
        Database::query("
            INSERT INTO atencion_vinculo_detalle (vinculo_id, atencion_id, rol_en_grupo)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE rol_en_grupo = VALUES(rol_en_grupo)
        ", [$vinculoId, $atencionId, $rolEnGrupo]);
    }

    public static function findParticipantes(int $vinculoId): array {
        return Database::query("
            SELECT avd.id,
                   avd.atencion_id,
                   avd.rol_en_grupo,
                   avd.es_responsable_pago,
                   avd.precio_cuota,
                   avd.precio_final,
                   CONCAT(pe.nombres, ' ', pe.apellidos) AS paciente,
                   pe.dni                                AS paciente_dni,
                   a.estado                              AS atencion_estado,
                   a.fecha_inicio                        AS atencion_fecha_inicio,
                   ss.nombre                             AS subservicio,
                   ss.modalidad                          AS modalidad
            FROM atencion_vinculo_detalle avd
            JOIN atenciones   a  ON a.id  = avd.atencion_id
            JOIN pacientes    p  ON p.id  = a.paciente_id
            JOIN personas     pe ON pe.id = p.persona_id
            JOIN subservicios ss ON ss.id = a.subservicio_id
            WHERE avd.vinculo_id = ?
            ORDER BY avd.id
        ", [$vinculoId])->fetchAll();
    }

    public static function removeParticipante(int $participanteId): void {
        Database::query(
            "DELETE FROM atencion_vinculo_detalle WHERE id = ?",
            [$participanteId]
        );
    }
}
