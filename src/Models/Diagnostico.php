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
}
