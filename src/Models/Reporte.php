<?php
namespace Src\Models;
use Src\Core\Database;

class Reporte {

    public static function historialPaciente(int $pacienteId): array {
        return Database::query(
            "SELECT
                p.id AS paciente_id,
                CONCAT(pe.nombres, ' ', pe.apellidos) AS paciente,
                a.id AS atencion_id,
                a.fecha_inicio,
                a.fecha_fin,
                a.estado AS estado_atencion,
                a.motivo_consulta,
                a.grado_instruccion AS grado_instruccion_atencion,
                a.ocupacion AS ocupacion_atencion,
                a.estado_civil AS estado_civil_atencion,
                a.recomendaciones,
                ss.nombre AS subservicio,
                ss.modalidad AS modalidad,
                CONCAT(pf.nombres, ' ', pf.apellidos) AS profesional,
                s.id AS sesion_id,
                s.numero_sesion,
                s.fecha_hora AS fecha_sesion,
                'realizada' AS estado_sesion,
                s.duracion_min,
                s.nota_clinica,
                d.cie10_codigo,
                c.descripcion_corta AS diagnostico
             FROM pacientes p
             JOIN personas pe       ON pe.id = p.persona_id
             JOIN atenciones a      ON a.paciente_id = p.id
             JOIN subservicios ss   ON ss.id = a.subservicio_id
             JOIN profesionales pr  ON pr.id = a.profesional_id
             JOIN personas pf       ON pf.id = pr.persona_id
             LEFT JOIN sesiones s   ON s.atencion_id = a.id
             LEFT JOIN diagnosticos_atencion d
                    ON d.atencion_id = a.id AND d.tipo = 'principal'
             LEFT JOIN cie10 c      ON c.codigo = d.cie10_codigo
             WHERE p.id = ?
             ORDER BY a.fecha_inicio DESC, s.numero_sesion ASC",
            [$pacienteId]
        )->fetchAll();
    }

    public static function saldoPacientes(){
        return Database::query("SELECT * FROM v_saldo_pacientes WHERE saldo_total_pendiente > 0")->fetchAll();
    }

    public static function resumenCheckin(){
        return Database::query("SELECT * FROM v_resumen_checkin")->fetchAll();
    }

    public static function agendaHoy(){
        return Database::query("SELECT * FROM v_agenda_dia")->fetchAll();
    }
}
