<?php
namespace Src\Models;
use Src\Core\Database;

class Diagnostico {

    public static function asignar(array $data): void {
        Database::query(
            "INSERT INTO diagnosticos_atencion
             (atencion_id, cie10_codigo, tipo, fecha_dx, registrado_por)
             VALUES (?, ?, ?, ?, ?)",
            [
                $data['atencion_id'],
                $data['cie10_codigo'],
                $data['tipo'],
                $data['fecha_dx'],
                $_SESSION['user']['id'],
            ]
        );
    }

    /** Devuelve true si ya existe un diagnóstico de tipo 'principal' en la atención. */
    public static function hasPrincipal(int $atencionId): bool {
        $count = (int) Database::query(
            "SELECT COUNT(*) FROM diagnosticos_atencion
             WHERE atencion_id = ? AND tipo = 'principal'",
            [$atencionId]
        )->fetchColumn();

        return $count > 0;
    }
}
