<?php
namespace Src\Models;

use Src\Core\Database;

class SesionGrupo {

    public static function create(array $data): void {
        Database::query("
            INSERT INTO sesiones_grupo
                (vinculo_id, fecha_hora, duracion_min, nota_clinica_compartida, estado)
            VALUES (?, ?, ?, ?, ?)
        ", [
            $data['vinculo_id'],
            $data['fecha_hora'],
            $data['duracion_min']           ?? null,
            $data['nota_clinica_compartida'] ?? null,
            $data['estado']                 ?? 'programada',
        ]);
    }

    public static function findByVinculo(int $vinculoId): array {
        return Database::query("
            SELECT id,
                   fecha_hora,
                   duracion_min,
                   nota_clinica_compartida,
                   nota_privada_p1,
                   nota_privada_p2,
                   nota_privada_p3,
                   estado,
                   created_at
            FROM   sesiones_grupo
            WHERE  vinculo_id = ?
            ORDER  BY fecha_hora
        ", [$vinculoId])->fetchAll();
    }

    public static function updateNota(int $id, ?string $nota): void {
        Database::query(
            "UPDATE sesiones_grupo SET nota_clinica_compartida = ? WHERE id = ?",
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
