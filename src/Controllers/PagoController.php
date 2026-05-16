<?php
namespace Src\Controllers;

use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\CuentaCobro;
use Src\Models\PagoPaciente;
use Src\Models\Cita;
use Src\Models\PacientePaquete;
use Src\Models\Subservicio;
use Src\Middleware\RoleMiddleware;
use Src\Core\Database;


class PagoController {

    private const ALLOWED = ['administrador', 'profesional'];

    // ----------------------------------------------------------------
    // GET /api/cuentas[?paciente_id=X]
    // ----------------------------------------------------------------
    public function cuentas(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $pacienteId = !empty($_GET['paciente_id']) ? (int) $_GET['paciente_id'] : null;
        Response::json(['success' => true, 'data' => CuentaCobro::findAll($pacienteId)]);
    }

    // ----------------------------------------------------------------
    // POST /api/cuentas
    // Body: { concepto, monto_total, fecha_emision,
    //         paciente_id? | vinculo_id?,
    //         atencion_id?, descuento_aplicado?, motivo_descuento?,
    //         fecha_vencimiento? }
    // ----------------------------------------------------------------
    public function crearCuenta(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();

        Validator::required($data, ['concepto', 'monto_total', 'fecha_emision']);

        // Al menos un titular
        if (empty($data['paciente_id']) && empty($data['vinculo_id'])) {
            Response::json([
                'success' => false,
                'message' => 'Se requiere paciente_id o vinculo_id',
            ], 422);
            return;
        }

        $id = CuentaCobro::create($data);
        Response::json(['success' => true, 'message' => 'Cuenta creada', 'id' => $id], 201);
    }

    // ----------------------------------------------------------------
    // GET /api/pagos?cuenta_id=X
    // ----------------------------------------------------------------
    public function pagos(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $cuentaId = (int) ($_GET['cuenta_id'] ?? 0);
        if (!$cuentaId) {
            Response::json(['success' => false, 'message' => 'cuenta_id requerido'], 400);
            return;
        }
        Response::json(['success' => true, 'data' => PagoPaciente::findByCuenta($cuentaId)]);
    }

    // ----------------------------------------------------------------
    // GET /api/pagos/resumen-paciente?paciente_id=X
    // ----------------------------------------------------------------
    public function resumenPaciente(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $pacienteId = (int) ($_GET['paciente_id'] ?? 0);
        if (!$pacienteId) {
            Response::json(['success' => false, 'message' => 'paciente_id requerido'], 400);
            return;
        }
        Response::json([
            'success' => true,
            'data'    => CuentaCobro::getResumenPorPaciente($pacienteId),
        ]);
    }

    // ----------------------------------------------------------------
    // POST /api/pagos
    // Body: { cuenta_cobro_id, monto, fecha_pago, metodo_pago,
    //         pagado_por_paciente? | pagado_por_apoderado? | pagado_por_externo?,
    //         numero_comprobante?, notas? }
    // ----------------------------------------------------------------
    public function registrarPago(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();

        // Pago de paquete sin cuenta_cobro previa (desde módulo Pagos, botón lazy)
        if (!empty($data['paciente_paquete_id']) && empty($data['cuenta_cobro_id'])) {
            $data['cuenta_cobro_id'] = PacientePaquete::obtenerOCrearCuenta(
                (int) $data['paciente_paquete_id']
            );
        }

        // Si viene cita_id, asegurar que exista la cuenta_cobro
        if (!empty($data['cita_id'])) {
            $citaId = (int)$data['cita_id'];
            $cita = Cita::findById($citaId);
            if (!$cita) {
                Response::json(['success' => false, 'message' => 'Cita no encontrada'], 404);
                return;
            }

            // Buscar cuenta existente vinculada a la cita
            $cuenta = Database::query("SELECT id FROM cuentas_cobro WHERE cita_id = ? LIMIT 1", [$citaId])->fetch();

            if (!$cuenta) {
                // Detectar si la cita está cubierta por un paquete activo
                $cobertura = Cita::evaluarCobertura($citaId);

                if ($cobertura['estado'] === 'cubierta_paquete') {
                    // Usar (o crear lazy) la cuenta_cobro del paquete
                    $data['cuenta_cobro_id'] = PacientePaquete::obtenerOCrearCuenta(
                        (int) $cobertura['paquete_id']
                    );
                } else {
                    // Flujo estándar: crear cuenta basada en la cita individual
                    $precioEfectivo = (float)$cita['precio_acordado'] - (float)($cita['descuento_monto'] ?? 0);
                    $fechaCorta = date('d/m/Y', strtotime($cita['fecha_hora_inicio']));
                    $concepto = "Cita {$fechaCorta} — {$cita['subservicio']}";

                    $idCuenta = CuentaCobro::create([
                        'cita_id'       => $citaId,
                        'paciente_id'   => (int)$cita['paciente_id'],
                        'concepto'      => $concepto,
                        'monto_total'   => $precioEfectivo,
                        'fecha_emision' => date('Y-m-d'),
                        'sesion_id'     => null
                    ]);
                    $data['cuenta_cobro_id'] = $idCuenta;
                }
            } else {
                $data['cuenta_cobro_id'] = $cuenta['id'];
            }
        }

        Validator::required($data, ['cuenta_cobro_id', 'monto', 'fecha_pago', 'metodo_pago']);

        // Validar que haya al menos un pagador
        if (
            empty($data['pagado_por_paciente']) &&
            empty($data['pagado_por_apoderado']) &&
            (empty($data['pagado_por_externo']) || trim($data['pagado_por_externo']) === '')
        ) {
            Response::json([
                'success' => false,
                'message' => 'Debe indicar quién realizó el pago',
            ], 422);
            return;
        }

        // Verificar que la cuenta existe
        $cuenta = CuentaCobro::findById((int) $data['cuenta_cobro_id']);
        if (!$cuenta) {
            Response::json(['success' => false, 'message' => 'Cuenta no encontrada'], 404);
            return;
        }

        PagoPaciente::registrar($data);
        Response::json(['success' => true, 'message' => 'Pago registrado', 'data' => ['cuenta_cobro_id' => $data['cuenta_cobro_id']]], 201);
    }

}
