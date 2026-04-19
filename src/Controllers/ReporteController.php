<?php
namespace Src\Controllers;

use Src\Core\Auth;
use Src\Core\Request;
use Src\Core\Response;
use Src\Models\Reporte;
use Src\Middleware\RoleMiddleware;

class ReporteController {

    private const TODOS     = ['administrador', 'profesional'];
    private const SOLO_ADMIN = ['administrador'];

    /* ── CLÍNICOS ──────────────────────────────────────────────── */

    public function progreso(Request $request): void
    {
        RoleMiddleware::handle(self::TODOS);
        $user       = Auth::user();
        $profesionalId = ($user['rol'] === 'profesional')
            ? (int)($user['profesional_id'] ?? 0)
            : (int)($_GET['profesional_id'] ?? 0);
        $pacienteId = (int)($_GET['paciente_id'] ?? 0);

        Response::json([
            'success' => true,
            'data'    => Reporte::progresoPacientes($profesionalId, $pacienteId),
        ]);
    }

    public function asistencia(Request $request): void
    {
        RoleMiddleware::handle(self::TODOS);
        $user       = Auth::user();
        $profesionalId = ($user['rol'] === 'profesional')
            ? (int)($user['profesional_id'] ?? 0)
            : (int)($_GET['profesional_id'] ?? 0);
        $desde = $_GET['fecha_desde'] ?? date('Y-m-01');
        $hasta = $_GET['fecha_hasta'] ?? date('Y-m-d');

        Response::json([
            'success' => true,
            'data'    => Reporte::asistencia($desde, $hasta, $profesionalId),
        ]);
    }

    public function carga(Request $request): void
    {
        RoleMiddleware::handle(self::SOLO_ADMIN);
        Response::json([
            'success' => true,
            'data'    => Reporte::cargaProfesionales(),
        ]);
    }

    /* ── FINANCIEROS ───────────────────────────────────────────── */

    public function facturacion(Request $request): void
    {
        RoleMiddleware::handle(self::SOLO_ADMIN);
        $desde = $_GET['fecha_desde'] ?? date('Y-m-01');
        $hasta = $_GET['fecha_hasta'] ?? date('Y-m-d');

        Response::json([
            'success' => true,
            'data'    => Reporte::facturacion($desde, $hasta),
        ]);
    }

    public function morosidad(Request $request): void
    {
        RoleMiddleware::handle(self::SOLO_ADMIN);
        Response::json([
            'success' => true,
            'data'    => Reporte::morosidad(),
        ]);
    }

    public function ingresos(Request $request): void
    {
        RoleMiddleware::handle(self::SOLO_ADMIN);
        $desde = $_GET['fecha_desde'] ?? date('Y-01-01');
        $hasta = $_GET['fecha_hasta'] ?? date('Y-m-d');

        Response::json([
            'success' => true,
            'data'    => Reporte::ingresosPorServicio($desde, $hasta),
        ]);
    }

    /* ── LEGACY ────────────────────────────────────────────────── */

    public function historial(Request $request): void
    {
        RoleMiddleware::handle(self::TODOS);
        $pacienteId = (int)($_GET['paciente_id'] ?? 0);
        if (!$pacienteId) {
            Response::json(['success' => false, 'message' => 'paciente_id requerido'], 400);
            return;
        }
        Response::json(['success' => true, 'data' => Reporte::historialPaciente($pacienteId)]);
    }

    public function saldos(Request $request): void
    {
        RoleMiddleware::handle(self::TODOS);
        Response::json(['success' => true, 'data' => Reporte::saldoPacientes()]);
    }

    public function checkin(Request $request): void
    {
        RoleMiddleware::handle(self::TODOS);
        Response::json(['success' => true, 'data' => Reporte::resumenCheckin()]);
    }

    public function agenda(Request $request): void
    {
        RoleMiddleware::handle(self::TODOS);
        Response::json(['success' => true, 'data' => Reporte::agendaHoy()]);
    }
}
