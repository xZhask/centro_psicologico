<?php
namespace Src\Models;
use Src\Core\Database;

class Sesion {

    public static function crear(array $data): void {
        Database::query(
            "INSERT INTO sesiones (atencion_id, numero_sesion, fecha_hora, duracion_min, nota_clinica, estado)
             VALUES (?, ?, ?, ?, ?, ?)",
            [
                $data['atencion_id'],
                $data['numero_sesion'],
                $data['fecha_hora'],
                $data['duracion_min'],
                $data['nota_clinica'] ?? null,
                $data['estado']       ?? 'programada',
            ]
        );
    }

    public static function findByAtencion(int $atencionId): array {
        return Database::query(
            "SELECT id, numero_sesion, fecha_hora, duracion_min, nota_clinica, estado
             FROM sesiones
             WHERE atencion_id = ?
             ORDER BY numero_sesion",
            [$atencionId]
        )->fetchAll();
    }

    public static function updateNota(int $id, string $nota): void {
        Database::query(
            "UPDATE sesiones SET nota_clinica = ? WHERE id = ?",
            [$nota, $id]
        );
    }
}
