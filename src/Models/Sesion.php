<?php
namespace Src\Models;
use Src\Core\Database;

class Sesion {

    public static function crear(array $data): void {
        $numero = self::nextNumero((int) $data['atencion_id']);

        Database::query(
            "INSERT INTO sesiones (atencion_id, numero_sesion, duracion_min, nota_clinica, fecha_hora)
             VALUES (?, ?, ?, ?, NOW())",
            [
                $data['atencion_id'],
                $numero,
                $data['duracion_min'],
                $data['nota_clinica'] ?? null,
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

    public static function nextNumero(int $atencionId): int {
        $row = Database::query(
            "SELECT COALESCE(MAX(numero_sesion), 0) + 1 AS next FROM sesiones WHERE atencion_id = ?",
            [$atencionId]
        )->fetch();
        return (int) $row['next'];
    }

    public static function updateNota(int $id, string $nota): void {
        Database::query(
            "UPDATE sesiones SET nota_clinica = ? WHERE id = ?",
            [$nota, $id]
        );
    }
}
