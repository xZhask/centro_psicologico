<?php
namespace Src\Models;
use Src\Core\Database;

class Tarea {

    /**
     * Crea una nueva tarea asociada a una sesión.
     */
    public static function create(array $data): int {
        Database::query(
            "INSERT INTO tareas
                (sesion_id, titulo, descripcion, fecha_asignacion, fecha_limite, estado)
             VALUES (?, ?, ?, ?, ?, ?)",
            [
                $data['sesion_id'],
                $data['titulo'],
                $data['descripcion']     ?? null,
                $data['fecha_asignacion'] ?? date('Y-m-d'),
                $data['fecha_limite']    ?? null,
                $data['estado']          ?? 'pendiente',
            ]
        );
        return (int) Database::getInstance()->lastInsertId();
    }

    /**
     * Tareas de una sesión específica.
     */
    public static function findBySesion(int $sesionId): array {
        return Database::query(
            "SELECT t.id, t.titulo, t.descripcion, t.fecha_asignacion,
                    t.fecha_limite, t.estado, t.respuesta_paciente,
                    s.numero_sesion
             FROM tareas t
             JOIN sesiones s ON s.id = t.sesion_id
             WHERE t.sesion_id = ?
             ORDER BY t.fecha_asignacion",
            [$sesionId]
        )->fetchAll();
    }

    /**
     * Todas las tareas de un paciente (a través de sus sesiones/atenciones).
     */
    public static function findByPaciente(int $pacienteId): array {
        return Database::query(
            "SELECT t.id, t.titulo, t.descripcion, t.fecha_asignacion,
                    t.fecha_limite, t.estado, t.respuesta_paciente,
                    s.numero_sesion, s.fecha_hora AS sesion_fecha,
                    a.id AS atencion_id,
                    CONCAT(pe_r.nombres,' ',pe_r.apellidos) AS profesional,
                    se.nombre AS servicio, ss.nombre AS subservicio
             FROM tareas t
             JOIN sesiones s   ON s.id   = t.sesion_id
             JOIN atenciones a ON a.id   = s.atencion_id
             JOIN profesionales pr ON pr.id  = a.profesional_id
             JOIN personas pe_r    ON pe_r.id = pr.persona_id
             JOIN subservicios ss  ON ss.id  = a.subservicio_id
             JOIN servicios se     ON se.id  = ss.servicio_id
             WHERE a.paciente_id = ?
             ORDER BY t.fecha_asignacion DESC",
            [$pacienteId]
        )->fetchAll();
    }

    /**
     * El profesional actualiza el estado de una tarea.
     */
    public static function updateEstado(int $id, string $estado): void {
        Database::query(
            "UPDATE tareas SET estado = ? WHERE id = ?",
            [$estado, $id]
        );
    }

    /**
     * El paciente registra su respuesta a la tarea.
     * Actualiza también el estado a 'completada' si no se indica otro.
     */
    public static function registrarRespuesta(int $id, string $respuesta): void {
        Database::query(
            "UPDATE tareas
             SET respuesta_paciente = ?,
                 estado = CASE WHEN estado = 'pendiente' THEN 'completada' ELSE estado END
             WHERE id = ?",
            [$respuesta, $id]
        );
    }

    /**
     * Devuelve el paciente_id propietario de la tarea (para validación de acceso).
     */
    public static function getPacienteId(int $tareaId): int {
        $row = Database::query(
            "SELECT a.paciente_id
             FROM tareas t
             JOIN sesiones s   ON s.id = t.sesion_id
             JOIN atenciones a ON a.id = s.atencion_id
             WHERE t.id = ?",
            [$tareaId]
        )->fetch();
        return $row ? (int) $row['paciente_id'] : 0;
    }
}
