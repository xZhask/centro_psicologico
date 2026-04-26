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
                    pk.sesiones_incluidas
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

    /**
     * Transacción: inserta paquete contratado, genera cuenta_cobro y vincula ambos.
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

            $cuentaId = CuentaCobro::create([
                'paciente_id'   => (int) $data['paciente_id'],
                'concepto'      => 'Paquete: ' . $paquete['nombre'],
                'monto_total'   => (float) $paquete['precio_paquete'],
                'fecha_emision' => $hoy,
            ]);

            $pdo->prepare(
                "UPDATE paciente_paquetes SET cuenta_cobro_id = ? WHERE id = ?"
            )->execute([$cuentaId, $ppId]);

            $pdo->commit();
            return $ppId;

        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public static function cancelar(int $id): bool {
        Database::query(
            "UPDATE paciente_paquetes SET estado = 'cancelado' WHERE id = ?",
            [$id]
        );
        return true;
    }
}
