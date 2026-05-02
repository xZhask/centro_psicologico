<?php
namespace Src\Models;

use Src\Core\Database;

class Paciente {

    public static function findAll(): array {
        return Database::query("
            SELECT
                p.id,
                pe.dni,
                pe.nombres,
                pe.apellidos,
                pe.fecha_nacimiento,
                pe.telefono,
                TIMESTAMPDIFF(YEAR, pe.fecha_nacimiento, CURDATE()) AS edad,
                (SELECT COUNT(*) FROM atenciones a
                 WHERE a.paciente_id = p.id
                   AND a.estado = 'activa') AS atenciones_activas,
                (SELECT MAX(s.fecha_hora)
                 FROM sesiones s
                 JOIN atenciones a ON a.id = s.atencion_id
                 WHERE a.paciente_id = p.id) AS ultima_sesion,
                (SELECT MAX(s.numero_sesion)
                 FROM sesiones s
                 JOIN atenciones a ON a.id = s.atencion_id
                 WHERE a.paciente_id = p.id
                   AND s.fecha_hora = (
                     SELECT MAX(s2.fecha_hora)
                     FROM sesiones s2
                     JOIN atenciones a2 ON a2.id = s2.atencion_id
                     WHERE a2.paciente_id = p.id
                   )
                ) AS numero_ultima_sesion,
                (SELECT COUNT(*) FROM alertas al
                 WHERE al.paciente_id = p.id
                   AND al.estado = 'activa') AS alertas_activas,
                CASE WHEN TIMESTAMPDIFF(YEAR, pe.fecha_nacimiento, CURDATE()) < 18
                     THEN 1 ELSE 0 END AS es_menor,
                (SELECT CONCAT(pe2.nombres, ' ', pe2.apellidos)
                 FROM apoderado_paciente ap2
                 JOIN apoderados ao2 ON ao2.id = ap2.apoderado_id
                 JOIN personas pe2 ON pe2.id = ao2.persona_id
                 WHERE ap2.paciente_id = p.id
                   AND ap2.es_contacto_principal = 1
                 LIMIT 1) AS apoderado_nombre
            FROM pacientes p
            JOIN personas pe ON pe.id = p.persona_id
            WHERE p.activo = 1
            ORDER BY pe.apellidos ASC
        ")->fetchAll();
    }

    public static function search(string $q): array {
        $like = '%' . $q . '%';
        return Database::query("
            SELECT
                p.id,
                pe.dni,
                pe.nombres,
                pe.apellidos,
                pe.fecha_nacimiento,
                pe.telefono,
                TIMESTAMPDIFF(YEAR, pe.fecha_nacimiento, CURDATE()) AS edad,
                (SELECT COUNT(*) FROM atenciones a
                 WHERE a.paciente_id = p.id
                   AND a.estado = 'activa') AS atenciones_activas,
                (SELECT MAX(s.fecha_hora)
                 FROM sesiones s
                 JOIN atenciones a ON a.id = s.atencion_id
                 WHERE a.paciente_id = p.id) AS ultima_sesion,
                (SELECT MAX(s.numero_sesion)
                 FROM sesiones s
                 JOIN atenciones a ON a.id = s.atencion_id
                 WHERE a.paciente_id = p.id
                   AND s.fecha_hora = (
                     SELECT MAX(s2.fecha_hora)
                     FROM sesiones s2
                     JOIN atenciones a2 ON a2.id = s2.atencion_id
                     WHERE a2.paciente_id = p.id
                   )
                ) AS numero_ultima_sesion,
                (SELECT COUNT(*) FROM alertas al
                 WHERE al.paciente_id = p.id
                   AND al.estado = 'activa') AS alertas_activas,
                CASE WHEN TIMESTAMPDIFF(YEAR, pe.fecha_nacimiento, CURDATE()) < 18
                     THEN 1 ELSE 0 END AS es_menor,
                (SELECT CONCAT(pe2.nombres, ' ', pe2.apellidos)
                 FROM apoderado_paciente ap2
                 JOIN apoderados ao2 ON ao2.id = ap2.apoderado_id
                 JOIN personas pe2 ON pe2.id = ao2.persona_id
                 WHERE ap2.paciente_id = p.id
                   AND ap2.es_contacto_principal = 1
                 LIMIT 1) AS apoderado_nombre
            FROM pacientes p
            JOIN personas pe ON pe.id = p.persona_id
            WHERE p.activo = 1
              AND (pe.nombres LIKE ? OR pe.apellidos LIKE ? OR pe.dni LIKE ?)
            ORDER BY pe.apellidos ASC
            LIMIT 50
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
