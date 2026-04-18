<?php
namespace Src\Controllers;

use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\Sesion;
use Src\Middleware\RoleMiddleware;

class SesionController {

    private const ALLOWED = ['administrador', 'profesional'];

    public function nextNumero(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $atencionId = (int) ($_GET['atencion_id'] ?? 0);
        if (!$atencionId) {
            Response::json(['success' => false, 'message' => 'atencion_id requerido'], 400);
            return;
        }
        Response::json(['success' => true, 'data' => ['numero_sesion' => Sesion::nextNumero($atencionId)]]);
    }

    public function sesionSiguiente(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $atencionId = (int) ($_GET['atencion_id'] ?? 0);
        if (!$atencionId) {
            Response::json(['success' => false, 'message' => 'atencion_id requerido'], 400);
            return;
        }
        Response::json(['success' => true, 'data' => ['numero_siguiente' => Sesion::nextNumero($atencionId)]]);
    }

    public function store(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['atencion_id', 'duracion_min']);
        Sesion::crear($data);
        Response::json(['success' => true, 'message' => 'Sesión registrada']);
    }

    public function updateNota(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['id']);
        Sesion::updateNota((int) $data['id'], $data['nota_clinica'] ?? '');
        Response::json(['success' => true, 'message' => 'Nota actualizada']);
    }
}
