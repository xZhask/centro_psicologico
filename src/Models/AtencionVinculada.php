<?php
namespace Src\Models;

use Src\Core\Database;

class AtencionVinculada {

    // ----------------------------------------------------------------
    // Vínculos grupales  (tabla: atenciones_vinculadas)
    // ----------------------------------------------------------------

    private static function _buildConditions(?string $tipo, string $search, ?string $desde, ?string $hasta, int $profesionalId, string $estado): array {
        $conditions = [];
        $params     = [];

        if ($tipo) {
            $conditions[] = 'av.tipo_vinculo = ?';
            $params[]     = $tipo;
        }
        if ($profesionalId) {
            $conditions[] = 'av.profesional_id = ?';
            $params[]     = $profesionalId;
        }
        if ($search !== '') {
            $conditions[] = '(av.nombre_grupo LIKE ? OR CONCAT(pe2.nombres, " ", pe2.apellidos) LIKE ?)';
            $like         = '%' . $search . '%';
            $params[]     = $like;
            $params[]     = $like;
        }
        if ($desde) {
            $conditions[] = 'av.fecha_inicio >= ?';
            $params[]     = $desde;
        }
        if ($hasta) {
            $conditions[] = 'av.fecha_inicio <= ?';
            $params[]     = $hasta;
        }
        if ($estado !== '') {
            $conditions[] = 'av.estado = ?';
            $params[]     = $estado;
        }

        return [$conditions, $params];
    }

    public static function findAll(?string $tipo = null, string $search = '', ?string $desde = null, ?string $hasta = null, int $profesionalId = 0, string $estado = ''): array {
        [$conditions, $params] = self::_buildConditions($tipo, $search, $desde, $hasta, $profesionalId, $estado);
        $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

        return Database::query("
            SELECT av.id,
                   av.tipo_vinculo,
                   av.nombre_grupo,
                   av.fecha_inicio,
                   av.fecha_fin,
                   av.estado,
                   av.subservicio_id,
                   av.profesional_id,
                   CONCAT(pe.nombres, ' ', pe.apellidos)  AS profesional,
                   COUNT(avd.id)                           AS total_participantes,
                   GROUP_CONCAT(
                       CONCAT(pe2.nombres, ' ', pe2.apellidos)
                       ORDER BY avd.id
                       SEPARATOR '||'
                   )                                       AS nombres_participantes
            FROM atenciones_vinculadas av
            JOIN profesionales pr   ON pr.id   = av.profesional_id
            JOIN personas      pe   ON pe.id   = pr.persona_id
            LEFT JOIN atencion_vinculo_detalle avd ON avd.vinculo_id = av.id
            LEFT JOIN atenciones               a   ON a.id   = avd.atencion_id
            LEFT JOIN pacientes                pac ON pac.id  = a.paciente_id
            LEFT JOIN personas                 pe2 ON pe2.id  = pac.persona_id
            $where
            GROUP BY av.id
            ORDER BY av.fecha_inicio DESC
        ", $params)->fetchAll();
    }

    public static function countAll(?string $tipo = null, string $search = '', ?string $desde = null, ?string $hasta = null, int $profesionalId = 0, string $estado = ''): int {
        [$conditions, $params] = self::_buildConditions($tipo, $search, $desde, $hasta, $profesionalId, $estado);
        $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

        $row = Database::query("
            SELECT COUNT(DISTINCT av.id) AS total
            FROM atenciones_vinculadas av
            JOIN profesionales pr   ON pr.id   = av.profesional_id
            JOIN personas      pe   ON pe.id   = pr.persona_id
            LEFT JOIN atencion_vinculo_detalle avd ON avd.vinculo_id = av.id
            LEFT JOIN atenciones               a   ON a.id   = avd.atencion_id
            LEFT JOIN pacientes                pac ON pac.id  = a.paciente_id
            LEFT JOIN personas                 pe2 ON pe2.id  = pac.persona_id
            $where
        ", $params)->fetch();

        return (int) ($row['total'] ?? 0);
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
                   av.motivo_consulta_proceso,
                   av.numero_sesiones_plan,
                   av.recomendaciones,
                   av.hipotesis_sistemica,
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
                (tipo_vinculo, nombre_grupo, subservicio_id, profesional_id, fecha_inicio, created_by,
                 motivo_consulta_proceso, numero_sesiones_plan)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ", [
            $data['tipo_vinculo'],
            $data['nombre_grupo']    ?? null,
            $data['subservicio_id'],
            $data['profesional_id'],
            $data['fecha_inicio'],
            $data['created_by'],
            $data['motivo_consulta'] ?? null,
            $data['numero_sesiones_plan'] ?? null,
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
    public static function addParticipante(int $vinculoId, int $atencionId, string $rolEnGrupo, ?string $relacion = null): void {
        Database::query("
            INSERT INTO atencion_vinculo_detalle (vinculo_id, atencion_id, rol_en_grupo, relacion_con_titular, fecha_incorporacion)
            VALUES (?, ?, ?, ?, CURDATE())
            ON DUPLICATE KEY UPDATE rol_en_grupo = VALUES(rol_en_grupo), relacion_con_titular = VALUES(relacion_con_titular)
        ", [$vinculoId, $atencionId, $rolEnGrupo, $relacion]);
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
                   a.motivo_consulta,
                   a.antecedentes_relevantes,
                   a.observacion_general,
                   a.observacion_conducta,
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

    /**
     * Diagnósticos CIE-10 registrados en una atención individual.
     * Replica la consulta de Atencion::findById para uso en el detalle de vínculo.
     */
    public static function getDiagnosticosByAtencion(int $atencionId): array {
        return Database::query("
            SELECT da.id,
                   da.cie10_codigo,
                   da.jerarquia,
                   da.nivel_certeza,
                   da.fecha_dx,
                   c.descripcion_corta,
                   c.descripcion AS descripcion_cie10
              FROM diagnosticos_atencion da
              JOIN cie10 c ON c.codigo = da.cie10_codigo
             WHERE da.atencion_id = ?
             ORDER BY da.jerarquia, da.fecha_dx
        ", [$atencionId])->fetchAll();
    }

    public static function removeParticipante(int $participanteId): void {
        Database::query(
            "DELETE FROM atencion_vinculo_detalle WHERE id = ?",
            [$participanteId]
        );
    }

    public static function updateProcesoData(int $vinculoId, array $data): void {
        Database::query("
            UPDATE atenciones_vinculadas
            SET motivo_consulta_proceso = ?,
                numero_sesiones_plan    = ?,
                recomendaciones         = ?,
                hipotesis_sistemica     = ?
            WHERE id = ?
        ", [
            $data['motivo_consulta_proceso'] ?? null,
            isset($data['numero_sesiones_plan']) && $data['numero_sesiones_plan'] !== '' ? (int) $data['numero_sesiones_plan'] : null,
            $data['recomendaciones']         ?? null,
            $data['hipotesis_sistemica']     ?? null,
            $vinculoId
        ]);
    }
}
