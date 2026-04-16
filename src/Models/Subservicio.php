<?php
namespace Src\Models;

use Src\Core\Database;

class Subservicio {

    public static function findAll(): array {
        return Database::query("
            SELECT ss.id,
                   ss.nombre,
                   ss.modalidad,
                   ss.duracion_min,
                   ss.precio_base,
                   ss.servicio_id,
                   s.nombre AS servicio
            FROM subservicios ss
            JOIN servicios s ON s.id = ss.servicio_id
            WHERE ss.activo = 1
            ORDER BY s.nombre, ss.nombre
        ")->fetchAll();
    }

    public static function findByServicio(int $servicioId): array {
        return Database::query("
            SELECT id, nombre, modalidad, duracion_min, precio_base
            FROM subservicios
            WHERE servicio_id = ? AND activo = 1
            ORDER BY nombre
        ", [$servicioId])->fetchAll();
    }

    public static function findById(int $id): array|false {
        return Database::query("
            SELECT id, servicio_id, nombre, modalidad, duracion_min, precio_base
            FROM subservicios
            WHERE id = ?
        ", [$id])->fetch();
    }

    public static function create(array $data): int {
        Database::query("
            INSERT INTO subservicios (servicio_id, nombre, modalidad, duracion_min, precio_base)
            VALUES (?, ?, ?, ?, ?)
        ", [
            (int) $data['servicio_id'],
            $data['nombre'],
            $data['modalidad'],
            isset($data['duracion_min']) && $data['duracion_min'] !== '' ? (int) $data['duracion_min'] : 50,
            isset($data['precio_base']) ? (float) $data['precio_base'] : 0.00,
        ]);
        return (int) Database::getInstance()->lastInsertId();
    }

    public static function update(int $id, array $data): void {
        Database::query("
            UPDATE subservicios
            SET nombre      = ?,
                modalidad   = ?,
                duracion_min = ?,
                precio_base = ?
            WHERE id = ?
        ", [
            $data['nombre'],
            $data['modalidad'],
            isset($data['duracion_min']) && $data['duracion_min'] !== '' ? (int) $data['duracion_min'] : 50,
            isset($data['precio_base']) ? (float) $data['precio_base'] : 0.00,
            $id,
        ]);
    }
}
