<?php
namespace Src\Models;
use Src\Core\Database;

class Cita {

    /**
     * Lista de citas con joins completos.
     * Filtros opcionales: estado, fecha, profesional_id, fecha_desde, fecha_hasta,
     *                     modalidad_sesion, q (busca en paciente/profesional/subservicio).
     * Sin filtros de fecha: devuelve citas de hoy en adelante (próximos 30 días).
     */
    public static function findAll(array $filtros = []): array {
        $where  = [];
        $params = [];

        if (!empty($filtros['estado'])) {
            $where[]  = 'ci.estado = ?';
            $params[] = $filtros['estado'];
        }
        if (!empty($filtros['profesional_id'])) {
            $where[]  = 'ci.profesional_id = ?';
            $params[] = (int) $filtros['profesional_id'];
        }
        if (!empty($filtros['modalidad_sesion'])) {
            $where[]  = 'ci.modalidad_sesion = ?';
            $params[] = $filtros['modalidad_sesion'];
        }
        if (!empty($filtros['q'])) {
            $like     = '%' . $filtros['q'] . '%';
            $where[]  = '(CONCAT(pe_p.nombres, \' \', pe_p.apellidos) LIKE ?
                          OR CONCAT(pe_r.nombres, \' \', pe_r.apellidos) LIKE ?
                          OR ss.nombre LIKE ?)';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $hasFechaFiltro = !empty($filtros['fecha_desde']) || !empty($filtros['fecha']);

        if (!empty($filtros['fecha_desde']) && !empty($filtros['fecha_hasta'])) {
            $where[]  = 'DATE(ci.fecha_hora_inicio) BETWEEN ? AND ?';
            $params[] = $filtros['fecha_desde'];
            $params[] = $filtros['fecha_hasta'];
        } elseif (!empty($filtros['fecha'])) {
            $where[]  = 'DATE(ci.fecha_hora_inicio) = ?';
            $params[] = $filtros['fecha'];
        } elseif (empty($filtros['fecha_desde'])) {
            $where[]  = 'DATE(ci.fecha_hora_inicio) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)';
        }

        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        return Database::query("
            SELECT ci.id                                              AS cita_id,
                   ci.paciente_id,
                   ci.profesional_id,
                   ci.fecha_hora_inicio,
                   ci.estado,
                   ci.reprogramaciones_count,
                   ci.cita_origen_id,
                   ci.tipo_cita,
                   COALESCE(ci.atencion_id,
                       (SELECT a.id FROM atenciones a WHERE a.cita_id = ci.id LIMIT 1)
                   )                                                  AS atencion_id,
                   ci.subservicio_id,
                   ci.precio_acordado,
                   ci.descuento_monto,
                   ci.motivo_descuento,
                   ci.modalidad_sesion,
                   CONCAT(pe_p.nombres, ' ', pe_p.apellidos)         AS paciente,
                   pe_p.dni                                           AS paciente_dni,
                   CONCAT(pe_r.nombres, ' ', pe_r.apellidos)         AS profesional,
                   ss.nombre                                          AS subservicio,
                   ss.modalidad AS subservicio_modalidad,
                   ss.duracion_min,
                   se.nombre                                          AS servicio,
                   ss.precio_base,
                   CASE
                       WHEN TIMESTAMPDIFF(YEAR, pe_p.fecha_nacimiento, CURDATE()) < 18
                            AND pe_p.fecha_nacimiento IS NOT NULL
                       THEN 1 ELSE 0
                   END                                               AS paciente_es_menor,
                   (SELECT COUNT(*) FROM alertas al_c
                    WHERE al_c.paciente_id = p.id
                      AND al_c.estado = 'activa'
                   )                                                  AS alertas_activas_paciente,
                   (ci.precio_acordado - IFNULL(ci.descuento_monto, 0)) AS precio_efectivo,
                   CASE
                       WHEN EXISTS (
                           SELECT 1 FROM atenciones a_ec
                           WHERE (a_ec.cita_id = ci.id OR a_ec.id = ci.atencion_id)
                             AND EXISTS (
                                 SELECT 1 FROM sesiones s_ec
                                 WHERE s_ec.atencion_id = a_ec.id
                                   AND s_ec.paciente_paquete_id IS NOT NULL
                             )
                       ) THEN 'paquete'
                       WHEN EXISTS (
                           SELECT 1 FROM cuentas_cobro cc_ec
                           JOIN sesiones s_ec ON s_ec.id = cc_ec.sesion_id
                           JOIN atenciones a_ec ON a_ec.id = s_ec.atencion_id
                           WHERE (a_ec.cita_id = ci.id OR a_ec.id = ci.atencion_id)
                             AND cc_ec.estado = 'pagado'
                       ) THEN 'pagado'
                       WHEN EXISTS (
                           SELECT 1 FROM cuentas_cobro cc_ec
                           JOIN sesiones s_ec ON s_ec.id = cc_ec.sesion_id
                           JOIN atenciones a_ec ON a_ec.id = s_ec.atencion_id
                           WHERE (a_ec.cita_id = ci.id OR a_ec.id = ci.atencion_id)
                             AND cc_ec.estado = 'pago_parcial'
                       ) THEN 'parcial'
                       WHEN EXISTS (
                           SELECT 1 FROM cuentas_cobro cc_ec
                           JOIN sesiones s_ec ON s_ec.id = cc_ec.sesion_id
                           JOIN atenciones a_ec ON a_ec.id = s_ec.atencion_id
                           WHERE (a_ec.cita_id = ci.id OR a_ec.id = ci.atencion_id)
                             AND cc_ec.estado = 'pendiente'
                       ) THEN 'pendiente'
                       ELSE 'sin_cobro'
                   END                                               AS estado_cobro,
                   (SELECT cc_sub.id
                    FROM cuentas_cobro cc_sub
                    JOIN sesiones s_sub ON s_sub.id = cc_sub.sesion_id
                    JOIN atenciones a_sub ON a_sub.id = s_sub.atencion_id
                    WHERE (a_sub.cita_id = ci.id OR a_sub.id = ci.atencion_id)
                    ORDER BY cc_sub.id DESC LIMIT 1
                   )                                                 AS cuenta_cobro_id,
                   (SELECT cc_sub.saldo_pendiente
                    FROM cuentas_cobro cc_sub
                    JOIN sesiones s_sub ON s_sub.id = cc_sub.sesion_id
                    JOIN atenciones a_sub ON a_sub.id = s_sub.atencion_id
                    WHERE (a_sub.cita_id = ci.id OR a_sub.id = ci.atencion_id)
                    ORDER BY cc_sub.id DESC LIMIT 1
                   )                                                 AS saldo_pendiente_cobro
            FROM citas ci
            JOIN pacientes    p    ON p.id    = ci.paciente_id
            JOIN personas     pe_p ON pe_p.id = p.persona_id
            JOIN profesionales pr  ON pr.id   = ci.profesional_id
            JOIN personas     pe_r ON pe_r.id = pr.persona_id
            JOIN subservicios ss   ON ss.id   = ci.subservicio_id
            JOIN servicios    se   ON se.id   = ss.servicio_id
            $whereClause
            ORDER BY ci.fecha_hora_inicio ASC
        ", $params)->fetchAll();
    }

    public static function findById(int $id): array|false {
        return Database::query("
            SELECT ci.*,
                   CONCAT(pe_p.nombres, ' ', pe_p.apellidos) AS paciente,
                   CONCAT(pe_r.nombres, ' ', pe_r.apellidos) AS profesional,
                   ss.nombre        AS subservicio,
                   ss.duracion_min,
                   ci.modalidad_sesion
            FROM citas ci
            JOIN pacientes    p    ON p.id    = ci.paciente_id
            JOIN personas     pe_p ON pe_p.id = p.persona_id
            JOIN profesionales pr  ON pr.id   = ci.profesional_id
            JOIN personas     pe_r ON pe_r.id = pr.persona_id
            JOIN subservicios ss   ON ss.id   = ci.subservicio_id
            WHERE ci.id = ?
        ", [$id])->fetch();
    }

    /** Devuelve solo las citas del paciente vinculado a la persona dada. */
    public static function findByPersona(int $personaId): array {
        return Database::query("
            SELECT ci.id AS cita_id,
                   ci.fecha_hora_inicio,
                   ci.estado,
                   ci.reprogramaciones_count,
                   CONCAT(pe_r.nombres, ' ', pe_r.apellidos) AS profesional,
                   ss.nombre    AS subservicio,
                   ss.duracion_min
            FROM citas ci
            JOIN pacientes    p    ON p.id    = ci.paciente_id
            JOIN profesionales pr  ON pr.id   = ci.profesional_id
            JOIN personas     pe_r ON pe_r.id = pr.persona_id
            JOIN subservicios ss   ON ss.id   = ci.subservicio_id
            WHERE p.persona_id = ?
            ORDER BY ci.fecha_hora_inicio DESC
        ", [$personaId])->fetchAll();
    }

    /** Devuelve la cita solo si pertenece al paciente vinculado a la persona dada. */
    public static function findByIdAndPersona(int $id, int $personaId): array|false {
        return Database::query("
            SELECT c.*
            FROM citas c
            JOIN pacientes p ON p.id = c.paciente_id
            WHERE c.id = ? AND p.persona_id = ?
        ", [$id, $personaId])->fetch();
    }

    public static function existeCruce(
        int    $profesional_id,
        string $nuevaFecha,
        int    $nuevaDuracion,
        ?int   $excluirCitaId = null,
        ?int   $excluirTallerFechaId = null
    ): bool {
        // Cruce con citas individuales
        $sqlCita = "
            SELECT c.id
            FROM citas c
            JOIN subservicios ss ON ss.id = c.subservicio_id
            WHERE c.profesional_id = ?
              AND c.estado IN ('pendiente','confirmada')
              AND ? < DATE_ADD(c.fecha_hora_inicio,
                      INTERVAL ss.duracion_min MINUTE)
              AND DATE_ADD(?, INTERVAL ? MINUTE)
                      > c.fecha_hora_inicio
        ";
        $paramsCita = [$profesional_id, $nuevaFecha, $nuevaFecha, $nuevaDuracion];
        if ($excluirCitaId !== null) {
            $sqlCita     .= " AND c.id != ?";
            $paramsCita[] = $excluirCitaId;
        }
        if ((bool) Database::query($sqlCita, $paramsCita)->fetch()) {
            return true;
        }

        // Cruce con fechas de talleres institucionales
        $sqlTaller = "
            SELECT tf.id
            FROM taller_fechas tf
            JOIN talleres_institucionales ti ON ti.id = tf.taller_id
            WHERE ti.profesional_id = ?
              AND tf.estado != 'cancelada'
              AND ? < DATE_ADD(tf.fecha_hora, INTERVAL tf.duracion_min MINUTE)
              AND DATE_ADD(?, INTERVAL ? MINUTE) > tf.fecha_hora
        ";
        $paramsTaller = [$profesional_id, $nuevaFecha, $nuevaFecha, $nuevaDuracion];
        if ($excluirTallerFechaId !== null) {
            $sqlTaller     .= " AND tf.id != ?";
            $paramsTaller[] = $excluirTallerFechaId;
        }

        return (bool) Database::query($sqlTaller, $paramsTaller)->fetch();
    }

    public static function create(array $data): void {
        Database::query("
            INSERT INTO citas (
                paciente_id, profesional_id, subservicio_id, fecha_hora_inicio,
                atencion_id, tipo_cita,
                modalidad_sesion,
                precio_acordado, descuento_monto, motivo_descuento,
                creado_por
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ", [
            $data['paciente_id'],
            $data['profesional_id'],
            $data['subservicio_id'],
            $data['fecha_hora_inicio'],
            $data['atencion_id']       ?? null,
            $data['tipo_cita']         ?? null,
            $data['modalidad_sesion']  ?? 'presencial',
            $data['precio_acordado']   ?? null,
            $data['descuento_monto']   ?? 0.00,
            $data['motivo_descuento']  ?? null,
            $_SESSION['user']['id'],
        ]);
    }

    /**
     * Reprograma una cita:
     *  1. Marca la original como 'reprogramada'
     *  2. Crea nueva cita con cita_origen_id apuntando a la original
     *  3. Inserta registro en historial_citas
     *  4. La nueva cita hereda reprogramaciones_count + 1
     */
    public static function reprogramar(int $id, string $nuevaFecha, string $descripcion, int $registradoPor): int {
        $original = Database::query("
            SELECT id, paciente_id, profesional_id, subservicio_id,
                   fecha_hora_inicio, estado, reprogramaciones_count,
                   tipo_cita, atencion_id,
                   modalidad_sesion,
                   precio_acordado, descuento_monto, motivo_descuento, notas
            FROM citas WHERE id = ?
        ", [$id])->fetch();

        if (!$original) {
            throw new \Exception('Cita no encontrada');
        }

        if (!in_array($original['estado'], ['pendiente', 'confirmada'], true)) {
            throw new \Exception('Solo se pueden reprogramar citas pendientes o confirmadas');
        }

        $pdo = Database::getInstance();
        $pdo->beginTransaction();
        try {
            // 1. Marcar original como reprogramada
            Database::query(
                "UPDATE citas SET estado = 'reprogramada' WHERE id = ?",
                [$id]
            );

            // 2. Crear nueva cita copiando campos de precio y modalidad de la original
            Database::query("
                INSERT INTO citas
                    (paciente_id, profesional_id, subservicio_id,
                     fecha_hora_inicio, cita_origen_id, reprogramaciones_count,
                     tipo_cita, atencion_id,
                     modalidad_sesion,
                     precio_acordado, descuento_monto, motivo_descuento,
                     notas, creado_por)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ", [
                $original['paciente_id'],
                $original['profesional_id'],
                $original['subservicio_id'],
                $nuevaFecha,
                $id,
                (int) $original['reprogramaciones_count'] + 1,
                $original['tipo_cita'],
                $original['atencion_id'],
                $original['modalidad_sesion'] ?? 'presencial',
                $original['precio_acordado'],
                $original['descuento_monto'],
                $original['motivo_descuento'],
                $original['notas'],
                $registradoPor,
            ]);

            $nuevaCitaId = (int) $pdo->lastInsertId();

            // 3. Registrar en historial_citas
            Database::query("
                INSERT INTO historial_citas
                    (cita_id, fecha_hora_anterior, fecha_hora_nueva,
                     motivo, descripcion, registrado_por)
                VALUES (?, ?, ?, 'reprogramacion', ?, ?)
            ", [
                $id,
                $original['fecha_hora_inicio'],
                $nuevaFecha,
                $descripcion ?: null,
                $registradoPor,
            ]);

            $pdo->commit();
            return $nuevaCitaId;
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public static function updateEstado(int $id, string $estado, ?int $atencionId = null): void {
        if ($atencionId !== null) {
            Database::query(
                "UPDATE citas SET estado = ?, atencion_id = ? WHERE id = ?",
                [$estado, $atencionId, $id]
            );
        } else {
            Database::query("UPDATE citas SET estado = ? WHERE id = ?", [$estado, $id]);
        }
    }

    public static function delete(int $id): void {
        Database::query("DELETE FROM citas WHERE id = ?", [$id]);
    }
}
