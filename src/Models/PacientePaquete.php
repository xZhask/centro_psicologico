<?php
namespace Src\Models;
use Src\Core\Database;

class PacientePaquete {

    public static function findByPaciente(int $pacienteId): array {
        return Database::query(
            "SELECT pp.id,
                    pp.paquete_id,
                    pp.paciente_id,
                    pp.profesional_id,
                    pp.sesiones_restantes,
                    pp.cuenta_cobro_id,
                    pp.estado,
                    pp.fecha_activacion,
                    pp.fecha_vencimiento,
                    pp.notas,
                    pk.nombre            AS nombre_paquete,
                    pk.sesiones_incluidas,
                    pk.precio_paquete,
                    CONCAT(pe.nombres, ' ', pe.apellidos) AS profesional
             FROM paciente_paquetes pp
             JOIN paquetes      pk ON pk.id  = pp.paquete_id
             JOIN profesionales pr ON pr.id  = pp.profesional_id
             JOIN personas      pe ON pe.id  = pr.persona_id
             WHERE pp.paciente_id = ?
             ORDER BY
                 FIELD(pp.estado,'activo','agotado','vencido','cancelado'),
                 pp.created_at DESC",
            [$pacienteId]
        )->fetchAll();
    }

    public static function findActivoByPaciente(int $pacienteId): ?array {
        $row = Database::query(
            "SELECT pp.id,
                    pp.paquete_id,
                    pp.sesiones_restantes,
                    pp.estado,
                    pp.fecha_activacion,
                    pp.fecha_vencimiento,
                    pk.nombre            AS nombre_paquete,
                    pk.sesiones_incluidas,
                    pk.precio_paquete
             FROM paciente_paquetes pp
             JOIN paquetes pk ON pk.id = pp.paquete_id
             WHERE pp.paciente_id = ?
               AND pp.estado = 'activo'
               AND pp.sesiones_restantes > 0
             ORDER BY pp.created_at DESC
             LIMIT 1",
            [$pacienteId]
        )->fetch();
        return $row ?: null;
    }

    public static function findActivoByPacienteYProfesional(int $pacienteId, int $profesionalId): ?array {
        $row = Database::query(
            "SELECT pp.id,
                    pp.paquete_id,
                    pp.profesional_id,
                    pp.sesiones_restantes,
                    pk.nombre             AS nombre_paquete,
                    pk.sesiones_incluidas,
                    pk.precio_paquete
             FROM paciente_paquetes pp
             JOIN paquetes pk ON pk.id = pp.paquete_id
             WHERE pp.paciente_id    = ?
               AND pp.profesional_id = ?
               AND pp.estado = 'activo'
               AND pp.sesiones_restantes > 0
             ORDER BY pp.created_at DESC
             LIMIT 1",
            [$pacienteId, $profesionalId]
        )->fetch();
        return $row ?: null;
    }

    /**
     * Transacción: inserta paquete contratado con cuenta_cobro_id = NULL.
     * La cuenta se crea de forma lazy al recibir el primer pago (obtenerOCrearCuenta).
     */
    public static function contratar(array $data): int {
        $pdo = Database::getInstance();
        $pdo->beginTransaction();

        try {
            $paquete = Paquete::findById((int) $data['paquete_id']);
            if (!$paquete) {
                throw new \RuntimeException('Paquete no encontrado');
            }

            $hoy = date('Y-m-d');

            $pdo->prepare(
                "INSERT INTO paciente_paquetes
                     (paquete_id, paciente_id, profesional_id, sesiones_restantes,
                      estado, fecha_activacion, fecha_vencimiento, notas, created_by)
                 VALUES (?, ?, ?, ?, 'activo', ?, ?, ?, ?)"
            )->execute([
                (int) $paquete['id'],
                (int) $data['paciente_id'],
                (int) $data['profesional_id'],
                (int) $paquete['sesiones_incluidas'],
                $data['fecha_activacion'] ?? $hoy,
                !empty($data['fecha_vencimiento']) ? $data['fecha_vencimiento'] : null,
                !empty($data['notas'])             ? trim($data['notas'])       : null,
                (int) $data['created_by'],
            ]);
            $ppId = (int) $pdo->lastInsertId();

            $pdo->commit();
            return $ppId;

        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Devuelve el cuenta_cobro_id del paquete contratado,
     * creándolo de forma lazy si aún no existe.
     */
    public static function obtenerOCrearCuenta(int $ppId): int {
        $pp = Database::query(
            "SELECT pp.id, pp.cuenta_cobro_id, pp.paciente_id,
                    pk.nombre, pk.precio_paquete
             FROM paciente_paquetes pp
             JOIN paquetes pk ON pk.id = pp.paquete_id
             WHERE pp.id = ?",
            [$ppId]
        )->fetch();

        if (!$pp) {
            throw new \RuntimeException('Paquete contratado no encontrado');
        }

        if ($pp['cuenta_cobro_id']) {
            return (int) $pp['cuenta_cobro_id'];
        }

        $cuentaId = CuentaCobro::create([
            'paciente_id'   => (int) $pp['paciente_id'],
            'concepto'      => 'Paquete: ' . $pp['nombre'],
            'monto_total'   => (float) $pp['precio_paquete'],
            'fecha_emision' => date('Y-m-d'),
        ]);

        Database::query(
            "UPDATE paciente_paquetes SET cuenta_cobro_id = ? WHERE id = ?",
            [$cuentaId, $ppId]
        );

        return $cuentaId;
    }

    public static function cancelar(int $id): bool {
        Database::query(
            "UPDATE paciente_paquetes SET estado = 'cancelado' WHERE id = ?",
            [$id]
        );
        return true;
    }

}
