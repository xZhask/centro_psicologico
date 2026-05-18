<?php
namespace Src\Models;

use Src\Core\Database;

class SesionGrupo {

    public static function create(array $data): int {
        $siguiente = Database::query(
            "SELECT COALESCE(MAX(numero_sesion), 0) + 1 AS num
            FROM sesiones_grupo
            WHERE vinculo_id = ?",
            [$data['vinculo_id']]
        )->fetch()['num'];

        Database::query("
            INSERT INTO sesiones_grupo
                (vinculo_id, numero_sesion, fecha_hora, duracion_min, nota_clinica_compartida, estado, cita_id, modalidad_sesion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ", [
            $data['vinculo_id'],
            $data['numero_sesion'] = (int) $siguiente,
            $data['fecha_hora']              ?? date('Y-m-d H:i:s'),
            $data['duracion_min']            ?? null,
            $data['nota_clinica_compartida'] ?? null,
            $data['estado']                  ?? 'realizada',
            $data['cita_id']                 ?? null,
            $data['modalidad_sesion']        ?? 'presencial',
        ]);

        return (int) Database::getInstance()->lastInsertId();
    }

    public static function findByVinculo(int $vinculoId): array {
        return Database::query("
            SELECT id,
                   numero_sesion,
                   fecha_hora,
                   duracion_min,
                   nota_clinica_compartida,
                   estado,
                   cita_id,
                   modalidad_sesion,
                   created_at
            FROM   sesiones_grupo
            WHERE  vinculo_id = ?
            ORDER  BY fecha_hora
        ", [$vinculoId])->fetchAll();
    }

    /**
     * Retorna las sesiones grupales de un vínculo con las notas privadas
     * de cada participante anidadas en cada sesión.
     */
    public static function findByVinculoConDetalle(int $vinculoId): array {
        $rows = Database::query("
            SELECT sg.id,
                   sg.numero_sesion,
                   sg.fecha_hora,
                   sg.duracion_min,
                   sg.nota_clinica_compartida,
                   sg.estado,
                   sg.cita_id,
                   sg.modalidad_sesion,
                   sg.created_at,
                   avd.atencion_id,
                   avd.rol_en_grupo,
                   CONCAT(pe.nombres, ' ', pe.apellidos) AS paciente_nombre,
                   s.nota_clinica                        AS nota_privada,
                   s.id                                  AS sesion_espejo_id
            FROM   sesiones_grupo sg
            JOIN   atencion_vinculo_detalle avd ON avd.vinculo_id = sg.vinculo_id
            JOIN   atenciones a                 ON a.id  = avd.atencion_id
            JOIN   pacientes pa                 ON pa.id = a.paciente_id
            JOIN   personas  pe                 ON pe.id = pa.persona_id
            LEFT JOIN sesiones s
                   ON s.atencion_id   = avd.atencion_id
                  AND s.numero_sesion = sg.numero_sesion
            WHERE  sg.vinculo_id = ?
            ORDER  BY sg.fecha_hora, avd.id
        ", [$vinculoId])->fetchAll();

        $sesiones = [];
        foreach ($rows as $row) {
            $sgId = (int) $row['id'];
            if (!isset($sesiones[$sgId])) {
                $sesiones[$sgId] = [
                    'id'                      => $sgId,
                    'numero_sesion'           => $row['numero_sesion'],
                    'fecha_hora'              => $row['fecha_hora'],
                    'duracion_min'            => $row['duracion_min'],
                    'nota_clinica_compartida' => $row['nota_clinica_compartida'],
                    'estado'                  => $row['estado'],
                    'cita_id'                 => $row['cita_id'] !== null ? (int) $row['cita_id'] : null,
                    'modalidad_sesion'        => $row['modalidad_sesion'],
                    'created_at'              => $row['created_at'],
                    'notas_privadas'          => [],
                ];
            }
            $sesiones[$sgId]['notas_privadas'][] = [
                'atencion_id'     => (int) $row['atencion_id'],
                'rol_en_grupo'    => $row['rol_en_grupo'],
                'paciente'        => $row['paciente_nombre'],
                'nota'            => $row['nota_privada'],
                'sesion_espejo_id'=> $row['sesion_espejo_id'] ? (int) $row['sesion_espejo_id'] : null,
            ];
        }

        return array_values($sesiones);
    }

    /**
     * Inserta sesiones espejo en la tabla `sesiones` para cada atención
     * participante del vínculo, y retorna un mapeo de atencion_id => sesion_id.
     * Las notas privadas se almacenan en nota_clinica de cada espejo (keyed by atencion_id).
     */
    public static function crearEspejos(
        int $vinculoId,
        string $fechaHora,
        ?int $duracionMin,
        array $notasPrivadas = [],
        ?int $citaId = null,
        ?int $paqueteTitularId = null,
        ?float $precioTitular = null
    ): array {
        $participantes = Database::query("
            SELECT atencion_id, rol_en_grupo
            FROM atencion_vinculo_detalle
            WHERE vinculo_id = ?
        ", [$vinculoId])->fetchAll();

        $mapping = [];
        foreach ($participantes as $p) {
            $atId      = (int)$p['atencion_id'];
            $esTitular = $p['rol_en_grupo'] === 'paciente_titular';

            $numRes = Database::query(
                "SELECT COALESCE(MAX(numero_sesion), 0) + 1 AS num FROM sesiones WHERE atencion_id = ?",
                [$atId]
            )->fetch();
            $num = $numRes ? (int)$numRes['num'] : 1;

            $notaPriv    = isset($notasPrivadas[$atId]) ? trim($notasPrivadas[$atId]) : null;
            $paqueteId   = ($esTitular && $paqueteTitularId) ? $paqueteTitularId : null;
            $precioFinal = $esTitular ? ($precioTitular ?? 0.00) : 0.00;

            Database::query("
                INSERT INTO sesiones
                    (atencion_id, cita_id, paciente_paquete_id, numero_sesion,
                     fecha_hora, duracion_min, precio_sesion, nota_clinica)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ", [$atId, null, $paqueteId, $num, $fechaHora, $duracionMin, $precioFinal, $notaPriv ?: null]);

            $mapping[$atId] = [
                'sesion_id'    => (int)Database::getInstance()->lastInsertId(),
                'rol_en_grupo' => $p['rol_en_grupo']
            ];
        }
        return $mapping;
    }

    /**
     * Retorna todas las tareas asignadas en sesiones espejo de un vínculo,
     * ordenadas por número de sesión desc y fecha límite asc.
     * Incluye el id de sesiones_grupo para que el frontend pueda enlazar al timeline.
     */
    public static function getTareasByVinculo(int $vinculoId): array {
        return Database::query("
            SELECT t.id,
                   t.titulo,
                   t.descripcion,
                   t.fecha_asignacion,
                   t.fecha_limite,
                   t.estado,
                   t.respuesta_paciente,
                   t.respondido_at,
                   s.numero_sesion,
                   sg.id AS sesion_grupo_id,
                   pe.nombres AS asignada_a_nombres,
                   pe.apellidos AS asignada_a_apellidos,
                   a.id AS atencion_id
              FROM tareas t
              JOIN sesiones s   ON s.id  = t.sesion_id
              JOIN atenciones a ON a.id  = s.atencion_id
              JOIN atencion_vinculo_detalle avd ON avd.atencion_id = a.id
              JOIN pacientes pac ON pac.id = t.paciente_id
              JOIN personas  pe  ON pe.id  = pac.persona_id
              LEFT JOIN sesiones_grupo sg
                     ON sg.vinculo_id   = avd.vinculo_id
                    AND sg.numero_sesion = s.numero_sesion
             WHERE avd.vinculo_id = ?
             ORDER BY s.numero_sesion DESC, t.fecha_limite ASC
        ", [$vinculoId])->fetchAll();
    }

    public static function updateNota(int $id, ?string $nota): void {
        Database::query(
            "UPDATE sesiones_grupo
             SET nota_clinica_compartida = ?
             WHERE id = ?",
            [$nota, $id]
        );
    }

    public static function updateEstado(int $id, string $estado): void {
        Database::query(
            "UPDATE sesiones_grupo SET estado = ? WHERE id = ?",
            [$estado, $id]
        );
    }
}
