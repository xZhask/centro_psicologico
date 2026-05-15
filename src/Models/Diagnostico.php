<?php
namespace Src\Models;
use Src\Core\Database;

class Diagnostico {

    public static function asignar(array $data): void {
        Database::query(
            "INSERT INTO diagnosticos_atencion
             (atencion_id, cie10_codigo, jerarquia, nivel_certeza, fecha_dx, registrado_por)
             VALUES (?, ?, ?, ?, ?, ?)",
            [
                $data['atencion_id'],
                $data['cie10_codigo'],
                $data['jerarquia'],
                $data['nivel_certeza'],
                $data['fecha_dx'],
                $_SESSION['user']['id'],
            ]
        );
    }

    /** Devuelve true si ya existe un diagnóstico principal en la atención. */
    public static function hasPrincipal(int $atencionId): bool {
        $count = (int) Database::query(
            "SELECT COUNT(*) FROM diagnosticos_atencion
             WHERE atencion_id = ? AND jerarquia = 'principal'",
            [$atencionId]
        )->fetchColumn();

        return $count > 0;
    }

    public static function findById(int $id): array|false {
        return Database::query(
            "SELECT * FROM diagnosticos_atencion WHERE id = ?",
            [$id]
        )->fetch();
    }

    /** Devuelve true si existe otro diagnóstico principal en la atención distinto al indicado. */
    public static function hasPrincipalExcepto(int $atencionId, int $exceptoId): bool {
        $count = (int) Database::query(
            "SELECT COUNT(*) FROM diagnosticos_atencion
             WHERE atencion_id = ? AND jerarquia = 'principal' AND id != ?",
            [$atencionId, $exceptoId]
        )->fetchColumn();

        return $count > 0;
    }

    public static function update(int $id, string $jerarquia, string $nivelCerteza): void {
        Database::query(
            "UPDATE diagnosticos_atencion SET jerarquia = ?, nivel_certeza = ? WHERE id = ?",
            [$jerarquia, $nivelCerteza, $id]
        );
    }

    public static function delete(int $id): void {
        Database::query(
            "DELETE FROM diagnosticos_atencion WHERE id = ?",
            [$id]
        );
    }
}
