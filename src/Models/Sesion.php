<?php
namespace Src\Models;

use Src\Core\Database;

class Sesion {

    public static function crear(array $data): array {
        $atencionId = (int) $data['atencion_id'];
        $numero     = self::nextNumero($atencionId);
        $modalidad  = $data['modalidad_sesion'] ?? 'presencial';
        $precio     = (float) $data['precio_sesion'];
        $paqueteId  = !empty($data['paciente_paquete_id']) ? (int) $data['paciente_paquete_id'] : null;
        $adelantoId = !empty($data['adelanto_id'])         ? (int) $data['adelanto_id']         : null;
        $citaId     = !empty($data['cita_id'])             ? (int) $data['cita_id']             : null;

        // 1. Insertar la sesión
        Database::query(
            "INSERT INTO sesiones
                 (atencion_id, paciente_paquete_id, numero_sesion, modalidad_sesion,
                  precio_sesion, duracion_min, nota_clinica, fecha_hora)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
            [
                $atencionId,
                $paqueteId,
                $numero,
                $modalidad,
                $precio,
                (int) $data['duracion_min'],
                $data['nota_clinica'] ?? null,
            ]
        );
        $sesionId = (int) Database::getInstance()->lastInsertId();

        // 2. Aplicar cobertura según prioridad

        // 2A. PAQUETE — el trigger consume sesión automáticamente
        if ($paqueteId) {
            $pp = Database::query(
                "SELECT pp.sesiones_restantes, pp.estado, pp.paquete_id, pp.paciente_id,
                        pp.cuenta_cobro_id,
                        pk.nombre AS nombre_paquete, pk.precio_paquete
                 FROM paciente_paquetes pp
                 JOIN paquetes pk ON pk.id = pp.paquete_id
                 WHERE pp.id = ?",
                [$paqueteId]
            )->fetch();

            if ($pp && ($pp['estado'] === 'activo' || $pp['estado'] === 'agotado')) {
                $nombre    = $data['paquete_nombre'] ?? $pp['nombre_paquete'] ?? 'paquete';
                $restantes = (int) $pp['sesiones_restantes'];
                $msg = $pp['estado'] === 'agotado'
                    ? "Sesión registrada. Paquete «{$nombre}» agotado."
                    : "Sesión registrada. Paquete «{$nombre}»: {$restantes} sesiones restantes.";
                if (!empty($pp['cuenta_cobro_id'])) {
                    Database::query(
                        "UPDATE cuentas_cobro SET atencion_id = ? WHERE id = ? AND atencion_id IS NULL",
                        [$atencionId, (int) $pp['cuenta_cobro_id']]
                    );
                }
                return [
                    'sesion_id'               => $sesionId,
                    'cobertura'               => 'paquete',
                    'cuenta_cobro_id'         => null,
                    'saldo_adelanto_restante'  => null,
                    'mensaje'                 => $msg,
                ];
            }
            $paqueteId = null;
        }

        $precioPendiente = $precio;

        // 2B. ADELANTO — aplicar monto contra el saldo
        if ($adelantoId) {
            $adelanto = AdelantoPaciente::findById($adelantoId);
            $saldo    = $adelanto ? (float) $adelanto['saldo_disponible'] : 0;
            $aplicar  = min($saldo, $precioPendiente);

            if ($aplicar > 0) {
                Database::query(
                    "INSERT INTO adelanto_sesion (adelanto_id, sesion_id, monto_aplicado)
                     VALUES (?, ?, ?)",
                    [$adelantoId, $sesionId, $aplicar]
                );
                $precioPendiente = round($precioPendiente - $aplicar, 2);
            }

            if ($precioPendiente == 0) {
                $saldoRestante = round($saldo - $aplicar, 2);
                return [
                    'sesion_id'               => $sesionId,
                    'cobertura'               => 'adelanto',
                    'cuenta_cobro_id'         => null,
                    'saldo_adelanto_restante'  => $saldoRestante,
                    'mensaje'                 => "Sesión registrada. Crédito aplicado. Saldo restante: S/ {$saldoRestante}",
                ];
            }
            // Si el adelanto cubrió parcialmente, continuar para vincular cuenta o crear una por el saldo
        }

        // 2C. CUENTA DE COBRO EXISTENTE (pago previo sobre cita)
        if ($citaId) {
            $cuenta = Database::query(
                "SELECT id FROM cuentas_cobro WHERE cita_id = ? LIMIT 1",
                [$citaId]
            )->fetch();

            if ($cuenta) {
                // Vincular la cuenta existente a la sesión y a la atención
                Database::query(
                    "UPDATE cuentas_cobro
                     SET sesion_id = ?,
                         atencion_id = ?
                     WHERE id = ?",
                    [$sesionId, $atencionId, (int)$cuenta['id']]
                );
                return [
                    'sesion_id'               => $sesionId,
                    'cobertura'               => 'directo',
                    'cuenta_cobro_id'         => (int)$cuenta['id'],
                    'saldo_adelanto_restante'  => null,
                    'mensaje'                 => "Sesión registrada y vinculada a la cuenta de la cita.",
                ];
            }
        }

        // 2D. Generar cuenta_cobro por el saldo pendiente (Fallback/Sin cita)
        $atencion      = Atencion::findById($atencionId);
        $subservNombre = $data['subservicio_nombre'] ?? 'Sesión';
        $cuentaId      = CuentaCobro::create([
            'paciente_id'   => (int) $atencion['paciente_id'],
            'atencion_id'   => $atencionId,
            'sesion_id'     => $sesionId,
            'concepto'      => 'Sesión #' . $numero . ' — ' . $subservNombre,
            'monto_total'   => $precioPendiente,
            'fecha_emision' => date('Y-m-d'),
        ]);

        return [
            'sesion_id'               => $sesionId,
            'cobertura'               => $adelantoId ? 'adelanto_parcial' : 'directo_fallback',
            'cuenta_cobro_id'         => $cuentaId,
            'saldo_adelanto_restante'  => 0,
            'mensaje'                 => $adelantoId
                                          ? "Sesión registrada. Crédito parcial aplicado. Cuenta generada por diferencia: S/ {$precioPendiente}"
                                          : "Sesión registrada. Cuenta de cobro generada: S/ {$precioPendiente}",
        ];
    }


    public static function findByAtencion(int $atencionId): array {
        return Database::query(
            "SELECT s.id, s.numero_sesion, s.fecha_hora, s.duracion_min,
                    s.modalidad_sesion, s.precio_sesion, s.nota_clinica,
                    s.paciente_paquete_id,
                    'realizada' AS estado,
                    pk.nombre AS nombre_paquete,
                    (SELECT COUNT(*) FROM adelanto_sesion WHERE sesion_id = s.id) > 0 AS tiene_adelanto
             FROM sesiones s
             LEFT JOIN paciente_paquetes pp ON pp.id = s.paciente_paquete_id
             LEFT JOIN paquetes          pk ON pk.id = pp.paquete_id
             WHERE s.atencion_id = ?
             ORDER BY s.numero_sesion",
            [$atencionId]
        )->fetchAll();
    }

    public static function nextNumero(int $atencionId): int {
        $row = Database::query(
            "SELECT COALESCE(MAX(numero_sesion), 0) + 1 AS next FROM sesiones WHERE atencion_id = ?",
            [$atencionId]
        )->fetch();
        return (int) $row['next'];
    }

    public static function updateNota(int $id, string $nota): void {
        Database::query(
            "UPDATE sesiones SET nota_clinica = ? WHERE id = ?",
            [$nota, $id]
        );
    }
}
