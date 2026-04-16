<?php
namespace Src\Models;
use Src\Core\Database;

class ReglaAlerta {

    /**
     * Crea una regla asociada a un plan de seguimiento.
     */
    public static function create(array $data): int {
        Database::query(
            "INSERT INTO reglas_alerta
                (plan_id, nombre, campo_origen, operador,
                 valor_umbral, dias_consecutivos, nivel_alerta)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                $data['plan_id'],
                $data['nombre'],
                $data['campo_origen'],
                $data['operador'],
                $data['valor_umbral'],
                $data['dias_consecutivos'] ?? 1,
                $data['nivel_alerta']      ?? 'moderada',
            ]
        );
        return (int) Database::getInstance()->lastInsertId();
    }

    /**
     * Reglas de un plan de seguimiento, ordenadas de mayor a menor criticidad.
     */
    public static function findByPlan(int $planId): array {
        return Database::query(
            "SELECT * FROM reglas_alerta
             WHERE plan_id = ? AND activa = 1
             ORDER BY FIELD(nivel_alerta,'critica','alta','moderada','informativa')",
            [$planId]
        )->fetchAll();
    }
}
