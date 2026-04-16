<?php
namespace Src\Controllers;

use Src\Core\Response;
use Src\Models\Reporte;
use Src\Middleware\RoleMiddleware;

class ReporteController {

    private const ALLOWED = ['administrador', 'profesional'];

    public function historial(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $pacienteId = (int) ($_GET['paciente_id'] ?? 0);
        if (!$pacienteId) {
            Response::json(['success' => false, 'message' => 'paciente_id requerido'], 400);
            return;
        }
        Response::json(['success' => true, 'data' => Reporte::historialPaciente($pacienteId)]);
    }

    public function saldos(): void {
        RoleMiddleware::handle(self::ALLOWED);
        Response::json(['success' => true, 'data' => Reporte::saldoPacientes()]);
    }

    public function checkin(): void {
        RoleMiddleware::handle(self::ALLOWED);
        Response::json(['success' => true, 'data' => Reporte::resumenCheckin()]);
    }

    public function agenda(): void {
        RoleMiddleware::handle(self::ALLOWED);
        Response::json(['success' => true, 'data' => Reporte::agendaHoy()]);
    }
}
