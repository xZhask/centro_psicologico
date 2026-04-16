<?php
namespace Src\Controllers;

use Src\Core\Response;
use Src\Models\Cie10;
use Src\Middleware\RoleMiddleware;

class Cie10Controller {

    private const ALLOWED = ['administrador', 'profesional'];

    public function buscar(): void {
        RoleMiddleware::handle(self::ALLOWED);

        $q = trim($_GET['q'] ?? '');

        if (mb_strlen($q) < 2) {
            Response::json(['success' => true, 'data' => []]);
            return;
        }

        Response::json(['success' => true, 'data' => Cie10::buscar($q)]);
    }
}
