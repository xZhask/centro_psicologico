<?php
namespace Src\Controllers;

use Src\Core\Auth;
use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\Cita;
use Src\Models\Atencion;
use Src\Middleware\RoleMiddleware;

class CitaController {

    private const STAFF = ['administrador', 'profesional'];
    private const ALL   = ['administrador', 'profesional', 'paciente'];

    public function index(): void {
        RoleMiddleware::handle(self::ALL);

        $user = Auth::user();

        if ($user['rol'] === 'paciente') {
            $data = Cita::findByPersona((int) $user['persona_id']);
        } else {
            $filtros = [];
            if (!empty($_GET['estado'])) $filtros['estado'] = $_GET['estado'];
            if (!empty($_GET['fecha']))  $filtros['fecha']  = $_GET['fecha'];
            $data = Cita::findAll($filtros);
        }

        Response::json(['success' => true, 'data' => $data]);
    }

    public function show(Request $request): void {
        RoleMiddleware::handle(self::ALL);

        $id   = (int) ($_GET['id'] ?? 0);
        $user = Auth::user();

        if ($user['rol'] === 'paciente') {
            $cita = Cita::findByIdAndPersona($id, (int) $user['persona_id']);
            if (!$cita) {
                Response::json(['success' => false, 'message' => 'No autorizado'], 403);
                return;
            }
        } else {
            $cita = Cita::findById($id);
        }

        Response::json(['success' => true, 'data' => $cita]);
    }

    public function store(Request $request): void {
        RoleMiddleware::handle(self::STAFF);
        $data = $request->json();
        Validator::required($data, ['paciente_id', 'profesional_id', 'fecha_hora_inicio']);

        $tipo = $data['tipo_cita'] ?? null;

        try {
            if ($tipo === 'sesion_existente') {
                Validator::required($data, ['atencion_id']);

                $atencion = Atencion::findById((int) $data['atencion_id']);
                if (!$atencion || $atencion['estado'] !== 'activa') {
                    Response::json(['success' => false, 'message' => 'Atención activa no encontrada'], 404);
                    return;
                }

                $data['subservicio_id'] = $atencion['subservicio_id'];
            } else {
                Validator::required($data, ['subservicio_id']);
                $data['atencion_id'] = null;
            }

            Cita::create($data);
            Response::json(['success' => true, 'message' => 'Cita creada']);
        } catch (\Exception $e) {
            Response::json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    public function updateEstado(Request $request): void {
        RoleMiddleware::handle(self::STAFF);
        $data = $request->json();
        Validator::required($data, ['id', 'estado']);
        Cita::updateEstado((int) $data['id'], $data['estado']);
        Response::json(['success' => true]);
    }

    public function reprogramar(Request $request): void {
        RoleMiddleware::handle(self::STAFF);
        $data = $request->json();
        Validator::required($data, ['id', 'nueva_fecha']);

        $user = Auth::user();

        try {
            $nuevaCitaId = Cita::reprogramar(
                (int) $data['id'],
                $data['nueva_fecha'],
                $data['motivo'] ?? '',
                (int) $user['id']
            );
            Response::json([
                'success'      => true,
                'message'      => 'Cita reprogramada',
                'nueva_cita_id' => $nuevaCitaId,
            ]);
        } catch (\Exception $e) {
            Response::json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    public function delete(Request $request): void {
        RoleMiddleware::handle(self::STAFF);
        $data = $request->json();
        Cita::delete((int) $data['id']);
        Response::json(['success' => true]);
    }
}
