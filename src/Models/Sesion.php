<?php
namespace Src\Models;
use Src\Core\Database;

class Sesion {

    public static function crear(array $data): int {
        $numero = self::nextNumero((int) $data['atencion_id']);

        Database::query(
            "INSERT INTO sesiones
                 (atencion_id, paciente_paquete_id, numero_sesion, duracion_min, nota_clinica, fecha_hora)
             VALUES (?, ?, ?, ?, ?, NOW())",
            [
                $data['atencion_id'],
                !empty($data['paciente_paquete_id']) ? (int) $data['paciente_paquete_id'] : null,
                $numero,
                $data['duracion_min'],
                $data['nota_clinica'] ?? null,
            ]
        );

        return (int) Database::getInstance()->lastInsertId();
    }

    public static function findByAtencion(int $atencionId): array {
        return Database::query(
            "SELECT s.id, s.numero_sesion, s.fecha_hora, s.duracion_min, s.nota_clinica,
                    s.paciente_paquete_id,
                    'realizada' AS estado,
                    pk.nombre AS nombre_paquete
             FROM sesiones s
             LEFT JOIN paciente_paquetes pp ON pp.id = s.paciente_paquete_id
             LEFT JOIN paquetes          pk ON pk.id = pp.paquete_id
             WHERE s.atencion_id = ?
             ORDER BY s.numero_sesion",
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
