<?php
namespace Src\Controllers;

use Src\Core\Auth;
use Src\Core\Database;
use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\Checkin;
use Src\Middleware\RoleMiddleware;

class CheckinController {

    private const SOLO_PACIENTE = ['paciente'];
    private const ALL           = ['administrador', 'profesional', 'paciente'];

    /**
     * GET /api/checkin
     * - Paciente: detecta automáticamente su atención activa.
     *   Devuelve { atencion, checkins, promedio }.
     * - Staff: requiere ?atencion_id=X.
     *   Devuelve { atencion: null, checkins, promedio }.
     */
    public function index(): void {
        RoleMiddleware::handle(self::ALL);
        $user = Auth::user();

        if ($user['rol'] === 'paciente') {
            $row = Database::query(
                "SELECT id FROM pacientes WHERE persona_id = ?",
                [(int) $user['persona_id']]
            )->fetch();
            if (!$row) {
                Response::json(['success' => false, 'message' => 'Paciente no encontrado'], 404);
                return;
            }
            $pacienteId = (int) $row['id'];

            $atencion = Database::query(
                "SELECT a.id, a.estado, a.fecha_inicio,
                        ss.nombre AS subservicio,
                        CONCAT(pe.nombres,' ',pe.apellidos) AS profesional
                 FROM atenciones a
                 JOIN subservicios ss  ON ss.id  = a.subservicio_id
                 JOIN profesionales pr ON pr.id  = a.profesional_id
                 JOIN personas pe      ON pe.id  = pr.persona_id
                 WHERE a.paciente_id = ? AND a.estado = 'activa'
                 ORDER BY a.fecha_inicio DESC LIMIT 1",
                [$pacienteId]
            )->fetch();

            if (!$atencion) {
                Response::json(['success' => true, 'data' => [
                    'atencion' => null,
                    'checkins' => [],
                    'promedio' => null,
                ]]);
                return;
            }
            $atencionId = (int) $atencion['id'];

        } else {
            $atencionId = (int) ($_GET['atencion_id'] ?? 0);
            if (!$atencionId) {
                Response::json(['success' => false, 'message' => 'atencion_id requerido'], 400);
                return;
            }
            $atencion = null;
        }

        $promedio = Checkin::promedioByAtencion($atencionId);

        Response::json(['success' => true, 'data' => [
            'atencion' => $atencion ?: null,
            'checkins' => Checkin::findByAtencion($atencionId),
            'promedio' => ($promedio && (int) $promedio['total'] > 0) ? $promedio : null,
        ]]);
    }

    /**
     * POST /api/checkin
     * Solo paciente. El servidor detecta la atención activa automáticamente.
     * Valida que exista una atención activa y que los valores sean 0-10.
     */
    public function store(Request $request): void {
        RoleMiddleware::handle(self::SOLO_PACIENTE);
        $user = Auth::user();

        // Resolver paciente_id
        $row = Database::query(
            "SELECT id FROM pacientes WHERE persona_id = ?",
            [(int) $user['persona_id']]
        )->fetch();
        if (!$row) {
            Response::json(['success' => false, 'message' => 'Paciente no encontrado'], 404);
            return;
        }
        $pacienteId = (int) $row['id'];

        // Verificar atención activa
        $atencion = Database::query(
            "SELECT id FROM atenciones
             WHERE paciente_id = ? AND estado = 'activa'
             ORDER BY fecha_inicio DESC LIMIT 1",
            [$pacienteId]
        )->fetch();
        if (!$atencion) {
            Response::json(['success' => false, 'message' => 'No tienes una atención activa'], 422);
            return;
        }
        $atencionId = (int) $atencion['id'];

        $data = $request->json();
        Validator::required($data, ['como_te_sientes', 'dormiste_bien', 'nivel_estres']);

        // Validar rango 0-10 para los tres indicadores
        foreach (['como_te_sientes', 'dormiste_bien', 'nivel_estres'] as $campo) {
            $val = (int) ($data[$campo] ?? -1);
            if ($val < 0 || $val > 10) {
                Response::json(['success' => false, 'message' => "Valor fuera de rango para {$campo}"], 422);
                return;
            }
        }

        $id = Checkin::create([
            'paciente_id'     => $pacienteId,
            'atencion_id'     => $atencionId,
            'como_te_sientes' => (int) $data['como_te_sientes'],
            'dormiste_bien'   => (int) $data['dormiste_bien'],
            'nivel_estres'    => (int) $data['nivel_estres'],
            'hiciste_tarea'   => isset($data['hiciste_tarea']) ? (int) $data['hiciste_tarea'] : null,
            'nota_opcional'   => !empty($data['nota_opcional']) ? trim($data['nota_opcional']) : null,
        ]);

        Response::json(['success' => true, 'message' => 'Check-in registrado', 'id' => $id]);
    }
}
