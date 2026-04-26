<?php
namespace Src\Models;

use PDO;
use Src\Core\Database;

class Reporte {

    /* ══════════════════════════════════════════════════════════════
       CLÍNICOS
    ══════════════════════════════════════════════════════════════ */

    public static function progresoPacientes(int $profesionalId = 0, int $pacienteId = 0): array
    {
        $where  = ['a.estado = ?'];
        $params = ['activa'];

        if ($profesionalId > 0) { $where[] = 'a.profesional_id = ?'; $params[] = $profesionalId; }
        if ($pacienteId    > 0) { $where[] = 'a.paciente_id    = ?'; $params[] = $pacienteId;    }

        $cond = implode(' AND ', $where);

        return Database::query("
            SELECT
                a.id                                                            AS atencion_id,
                CONCAT(pe.nombres, ' ', pe.apellidos)                          AS paciente,
                CONCAT(pf.nombres, ' ', pf.apellidos)                          AS profesional,
                ss.nombre                                                       AS subservicio,
                COUNT(DISTINCT s.id)                                            AS sesiones_realizadas,
                a.numero_sesiones_plan                                          AS sesiones_planificadas,
                ROUND(CASE
                    WHEN a.numero_sesiones_plan > 0
                    THEN COUNT(DISTINCT s.id) / a.numero_sesiones_plan * 100
                    ELSE NULL
                END, 1)                                                         AS porcentaje_avance,
                ROUND(AVG(ce.como_te_sientes), 2)                              AS promedio_estado_emocional,
                ROUND(AVG(ce.nivel_estres),    2)                              AS promedio_estres,
                MAX(ce.fecha_hora)                                             AS ultimo_checkin
            FROM atenciones a
            JOIN pacientes     p  ON p.id  = a.paciente_id
            JOIN personas      pe ON pe.id = p.persona_id
            JOIN profesionales pr ON pr.id = a.profesional_id
            JOIN personas      pf ON pf.id = pr.persona_id
            JOIN subservicios  ss ON ss.id = a.subservicio_id
            LEFT JOIN sesiones          s  ON s.atencion_id  = a.id
            LEFT JOIN checkin_emocional ce ON ce.atencion_id = a.id
            WHERE {$cond}
            GROUP BY
                a.id, pe.nombres, pe.apellidos,
                pf.nombres, pf.apellidos,
                ss.nombre, a.numero_sesiones_plan
            ORDER BY pe.apellidos, pe.nombres
        ", $params)->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function asistencia(string $desde, string $hasta, int $profesionalId = 0): array
    {
        $cond   = 'c.fecha_hora_inicio BETWEEN ? AND ?';
        $params = [$desde . ' 00:00:00', $hasta . ' 23:59:59'];

        if ($profesionalId > 0) {
            $cond   .= ' AND c.profesional_id = ?';
            $params[] = $profesionalId;
        }

        $porProfesional = Database::query("
            SELECT
                CONCAT(pf.nombres, ' ', pf.apellidos)                         AS profesional,
                COUNT(*)                                                        AS total_citas,
                SUM(c.estado = 'completada')                                   AS completadas,
                SUM(c.estado = 'no_asistio')                                   AS no_asistio,
                SUM(c.estado = 'cancelada')                                    AS canceladas,
                ROUND(SUM(c.estado = 'completada') / COUNT(*) * 100, 1)       AS tasa_asistencia
            FROM citas c
            JOIN profesionales pr ON pr.id = c.profesional_id
            JOIN personas      pf ON pf.id = pr.persona_id
            WHERE {$cond}
            GROUP BY pr.id, pf.nombres, pf.apellidos
            ORDER BY tasa_asistencia DESC
        ", $params)->fetchAll(PDO::FETCH_ASSOC);

        $tendencia = Database::query("
            SELECT
                YEARWEEK(c.fecha_hora_inicio, 1)                               AS semana,
                MIN(DATE(c.fecha_hora_inicio))                                 AS inicio_semana,
                COUNT(*)                                                        AS total_citas,
                SUM(c.estado = 'completada')                                   AS completadas,
                ROUND(SUM(c.estado = 'completada') / COUNT(*) * 100, 1)       AS tasa
            FROM citas c
            WHERE {$cond}
            GROUP BY YEARWEEK(c.fecha_hora_inicio, 1)
            ORDER BY semana
        ", $params)->fetchAll(PDO::FETCH_ASSOC);

        return ['por_profesional' => $porProfesional, 'tendencia' => $tendencia];
    }

    public static function cargaProfesionales(): array
    {
        return Database::query("
            SELECT
                CONCAT(pe.nombres, ' ', pe.apellidos)  AS profesional,
                pr.especialidad,
                COUNT(DISTINCT a.id)                   AS atenciones_activas,
                COUNT(DISTINCT s.id)                   AS sesiones_semana,
                COUNT(DISTINCT a.paciente_id)          AS pacientes_distintos,
                COUNT(DISTINCT al.id)                  AS alertas_activas
            FROM profesionales pr
            JOIN personas pe ON pe.id = pr.persona_id
            LEFT JOIN atenciones a
                   ON a.profesional_id = pr.id AND a.estado = 'activa'
            LEFT JOIN sesiones s
                   ON s.atencion_id = a.id
                  AND s.fecha_hora >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            LEFT JOIN alertas al
                   ON al.profesional_id = pr.id AND al.estado = 'activa'
            WHERE pr.activo = 1
            GROUP BY pr.id, pe.nombres, pe.apellidos, pr.especialidad
            ORDER BY atenciones_activas DESC
        ")->fetchAll(PDO::FETCH_ASSOC);
    }

    /* ══════════════════════════════════════════════════════════════
       FINANCIEROS
    ══════════════════════════════════════════════════════════════ */

    public static function facturacion(string $desde, string $hasta): array
    {
        $params = [$desde, $hasta];

        $resumen = Database::query("
            SELECT
                COALESCE(SUM(cc.monto_total),     0) AS total_facturado,
                COALESCE(SUM(cc.monto_pagado),    0) AS total_cobrado,
                COALESCE(SUM(cc.saldo_pendiente), 0) AS total_pendiente,
                COUNT(DISTINCT cc.atencion_id)       AS cantidad_atenciones
            FROM cuentas_cobro cc
            WHERE cc.fecha_emision BETWEEN ? AND ? AND cc.estado <> 'anulado'
        ", $params)->fetch(PDO::FETCH_ASSOC);

        $porServicio = Database::query("
            SELECT
                sv.nombre                                AS servicio,
                COALESCE(SUM(cc.monto_total), 0)        AS monto_facturado
            FROM cuentas_cobro cc
            JOIN atenciones   a  ON a.id  = cc.atencion_id
            JOIN subservicios ss ON ss.id = a.subservicio_id
            JOIN servicios    sv ON sv.id = ss.servicio_id
            WHERE cc.fecha_emision BETWEEN ? AND ? AND cc.estado <> 'anulado'
            GROUP BY sv.id, sv.nombre
            ORDER BY monto_facturado DESC
        ", $params)->fetchAll(PDO::FETCH_ASSOC);

        $porSemana = Database::query("
            SELECT
                YEARWEEK(cc.fecha_emision, 1)           AS semana,
                MIN(cc.fecha_emision)                   AS inicio_semana,
                COALESCE(SUM(cc.monto_total), 0)        AS monto
            FROM cuentas_cobro cc
            WHERE cc.fecha_emision BETWEEN ? AND ? AND cc.estado <> 'anulado'
            GROUP BY YEARWEEK(cc.fecha_emision, 1)
            ORDER BY semana
        ", $params)->fetchAll(PDO::FETCH_ASSOC);

        $base = $resumen ?: ['total_facturado' => 0, 'total_cobrado' => 0, 'total_pendiente' => 0, 'cantidad_atenciones' => 0];
        return array_merge($base, ['por_servicio' => $porServicio, 'por_semana' => $porSemana]);
    }

    public static function morosidad(): array
    {
        return Database::query("
            SELECT
                CONCAT(pe.nombres, ' ', pe.apellidos)  AS paciente,
                cc.concepto,
                cc.monto_total,
                cc.monto_pagado,
                cc.saldo_pendiente,
                cc.fecha_emision,
                cc.fecha_vencimiento,
                cc.estado,
                DATEDIFF(CURDATE(), cc.fecha_emision)  AS dias_mora
            FROM cuentas_cobro cc
            JOIN pacientes p  ON p.id  = cc.paciente_id
            JOIN personas  pe ON pe.id = p.persona_id
            WHERE cc.saldo_pendiente > 0 AND cc.estado <> 'anulado'
            ORDER BY cc.fecha_emision ASC
        ")->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function ingresosPorServicio(string $desde, string $hasta): array
    {
        $params = [$desde, $hasta];

        $detalle = Database::query("
            SELECT
                sv.nombre                                                        AS servicio,
                ss.nombre                                                        AS subservicio,
                COUNT(cc.id)                                                     AS total_cuentas,
                COALESCE(SUM(cc.monto_total),     0)                            AS total_facturado,
                COALESCE(SUM(cc.monto_pagado),    0)                            AS total_cobrado,
                COALESCE(SUM(cc.saldo_pendiente), 0)                            AS total_pendiente,
                ROUND(CASE
                    WHEN SUM(cc.monto_total) > 0
                    THEN SUM(cc.monto_pagado) / SUM(cc.monto_total) * 100
                    ELSE 0
                END, 1)                                                          AS tasa_cobro
            FROM cuentas_cobro cc
            JOIN atenciones   a  ON a.id  = cc.atencion_id
            JOIN subservicios ss ON ss.id = a.subservicio_id
            JOIN servicios    sv ON sv.id = ss.servicio_id
            WHERE cc.fecha_emision BETWEEN ? AND ? AND cc.estado <> 'anulado'
            GROUP BY sv.id, sv.nombre, ss.id, ss.nombre
            ORDER BY sv.nombre, total_facturado DESC
        ", $params)->fetchAll(PDO::FETCH_ASSOC);

        $resumenServicio = Database::query("
            SELECT
                sv.nombre                                AS servicio,
                COALESCE(SUM(cc.monto_total),  0)       AS total_facturado,
                COALESCE(SUM(cc.monto_pagado), 0)       AS total_cobrado
            FROM cuentas_cobro cc
            JOIN atenciones   a  ON a.id  = cc.atencion_id
            JOIN subservicios ss ON ss.id = a.subservicio_id
            JOIN servicios    sv ON sv.id = ss.servicio_id
            WHERE cc.fecha_emision BETWEEN ? AND ? AND cc.estado <> 'anulado'
            GROUP BY sv.id, sv.nombre
            ORDER BY total_facturado DESC
        ", $params)->fetchAll(PDO::FETCH_ASSOC);

        return ['detalle' => $detalle, 'resumen_servicio' => $resumenServicio];
    }

    /* ══════════════════════════════════════════════════════════════
       LEGACY — endpoints anteriores (mantenidos para las rutas /pdf)
    ══════════════════════════════════════════════════════════════ */

    public static function historialPaciente(int $pacienteId): array
    {
        return Database::query("
            -- Atenciones individuales con sus sesiones propias
            SELECT
                p.id AS paciente_id,
                CONCAT(pe.nombres, ' ', pe.apellidos) AS paciente,
                a.id AS atencion_id,
                a.fecha_inicio, a.fecha_fin,
                a.estado AS estado_atencion,
                a.motivo_consulta, a.recomendaciones,
                ss.nombre AS subservicio, ss.modalidad,
                CONCAT(pf.nombres, ' ', pf.apellidos) AS profesional,
                s.id AS sesion_id,
                s.numero_sesion,
                s.fecha_hora AS fecha_sesion,
                s.nota_clinica,
                d.cie10_codigo,
                c.descripcion_corta AS diagnostico
            FROM pacientes p
            JOIN personas      pe ON pe.id = p.persona_id
            JOIN atenciones    a  ON a.paciente_id = p.id
            JOIN subservicios  ss ON ss.id = a.subservicio_id
            JOIN profesionales pr ON pr.id = a.profesional_id
            JOIN personas      pf ON pf.id = pr.persona_id
            LEFT JOIN sesiones              s ON s.atencion_id = a.id
            LEFT JOIN diagnosticos_atencion d ON d.atencion_id = a.id AND d.tipo = 'principal'
            LEFT JOIN cie10                 c ON c.codigo = d.cie10_codigo
            WHERE p.id = ? AND ss.modalidad = 'individual'

            UNION ALL

            -- Atenciones grupales (pareja/familiar/grupal) con sesiones_grupo
            SELECT
                p.id AS paciente_id,
                CONCAT(pe.nombres, ' ', pe.apellidos) AS paciente,
                a.id AS atencion_id,
                a.fecha_inicio, a.fecha_fin,
                a.estado AS estado_atencion,
                a.motivo_consulta, a.recomendaciones,
                ss.nombre AS subservicio, ss.modalidad,
                CONCAT(pf.nombres, ' ', pf.apellidos) AS profesional,
                sg.id AS sesion_id,
                ROW_NUMBER() OVER (PARTITION BY a.id ORDER BY sg.fecha_hora) AS numero_sesion,
                sg.fecha_hora AS fecha_sesion,
                sg.nota_clinica_compartida AS nota_clinica,
                d.cie10_codigo,
                c.descripcion_corta AS diagnostico
            FROM pacientes p
            JOIN personas      pe  ON pe.id  = p.persona_id
            JOIN atenciones    a   ON a.paciente_id = p.id
            JOIN subservicios  ss  ON ss.id  = a.subservicio_id
            JOIN profesionales pr  ON pr.id  = a.profesional_id
            JOIN personas      pf  ON pf.id  = pr.persona_id
            JOIN atencion_vinculo_detalle avd ON avd.atencion_id = a.id
            JOIN atenciones_vinculadas    av  ON av.id = avd.vinculo_id
            LEFT JOIN sesiones_grupo sg ON sg.vinculo_id = av.id
            LEFT JOIN diagnosticos_atencion d ON d.atencion_id = a.id AND d.tipo = 'principal'
            LEFT JOIN cie10                 c ON c.codigo = d.cie10_codigo
            WHERE p.id = ? AND ss.modalidad IN ('pareja','familiar','grupal')

            ORDER BY fecha_inicio DESC, numero_sesion ASC
        ", [$pacienteId, $pacienteId])->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function historialPacienteConNotas(int $pacienteId): array
    {
        return Database::query("
            SELECT
                vh.*,
                CASE
                    WHEN avd.atencion_id IS NOT NULL THEN
                        CASE avd_pos.rol_posicion
                            WHEN 1 THEN sg.nota_privada_p1
                            WHEN 2 THEN sg.nota_privada_p2
                            WHEN 3 THEN sg.nota_privada_p3
                            ELSE NULL
                        END
                    ELSE NULL
                END AS nota_privada,
                (SELECT COUNT(*) FROM sesion_archivos sa
                 WHERE sa.sesion_id = vh.sesion_id AND vh.sesion_id IS NOT NULL) AS archivos_count,
                pk.nombre AS nombre_paquete
            FROM v_historial_paciente vh
            LEFT JOIN atencion_vinculo_detalle avd
                   ON avd.atencion_id = vh.atencion_id
            LEFT JOIN atenciones_vinculadas av
                   ON av.id = avd.vinculo_id
            LEFT JOIN sesiones_grupo sg
                   ON sg.vinculo_id = av.id
                  AND sg.id = vh.sesion_id
            LEFT JOIN (
                SELECT
                    vinculo_id,
                    atencion_id,
                    ROW_NUMBER() OVER (
                        PARTITION BY vinculo_id
                        ORDER BY id ASC
                    ) AS rol_posicion
                FROM atencion_vinculo_detalle
            ) avd_pos
                   ON avd_pos.atencion_id = vh.atencion_id
                  AND avd_pos.vinculo_id  = avd.vinculo_id
            LEFT JOIN sesiones          ses_pq ON ses_pq.id = vh.sesion_id
                                               AND vh.sesion_id IS NOT NULL
            LEFT JOIN paciente_paquetes pp     ON pp.id = ses_pq.paciente_paquete_id
            LEFT JOIN paquetes          pk     ON pk.id = pp.paquete_id
            WHERE vh.paciente_id = ?
            ORDER BY vh.atencion_id, vh.numero_sesion
        ", [$pacienteId])->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function saldoPacientes(): array
    {
        return Database::query(
            "SELECT * FROM v_saldo_pacientes WHERE saldo_total_pendiente > 0"
        )->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function resumenCheckin(): array
    {
        return Database::query("SELECT * FROM v_resumen_checkin")->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function agendaHoy(): array
    {
        return Database::query("SELECT * FROM v_agenda_dia")->fetchAll(PDO::FETCH_ASSOC);
    }
}
