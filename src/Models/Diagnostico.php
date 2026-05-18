<?php
namespace Src\Models;
use Src\Core\Database;

class Diagnostico {

    public static function asignar(array $data): void {
        $hasAtencion = !empty($data['atencion_id']);
        $hasVinculo  = !empty($data['vinculo_id']);

        if (($hasAtencion && $hasVinculo) || (!$hasAtencion && !$hasVinculo)) {
            throw new \InvalidArgumentException("Debe especificar exactamente uno de atencion_id o vinculo_id (Arco Exclusivo).");
        }

        $registradoPor = isset($_SESSION['user']['id']) ? $_SESSION['user']['id'] : ($data['registrado_por'] ?? null);

        Database::query(
            "INSERT INTO diagnosticos_atencion
             (atencion_id, vinculo_id, cie10_codigo, jerarquia, nivel_certeza, fecha_dx, registrado_por)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                $data['atencion_id'] ?? null,
                $data['vinculo_id']  ?? null,
                $data['cie10_codigo'],
                $data['jerarquia'],
                $data['nivel_certeza'],
                $data['fecha_dx'],
                $registradoPor,
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

    public static function findByVinculo(int $vinculoId): array {
        return Database::query("
            SELECT da.id,
                   da.vinculo_id,
                   da.cie10_codigo,
                   da.jerarquia,
                   da.nivel_certeza,
                   da.fecha_dx,
                   da.observacion_clinica,
                   c.descripcion_corta,
                   c.descripcion AS descripcion_cie10
            FROM diagnosticos_atencion da
            JOIN cie10 c ON c.codigo = da.cie10_codigo
            WHERE da.vinculo_id = ?
            ORDER BY da.jerarquia, da.fecha_dx
        ", [$vinculoId])->fetchAll();
    }

    public static function deleteByVinculo(int $id): void {
        self::delete($id);
    }
}
