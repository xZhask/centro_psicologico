<?php
namespace Src\Controllers;

use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\Planilla;
use Src\Models\PagoPersonal;
use Src\Models\PlanillaConcepto;
use Src\Middleware\RoleMiddleware;

class PlanillaController {

    private const ALLOWED = ['administrador'];

    // ----------------------------------------------------------------
    // GET /api/planillas[?profesional_id=X]
    // ----------------------------------------------------------------
    public function index(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $profId = !empty($_GET['profesional_id']) ? (int) $_GET['profesional_id'] : null;
        Response::json(['success' => true, 'data' => Planilla::findAll($profId)]);
    }

    // ----------------------------------------------------------------
    // GET /api/planillas/preview
    // Query: profesional_id, periodo_inicio, periodo_fin, porcentaje
    // ----------------------------------------------------------------
    public function preview(): void {
        RoleMiddleware::handle(self::ALLOWED);

        $profId  = (int)   ($_GET['profesional_id']  ?? 0);
        $inicio  =          $_GET['periodo_inicio']  ?? '';
        $fin     =          $_GET['periodo_fin']     ?? '';
        $pct     = (float) ($_GET['porcentaje']      ?? 0);

        if (!$profId || !$inicio || !$fin || $pct <= 0) {
            Response::json([
                'success' => false,
                'message' => 'Parámetros requeridos: profesional_id, periodo_inicio, periodo_fin, porcentaje',
            ], 400);
            return;
        }

        $data = Planilla::calcularPreview($profId, $inicio, $fin, $pct);
        Response::json(['success' => true, 'data' => $data]);
    }

    // ----------------------------------------------------------------
    // POST /api/planillas
    // Body: { profesional_id, periodo_inicio, periodo_fin,
    //         porcentaje_profesional, descuentos?, observaciones? }
    //   Si monto_bruto se omite, se calcula desde las sesiones.
    // ----------------------------------------------------------------
    public function store(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();

        Validator::required($data, [
            'profesional_id', 'periodo_inicio', 'periodo_fin', 'porcentaje_profesional',
        ]);

        if (strtotime($data['periodo_fin']) < strtotime($data['periodo_inicio'])) {
            Response::json([
                'success' => false,
                'message' => 'La fecha fin no puede ser anterior al inicio del período',
            ], 422);
            return;
        }

        if (empty($data['monto_bruto'])) {
            $preview = Planilla::calcularPreview(
                (int)   $data['profesional_id'],
                        $data['periodo_inicio'],
                        $data['periodo_fin'],
                (float) $data['porcentaje_profesional']
            );
            $data['sesiones_realizadas'] = $preview['total_sesiones'];
            $data['monto_bruto']         = $preview['monto_profesional'];
        }

        $id = Planilla::create($data);

        // Insertar automáticamente los conceptos de talleres realizados en el período
        PlanillaConcepto::insertTallerConceptos(
            $id,
            (int) $data['profesional_id'],
            $data['periodo_inicio'] . ' 00:00:00',
            $data['periodo_fin']    . ' 23:59:59'
        );

        Response::json(['success' => true, 'message' => 'Planilla creada', 'id' => $id], 201);
    }

    // ----------------------------------------------------------------
    // PUT /api/planillas/aprobar
    // Body: { planilla_id }
    // ----------------------------------------------------------------
    public function aprobar(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['planilla_id']);

        $ok = Planilla::aprobar((int) $data['planilla_id']);
        if (!$ok) {
            Response::json([
                'success' => false,
                'message' => 'No se pudo aprobar: la planilla no existe o no está en estado borrador',
            ], 409);
            return;
        }
        Response::json(['success' => true, 'message' => 'Planilla aprobada']);
    }

    // ----------------------------------------------------------------
    // GET /api/pagos-personal?planilla_id=X
    // ----------------------------------------------------------------
    public function pagos(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $planillaId = (int) ($_GET['planilla_id'] ?? 0);
        if (!$planillaId) {
            Response::json(['success' => false, 'message' => 'planilla_id requerido'], 400);
            return;
        }
        Response::json(['success' => true, 'data' => PagoPersonal::findByPlanilla($planillaId)]);
    }

    // ----------------------------------------------------------------
    // POST /api/pagos-personal
    // Body: { planilla_id, monto, fecha_pago, metodo_pago, referencia? }
    // ----------------------------------------------------------------
    public function registrarPago(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();

        Validator::required($data, ['planilla_id', 'monto', 'fecha_pago', 'metodo_pago']);

        $planillaId = (int) $data['planilla_id'];
        $planilla   = Planilla::findById($planillaId);

        if (!$planilla) {
            Response::json(['success' => false, 'message' => 'Planilla no encontrada'], 404);
            return;
        }

        if ($planilla['estado'] !== 'aprobada') {
            Response::json([
                'success' => false,
                'message' => 'Solo se puede registrar pagos en planillas aprobadas',
            ], 409);
            return;
        }

        $monto = (float) $data['monto'];
        if ($monto <= 0) {
            Response::json(['success' => false, 'message' => 'El monto debe ser mayor a cero'], 422);
            return;
        }

        $montoNeto   = (float) $planilla['monto_neto'];
        $montoPagado = (float) $planilla['monto_pagado'];
        $saldo       = round($montoNeto - $montoPagado, 2);

        if ($monto > $saldo + 0.001) {
            Response::json([
                'success' => false,
                'message' => "El monto supera el saldo pendiente (S/ {$saldo})",
            ], 422);
            return;
        }

        PagoPersonal::create($data);

        // Si el pago liquida el saldo, marcar planilla como pagada
        $nuevoSaldo = round($saldo - $monto, 2);
        if ($nuevoSaldo <= 0) {
            Planilla::marcarPagada($planillaId);
        }

        Response::json([
            'success'      => true,
            'message'      => 'Pago registrado',
            'saldo_restante' => max(0, $nuevoSaldo),
        ], 201);
    }

    // ----------------------------------------------------------------
    // GET /api/planillas/conceptos?planilla_id=X
    // ----------------------------------------------------------------
    public function conceptos(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $planillaId = (int) ($_GET['planilla_id'] ?? 0);
        if (!$planillaId) {
            Response::json(['success' => false, 'message' => 'planilla_id requerido'], 400);
            return;
        }
        Response::json([
            'success' => true,
            'data'    => PlanillaConcepto::findByPlanilla($planillaId),
        ]);
    }
}
