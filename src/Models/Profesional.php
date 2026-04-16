<?php
namespace Src\Models;

use Src\Core\Database;

class Profesional {

    public static function findAll(): array {
        return Database::query("
            SELECT pr.id,
                   pe.nombres,
                   pe.apellidos,
                   pe.dni,
                   pe.telefono,
                   pe.email,
                   pr.especialidad,
                   pr.colegiatura,
                   pr.tarifa_hora
            FROM profesionales pr
            JOIN personas pe ON pe.id = pr.persona_id
            WHERE pr.activo = 1
            ORDER BY pe.apellidos, pe.nombres
        ")->fetchAll();
    }

    public static function findById(int $id): array|false {
        return Database::query("
            SELECT pr.id,
                   pe.nombres,
                   pe.apellidos,
                   pe.dni,
                   pe.email,
                   pe.telefono,
                   pr.especialidad,
                   pr.colegiatura,
                   pr.tarifa_hora
            FROM profesionales pr
            JOIN personas pe ON pe.id = pr.persona_id
            WHERE pr.id = ?
        ", [$id])->fetch();
    }

    public static function create(array $data): int {
        $pdo = Database::getInstance();

        $exists = Database::query(
            "SELECT id FROM personas WHERE dni = ?",
            [$data['dni']]
        )->fetch();

        if ($exists) {
            throw new \Exception('DNI ya registrado');
        }

        $pdo->beginTransaction();
        try {
            Database::query("
                INSERT INTO personas (dni, nombres, apellidos, telefono, email)
                VALUES (?, ?, ?, ?, ?)
            ", [
                $data['dni'],
                $data['nombres'],
                $data['apellidos'],
                $data['telefono'] ?: null,
                $data['email']    ?: null,
            ]);

            $personaId = (int) $pdo->lastInsertId();

            Database::query("
                INSERT INTO profesionales (persona_id, colegiatura, especialidad, tarifa_hora)
                VALUES (?, ?, ?, ?)
            ", [
                $personaId,
                $data['colegiatura'],
                $data['especialidad'] ?: null,
                $data['tarifa_hora']  ?: null,
            ]);

            $profId = (int) $pdo->lastInsertId();
            $pdo->commit();
            return $profId;
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public static function update(int $id, array $data): void {
        Database::query("
            UPDATE personas pe
            JOIN profesionales pr ON pr.persona_id = pe.id
            SET pe.nombres      = ?,
                pe.apellidos    = ?,
                pe.telefono     = ?,
                pe.email        = ?,
                pr.colegiatura  = ?,
                pr.especialidad = ?,
                pr.tarifa_hora  = ?
            WHERE pr.id = ?
        ", [
            $data['nombres'],
            $data['apellidos'],
            $data['telefono']     ?: null,
            $data['email']        ?: null,
            $data['colegiatura'],
            $data['especialidad'] ?: null,
            $data['tarifa_hora']  ?: null,
            $id,
        ]);
    }

    public static function delete(int $id): void {
        Database::query("UPDATE profesionales SET activo = 0 WHERE id = ?", [$id]);
    }
}
