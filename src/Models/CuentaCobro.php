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
                    cc.atencion_id,
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
                (paciente_id, vinculo_id, atencion_id, sesion_id, concepto,
                 monto_total, descuento_aplicado, motivo_descuento,
                 fecha_emision, fecha_vencimiento)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                !empty($data['paciente_id'])     ? (int) $data['paciente_id']          : null,
                !empty($data['vinculo_id'])       ? (int) $data['vinculo_id']           : null,
                !empty($data['atencion_id'])      ? (int) $data['atencion_id']          : null,
                !empty($data['sesion_id'])        ? (int) $data['sesion_id']            : null,
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
                    COUNT(DISTINCT s.id) AS total_sesiones,
                    COALESCE(SUM(cc.monto_total), 0) AS total_facturado,
                    COALESCE(SUM(cc.monto_pagado), 0) AS total_cobrado,
                    COALESCE(SUM(cc.saldo_pendiente), 0) AS saldo_pendiente
             FROM atenciones a
             JOIN subservicios ss ON ss.id = a.subservicio_id
             JOIN profesionales prof ON prof.id = a.profesional_id
             JOIN personas pe ON pe.id = prof.persona_id
             LEFT JOIN sesiones s ON s.atencion_id = a.id
             LEFT JOIN cuentas_cobro cc ON cc.sesion_id = s.id
             WHERE a.paciente_id = ?
             GROUP BY a.id, a.profesional_id, ss.nombre, pe.nombres, pe.apellidos,
                      a.fecha_inicio, a.estado
             ORDER BY a.fecha_inicio DESC",
            [$pacienteId]
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
                 LEFT JOIN cuentas_cobro cc ON cc.sesion_id = s.id
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

        return [
            'adelantos_activos' => $adelantos,
            'atenciones'        => $atenciones,
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
}
