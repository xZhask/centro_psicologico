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

        // 2. Con paquete: el trigger trg_consumir_paquete ya descuenta. Sin cuenta_cobro.
        if ($paqueteId) {
            $nombre    = $data['paquete_nombre'] ?? 'paquete';
            $restantes = max(0, (int) ($data['paquete_sesiones_restantes'] ?? 1) - 1);
            return [
                'sesion_id'               => $sesionId,
                'cobertura'               => 'paquete',
                'cuenta_cobro_id'         => null,
                'saldo_adelanto_restante'  => null,
                'mensaje'                 => "Sesión registrada. Paquete {$nombre}: {$restantes} sesiones restantes.",
            ];
        }

        $precioPendiente = $precio;

        // 3. Con adelanto: aplicar automáticamente
        if ($adelantoId) {
            $adelanto = AdelantoPaciente::findById($adelantoId);
            $saldo    = $adelanto ? (float) $adelanto['saldo_disponible'] : 0;

            if ($saldo >= $precioPendiente) {
                // Adelanto cubre el total
                Database::query(
                    "INSERT INTO adelanto_sesion (adelanto_id, sesion_id, monto_aplicado)
                     VALUES (?, ?, ?)",
                    [$adelantoId, $sesionId, $precioPendiente]
                );
                $saldoRestante = round($saldo - $precioPendiente, 2);
                return [
                    'sesion_id'               => $sesionId,
                    'cobertura'               => 'adelanto',
                    'cuenta_cobro_id'         => null,
                    'saldo_adelanto_restante'  => $saldoRestante,
                    'mensaje'                 => "Sesión registrada. Crédito aplicado. Saldo restante: S/ {$saldoRestante}",
                ];
            } else {
                // Adelanto cubre parcialmente
                Database::query(
                    "INSERT INTO adelanto_sesion (adelanto_id, sesion_id, monto_aplicado)
                     VALUES (?, ?, ?)",
                    [$adelantoId, $sesionId, $saldo]
                );
                $precioPendiente = round($precioPendiente - $saldo, 2);
                // Continúa para generar cuenta_cobro por la diferencia
            }
        }

        // 4. Generar cuenta_cobro por el saldo pendiente
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

        if ($adelantoId) {
            $aplicado = round($precio - $precioPendiente, 2);
            return [
                'sesion_id'               => $sesionId,
                'cobertura'               => 'adelanto_parcial',
                'cuenta_cobro_id'         => $cuentaId,
                'saldo_adelanto_restante'  => 0,
                'mensaje'                 => "Sesión registrada. Crédito parcial aplicado (S/ {$aplicado}). Cuenta generada por diferencia: S/ {$precioPendiente}",
            ];
        }

        return [
            'sesion_id'               => $sesionId,
            'cobertura'               => 'directo',
            'cuenta_cobro_id'         => $cuentaId,
            'saldo_adelanto_restante'  => null,
            'mensaje'                 => "Sesión registrada. Cuenta de cobro generada: S/ {$precioPendiente}",
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
