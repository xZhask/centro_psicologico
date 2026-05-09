<?php
namespace Src\Controllers;

use Src\Core\Auth;
use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\Atencion;
use Src\Models\Cita;
use Src\Models\Diagnostico;
use Src\Models\Profesional;
use Src\Models\PacientePaquete;
use Src\Models\Sesion;
use Src\Middleware\RoleMiddleware;

class AtencionController {

    private const ALLOWED = ['administrador', 'profesional'];

    private function resolveProfesionalId(): int {
        $user = Auth::user();
        $prof = Profesional::findByPersonaId((int) $user['persona_id']);
        return $prof ? (int) $prof['id'] : 0;
    }

    public function index(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $user = Auth::user();

        if ($user['rol'] === 'profesional') {
            $profId = $this->resolveProfesionalId();
            if (!$profId) {
                Response::json(['success' => true, 'data' => []]);
                return;
            }
            Response::json(['success' => true, 'data' => Atencion::findAll($profId)]);
        } else {
            Response::json(['success' => true, 'data' => Atencion::findAll()]);
        }
    }

    public function show(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $id      = (int) ($_GET['id'] ?? 0);
        $user    = Auth::user();
        $atencion = Atencion::findWithDetail($id);
        if (!$atencion) {
            Response::json(['success' => false, 'message' => 'No encontrada'], 404);
            return;
        }
        if ($user['rol'] === 'profesional') {
            $profId = $this->resolveProfesionalId();
            if ((int) $atencion['profesional_id'] !== $profId) {
                Response::json(['success' => false, 'message' => 'No autorizado'], 403);
                return;
            }
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
        $user = Auth::user();
        if ($user['rol'] === 'profesional') {
            $profId = $this->resolveProfesionalId();
            Response::json(['success' => true, 'data' => Atencion::findByPaciente($pacienteId, $profId)]);
        } else {
            Response::json(['success' => true, 'data' => Atencion::findByPaciente($pacienteId)]);
        }
    }

    public function store(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        $user = Auth::user();

        if ($user['rol'] === 'profesional') {
            $prof = Profesional::findByPersonaId((int) $user['persona_id']);
            if (!$prof) {
                Response::json(['success' => false, 'message' => 'Tu usuario no tiene un perfil de profesional asociado'], 403);
                return;
            }
            $data['profesional_id'] = $prof['id'];
        }

        $cita = null;
        if (!empty($data['cita_id'])) {
            $cita = Cita::findById((int) $data['cita_id']);
            if ($cita) {
                if (empty($data['paciente_id']))    $data['paciente_id']    = $cita['paciente_id'];
                if (empty($data['subservicio_id'])) $data['subservicio_id'] = $cita['subservicio_id'];
                if ($user['rol'] !== 'profesional' && empty($data['profesional_id'])) {
                    $data['profesional_id'] = $cita['profesional_id'];
                }
                if (empty($data['fecha_inicio'])) {
                    $data['fecha_inicio'] = (new \DateTime($cita['fecha_hora_inicio']))->format('Y-m-d');
                }
            }
        }

        Validator::required($data, [
            'paciente_id', 'profesional_id', 'subservicio_id',
            'motivo_consulta', 'fecha_inicio',
        ]);
        $atencionId = Atencion::create($data);

        if (!empty($data['cita_id'])) {
            Cita::updateEstado((int) $data['cita_id'], 'completada', $atencionId);
        }

        $sesionId = null;
        if (!empty($data['primera_sesion_duracion']) && $cita) {
            $paqueteActivo = PacientePaquete::findActivoByPaciente(
                (int) $cita['paciente_id']
            );
            $sesionResult = Sesion::crear([
                'atencion_id'                => $atencionId,
                'modalidad_sesion'           => $cita['modalidad_sesion'] ?? 'presencial',
                'precio_sesion'              => 0,
                'duracion_min'               => (int) $data['primera_sesion_duracion'],
                'nota_clinica'               => $data['primera_sesion_nota'] ?? null,
                'paciente_paquete_id'        => $paqueteActivo ? (int) $paqueteActivo['id'] : null,
                'paquete_nombre'             => $paqueteActivo['nombre_paquete'] ?? null,
                'paquete_sesiones_restantes' => $paqueteActivo['sesiones_restantes'] ?? null,
            ]);
            $sesionId = $sesionResult['sesion_id'] ?? null;
        }

        Response::json([
            'success' => true,
            'data'    => ['id' => $atencionId, 'sesion_id' => $sesionId],
            'message' => 'Atención creada',
        ]);
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
        Validator::required($data, ['atencion_id', 'cie10_codigo', 'jerarquia', 'nivel_certeza', 'fecha_dx']);

        if ($data['jerarquia'] === 'principal' && Diagnostico::hasPrincipal((int) $data['atencion_id'])) {
            Response::json([
                'success' => false,
                'message' => 'Ya existe un diagnóstico principal para esta atención. Cambie la jerarquía o elimine el existente.',
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
        $id = Sesion::crear($data);
        Response::json(['success' => true, 'data' => ['id' => $id]]);
    }
}
