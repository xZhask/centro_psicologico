<?php
namespace Src\Controllers;

use Src\Core\Response;
use Src\Core\Request;
use Src\Models\Subservicio;
use Src\Middleware\RoleMiddleware;

class SubservicioController {

    private const ADMIN   = ['administrador'];
    private const ALLOWED = ['administrador', 'profesional'];

    public function index(): void {
        RoleMiddleware::handle(self::ALLOWED);
        Response::json(['success' => true, 'data' => Subservicio::findAll()]);
    }

    public function byServicio(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $servicioId = (int) ($_GET['servicio_id'] ?? 0);
        if (!$servicioId) {
            Response::json(['success' => false, 'message' => 'servicio_id requerido'], 400);
            return;
        }
        Response::json(['success' => true, 'data' => Subservicio::findByServicio($servicioId)]);
    }

    public function show(Request $request): void {
        RoleMiddleware::handle(self::ADMIN);
        $id  = (int) ($_GET['id'] ?? 0);
        $sub = Subservicio::findById($id);
        if (!$sub) {
            Response::json(['success' => false, 'message' => 'No encontrado'], 404);
            return;
        }
        Response::json(['success' => true, 'data' => $sub]);
    }

    public function store(Request $request): void {
        RoleMiddleware::handle(self::ADMIN);
        $data = $request->json();

        if (empty($data['servicio_id']) || empty($data['nombre']) ||
            empty($data['modalidad']) || !isset($data['precio_base'])) {
            Response::json(['success' => false, 'message' => 'Campos obligatorios faltantes'], 400);
            return;
        }

        try {
            Subservicio::create($data);
            Response::json(['success' => true, 'message' => 'Subservicio creado']);
        } catch (\Exception $e) {
            Response::json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    public function update(Request $request): void {
        RoleMiddleware::handle(self::ADMIN);
        $data = $request->json();

        if (empty($data['id']) || empty($data['nombre']) ||
            empty($data['modalidad']) || !isset($data['precio_base'])) {
            Response::json(['success' => false, 'message' => 'Campos obligatorios faltantes'], 400);
            return;
        }

        try {
            Subservicio::update((int) $data['id'], $data);
            Response::json(['success' => true, 'message' => 'Subservicio actualizado']);
        } catch (\Exception $e) {
            Response::json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }
}
