<?php
namespace Src\Controllers;

use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\CuentaCobro;
use Src\Models\PagoPaciente;
use Src\Middleware\RoleMiddleware;

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
    // POST /api/pagos
    // Body: { cuenta_cobro_id, monto, fecha_pago, metodo_pago,
    //         pagado_por_paciente? | pagado_por_apoderado? | pagado_por_externo?,
    //         numero_comprobante?, notas? }
    // ----------------------------------------------------------------
    public function registrarPago(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();

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
        Response::json(['success' => true, 'message' => 'Pago registrado'], 201);
    }
}
