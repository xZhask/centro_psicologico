<?php
namespace Src\Controllers;

use Src\Core\Response;
use Src\Models\Reporte;
use Src\Middleware\RoleMiddleware;

class ReporteController {

    private const ALLOWED = ['administrador', 'profesional'];

    public function historial(): void {
        RoleMiddleware::handle(self::ALLOWED);
        Response::json(['success' => true, 'data' => Reporte::historialPaciente()]);
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
