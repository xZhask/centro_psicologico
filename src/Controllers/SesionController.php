<?php
namespace Src\Controllers;

use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\Sesion;
use Src\Middleware\RoleMiddleware;

class SesionController {

    private const ALLOWED = ['administrador', 'profesional'];

    public function store(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['atencion_id', 'numero_sesion', 'fecha_hora', 'duracion_min']);
        Sesion::crear($data);
        Response::json(['success' => true, 'message' => 'Sesión registrada']);
    }

    public function updateNota(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['id', 'nota_clinica']);
        Sesion::updateNota((int) $data['id'], $data['nota_clinica']);
        Response::json(['success' => true, 'message' => 'Nota actualizada']);
    }
}
