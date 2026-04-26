<?php
namespace Src\Controllers;

use Src\Core\Auth;
use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\Paquete;
use Src\Models\PacientePaquete;
use Src\Models\Profesional;
use Src\Middleware\RoleMiddleware;

class PaqueteController {

    // ----------------------------------------------------------------
    // GET /api/paquetes[?activo=1]
    // ----------------------------------------------------------------
    public function index(): void {
        RoleMiddleware::handle(['administrador', 'profesional']);
        $soloActivos = !empty($_GET['activo']);
        Response::json(['success' => true, 'data' => Paquete::findAll($soloActivos)]);
    }

    // ----------------------------------------------------------------
    // POST /api/paquetes
    // ----------------------------------------------------------------
    public function store(Request $request): void {
        RoleMiddleware::handle(['administrador']);
        $data = $request->json();
        Validator::required($data, ['nombre', 'sesiones_incluidas', 'precio_paquete']);

        if ((int) $data['sesiones_incluidas'] < 1) {
            Response::json(['success' => false, 'message' => 'sesiones_incluidas debe ser ≥ 1'], 422);
            return;
        }
        if ((float) $data['precio_paquete'] <= 0) {
            Response::json(['success' => false, 'message' => 'precio_paquete debe ser mayor que 0'], 422);
            return;
        }

        $id = Paquete::create($data);
        Response::json(['success' => true, 'data' => ['id' => $id], 'message' => 'Paquete creado'], 201);
    }

    // ----------------------------------------------------------------
    // PUT /api/paquetes
    // Body: { id, nombre, descripcion?, sesiones_incluidas, precio_paquete }
    // ----------------------------------------------------------------
    public function update(Request $request): void {
        RoleMiddleware::handle(['administrador']);
        $data = $request->json();
        Validator::required($data, ['id', 'nombre', 'sesiones_incluidas', 'precio_paquete']);
        Paquete::update((int) $data['id'], $data);
        Response::json(['success' => true, 'message' => 'Paquete actualizado']);
    }

    // ----------------------------------------------------------------
    // DELETE /api/paquetes/toggle-activo
    // Body: { id }
    // ----------------------------------------------------------------
    public function toggleActivo(Request $request): void {
        RoleMiddleware::handle(['administrador']);
        $data = $request->json();
        if (empty($data['id'])) {
            Response::json(['success' => false, 'message' => 'id requerido'], 400);
            return;
        }
        Paquete::toggleActivo((int) $data['id']);
        Response::json(['success' => true, 'message' => 'Estado actualizado']);
    }

    // ----------------------------------------------------------------
    // GET /api/paciente-paquetes?paciente_id=X[&activo=1]
    // ----------------------------------------------------------------
    public function porPaciente(): void {
        RoleMiddleware::handle(['administrador', 'profesional']);
        $pacienteId = (int) ($_GET['paciente_id'] ?? 0);
        if (!$pacienteId) {
            Response::json(['success' => false, 'message' => 'paciente_id requerido'], 400);
            return;
        }

        if (!empty($_GET['activo'])) {
            $data = PacientePaquete::findActivoByPaciente($pacienteId);
            Response::json(['success' => true, 'data' => $data]);
        } else {
            $data = PacientePaquete::findByPaciente($pacienteId);
            Response::json(['success' => true, 'data' => $data]);
        }
    }

    // ----------------------------------------------------------------
    // POST /api/paciente-paquetes
    // Body: { paquete_id, paciente_id, profesional_id?,
    //         fecha_activacion?, fecha_vencimiento?, notas? }
    // ----------------------------------------------------------------
    public function contratar(Request $request): void {
        RoleMiddleware::handle(['administrador', 'profesional']);
        $data = $request->json();
        Validator::required($data, ['paquete_id', 'paciente_id']);

        $user = Auth::user();

        // Resolver profesional_id
        if (empty($data['profesional_id'])) {
            $prof = Profesional::findByPersonaId((int) $user['persona_id']);
            if (!$prof) {
                Response::json(['success' => false, 'message' => 'No se pudo determinar el profesional'], 422);
                return;
            }
            $data['profesional_id'] = $prof['id'];
        }

        $data['created_by'] = $user['id'];

        try {
            $id = PacientePaquete::contratar($data);
            Response::json([
                'success' => true,
                'data'    => ['id' => $id],
                'message' => 'Paquete contratado. Se generó la cuenta de cobro correspondiente.',
            ], 201);
        } catch (\Throwable $e) {
            Response::json(['success' => false, 'message' => 'Error al contratar paquete: ' . $e->getMessage()], 500);
        }
    }

    // ----------------------------------------------------------------
    // GET /api/paciente-paquetes/mio   (solo rol paciente)
    // Resuelve el paciente_id desde la sesión actual
    // ----------------------------------------------------------------
    public function miPaquete(): void {
        RoleMiddleware::handle(['paciente']);
        $user   = Auth::user();
        $pacRow = \Src\Core\Database::query(
            "SELECT id FROM pacientes WHERE persona_id = ?",
            [(int) $user['persona_id']]
        )->fetch();

        if (!$pacRow) {
            Response::json(['success' => true, 'data' => null]);
            return;
        }
        $data = PacientePaquete::findActivoByPaciente((int) $pacRow['id']);
        Response::json(['success' => true, 'data' => $data]);
    }

    // ----------------------------------------------------------------
    // PUT /api/paciente-paquetes/cancelar
    // Body: { id }
    // ----------------------------------------------------------------
    public function cancelar(Request $request): void {
        RoleMiddleware::handle(['administrador', 'profesional']);
        $data = $request->json();
        if (empty($data['id'])) {
            Response::json(['success' => false, 'message' => 'id requerido'], 400);
            return;
        }
        PacientePaquete::cancelar((int) $data['id']);
        Response::json(['success' => true, 'message' => 'Paquete cancelado']);
    }
}
