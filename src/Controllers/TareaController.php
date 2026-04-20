<?php
namespace Src\Controllers;

use Src\Core\Auth;
use Src\Core\Database;
use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\Tarea;
use Src\Middleware\RoleMiddleware;

class TareaController {

    private const STAFF   = ['administrador', 'profesional'];
    private const ALL     = ['administrador', 'profesional', 'paciente'];

    /**
     * GET /api/tareas?paciente_id=X
     * Profesional/admin pasan paciente_id.
     * Paciente obtiene las suyas automáticamente.
     */
    public function index(): void {
        RoleMiddleware::handle(self::ALL);
        $user = Auth::user();

        if ($user['rol'] === 'paciente') {
            // Resolver paciente_id desde persona_id
            $row = Database::query(
                "SELECT id FROM pacientes WHERE persona_id = ?",
                [(int) $user['persona_id']]
            )->fetch();
            if (!$row) {
                Response::json(['success' => false, 'message' => 'Paciente no encontrado'], 404);
                return;
            }
            $pacienteId = (int) $row['id'];
        } else {
            $pacienteId = (int) ($_GET['paciente_id'] ?? 0);
            if (!$pacienteId) {
                Response::json(['success' => false, 'message' => 'paciente_id requerido'], 400);
                return;
            }
        }

        Response::json(['success' => true, 'data' => Tarea::findByPaciente($pacienteId)]);
    }

    /**
     * POST /api/tareas
     * Solo profesional/admin. Requiere sesion_id y titulo.
     */
    public function store(Request $request): void {
        RoleMiddleware::handle(self::STAFF);
        $data = $request->json();
        Validator::required($data, ['sesion_id', 'titulo']);
        $id = Tarea::create($data);
        Response::json(['success' => true, 'message' => 'Tarea creada', 'id' => $id]);
    }

    /**
     * PUT /api/tareas/estado  { id, estado }
     * Solo profesional/admin.
     */
    public function updateEstado(Request $request): void {
        RoleMiddleware::handle(self::STAFF);
        $data = $request->json();
        Validator::required($data, ['id', 'estado']);

        if ($data['estado'] === 'no_realizada') {
            Response::json([
                'success' => false,
                'message' => "El estado 'no_realizada' es asignado automáticamente por el sistema cuando vence la fecha límite.",
            ], 422);
            return;
        }

        $estados = ['pendiente', 'en_proceso', 'completada'];
        if (!in_array($data['estado'], $estados, true)) {
            Response::json(['success' => false, 'message' => 'Estado no válido'], 422);
            return;
        }

        Tarea::updateEstado((int) $data['id'], $data['estado']);
        Response::json(['success' => true, 'message' => 'Estado actualizado']);
    }

    /**
     * PUT /api/tareas/respuesta  { id, respuesta_paciente }
     * Paciente responde a su propia tarea. Profesional también puede.
     */
    public function registrarRespuesta(Request $request): void {
        RoleMiddleware::handle(self::ALL);
        $data = $request->json();
        Validator::required($data, ['id', 'respuesta_paciente']);
        $user = Auth::user();

        // Si es paciente, verificar que la tarea le pertenezca
        if ($user['rol'] === 'paciente') {
            $row = Database::query(
                "SELECT id FROM pacientes WHERE persona_id = ?",
                [(int) $user['persona_id']]
            )->fetch();
            $pacienteId = $row ? (int) $row['id'] : 0;

            if (!$pacienteId || Tarea::getPacienteId((int) $data['id']) !== $pacienteId) {
                Response::json(['success' => false, 'message' => 'Acceso no autorizado'], 403);
                return;
            }
        }

        Tarea::registrarRespuesta((int) $data['id'], $data['respuesta_paciente']);
        Response::json(['success' => true, 'message' => 'Respuesta registrada']);
    }
}
