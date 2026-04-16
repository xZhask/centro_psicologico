<?php
namespace Src\Controllers;

use Src\Core\Auth;
use Src\Core\Database;
use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\Alerta;
use Src\Models\PlanSeguimiento;
use Src\Models\ReglaAlerta;
use Src\Middleware\RoleMiddleware;

class AlertaController {

    private const STAFF = ['administrador', 'profesional'];

    /**
     * Resuelve el profesional_id del usuario autenticado.
     * Devuelve 0 si no se encuentra (no debería ocurrir para rol=profesional).
     */
    private function resolveProfesionalId(): int {
        $user = Auth::user();
        $row  = Database::query(
            "SELECT id FROM profesionales WHERE persona_id = ?",
            [(int) $user['persona_id']]
        )->fetch();
        return $row ? (int) $row['id'] : 0;
    }

    // ----------------------------------------------------------------
    // GET /api/alertas
    // ?estado=activa|atendida|descartada|todas  (default: activa)
    // ----------------------------------------------------------------
    public function index(): void {
        RoleMiddleware::handle(self::STAFF);
        $user = Auth::user();

        $estadoParam = $_GET['estado'] ?? 'activa';
        $estado = ($estadoParam === 'todas') ? null : $estadoParam;

        if ($user['rol'] === 'administrador') {
            $alertas = Alerta::findAll($estado);
        } else {
            $profId = $this->resolveProfesionalId();
            if (!$profId) {
                Response::json(['success' => false, 'message' => 'Profesional no encontrado'], 404);
                return;
            }
            $alertas = Alerta::findByProfesional($profId, $estado);
        }

        Response::json(['success' => true, 'data' => $alertas]);
    }

    // ----------------------------------------------------------------
    // GET /api/alertas/conteo
    // Devuelve solo el total de alertas activas (para KPI del dashboard).
    // ----------------------------------------------------------------
    public function conteo(): void {
        RoleMiddleware::handle(self::STAFF);
        $user = Auth::user();

        if ($user['rol'] === 'administrador') {
            $total = Alerta::conteoActivasGlobal();
        } else {
            $profId = $this->resolveProfesionalId();
            $total  = $profId ? Alerta::conteoActivas($profId) : 0;
        }

        Response::json(['success' => true, 'data' => ['total' => $total]]);
    }

    // ----------------------------------------------------------------
    // POST /api/alertas  — alerta manual
    // ----------------------------------------------------------------
    public function store(Request $request): void {
        RoleMiddleware::handle(self::STAFF);
        $data = $request->json();

        Validator::required($data, ['atencion_id', 'tipo', 'nivel', 'descripcion']);

        $tipos  = ['sin_respuesta','riesgo_emocional','tarea_pendiente','inasistencia','escala_critica','manual'];
        $niveles = ['informativa','moderada','alta','critica'];

        if (!in_array($data['tipo'], $tipos, true)) {
            Response::json(['success' => false, 'message' => 'Tipo de alerta inválido'], 422);
            return;
        }
        if (!in_array($data['nivel'], $niveles, true)) {
            Response::json(['success' => false, 'message' => 'Nivel de alerta inválido'], 422);
            return;
        }

        // Resolver paciente_id y profesional_id desde la atención
        $atencion = Database::query(
            "SELECT paciente_id, profesional_id FROM atenciones WHERE id = ? AND estado = 'activa'",
            [(int) $data['atencion_id']]
        )->fetch();

        if (!$atencion) {
            Response::json(['success' => false, 'message' => 'Atención activa no encontrada'], 404);
            return;
        }

        $id = Alerta::create([
            'atencion_id'    => (int) $data['atencion_id'],
            'paciente_id'    => (int) $atencion['paciente_id'],
            'profesional_id' => (int) $atencion['profesional_id'],
            'tipo'           => $data['tipo'],
            'nivel'          => $data['nivel'],
            'descripcion'    => trim($data['descripcion']),
        ]);

        Response::json(['success' => true, 'message' => 'Alerta creada', 'id' => $id], 201);
    }

