<?php
namespace Src\Models;
use Src\Core\Database;

class PlanillaConcepto {

    public static function findByPlanilla(int $planillaId): array {
        return Database::query("
            SELECT pc.id,
                   pc.tipo,
                   pc.sesion_id,
                   pc.taller_fecha_id,
                   pc.descripcion,
                   pc.monto_base,
                   pc.porcentaje,
                   pc.monto_profesional
            FROM planilla_conceptos pc
            WHERE pc.planilla_id = ?
            ORDER BY pc.tipo, pc.id
        ", [$planillaId])->fetchAll();
    }

    public static function insertTallerConceptos(int $planillaId, int $profesionalId, string $inicio, string $fin): int {
        $talleres = Database::query("
            SELECT tf.id   AS taller_fecha_id,
                   ti.tema,
                   ti.precio_acordado,
                   ti.porcentaje_prof,
                   tf.fecha_hora
            FROM taller_fechas tf
            JOIN talleres_institucionales ti ON ti.id = tf.taller_id
            WHERE ti.profesional_id = ?
              AND tf.estado = 'realizada'
              AND tf.fecha_hora BETWEEN ? AND ?
        ", [$profesionalId, $inicio, $fin])->fetchAll();

        $insertados = 0;
        foreach ($talleres as $t) {
            Database::query("
                INSERT INTO planilla_conceptos
                    (planilla_id, tipo, taller_fecha_id, descripcion, monto_base, porcentaje)
                VALUES (?, 'taller', ?, ?, ?, ?)
            ", [
                $planillaId,
                (int) $t['taller_fecha_id'],
                'Taller: ' . $t['tema'] . ' (' . substr($t['fecha_hora'], 0, 10) . ')',
                (float) $t['precio_acordado'],
                (float) $t['porcentaje_prof'],
            ]);
            $insertados++;
        }
        return $insertados;
    }
}
