<?php
namespace Src\Controllers;

use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\Atencion;
use Src\Models\Diagnostico;
use Src\Models\Sesion;
use Src\Middleware\RoleMiddleware;

class AtencionController {

    private const ALLOWED = ['administrador', 'profesional'];

    public function index(): void {
        RoleMiddleware::handle(self::ALLOWED);
        Response::json(['success' => true, 'data' => Atencion::findAll()]);
    }

    public function show(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $id      = (int) ($_GET['id'] ?? 0);
        $atencion = Atencion::findWithDetail($id);
        if (!$atencion) {
            Response::json(['success' => false, 'message' => 'No encontrada'], 404);
            return;
        }
        Response::json(['success' => true, 'data' => $atencion]);
    }

    public function porPaciente(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $pacienteId = (int) ($_GET['paciente_id'] ?? 0);
        if (!$pacienteId) {
            Response::json(['success' => false, 'message' => 'paciente_id requerido'], 400);
            return;
        }
        Response::json(['success' => true, 'data' => Atencion::findByPaciente($pacienteId)]);
    }

    public function store(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, [
            'paciente_id', 'profesional_id', 'subservicio_id',
            'precio_acordado', 'motivo_consulta', 'fecha_inicio',
        ]);
        $id = Atencion::create($data);
        Response::json(['success' => true, 'data' => ['id' => $id], 'message' => 'Atención creada']);
    }

    public function cerrar(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $d = $request->json();
        Validator::required($d, ['id', 'fecha_fin']);
        Atencion::cerrar($d['id'], $d['fecha_fin']);
        Response::json(['success' => true]);
    }

    public function diagnostico(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['atencion_id', 'cie10_codigo', 'tipo', 'fecha_dx']);

        if ($data['tipo'] === 'principal' && Diagnostico::hasPrincipal((int) $data['atencion_id'])) {
            Response::json([
                'success' => false,
                'message' => 'Ya existe un diagnóstico principal para esta atención. Cambie el tipo o elimine el existente.',
            ], 400);
            return;
        }

        Diagnostico::asignar($data);
        Response::json(['success' => true, 'message' => 'Diagnóstico registrado']);
    }

    public function sesion(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['atencion_id', 'numero_sesion', 'fecha_hora', 'duracion_min']);
        Sesion::crear($data);
        Response::json(['success' => true]);
    }
}
