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
                (paciente_id, vinculo_id, atencion_id, concepto,
                 monto_total, descuento_aplicado, motivo_descuento,
                 fecha_emision, fecha_vencimiento)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                !empty($data['paciente_id'])     ? (int) $data['paciente_id']          : null,
                !empty($data['vinculo_id'])       ? (int) $data['vinculo_id']           : null,
                !empty($data['atencion_id'])      ? (int) $data['atencion_id']          : null,
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
