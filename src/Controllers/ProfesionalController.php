<?php
namespace Src\Controllers;

use Src\Core\Response;
use Src\Core\Request;
use Src\Models\Profesional;
use Src\Middleware\RoleMiddleware;

class ProfesionalController {

    private const ADMIN   = ['administrador'];
    private const ALLOWED = ['administrador', 'profesional'];

    public function index(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $q = trim($_GET['q'] ?? '');
        $data = $q !== '' ? Profesional::search($q) : Profesional::findAll();
        Response::json(['success' => true, 'data' => $data]);
    }

    public function show(Request $request): void {
        RoleMiddleware::handle(self::ADMIN);
        $id   = (int) ($_GET['id'] ?? 0);
        $prof = Profesional::findById($id);
        if (!$prof) {
            Response::json(['success' => false, 'message' => 'No encontrado'], 404);
            return;
        }
        Response::json(['success' => true, 'data' => $prof]);
    }

    public function store(Request $request): void {
        RoleMiddleware::handle(self::ADMIN);
        $data = $request->json();

        if (empty($data['dni']) || empty($data['nombres']) ||
            empty($data['apellidos']) || empty($data['colegiatura'])) {
            Response::json(['success' => false, 'message' => 'Campos obligatorios faltantes'], 400);
            return;
        }

        try {
            Profesional::create($data);
            Response::json(['success' => true, 'message' => 'Profesional creado']);
        } catch (\Exception $e) {
            Response::json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    public function update(Request $request): void {
        RoleMiddleware::handle(self::ADMIN);
        $data = $request->json();

        if (empty($data['id']) || empty($data['nombres']) ||
            empty($data['apellidos']) || empty($data['colegiatura'])) {
            Response::json(['success' => false, 'message' => 'Campos obligatorios faltantes'], 400);
            return;
        }

        try {
            Profesional::update((int) $data['id'], $data);
            Response::json(['success' => true, 'message' => 'Profesional actualizado']);
        } catch (\Exception $e) {
            Response::json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    public function delete(Request $request): void {
        RoleMiddleware::handle(self::ADMIN);
        $data = $request->json();

        if (empty($data['id'])) {
            Response::json(['success' => false, 'message' => 'ID requerido'], 400);
            return;
        }

        Profesional::delete((int) $data['id']);
        Response::json(['success' => true, 'message' => 'Profesional eliminado']);
    }
}
