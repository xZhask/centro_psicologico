<?php
namespace Src\Controllers;

use Src\Core\Response;
use Src\Core\Request;
use Src\Models\Servicio;
use Src\Middleware\RoleMiddleware;

class ServicioController {

    private const ADMIN   = ['administrador'];
    private const ALLOWED = ['administrador', 'profesional'];

    public function index(): void {
        RoleMiddleware::handle(self::ALLOWED);
        Response::json(['success' => true, 'data' => Servicio::findAll()]);
    }

    public function show(Request $request): void {
        RoleMiddleware::handle(self::ADMIN);
        $id       = (int) ($_GET['id'] ?? 0);
        $servicio = Servicio::findById($id);
        if (!$servicio) {
            Response::json(['success' => false, 'message' => 'No encontrado'], 404);
            return;
        }
        Response::json(['success' => true, 'data' => $servicio]);
    }

    public function store(Request $request): void {
        RoleMiddleware::handle(self::ADMIN);
        $data = $request->json();

        if (empty($data['nombre']) || empty($data['tipo'])) {
            Response::json(['success' => false, 'message' => 'Nombre y tipo son obligatorios'], 400);
            return;
        }

        try {
            Servicio::create($data);
            Response::json(['success' => true, 'message' => 'Servicio creado']);
        } catch (\Exception $e) {
            Response::json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    public function update(Request $request): void {
        RoleMiddleware::handle(self::ADMIN);
        $data = $request->json();

        if (empty($data['id']) || empty($data['nombre']) || empty($data['tipo'])) {
            Response::json(['success' => false, 'message' => 'Campos obligatorios faltantes'], 400);
            return;
        }

        try {
            Servicio::update((int) $data['id'], $data);
            Response::json(['success' => true, 'message' => 'Servicio actualizado']);
        } catch (\Exception $e) {
            Response::json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }
}
