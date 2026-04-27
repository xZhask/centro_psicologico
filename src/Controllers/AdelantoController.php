<?php
namespace Src\Controllers;

use Src\Core\Auth;
use Src\Core\Database;
use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\AdelantoPaciente;
use Src\Models\Profesional;
use Src\Middleware\RoleMiddleware;

class AdelantoController {

    // ----------------------------------------------------------------
    // GET /api/adelantos?paciente_id=X
    // ----------------------------------------------------------------
    public function index(): void {
        RoleMiddleware::handle(['administrador', 'profesional']);

        $pacienteId = (int) ($_GET['paciente_id'] ?? 0);
        if (!$pacienteId) {
            Response::json(['success' => false, 'message' => 'paciente_id requerido'], 400);
            return;
        }

        $lista = AdelantoPaciente::findByPaciente($pacienteId);

        $user = Auth::user();
        if ($user['rol'] === 'profesional') {
            $prof = Profesional::findByPersonaId((int) $user['persona_id']);
            if ($prof) {
                $profId = (int) $prof['id'];
                $lista  = array_values(
                    array_filter($lista, fn($a) => (int) $a['profesional_id'] === $profId)
                );
            }
        }

        Response::json(['success' => true, 'data' => $lista]);
    }

    // ----------------------------------------------------------------
    // POST /api/adelantos
    // Body: { paciente_id, profesional_id, concepto, monto_total,
    //         atencion_id?, sesiones_acordadas? }
    // ----------------------------------------------------------------
    public function store(Request $request): void {
        RoleMiddleware::handle(['administrador', 'profesional']);
        $data = $request->json();
        Validator::required($data, ['paciente_id', 'profesional_id', 'concepto', 'monto_total']);

        if ((float) $data['monto_total'] <= 0) {
            Response::json(['success' => false, 'message' => 'El monto debe ser mayor que 0'], 422);
            return;
        }

        $user = Auth::user();
        $data['created_by'] = (int) $user['id'];

        try {
            $id = AdelantoPaciente::create($data);
            Response::json([
                'success' => true,
                'data'    => ['id' => $id],
                'message' => 'Adelanto registrado',
            ], 201);
        } catch (\Throwable $e) {
            Response::json([
                'success' => false,
                'message' => 'Error al registrar: ' . $e->getMessage(),
            ], 500);
        }
    }

    // ----------------------------------------------------------------
    // PUT /api/adelantos/cancelar
    // Body: { adelanto_id }  —  solo administrador
    // ----------------------------------------------------------------
    public function cancelar(Request $request): void {
        RoleMiddleware::handle(['administrador']);
        $data = $request->json();
        if (empty($data['adelanto_id'])) {
            Response::json(['success' => false, 'message' => 'adelanto_id requerido'], 400);
            return;
        }
        AdelantoPaciente::cancelar((int) $data['adelanto_id']);
        Response::json(['success' => true, 'message' => 'Adelanto cancelado']);
    }

    // ----------------------------------------------------------------
    // GET /api/adelantos/sesiones?adelanto_id=X
    // ----------------------------------------------------------------
    public function sesiones(): void {
        RoleMiddleware::handle(['administrador', 'profesional']);
        $adelantoId = (int) ($_GET['adelanto_id'] ?? 0);
        if (!$adelantoId) {
            Response::json(['success' => false, 'message' => 'adelanto_id requerido'], 400);
            return;
        }

        $rows = Database::query("
            SELECT ads.id, ads.adelanto_id, ads.sesion_id,
                   ads.monto_aplicado, ads.created_at,
                   s.numero_sesion, s.fecha_hora, s.modalidad_sesion
            FROM adelanto_sesion ads
            JOIN sesiones s ON s.id = ads.sesion_id
            WHERE ads.adelanto_id = ?
            ORDER BY s.numero_sesion
        ", [$adelantoId])->fetchAll();

        Response::json(['success' => true, 'data' => $rows]);
    }
}
