<?php
namespace Src\Models;

use Src\Core\Database;

class Servicio {

    public static function findAll(): array {
        return Database::query("
            SELECT s.id,
                   s.nombre,
                   s.descripcion,
                   s.tipo,
                   s.orden,
                   COUNT(ss.id) AS total_subservicios
            FROM servicios s
            LEFT JOIN subservicios ss ON ss.servicio_id = s.id AND ss.activo = 1
            WHERE s.activo = 1
            GROUP BY s.id
            ORDER BY s.orden, s.nombre
        ")->fetchAll();
    }

    public static function findById(int $id): array|false {
        return Database::query("
            SELECT id, nombre, descripcion, tipo, orden
            FROM servicios
            WHERE id = ? AND activo = 1
        ", [$id])->fetch();
    }

    public static function create(array $data): int {
        Database::query("
            INSERT INTO servicios (nombre, descripcion, tipo, orden)
            VALUES (?, ?, ?, ?)
        ", [
            $data['nombre'],
            $data['descripcion'] ?: null,
            $data['tipo'],
            isset($data['orden']) && $data['orden'] !== '' ? (int) $data['orden'] : 0,
        ]);
        return (int) Database::getInstance()->lastInsertId();
    }

    public static function update(int $id, array $data): void {
        Database::query("
            UPDATE servicios
            SET nombre      = ?,
                descripcion = ?,
                tipo        = ?,
                orden       = ?
            WHERE id = ?
        ", [
            $data['nombre'],
            $data['descripcion'] ?: null,
            $data['tipo'],
            isset($data['orden']) && $data['orden'] !== '' ? (int) $data['orden'] : 0,
            $id,
        ]);
    }
}
