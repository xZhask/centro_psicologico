<?php
namespace Src\Models;
use Src\Core\Database;

class CuentaCobro {

    /**
     * Lista todas las cuentas, opcionalmente filtradas por paciente.
     * Incluye nombre del paciente (LEFT JOIN para cubrir cuentas grupales).
     */
    public static function findAll(?int $pacienteId = null): array {
        $where  = $pacienteId ? "WHERE cc.paciente_id = ?" : "";
        $params = $pacienteId ? [$pacienteId] : [];

        return Database::query(
            "SELECT cc.id,
                    cc.paciente_id,
                    cc.vinculo_id,
                    cc.concepto,
                    cc.monto_total,
                    cc.descuento_aplicado,
                    cc.motivo_descuento,
                    cc.monto_pagado,
                    cc.saldo_pendiente,
                    cc.estado,
                    cc.fecha_emision,
                    cc.fecha_vencimiento,
                    CONCAT(pe.nombres, ' ', pe.apellidos) AS paciente_nombre
             FROM cuentas_cobro cc
             LEFT JOIN pacientes pa ON pa.id = cc.paciente_id
             LEFT JOIN personas  pe ON pe.id = pa.persona_id
             {$where}
             ORDER BY cc.fecha_emision DESC, cc.id DESC",
            $params
        )->fetchAll();
    }

