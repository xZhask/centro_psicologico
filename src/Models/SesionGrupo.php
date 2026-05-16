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

        //$data['numero_sesion'] = (int) $siguiente;
        Database::query("
            INSERT INTO sesiones_grupo
                (vinculo_id,numero_sesion, fecha_hora, duracion_min, nota_clinica_compartida, estado)
            VALUES (?, ?, ?, ?, ?, ?)
        ", [
            $data['vinculo_id'],
            $data['numero_sesion'] = (int) $siguiente,
            $data['fecha_hora']              ?? date('Y-m-d H:i:s'),
            $data['duracion_min']            ?? null,
            $data['nota_clinica_compartida'] ?? null,
            $data['estado']                  ?? 'realizada',
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
                   created_at
            FROM   sesiones_grupo
            WHERE  vinculo_id = ?
            ORDER  BY fecha_hora
        ", [$vinculoId])->fetchAll();
    }

    /**
     * Inserta sesiones espejo en la tabla `sesiones` para cada atención
     * participante del vínculo, y retorna un mapeo de atencion_id => sesion_id.
     * Las notas privadas se almacenan en nota_clinica de cada espejo (keyed by atencion_id).
     */
    public static function crearEspejos(int $vinculoId, string $fechaHora, ?int $duracionMin, array $notasPrivadas = []): array {
        $participantes = Database::query("
            SELECT atencion_id, rol_en_grupo
            FROM atencion_vinculo_detalle
            WHERE vinculo_id = ?
        ", [$vinculoId])->fetchAll();

        $mapping = [];
        foreach ($participantes as $p) {
            $atId = (int)$p['atencion_id'];

            $numRes = Database::query(
                "SELECT COALESCE(MAX(numero_sesion), 0) + 1 AS num FROM sesiones WHERE atencion_id = ?",
                [$atId]
            )->fetch();
            $num = $numRes ? (int)$numRes['num'] : 1;

            $notaPriv = isset($notasPrivadas[$atId]) ? trim($notasPrivadas[$atId]) : null;

            Database::query("
                INSERT INTO sesiones (atencion_id, numero_sesion, fecha_hora, duracion_min, nota_clinica)
                VALUES (?, ?, ?, ?, ?)
            ", [$atId, $num, $fechaHora, $duracionMin, $notaPriv ?: null]);

            $mapping[$atId] = [
                'sesion_id'    => (int)Database::getInstance()->lastInsertId(),
                'rol_en_grupo' => $p['rol_en_grupo']
            ];
        }
        return $mapping;
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
