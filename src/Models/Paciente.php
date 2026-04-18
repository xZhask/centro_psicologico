<?php
namespace Src\Models;

use Src\Core\Database;

class Paciente {

    public static function findAll(): array {
        return Database::query("
            SELECT p.id,
                   pe.nombres,
                   pe.apellidos,
                   pe.dni,
                   pe.email,
                   pe.telefono,
                   pe.sexo,
                   pe.fecha_nacimiento,
                   p.estado_civil,
                   p.ocupacion
            FROM pacientes p
            JOIN personas pe ON pe.id = p.persona_id
            WHERE p.activo = 1
            ORDER BY pe.apellidos, pe.nombres
        ")->fetchAll();
    }

    public static function search(string $q): array {
        $like = '%' . $q . '%';
        return Database::query("
            SELECT p.id,
                   pe.nombres,
                   pe.apellidos,
                   pe.dni
            FROM pacientes p
            JOIN personas pe ON pe.id = p.persona_id
            WHERE p.activo = 1
              AND (pe.nombres LIKE ? OR pe.apellidos LIKE ? OR pe.dni LIKE ?)
            ORDER BY pe.apellidos, pe.nombres
            LIMIT 15
        ", [$like, $like, $like])->fetchAll();
    }

    public static function findById(int|string $id): array|false {
        return Database::query("
            SELECT p.id,
                   pe.*,
                   p.grado_instruccion,
                   p.ocupacion,
                   p.estado_civil,
                   p.telefono_emergencia,
                   p.contacto_emergencia,
                   p.antecedentes
            FROM pacientes p
            JOIN personas pe ON pe.id = p.persona_id
            WHERE p.id = ?
        ", [$id])->fetch();
    }

    public static function create(array $data): int {
        $exists = Database::query(
            "SELECT id FROM personas WHERE dni = ?",
            [$data['dni']]
        )->fetch();

        if ($exists) {
            throw new \Exception('DNI ya registrado');
        }

        Database::query("
            INSERT INTO personas
                (dni, nombres, apellidos, fecha_nacimiento, sexo, telefono, email)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ", [
            $data['dni'],
            $data['nombres'],
            $data['apellidos'],
            ($data['fecha_nacimiento'] ?? '') ?: null,
            ($data['sexo']             ?? '') ?: 'no_especificado',
            ($data['telefono']         ?? '') ?: null,
            ($data['email']            ?? '') ?: null,
        ]);

        $personaId = (int) Database::getInstance()->lastInsertId();

        Database::query("
            INSERT INTO pacientes
                (persona_id, grado_instruccion, ocupacion, estado_civil,
                 telefono_emergencia, contacto_emergencia, antecedentes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ", [
            $personaId,
            ($data['grado_instruccion']    ?? '') ?: 'no_especificado',
            ($data['ocupacion']            ?? '') ?: null,
            ($data['estado_civil']         ?? '') ?: 'no_especificado',
            ($data['telefono_emergencia']  ?? '') ?: null,
            ($data['contacto_emergencia']  ?? '') ?: null,
            ($data['antecedentes']         ?? '') ?: null,
        ]);

        return (int) Database::getInstance()->lastInsertId();
    }

    public static function update(int|string $id, array $data): void {
        Database::query("
            UPDATE personas pe
            JOIN pacientes p ON p.persona_id = pe.id
            SET pe.nombres            = ?,
                pe.apellidos          = ?,
                pe.fecha_nacimiento   = ?,
                pe.sexo               = ?,
                pe.telefono           = ?,
                pe.email              = ?,
                p.grado_instruccion   = ?,
                p.ocupacion           = ?,
                p.estado_civil        = ?,
                p.telefono_emergencia = ?,
                p.contacto_emergencia = ?,
                p.antecedentes        = ?
            WHERE p.id = ?
        ", [
            $data['nombres'],
            $data['apellidos'],
            $data['fecha_nacimiento'] ?: null,
            $data['sexo']             ?: 'no_especificado',
            $data['telefono']         ?: null,
            $data['email']            ?: null,
            $data['grado_instruccion']    ?: 'no_especificado',
            $data['ocupacion']            ?: null,
            $data['estado_civil']         ?: 'no_especificado',
            $data['telefono_emergencia']  ?: null,
            $data['contacto_emergencia']  ?: null,
            $data['antecedentes']         ?: null,
            $id,
        ]);
    }

    public static function delete(int|string $id): void {
        Database::query("DELETE FROM pacientes WHERE id = ?", [$id]);
    }
}
