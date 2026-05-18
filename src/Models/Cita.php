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
                   -- Cobertura consolidada para el frontend
                   (SELECT JSON_OBJECT(
                      'paquete_id',                 pp.id,
                      'paquete_nombre',             pk.nombre,
                      'paquete_sesiones_restantes', pp.sesiones_restantes,
                      'paquete_cuenta_cobro_id',    pp.cuenta_cobro_id,
                      'paquete_cuenta_monto',       cc_pp.monto_total,
                      'paquete_cuenta_saldo',       cc_pp.saldo_pendiente,
                      'precio_paquete',             pk.precio_paquete,
                      'adelanto_id',        ap.id,
                      'adelanto_saldo',     ap.saldo_disponible,
                      'adelanto_concepto',  ap.concepto,
                      'cuenta_id',          cc.id,
                      'cuenta_monto',       cc.monto_total,
                      'cuenta_pagado',      cc.monto_pagado,
                      'cuenta_saldo',       cc.saldo_pendiente,
                      'cuenta_estado',      cc.estado,
                      'habilitada_para_registro',
                          CASE
                            WHEN pp.id IS NOT NULL AND cc_pp.monto_pagado > 0 THEN 1
                            WHEN ap.id IS NOT NULL AND ap.saldo_disponible >= (ci.precio_acordado - ci.descuento_monto) THEN 1
                            WHEN cc.id IS NOT NULL AND (cc.monto_pagado >= cc.monto_total OR cc.monto_pagado > 0) THEN 1
                            ELSE 0
                          END
                   )
                    FROM (SELECT 1) AS dummy
                    LEFT JOIN paciente_paquetes pp ON pp.id = COALESCE(
                         -- 1. Match exacto: sesion de esta cita cubierta por paquete
                         (SELECT s.paciente_paquete_id
                          FROM sesiones s
                          WHERE s.cita_id = ci.id
                            AND s.paciente_paquete_id IS NOT NULL
                          LIMIT 1),
                         -- 2. Legacy: cita completada sin sesion enlazada (paquete sesion 2+)
                         (CASE WHEN ci.estado = 'completada'
                                 AND NOT EXISTS (SELECT 1 FROM sesiones sx WHERE sx.cita_id = ci.id)
                            THEN (SELECT s2.paciente_paquete_id
                                  FROM sesiones s2
                                  JOIN atenciones a2 ON a2.id = s2.atencion_id
                                  WHERE a2.paciente_id    = ci.paciente_id
                                    AND a2.profesional_id = ci.profesional_id
                                    AND s2.cita_id IS NULL
                                    AND s2.paciente_paquete_id IS NOT NULL
                                  LIMIT 1)
                            ELSE NULL END),
                         -- 3. Citas pendientes/confirmadas: paquete activo con sesiones disponibles
                         (SELECT pp2.id FROM paciente_paquetes pp2
                          WHERE pp2.paciente_id = ci.paciente_id
                            AND pp2.profesional_id = ci.profesional_id
                            AND pp2.estado = 'activo'
                            AND pp2.sesiones_restantes > (
                                SELECT COUNT(*) FROM citas c2
                                WHERE c2.paciente_id = ci.paciente_id
                                  AND c2.profesional_id = ci.profesional_id
                                  AND c2.estado IN ('pendiente', 'confirmada')
                                  AND (c2.fecha_hora_inicio < ci.fecha_hora_inicio
                                       OR (c2.fecha_hora_inicio = ci.fecha_hora_inicio AND c2.id < ci.id))
                            )
                          LIMIT 1)
                     )
                    LEFT JOIN paquetes pk ON pk.id = pp.paquete_id
                    LEFT JOIN cuentas_cobro cc_pp ON cc_pp.id = pp.cuenta_cobro_id
                    LEFT JOIN adelantos_paciente ap ON ap.paciente_id = ci.paciente_id
                         AND ap.profesional_id = ci.profesional_id
                         AND ap.estado = 'activo' AND ap.saldo_disponible > 0
                    LEFT JOIN cuentas_cobro cc ON cc.cita_id = ci.id
                    LIMIT 1
                   ) AS cobertura
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

    public static function create(array $data): int {
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
        return (int) Database::getInstance()->lastInsertId();
    }

    public static function evaluarCobertura(int $citaId): array {
        $cita = self::findById($citaId);
        if (!$cita) {
            throw new \Exception("Cita no encontrada");
        }

        $precioEfectivo = (float)$cita['precio_acordado'] - (float)($cita['descuento_monto'] ?? 0);

        // 1. Paquete activo
        $paquete = Database::query("
            SELECT pp.*, pk.nombre,
                   (SELECT COUNT(*) FROM citas c2 
                    WHERE c2.paciente_id = pp.paciente_id 
                      AND c2.profesional_id = pp.profesional_id 
                      AND c2.estado IN ('pendiente', 'confirmada')
                      AND (c2.fecha_hora_inicio < ci.fecha_hora_inicio 
                           OR (c2.fecha_hora_inicio = ci.fecha_hora_inicio AND c2.id < ci.id))
                   ) AS reservas_previas
            FROM paciente_paquetes pp
            JOIN paquetes pk ON pk.id = pp.paquete_id
            JOIN citas ci ON ci.id = ?
            WHERE pp.paciente_id = ci.paciente_id
              AND pp.profesional_id = ci.profesional_id
              AND pp.estado = 'activo'
              AND pp.sesiones_restantes > 0
            LIMIT 1
        ", [$citaId])->fetch();

        if ($paquete && (int)$paquete['sesiones_restantes'] > (int)$paquete['reservas_previas']) {
            return [
                'estado'                     => 'cubierta_paquete',
                'cuenta_cobro_id'            => null,
                'monto_total'                => $precioEfectivo,
                'monto_pagado'               => $precioEfectivo,
                'saldo_pendiente'            => 0,
                'paquete_id'                 => (int)$paquete['id'],
                'paquete_nombre'             => $paquete['nombre'],
                'paquete_sesiones_restantes' => (int)$paquete['sesiones_restantes'],
                'adelanto_id'                => null,
                'adelanto_saldo'             => null,
                'habilitada_para_registro'   => true,
                'mensaje'                    => "Cubierta por paquete {$paquete['nombre']}: {$paquete['sesiones_restantes']} sesiones restantes."
            ];
        }

        // 2. Adelanto activo
        $adelanto = Database::query("
            SELECT * FROM adelantos_paciente
            WHERE paciente_id = ?
              AND profesional_id = ?
              AND estado = 'activo'
              AND saldo_disponible > 0
            LIMIT 1
        ", [$cita['paciente_id'], $cita['profesional_id']])->fetch();

        if ($adelanto) {
            $saldoAd = (float)$adelanto['saldo_disponible'];
            if ($saldoAd >= $precioEfectivo) {
                return [
                    'estado'                   => 'cubierta_adelanto',
                    'cuenta_cobro_id'          => null,
                    'monto_total'              => $precioEfectivo,
                    'monto_pagado'             => $precioEfectivo,
                    'saldo_pendiente'          => 0,
                    'paquete_id'               => null,
                    'paquete_nombre'           => null,
                    'paquete_sesiones_restantes' => null,
                    'adelanto_id'              => (int)$adelanto['id'],
                    'adelanto_saldo'           => $saldoAd,
                    'habilitada_para_registro' => true,
                    'mensaje'                  => "Cubierta por crédito disponible. Se aplicarán S/{$precioEfectivo} al registrar."
                ];
            } else {
                // Adelanto parcial, ver si hay pago por la diferencia
                $saldoPendienteReal = round($precioEfectivo - $saldoAd, 2);
                $cuenta = Database::query("SELECT * FROM cuentas_cobro WHERE cita_id = ? LIMIT 1", [$citaId])->fetch();

                $pagadoEnCuenta = $cuenta ? (float)$cuenta['monto_pagado'] : 0;
                $habilitada = ($pagadoEnCuenta >= $saldoPendienteReal);

                return [
                    'estado'                   => 'cubierta_parcial_adelanto',
                    'cuenta_cobro_id'          => $cuenta ? (int)$cuenta['id'] : null,
                    'monto_total'              => $precioEfectivo,
                    'monto_pagado'             => round($saldoAd + $pagadoEnCuenta, 2),
                    'saldo_pendiente'          => round($precioEfectivo - ($saldoAd + $pagadoEnCuenta), 2),
                    'paquete_id'               => null,
                    'paquete_nombre'           => null,
                    'paquete_sesiones_restantes' => null,
                    'adelanto_id'              => (int)$adelanto['id'],
                    'adelanto_saldo'           => $saldoAd,
                    'habilitada_para_registro' => $habilitada,
                    'mensaje'                  => $habilitada
                                                  ? "Cubierta por adelanto parcial y pago de diferencia."
                                                  : "Cubierta parcialmente por adelanto. Falta pagar S/{$saldoPendienteReal}."
                ];
            }
        }

        // 3. Cuenta de cobro vinculada
        $cuenta = Database::query("SELECT * FROM cuentas_cobro WHERE cita_id = ? LIMIT 1", [$citaId])->fetch();

        if (!$cuenta) {
            return [
                'estado'                   => 'pendiente_pago',
                'cuenta_cobro_id'          => null,
                'monto_total'              => $precioEfectivo,
                'monto_pagado'             => 0,
                'saldo_pendiente'          => $precioEfectivo,
                'paquete_id'               => null,
                'paquete_nombre'           => null,
                'paquete_sesiones_restantes' => null,
                'adelanto_id'              => null,
                'adelanto_saldo'           => null,
                'habilitada_para_registro' => false,
                'mensaje'                  => "Requiere pago para registrar la sesión/atención."
            ];
        }

        $mp = (float)$cuenta['monto_pagado'];
        $mt = (float)$cuenta['monto_total'];
        $habilitada = ($mp >= $mt || $mp > 0); // User said: Si monto_pagado > 0 -> habilitada_para_registro = true (pago parcial permitido)

        return [
            'estado'                   => ($mp >= $mt) ? 'pagada_completa' : (($mp > 0) ? 'pago_parcial' : 'pendiente_pago'),
            'cuenta_cobro_id'          => (int)$cuenta['id'],
            'monto_total'              => $mt,
            'monto_pagado'             => $mp,
            'saldo_pendiente'          => (float)$cuenta['saldo_pendiente'],
            'paquete_id'               => null,
            'paquete_nombre'           => null,
            'paquete_sesiones_restantes' => null,
            'adelanto_id'              => null,
            'adelanto_saldo'           => null,
            'habilitada_para_registro' => $habilitada,
            'mensaje'                  => ($mp >= $mt) ? "Pago completado." : (($mp > 0) ? "Pago parcial recibido (S/{$mp} de S/{$mt})." : "Pago pendiente.")
        ];
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

            // 4. Si la cita original tenía cuenta_cobro, transferirla a la nueva
            Database::query(
                "UPDATE cuentas_cobro
                 SET cita_id = ?,
                     concepto = CONCAT('Reprogramada: ', concepto)
                 WHERE cita_id = ?",
                [$nuevaCitaId, $id]
            );

            $pdo->commit();
            return $nuevaCitaId;
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public static function cancelar(int $citaId): array {
        $pdo = Database::getInstance();
        $pdo->beginTransaction();
        try {
            // 1. Actualizar estado de la cita
            Database::query("UPDATE citas SET estado = 'cancelada' WHERE id = ?", [$citaId]);

            // 2. Buscar cuenta vinculada
            $cuenta = Database::query("SELECT id, monto_pagado FROM cuentas_cobro WHERE cita_id = ?", [$citaId])->fetch();

            $res = ['requiere_devolucion' => false, 'monto_a_devolver' => 0];

            if ($cuenta) {
                $montoPagado = (float)$cuenta['monto_pagado'];
                if ($montoPagado > 0) {
                    Database::query("UPDATE cuentas_cobro SET estado = 'anulada' WHERE id = ?", [$cuenta['id']]);
                    $res = [
                        'requiere_devolucion' => true,
                        'monto_a_devolver'    => $montoPagado,
                        'mensaje'             => "Esta cita tiene S/{$montoPagado} pagado. Registra la devolución del dinero al paciente manualmente fuera del sistema."
                    ];
                } else {
                    Database::query("DELETE FROM cuentas_cobro WHERE id = ?", [$cuenta['id']]);
                }
            }

            $pdo->commit();
            return $res;
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
