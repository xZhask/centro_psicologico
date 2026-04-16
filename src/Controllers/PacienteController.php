<?php
namespace Src\Controllers;

use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\Paciente;
use Src\Models\Apoderado;
use Src\Middleware\RoleMiddleware;

class PacienteController {

    private const ALLOWED = ['administrador', 'profesional'];

    public function index(): void {
        RoleMiddleware::handle(self::ALLOWED);
        Response::json(['success' => true, 'data' => Paciente::findAll()]);
    }

    public function show(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $id = $_GET['id'] ?? null;
        Response::json(['success' => true, 'data' => Paciente::findById($id)]);
    }

    public function store(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['dni', 'nombres', 'apellidos']);

        try {
            $pid = Paciente::create($data);

            if (isset($data['apoderado'])) {
                $ap = Apoderado::create($data['apoderado']);
                Apoderado::vincular($pid, $ap, $data['apoderado']['parentesco']);
            }

            Response::json(['success' => true, 'message' => 'Paciente creado']);
        } catch (\Exception $e) {
            Response::json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    public function update(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['id', 'nombres', 'apellidos']);
        Paciente::update($data['id'], $data);
        Response::json(['success' => true, 'message' => 'Actualizado']);
    }

    public function delete(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Paciente::delete($data['id']);
        Response::json(['success' => true, 'message' => 'Eliminado']);
    }
}