    // ----------------------------------------------------------------
    // PUT /api/alertas/atender
    // ----------------------------------------------------------------
    public function atender(Request $request): void {
        RoleMiddleware::handle(self::STAFF);
        $user = Auth::user();
        $data = $request->json();

        Validator::required($data, ['id', 'accion']);

        $accion = trim($data['accion']);
        if ($accion === '') {
            Response::json(['success' => false, 'message' => 'Debe describir la acción tomada'], 422);
            return;
        }

        Alerta::atender((int) $data['id'], $accion, (int) $user['id']);
        Response::json(['success' => true, 'message' => 'Alerta atendida']);
    }

    // ----------------------------------------------------------------
    // PUT /api/alertas/descartar
    // ----------------------------------------------------------------
    public function descartar(Request $request): void {
        RoleMiddleware::handle(self::STAFF);
        $user = Auth::user();
        $data = $request->json();

        Validator::required($data, ['id']);
        Alerta::descartar((int) $data['id'], (int) $user['id']);
        Response::json(['success' => true, 'message' => 'Alerta descartada']);
    }

    // ----------------------------------------------------------------
    // POST /api/planes-seguimiento
    // ----------------------------------------------------------------
    public function crearPlan(Request $request): void {
        RoleMiddleware::handle(self::STAFF);
        $user = Auth::user();
        $data = $request->json();

        Validator::required($data, ['atencion_id']);

        // El administrador puede pasar profesional_id explícito;
        // el profesional usa el suyo propio.
        if ($user['rol'] === 'administrador') {
            Validator::required($data, ['profesional_id']);
            $profId = (int) $data['profesional_id'];
        } else {
            $profId = $this->resolveProfesionalId();
            if (!$profId) {
                Response::json(['success' => false, 'message' => 'Profesional no encontrado'], 404);
                return;
            }
        }

        // Verificar que la atención existe y está activa
        $atencion = Database::query(
            "SELECT id FROM atenciones WHERE id = ? AND estado = 'activa'",
            [(int) $data['atencion_id']]
        )->fetch();

        if (!$atencion) {
            Response::json(['success' => false, 'message' => 'Atención activa no encontrada'], 404);
            return;
        }

        $planId = PlanSeguimiento::create([
            'atencion_id'               => (int) $data['atencion_id'],
            'profesional_id'            => $profId,
            'frecuencia_checkin'        => $data['frecuencia_checkin']        ?? 'libre',
            'alerta_sin_respuesta_dias' => $data['alerta_sin_respuesta_dias'] ?? 7,
            'usar_phq9'                 => $data['usar_phq9']                 ?? 0,
            'usar_gad7'                 => $data['usar_gad7']                 ?? 0,
            'usar_escala_custom'        => $data['usar_escala_custom']        ?? 0,
        ]);

        // Crear reglas opcionales enviadas en el mismo request
        $reglas = $data['reglas'] ?? [];
        foreach ($reglas as $regla) {
            if (empty($regla['nombre'])       ||
                empty($regla['campo_origen']) ||
                empty($regla['operador'])     ||
                !isset($regla['valor_umbral'])) {
                continue;
            }
            ReglaAlerta::create([
                'plan_id'           => $planId,
                'nombre'            => $regla['nombre'],
                'campo_origen'      => $regla['campo_origen'],
                'operador'          => $regla['operador'],
                'valor_umbral'      => (float) $regla['valor_umbral'],
                'dias_consecutivos' => $regla['dias_consecutivos'] ?? 1,
                'nivel_alerta'      => $regla['nivel_alerta']      ?? 'moderada',
            ]);
        }

        Response::json(['success' => true, 'message' => 'Plan de seguimiento creado', 'id' => $planId], 201);
    }

    // ----------------------------------------------------------------
    // GET /api/planes-seguimiento
    // ?atencion_id=X
    // ----------------------------------------------------------------
    public function showPlan(): void {
        RoleMiddleware::handle(self::STAFF);
        $atencionId = (int) ($_GET['atencion_id'] ?? 0);

        if (!$atencionId) {
            Response::json(['success' => false, 'message' => 'atencion_id requerido'], 400);
            return;
        }

        $plan = PlanSeguimiento::findByAtencion($atencionId);
        if ($plan) {
            $plan['reglas'] = ReglaAlerta::findByPlan((int) $plan['id']);
        }

        Response::json(['success' => true, 'data' => $plan ?: null]);
    }
}
