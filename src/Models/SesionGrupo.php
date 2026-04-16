<?php
namespace Src\Models;

use Src\Core\Database;

class SesionGrupo {

    public static function create(array $data): void {
        Database::query("
            INSERT INTO sesiones_grupo
                (vinculo_id, numero_sesion, fecha_hora, duracion_min, nota_compartida, estado)
            VALUES (?, ?, ?, ?, ?, ?)
        ", [
            $data['vinculo_id'],
            $data['numero_sesion'],
            $data['fecha_hora'],
            $data['duracion_min']      ?? 60,
            $data['nota_compartida']   ?? null,
            $data['estado']            ?? 'programada',
        ]);
    }

    public static function findByVinculo(int $vinculoId): array {
        return Database::query("
            SELECT id, numero_sesion, fecha_hora, duracion_min, nota_compartida, estado
            FROM   sesiones_grupo
            WHERE  vinculo_id = ?
            ORDER  BY numero_sesion
        ", [$vinculoId])->fetchAll();
    }

    public static function updateNota(int $id, ?string $nota): void {
        Database::query(
            "UPDATE sesiones_grupo SET nota_compartida = ? WHERE id = ?",
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
