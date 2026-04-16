<?php
namespace Src\Models;

use Src\Core\Database;

class AtencionVinculada {

    // ----------------------------------------------------------------
    // Vínculos grupales
    // ----------------------------------------------------------------

    public static function findAll(): array {
        return Database::query("
            SELECT vg.id,
                   vg.tipo,
                   vg.nombre,
                   vg.fecha_inicio,
                   vg.estado,
                   vg.descripcion,
                   CONCAT(pe.nombres, ' ', pe.apellidos) AS profesional,
                   COUNT(vp.id)                          AS total_participantes
            FROM vinculos_grupales vg
            JOIN profesionales pr ON pr.id   = vg.profesional_id
            JOIN personas      pe ON pe.id   = pr.persona_id
            LEFT JOIN vinculo_participantes vp ON vp.vinculo_id = vg.id
            GROUP BY vg.id
            ORDER BY vg.fecha_inicio DESC
        ")->fetchAll();
    }

    public static function findById(int|string $id): array|false {
        return Database::query("
            SELECT vg.id,
                   vg.tipo,
                   vg.nombre,
                   vg.fecha_inicio,
                   vg.estado,
                   vg.descripcion,
                   vg.profesional_id,
                   CONCAT(pe.nombres, ' ', pe.apellidos) AS profesional
            FROM vinculos_grupales vg
            JOIN profesionales pr ON pr.id = vg.profesional_id
            JOIN personas      pe ON pe.id = pr.persona_id
            WHERE vg.id = ?
        ", [$id])->fetch();
    }

    public static function create(array $data): int {
        Database::query("
            INSERT INTO vinculos_grupales
                (tipo, nombre, profesional_id, fecha_inicio, descripcion)
            VALUES (?, ?, ?, ?, ?)
        ", [
            $data['tipo'],
            $data['nombre'],
            $data['profesional_id'],
            $data['fecha_inicio'],
            $data['descripcion'] ?? null,
        ]);
        return (int) Database::getInstance()->lastInsertId();
    }

    public static function cerrar(int $id): void {
        Database::query(
            "UPDATE vinculos_grupales SET estado = 'cerrado' WHERE id = ?",
            [$id]
        );
    }

    // ----------------------------------------------------------------
    // Participantes del vínculo
    // ----------------------------------------------------------------

    /**
     * Agrega (o actualiza el rol de) una atención individual al vínculo grupal.
     * Usa INSERT … ON DUPLICATE KEY para idempotencia.
     */
    public static function addParticipante(int $vinculoId, int $atencionId, ?string $rol): void {
        Database::query("
            INSERT INTO vinculo_participantes (vinculo_id, atencion_id, rol)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE rol = VALUES(rol)
        ", [$vinculoId, $atencionId, $rol]);
    }

    public static function findParticipantes(int $vinculoId): array {
        return Database::query("
            SELECT vp.id,
                   vp.atencion_id,
                   vp.rol,
                   vp.created_at,
                   CONCAT(pe.nombres, ' ', pe.apellidos) AS paciente,
                   pe.dni                                AS paciente_dni,
                   a.estado                              AS atencion_estado,
                   a.fecha_inicio                        AS atencion_fecha_inicio,
                   ss.nombre                             AS subservicio,
                   ss.modalidad                          AS modalidad
            FROM vinculo_participantes vp
            JOIN atenciones  a  ON a.id  = vp.atencion_id
            JOIN pacientes   p  ON p.id  = a.paciente_id
            JOIN personas    pe ON pe.id = p.persona_id
            JOIN subservicios ss ON ss.id = a.subservicio_id
            WHERE vp.vinculo_id = ?
            ORDER BY vp.created_at
        ", [$vinculoId])->fetchAll();
    }

    public static function removeParticipante(int $participanteId): void {
        Database::query(
            "DELETE FROM vinculo_participantes WHERE id = ?",
            [$participanteId]
        );
    }
}
