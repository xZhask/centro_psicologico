<?php
namespace Src\Controllers;

use Src\Core\Auth;
use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\Cita;
use Src\Models\Atencion;
use Src\Models\Profesional;
use Src\Models\Subservicio;
use Src\Models\PacientePaquete;
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
            if (!empty($_GET['estado']))          $filtros['estado']          = $_GET['estado'];
            if (!empty($_GET['fecha']))           $filtros['fecha']           = $_GET['fecha'];
            if (!empty($_GET['fecha_desde']))     $filtros['fecha_desde']     = $_GET['fecha_desde'];
            if (!empty($_GET['fecha_hasta']))     $filtros['fecha_hasta']     = $_GET['fecha_hasta'];
            if (!empty($_GET['modalidad_sesion'])) $filtros['modalidad_sesion'] = $_GET['modalidad_sesion'];
            if (!empty($_GET['q']))               $filtros['q']               = $_GET['q'];

            if ($user['rol'] === 'profesional') {
                $prof = Profesional::findByPersonaId((int) $user['persona_id']);
                if (!$prof) {
                    Response::json(['success' => true, 'data' => []]);
                    return;
                }
                $filtros['profesional_id'] = $prof['id'];
            }

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
        } elseif ($user['rol'] === 'profesional') {
            $cita = Cita::findById($id);
            if ($cita) {
                $prof = Profesional::findByPersonaId((int) $user['persona_id']);
                if (!$prof || (int) $cita['profesional_id'] !== (int) $prof['id']) {
                    Response::json(['success' => false, 'message' => 'No autorizado'], 403);
                    return;
                }
            }
        } else {
            $cita = Cita::findById($id);
        }

        Response::json(['success' => true, 'data' => $cita]);
    }

    public function store(Request $request): void {
        RoleMiddleware::handle(self::STAFF);
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

        Validator::required($data, ['paciente_id', 'profesional_id', 'fecha_hora_inicio']);

        if (!isset($data['tipo_cita'])
            || !in_array($data['tipo_cita'], ['nueva_atencion', 'sesion_existente'], true)) {
            Response::json(['success' => false, 'message' => 'Tipo de cita requerido (nueva_atencion o sesion_existente)'], 422);
            return;
        }
        $tipo = $data['tipo_cita'];

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

            $sub = Subservicio::findById((int) $data['subservicio_id']);
            if (!$sub) {
                Response::json(['success' => false, 'message' => 'Subservicio no encontrado'], 404);
                return;
            }

            if (Cita::existeCruce(
                (int) $data['profesional_id'],
                $data['fecha_hora_inicio'],
                (int) $sub['duracion_min']
            )) {
                Response::json(['success' => false, 'message' => 'El profesional ya tiene una cita en ese horario (considera la duración de la sesión).'], 409);
                return;
            }

            Cita::create($data);

            if (!empty($data['contratar_paquete_id'])) {
                $ppId = PacientePaquete::contratar([
                    'paquete_id'     => (int) $data['contratar_paquete_id'],
                    'paciente_id'    => (int) $data['paciente_id'],
                    'profesional_id' => (int) $data['profesional_id'],
                    'created_by'     => (int) $user['id'],
                ]);
                Response::json(['success' => true, 'message' => 'Cita creada con paquete', 'paciente_paquete_id' => $ppId]);
            } else {
                Response::json(['success' => true, 'message' => 'Cita creada']);
            }
        } catch (\Exception $e) {
            Response::json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    public function updateEstado(Request $request): void {
        RoleMiddleware::handle(self::STAFF);
        $data = $request->json();
        Validator::required($data, ['id', 'estado']);
        $user = Auth::user();
        if ($user['rol'] === 'profesional') {
            $cita = Cita::findById((int) $data['id']);
            $prof = Profesional::findByPersonaId((int) $user['persona_id']);
            if (!$cita || !$prof || (int) $cita['profesional_id'] !== (int) $prof['id']) {
                Response::json(['success' => false, 'message' => 'No autorizado'], 403);
                return;
            }
        }
        Cita::updateEstado((int) $data['id'], $data['estado']);
        Response::json(['success' => true]);
    }

    public function reprogramar(Request $request): void {
        RoleMiddleware::handle(self::STAFF);
        $data = $request->json();
        Validator::required($data, ['id', 'nueva_fecha']);

        $citaId     = (int) $data['id'];
        $nuevaFecha = $data['nueva_fecha'];
        $user       = Auth::user();

        $cita = Cita::findById($citaId);
        if (!$cita) {
            Response::json(['success' => false, 'message' => 'Cita no encontrada'], 404);
            return;
        }

        if ($user['rol'] === 'profesional') {
            $prof = Profesional::findByPersonaId((int) $user['persona_id']);
            if (!$prof || (int) $cita['profesional_id'] !== (int) $prof['id']) {
                Response::json(['success' => false, 'message' => 'No autorizado'], 403);
                return;
            }
        }

        $sub = Subservicio::findById((int) $cita['subservicio_id']);
        if (Cita::existeCruce(
            (int) $cita['profesional_id'],
            $nuevaFecha,
            (int) ($sub['duracion_min'] ?? 50),
            $citaId
        )) {
            Response::json(['success' => false, 'message' => 'El profesional ya tiene una cita en ese horario (considera la duración de la sesión).'], 409);
            return;
        }

        try {
            $nuevaCitaId = Cita::reprogramar(
                $citaId,
                $nuevaFecha,
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
        $user = Auth::user();
        if ($user['rol'] === 'profesional') {
            $cita = Cita::findById((int) $data['id']);
            $prof = Profesional::findByPersonaId((int) $user['persona_id']);
            if (!$cita || !$prof || (int) $cita['profesional_id'] !== (int) $prof['id']) {
                Response::json(['success' => false, 'message' => 'No autorizado'], 403);
                return;
            }
        }
        Cita::delete((int) $data['id']);
        Response::json(['success' => true]);
    }
}