    /**
     * Crea una cuenta de cobro.
     * saldo_pendiente es GENERATED; nunca se inserta desde PHP.
     */
    public static function create(array $data): int {
        Database::query(
            "INSERT INTO cuentas_cobro
                (paciente_id, vinculo_id, sesion_id, cita_id, taller_id, concepto,
                 monto_total, descuento_aplicado, motivo_descuento,
                 fecha_emision, fecha_vencimiento)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                !empty($data['paciente_id'])     ? (int) $data['paciente_id']          : null,
                !empty($data['vinculo_id'])       ? (int) $data['vinculo_id']           : null,
                !empty($data['sesion_id'])        ? (int) $data['sesion_id']            : null,
                !empty($data['cita_id'])          ? (int) $data['cita_id']              : null,
                !empty($data['taller_id'])        ? (int) $data['taller_id']            : null,
                trim($data['concepto']),
                (float) $data['monto_total'],
                isset($data['descuento_aplicado']) ? (float) $data['descuento_aplicado'] : 0,
                !empty($data['motivo_descuento']) ? trim($data['motivo_descuento'])     : null,
                $data['fecha_emision'],
                !empty($data['fecha_vencimiento']) ? $data['fecha_vencimiento']         : null,
            ]
        );
        return (int) Database::getInstance()->lastInsertId();
    }

    /**
     * Resumen completo de pagos de un paciente: adelantos activos +
     * atenciones agrupadas con sus sesiones y cuentas de cobro.
     */
    public static function getResumenPorPaciente(int $pacienteId): array {
        $adelantos = Database::query(
            "SELECT ap.id, ap.concepto, ap.monto_total, ap.saldo_disponible,
                    ap.sesiones_acordadas, ap.monto_aplicado,
                    CONCAT(pe.nombres, ' ', pe.apellidos) AS profesional_nombre
             FROM adelantos_paciente ap
             JOIN profesionales prof ON prof.id = ap.profesional_id
             JOIN personas pe ON pe.id = prof.persona_id
             WHERE ap.paciente_id = ? AND ap.estado = 'activo' AND ap.saldo_disponible > 0
             ORDER BY ap.created_at ASC",
            [$pacienteId]
        )->fetchAll();

        $atenciones = Database::query(
            "SELECT a.id AS atencion_id,
                    a.profesional_id,
                    ss.nombre AS subservicio,
                    CONCAT(pe.nombres, ' ', pe.apellidos) AS profesional,
                    a.fecha_inicio,
                    a.estado AS estado_atencion,
                    COUNT(DISTINCT s.id)               AS total_sesiones,
                    COALESCE(cc_agg.total_facturado, 0) + COALESCE(pkg_agg.total_facturado, 0) + COALESCE(vinculo_agg.total_facturado, 0) AS total_facturado,
                    COALESCE(cc_agg.total_cobrado,   0) + COALESCE(pkg_agg.total_cobrado,   0) + COALESCE(vinculo_agg.total_cobrado,   0) AS total_cobrado,
                    COALESCE(cc_agg.saldo_pendiente, 0) + COALESCE(pkg_agg.saldo_pendiente, 0) + COALESCE(vinculo_agg.saldo_pendiente, 0) AS saldo_pendiente
             FROM atenciones a
             JOIN subservicios ss ON ss.id = a.subservicio_id
             JOIN profesionales prof ON prof.id = a.profesional_id
             JOIN personas pe ON pe.id = prof.persona_id
             LEFT JOIN sesiones s ON s.atencion_id = a.id
             LEFT JOIN (
                 SELECT atencion_id,
                        SUM(monto_total)     AS total_facturado,
                        SUM(monto_pagado)    AS total_cobrado,
                        SUM(saldo_pendiente) AS saldo_pendiente
                 FROM cuentas_cobro
                 WHERE atencion_id IS NOT NULL
                 GROUP BY atencion_id
             ) cc_agg ON cc_agg.atencion_id = a.id
             LEFT JOIN (
                 SELECT grp.atencion_id,
                        SUM(COALESCE(cc_pkg.monto_total, grp.ses_total))          AS total_facturado,
                        SUM(COALESCE(cc_pkg.monto_pagado, 0))                     AS total_cobrado,
                        SUM(COALESCE(cc_pkg.saldo_pendiente, grp.ses_total))      AS saldo_pendiente
                 FROM (
                     SELECT s2.atencion_id,
                            s2.paciente_paquete_id,
                            SUM(s2.precio_sesion) AS ses_total
                     FROM sesiones s2
                     WHERE s2.paciente_paquete_id IS NOT NULL
                       AND s2.atencion_id IS NOT NULL
                       AND s2.precio_sesion > 0
                     GROUP BY s2.atencion_id, s2.paciente_paquete_id
                 ) grp
                 JOIN paciente_paquetes pp2 ON pp2.id = grp.paciente_paquete_id
                 LEFT JOIN cuentas_cobro cc_pkg ON cc_pkg.id = pp2.cuenta_cobro_id
                 GROUP BY grp.atencion_id
             ) pkg_agg ON pkg_agg.atencion_id = a.id
             LEFT JOIN (
                 SELECT avd.atencion_id,
                        SUM(cc.monto_total)     AS total_facturado,
                        SUM(cc.monto_pagado)    AS total_cobrado,
                        SUM(cc.saldo_pendiente) AS saldo_pendiente
                 FROM cuentas_cobro cc
                 JOIN atencion_vinculo_detalle avd ON avd.vinculo_id = cc.vinculo_id
                 WHERE cc.vinculo_id IS NOT NULL
                   AND cc.paciente_id = ?
                   AND cc.estado != 'anulado'
                 GROUP BY avd.atencion_id
             ) vinculo_agg ON vinculo_agg.atencion_id = a.id
             WHERE a.paciente_id = ?
             GROUP BY a.id, a.profesional_id, ss.nombre, pe.nombres, pe.apellidos,
                      a.fecha_inicio, a.estado,
                      cc_agg.total_facturado, cc_agg.total_cobrado, cc_agg.saldo_pendiente,
                      vinculo_agg.total_facturado, vinculo_agg.total_cobrado, vinculo_agg.saldo_pendiente
             ORDER BY a.fecha_inicio DESC",
            [$pacienteId, $pacienteId]
        )->fetchAll();

        if (!empty($atenciones)) {
            $ids = array_column($atenciones, 'atencion_id');
            $ph  = implode(',', array_fill(0, count($ids), '?'));

            $sesiones = Database::query(
                "SELECT s.id AS sesion_id,
                        s.atencion_id,
                        s.numero_sesion,
                        s.fecha_hora,
                        s.modalidad_sesion,
                        s.precio_sesion,
                        cc.concepto,
                        CASE
                            WHEN s.paciente_paquete_id IS NOT NULL THEN 'paquete'
                            WHEN ads.adelanto_id IS NOT NULL AND cc.id IS NULL THEN 'adelanto'
                            WHEN ads.adelanto_id IS NOT NULL AND cc.id IS NOT NULL THEN 'adelanto_parcial'
                            ELSE 'directo'
                        END AS tipo_cobertura,
                        cc.id AS cuenta_cobro_id,
                        cc.monto_total AS monto_facturado,
                        cc.monto_pagado AS monto_cobrado,
                        cc.saldo_pendiente AS saldo_cuenta,
                        cc.estado AS estado_cuenta
                 FROM sesiones s
                 LEFT JOIN atencion_vinculo_detalle avd
                        ON avd.atencion_id = s.atencion_id AND s.cita_id IS NULL
                 LEFT JOIN sesiones_grupo sg
                        ON sg.vinculo_id    = avd.vinculo_id
                       AND sg.numero_sesion = s.numero_sesion
                 LEFT JOIN cuentas_cobro cc
                        ON cc.cita_id = COALESCE(s.cita_id, sg.cita_id)
                       AND cc.estado != 'anulado'
                 LEFT JOIN adelanto_sesion ads ON ads.sesion_id = s.id
                 WHERE s.atencion_id IN ({$ph})
                 ORDER BY s.atencion_id, s.numero_sesion ASC",
                $ids
            )->fetchAll();

            $map = [];
            foreach ($sesiones as $s) {
                $map[(int) $s['atencion_id']][] = $s;
            }
            foreach ($atenciones as &$a) {
                $a['sesiones'] = $map[(int) $a['atencion_id']] ?? [];
            }
            unset($a);
        }

        // Paquetes contratados por el paciente
        $paquetes = Database::query(
            "SELECT pp.id, pp.paquete_id, pp.profesional_id, pp.estado,
                    pp.sesiones_restantes, pp.fecha_activacion,
                    pk.nombre AS nombre_paquete, pk.sesiones_incluidas, pk.precio_paquete,
                    cc.id AS cuenta_cobro_id, cc.monto_total, cc.monto_pagado,
                    cc.saldo_pendiente, cc.estado AS estado_cuenta,
                    CONCAT(pe.nombres, ' ', pe.apellidos) AS profesional
             FROM paciente_paquetes pp
             JOIN paquetes pk ON pk.id = pp.paquete_id
             JOIN profesionales prof ON prof.id = pp.profesional_id
             JOIN personas pe ON pe.id = prof.persona_id
             LEFT JOIN cuentas_cobro cc ON cc.id = pp.cuenta_cobro_id
             WHERE pp.paciente_id = ?
             ORDER BY pp.created_at DESC",
            [$pacienteId]
        )->fetchAll();

        // Cuentas vinculadas a citas que aún no inician atención
        $citasPendientes = Database::query(
            "SELECT cc.id AS cuenta_cobro_id,
                    cc.concepto,
                    cc.monto_total,
                    cc.monto_pagado,
                    cc.saldo_pendiente,
                    cc.estado AS estado_cuenta,
                    cc.fecha_emision,
                    DATE(ci.fecha_hora_inicio) AS fecha_cita,
                    ss.nombre AS subservicio
             FROM cuentas_cobro cc
             JOIN citas ci ON ci.id = cc.cita_id
             JOIN subservicios ss ON ss.id = ci.subservicio_id
             WHERE cc.paciente_id = ?
               AND cc.estado != 'anulado'
               AND ci.atencion_id IS NULL
             ORDER BY ci.fecha_hora_inicio ASC",
            [$pacienteId]
        )->fetchAll();

        // Sesiones grupales donde este paciente participa
        $sesionesGrupales = Database::query("
            SELECT cc.id AS cuenta_cobro_id, cc.concepto,
                   cc.monto_total, cc.monto_pagado, cc.saldo_pendiente,
                   cc.estado AS estado_cuenta, cc.fecha_emision,
                   av.nombre_grupo, av.tipo_vinculo,
                   avd.rol_en_grupo
            FROM cuentas_cobro cc
            JOIN atenciones_vinculadas av ON av.id = cc.vinculo_id
            JOIN atencion_vinculo_detalle avd ON avd.vinculo_id = cc.vinculo_id
            JOIN atenciones a ON a.id = avd.atencion_id
            WHERE a.paciente_id = ? AND cc.estado != 'anulado'
            GROUP BY cc.id, cc.concepto, cc.monto_total, cc.monto_pagado,
                     cc.saldo_pendiente, cc.estado, cc.fecha_emision,
                     av.nombre_grupo, av.tipo_vinculo, avd.rol_en_grupo
            ORDER BY cc.fecha_emision DESC
        ", [$pacienteId])->fetchAll();

        // Totales financieros globales del paciente (incluye cuentas grupales)
        $totales = Database::query(
            "SELECT COALESCE(SUM(monto_total), 0) AS total_facturado,
                    COALESCE(SUM(monto_pagado), 0) AS total_cobrado,
                    COALESCE(SUM(saldo_pendiente), 0) AS total_pendiente
             FROM cuentas_cobro
             WHERE estado != 'anulado'
               AND (paciente_id = ?
                    OR vinculo_id IN (
                        SELECT DISTINCT avd.vinculo_id
                        FROM atencion_vinculo_detalle avd
                        JOIN atenciones a ON a.id = avd.atencion_id
                        WHERE a.paciente_id = ?
                    ))",
            [$pacienteId, $pacienteId]
        )->fetch();

        return [
            'adelantos_activos'  => $adelantos,
            'atenciones'         => $atenciones,
            'paquetes'           => $paquetes,
            'citas_pendientes'   => $citasPendientes,
            'sesiones_grupales'  => $sesionesGrupales,
            'totales'            => $totales ?: ['total_facturado' => 0, 'total_cobrado' => 0, 'total_pendiente' => 0],
        ];
    }

    public static function findById(int $id): array|false {
        return Database::query(
            "SELECT cc.*,
                    CONCAT(pe.nombres, ' ', pe.apellidos) AS paciente_nombre
             FROM cuentas_cobro cc
             LEFT JOIN pacientes pa ON pa.id = cc.paciente_id
             LEFT JOIN personas  pe ON pe.id = pa.persona_id
             WHERE cc.id = ?",
            [$id]
        )->fetch();
    }

    public static function findByCitaId(int $citaId): array|false {
        return Database::query(
            "SELECT * FROM cuentas_cobro WHERE cita_id = ? AND estado != 'anulado' LIMIT 1",
            [$citaId]
        )->fetch();
    }

    public static function linkVinculo(int $id, int $vinculoId): void {
        Database::query(
            "UPDATE cuentas_cobro SET vinculo_id = ? WHERE id = ? AND vinculo_id IS NULL",
            [$vinculoId, $id]
        );
    }
}
