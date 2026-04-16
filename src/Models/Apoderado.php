<?php
namespace Src\Models;
use Src\Core\Database;

class Apoderado {

    /**
     * Todos los apoderados vinculados a un paciente, con datos de persona y de vinculación.
     */
    public static function findByPaciente(int $pacienteId): array {
        return Database::query(
            "SELECT ap.id              AS vinculo_id,
                    ap.apoderado_id,
                    ap.parentesco,
                    ap.es_contacto_principal,
                    ap.es_responsable_pago,
                    ap.puede_ver_historial,
                    ap.notas,
                    a.activo           AS apoderado_activo,
                    pe.id              AS persona_id,
                    pe.dni,
                    pe.nombres,
                    pe.apellidos,
                    pe.telefono,
                    pe.email
             FROM apoderado_paciente ap
             JOIN apoderados a  ON a.id   = ap.apoderado_id
             JOIN personas   pe ON pe.id  = a.persona_id
             WHERE ap.paciente_id = ?
             ORDER BY ap.es_contacto_principal DESC, pe.apellidos, pe.nombres",
            [$pacienteId]
        )->fetchAll();
    }

    /**
     * Crea persona + apoderado.
     * Devuelve el apoderado_id (corregido: antes devolvía persona_id por error).
     */
    public static function create(array $data): int {
        Database::query(
            "INSERT INTO personas (dni, nombres, apellidos, telefono, email)
             VALUES (?, ?, ?, ?, ?)",
            [
                $data['dni'],
                $data['nombres'],
                $data['apellidos'],
                $data['telefono'] ?? null,
                $data['email']    ?? null,
            ]
        );
        $personaId = (int) Database::getInstance()->lastInsertId();

        Database::query(
            "INSERT INTO apoderados (persona_id) VALUES (?)",
            [$personaId]
        );
        return (int) Database::getInstance()->lastInsertId(); // apoderado_id
    }

    /**
     * Busca un apoderado por DNI de su persona.
     * Devuelve ['apoderado_id', 'persona_id', 'nombres', 'apellidos', 'telefono', 'email']
     * o false si no existe apoderado con ese DNI.
     */
    public static function findByDni(string $dni): array|false {
        return Database::query(
            "SELECT a.id AS apoderado_id, pe.id AS persona_id,
                    pe.nombres, pe.apellidos, pe.telefono, pe.email
             FROM apoderados a
             JOIN personas pe ON pe.id = a.persona_id
             WHERE pe.dni = ?",
            [$dni]
        )->fetch();
    }

    /**
     * Vincula un apoderado existente a un paciente.
     * Devuelve el id del registro apoderado_paciente creado.
     */
    public static function vincular(int $pacienteId, int $apoderadoId, array $vinculo = []): int {
        Database::query(
            "INSERT INTO apoderado_paciente
                (apoderado_id, paciente_id, parentesco,
                 es_contacto_principal, es_responsable_pago, puede_ver_historial, notas)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                $apoderadoId,
                $pacienteId,
                $vinculo['parentesco']             ?? 'otro',
                $vinculo['es_contacto_principal']  ?? 0,
                $vinculo['es_responsable_pago']    ?? 0,
                $vinculo['puede_ver_historial']    ?? 1,
                $vinculo['notas']                  ?? null,
            ]
        );
        return (int) Database::getInstance()->lastInsertId();
    }

    /**
     * Actualiza los datos de persona y/o los permisos del vínculo.
     * $id = apoderado_paciente.id (vinculo_id)
     */
    public static function update(int $vinculoId, array $data): void {
        // Actualizar campos de persona si vienen en $data
        $camposPersona = array_intersect_key($data, array_flip([
            'nombres', 'apellidos', 'telefono', 'email', 'dni'
        ]));

        if ($camposPersona) {
            // Obtener persona_id a través del vínculo
            $row = Database::query(
                "SELECT pe.id AS persona_id
                 FROM apoderado_paciente ap
                 JOIN apoderados a  ON a.id  = ap.apoderado_id
                 JOIN personas   pe ON pe.id = a.persona_id
                 WHERE ap.id = ?",
                [$vinculoId]
            )->fetch();

            if ($row) {
                $sets   = [];
                $params = [];
                foreach ($camposPersona as $col => $val) {
                    $sets[]   = "{$col} = ?";
                    $params[] = $val;
                }
                $params[] = (int) $row['persona_id'];
                Database::query(
                    "UPDATE personas SET " . implode(', ', $sets) . " WHERE id = ?",
                    $params
                );
            }
        }

        // Actualizar campos del vínculo
        $camposVinculo = array_intersect_key($data, array_flip([
            'parentesco', 'es_contacto_principal', 'es_responsable_pago',
            'puede_ver_historial', 'notas'
        ]));

        if ($camposVinculo) {
            $sets   = [];
            $params = [];
            foreach ($camposVinculo as $col => $val) {
                $sets[]   = "{$col} = ?";
                $params[] = $val;
            }
            $params[] = $vinculoId;
            Database::query(
                "UPDATE apoderado_paciente SET " . implode(', ', $sets) . " WHERE id = ?",
                $params
            );
        }
    }

    /**
     * Elimina el vínculo apoderado–paciente.
     * $id = apoderado_paciente.id (vinculo_id)
     * No elimina la persona ni el registro de apoderado.
     */
    public static function desvincular(int $vinculoId): void {
        Database::query(
            "DELETE FROM apoderado_paciente WHERE id = ?",
            [$vinculoId]
        );
    }

    /**
     * Si se marca contacto_principal = 1 para un vínculo,
     * desmarca los demás vínculos del mismo paciente.
     */
    public static function desmarcarContactoPrincipal(int $pacienteId, int $excepto): void {
        Database::query(
            "UPDATE apoderado_paciente
             SET es_contacto_principal = 0
             WHERE paciente_id = ? AND id <> ?",
            [$pacienteId, $excepto]
        );
    }
}
