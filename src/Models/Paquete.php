<?php
namespace Src\Models;
use Src\Core\Database;

class Paquete {

    public static function findAll(bool $soloActivos = false): array {
        $where = $soloActivos ? "WHERE activo = 1" : "";
        return Database::query(
            "SELECT id, nombre, descripcion, sesiones_incluidas, precio_paquete, activo, created_at
             FROM paquetes {$where}
             ORDER BY activo DESC, nombre ASC"
        )->fetchAll();
    }

    public static function findById(int $id): ?array {
        $row = Database::query(
            "SELECT id, nombre, descripcion, sesiones_incluidas, precio_paquete, activo
             FROM paquetes WHERE id = ?",
            [$id]
        )->fetch();
        return $row ?: null;
    }

    public static function create(array $data): int {
        Database::query(
            "INSERT INTO paquetes (nombre, descripcion, sesiones_incluidas, precio_paquete, activo)
             VALUES (?, ?, ?, ?, 1)",
            [
                trim($data['nombre']),
                !empty($data['descripcion']) ? trim($data['descripcion']) : null,
                (int) $data['sesiones_incluidas'],
                (float) $data['precio_paquete'],
            ]
        );
        return (int) Database::getInstance()->lastInsertId();
    }

    public static function update(int $id, array $data): bool {
        Database::query(
            "UPDATE paquetes
             SET nombre = ?, descripcion = ?, sesiones_incluidas = ?, precio_paquete = ?
             WHERE id = ?",
            [
                trim($data['nombre']),
                !empty($data['descripcion']) ? trim($data['descripcion']) : null,
                (int) $data['sesiones_incluidas'],
                (float) $data['precio_paquete'],
                $id,
            ]
        );
        return true;
    }

    public static function toggleActivo(int $id): bool {
        Database::query(
            "UPDATE paquetes SET activo = 1 - activo WHERE id = ?",
            [$id]
        );
        return true;
    }
}
