<?php
namespace Src\Models;
use Src\Core\Database;

class Atencion {

    public static function findAll(int $profesionalId = 0): array {
        $whereClause = $profesionalId ? 'WHERE a.profesional_id = ?' : '';
        $params      = $profesionalId ? [$profesionalId] : [];

        return Database::query("
            SELECT a.id,
                   a.profesional_id,
                   a.fecha_inicio,
                   a.fecha_fin,
                   a.estado,
                   a.motivo_consulta,
                   a.numero_sesiones_plan,
                   a.precio_acordado,
                   CONCAT(pe_p.nombres, ' ', pe_p.apellidos) AS paciente,
                   CONCAT(pe_r.nombres, ' ', pe_r.apellidos) AS profesional,
                   ss.nombre  AS subservicio,
                   se.nombre  AS servicio
            FROM atenciones a
            JOIN pacientes    p    ON p.id    = a.paciente_id
            JOIN personas     pe_p ON pe_p.id = p.persona_id
            JOIN profesionales pr  ON pr.id   = a.profesional_id
            JOIN personas     pe_r ON pe_r.id = pr.persona_id
            JOIN subservicios ss   ON ss.id   = a.subservicio_id
            JOIN servicios    se   ON se.id   = ss.servicio_id
            $whereClause
            ORDER BY a.fecha_inicio DESC
        ", $params)->fetchAll();
    }

    public static function findById(int|string $id): array|false {
        return Database::query("
            SELECT * FROM atenciones WHERE id = ?
        ", [$id])->fetch();
    }

    /**
     * Historial de atenciones de un paciente, con conteo de sesiones realizadas.
     */
    public static function findByPaciente(int $pacienteId, int $profesionalId = 0): array {
        $extraWhere = $profesionalId ? ' AND a.profesional_id = ?' : '';
        $params     = $profesionalId ? [$pacienteId, $profesionalId] : [$pacienteId];

        return Database::query("
            SELECT a.id,
                   a.cita_id,
                   a.profesional_id,
                   a.subservicio_id,
                   a.fecha_inicio,
                   a.fecha_fin,
                   a.estado,
                   a.motivo_consulta,
                   a.numero_sesiones_plan,
                   a.precio_acordado,
                   CONCAT(pe_r.nombres, ' ', pe_r.apellidos) AS profesional,
                   ss.nombre       AS subservicio,
                   ss.duracion_min AS duracion_min,
                   se.nombre       AS servicio,
                   COUNT(s.id)     AS sesiones_realizadas,
                   (SELECT COUNT(*) FROM sesiones WHERE atencion_id = a.id) AS total_sesiones
            FROM atenciones a
            JOIN profesionales pr  ON pr.id   = a.profesional_id
            JOIN personas     pe_r ON pe_r.id = pr.persona_id
            JOIN subservicios ss   ON ss.id   = a.subservicio_id
            JOIN servicios    se   ON se.id   = ss.servicio_id
            LEFT JOIN sesiones s ON s.atencion_id = a.id
            WHERE a.paciente_id = ?$extraWhere
            GROUP BY a.id
            ORDER BY a.fecha_inicio DESC
        ", $params)->fetchAll();
    }

    /**
     * Atención con detalle completo: sesiones, diagnósticos CIE-10 y tareas.
     */
    public static function findWithDetail(int $id): array|false {
        $atencion = Database::query("
            SELECT a.*,
                   CONCAT(pe_p.nombres, ' ', pe_p.apellidos) AS paciente,
                   pe_p.dni                                  AS paciente_dni,
                   a.paciente_id,
                   CONCAT(pe_r.nombres, ' ', pe_r.apellidos) AS profesional,
                   ss.nombre    AS subservicio,
                   ss.modalidad AS subservicio_modalidad,
                   se.nombre    AS servicio
            FROM atenciones a
            JOIN pacientes    p    ON p.id    = a.paciente_id
            JOIN personas     pe_p ON pe_p.id = p.persona_id
            JOIN profesionales pr  ON pr.id   = a.profesional_id
            JOIN personas     pe_r ON pe_r.id = pr.persona_id
            JOIN subservicios ss   ON ss.id   = a.subservicio_id
            JOIN servicios    se   ON se.id   = ss.servicio_id
            WHERE a.id = ?
        ", [$id])->fetch();

        if (!$atencion) return false;

        $atencion['sesiones'] = Database::query("
            SELECT id, numero_sesion, fecha_hora, duracion_min, nota_clinica,
                   'realizada' AS estado
            FROM sesiones
            WHERE atencion_id = ?
            ORDER BY numero_sesion
        ", [$id])->fetchAll();

        $atencion['diagnosticos'] = Database::query("
            SELECT da.id,
                   da.cie10_codigo,
                   da.tipo,
                   da.fecha_dx,
                   da.observacion_clinica,
                   c.descripcion_corta,
                   c.descripcion AS descripcion_cie10
            FROM diagnosticos_atencion da
            JOIN cie10 c ON c.codigo = da.cie10_codigo
            WHERE da.atencion_id = ?
            ORDER BY da.tipo, da.fecha_dx
        ", [$id])->fetchAll();

        $atencion['tareas'] = Database::query("
            SELECT t.id,
                   t.titulo,
                   t.descripcion,
                   t.fecha_asignacion,
                   t.fecha_limite,
                   t.estado,
                   t.respuesta_paciente,
                   s.numero_sesion
            FROM tareas t
            JOIN sesiones s ON s.id = t.sesion_id
            WHERE s.atencion_id = ?
            ORDER BY t.fecha_asignacion DESC
        ", [$id])->fetchAll();

        return $atencion;
    }

    public static function create(array $data): int {
        Database::query("
            INSERT INTO atenciones (
                paciente_id, profesional_id, cita_id, subservicio_id,
                precio_acordado, descuento_monto, motivo_descuento,
                grado_instruccion, ocupacion, estado_civil,
                motivo_consulta, observacion_general, observacion_conducta,
                antecedentes_relevantes, recomendaciones,
                fecha_inicio, numero_sesiones_plan
            )
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ", [
            $data['paciente_id'],
            $data['profesional_id'],
            $data['cita_id']          ?? null,
            $data['subservicio_id'],
            $data['precio_acordado'],
            $data['descuento_monto']  ?? 0,
            $data['motivo_descuento'] ?? null,
            $data['grado_instruccion']     ?? 'no_especificado',
            $data['ocupacion']             ?? null,
            $data['estado_civil']          ?? 'no_especificado',
            $data['motivo_consulta'],
            $data['observacion_general']   ?? null,
            $data['observacion_conducta']  ?? null,
            $data['antecedentes_relevantes'] ?? null,
            $data['recomendaciones']       ?? null,
            $data['fecha_inicio'],
            $data['numero_sesiones_plan']  ?? null,
        ]);
        return (int) Database::getInstance()->lastInsertId();
    }

    public static function cerrar(int|string $id, string $fecha_fin): void {
        Database::query("
            UPDATE atenciones SET estado = 'completada', fecha_fin = ? WHERE id = ?
        ", [$fecha_fin, $id]);
    }
}
