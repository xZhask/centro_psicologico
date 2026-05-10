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
use Src\Models\SesionGrupo;
use Src\Models\AtencionVinculada;
use Src\Models\Subservicio;
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
        if (!empty($data['primera_sesion_duracion'])) {
            $pacienteIdAtencion = $cita ? (int) $cita['paciente_id'] : (int) $data['paciente_id'];
            $paqueteActivo = PacientePaquete::findActivoByPaciente($pacienteIdAtencion);
            $modalidad = $cita ? ($cita['modalidad_sesion'] ?? 'presencial') : ($data['modalidad_sesion'] ?? 'presencial');
            $precio = $cita ? (float) ($cita['precio_acordado'] ?? 0) : (float) ($data['precio_acordado'] ?? 0);
            
            $subId = (int) $data['subservicio_id'];
            $ss = \Src\Core\Database::query("SELECT modalidad FROM subservicios WHERE id = ?", [$subId])->fetch();
            $modSs = $ss ? strtolower($ss['modalidad']) : 'individual';
            $isGrupal = in_array($modSs, ['pareja', 'familiar', 'grupal']);

            if ($isGrupal && !empty($data['participantes'])) {
                // 1. Crear Vínculo (Grupo)
                $userAuth = Auth::user();
                $vinculoId = AtencionVinculada::create([
                    'tipo_vinculo'   => $modSs,
                    'nombre_grupo'   => 'Proceso ' . $modSs . ' (' . date('d/m/Y') . ')',
                    'subservicio_id' => $subId,
                    'profesional_id' => (int) $data['profesional_id'],
                    'fecha_inicio'   => $data['fecha_inicio'] ?? date('Y-m-d'),
                    'created_by'     => $userAuth['id']
                ]);

                // 2. Crear Sesión Grupal (Shared Data)
                $sesionGrupoId = SesionGrupo::create([
                    'vinculo_id'              => $vinculoId,
                    'numero_sesion'           => 1,
                    'fecha_hora'              => date('Y-m-d H:i:s'),
                    'duracion_min'            => (int) $data['primera_sesion_duracion'],
                    'nota_clinica_compartida' => $data['primera_sesion_nota_compartida'] ?? null,
                    'estado'                  => 'realizada'
                ]);

                // 3. Procesar Participantes (Titular + Acompañantes)
                foreach ($data['participantes'] as $pData) {
                    $pId = (int) $pData['paciente_id'];
                    $isTitular = ($pId === $pacienteIdAtencion);
                    $thisAtencionId = null;

                    if ($isTitular) {
                        $thisAtencionId = $atencionId;
                    } else {
                        // Crear atención para acompañante
                        $thisAtencionId = Atencion::create([
                            'paciente_id'          => $pId,
                            'profesional_id'       => (int) $data['profesional_id'],
                            'subservicio_id'       => $subId,
                            'motivo_consulta'      => $data['motivo_consulta'],
                            'fecha_inicio'         => $data['fecha_inicio'] ?? date('Y-m-d'),
                            'observacion_general'  => 'Agregado desde registro grupal inicial.',
                            'grado_instruccion'    => $pData['grado_instruccion'] ?? 'no_especificado',
                            'ocupacion'            => $pData['ocupacion'] ?? null,
                            'estado_civil'         => $pData['estado_civil'] ?? 'no_especificado'
                        ]);
                    }

                    // Vincular al grupo con relación
                    AtencionVinculada::addParticipante(
                        $vinculoId, 
                        $thisAtencionId, 
                        $isTitular ? 'paciente_titular' : 'participante',
                        $pData['relacion'] ?? null
                    );

                    // Registrar diagnóstico individual si existe
                    if (!empty($pData['dx'])) {
                        Diagnostico::asignar([
                            'atencion_id'   => $thisAtencionId,
                            'cie10_codigo'  => $pData['dx']['codigo'],
                            'jerarquia'     => $pData['dx']['jerarquia'],
                            'nivel_certeza' => $pData['dx']['nivel_certeza'],
                            'fecha_dx'      => date('Y-m-d')
                        ]);
                    }

                    // Crear sesión espejo INDIVIDUAL con nota privada
                    $thisPaqueteId = ($isTitular && $paqueteActivo) ? (int) $paqueteActivo['id'] : null;
                    
                    \Src\Core\Database::query("
                        INSERT INTO sesiones (atencion_id, paciente_paquete_id, numero_sesion, modalidad_sesion, 
                                             precio_sesion, duracion_min, nota_clinica, fecha_hora)
                        VALUES (?, ?, 1, ?, ?, ?, ?, NOW())
                    ", [
                        $thisAtencionId,
                        $thisPaqueteId,
                        $modalidad,
                        $isTitular ? $precio : 0,
                        (int) $data['primera_sesion_duracion'],
                        $pData['nota_privada'] ?? null
                    ]);
                    
                    if ($isTitular) $sesionId = (int) \Src\Core\Database::getInstance()->lastInsertId();
                }
            } else {
                // Sesión individual
                $sesionResult = Sesion::crear([
                    'atencion_id'                => $atencionId,
                    'modalidad_sesion'           => $modalidad,
                    'precio_sesion'              => $precio,
                    'duracion_min'               => (int) $data['primera_sesion_duracion'],
                    'nota_clinica'               => $data['primera_sesion_nota'] ?? null,
                    'paciente_paquete_id'        => $paqueteActivo ? (int) $paqueteActivo['id'] : null,
                    'paquete_nombre'             => $paqueteActivo['nombre_paquete'] ?? null,
                    'paquete_sesiones_restantes' => $paqueteActivo['sesiones_restantes'] ?? null,
                ]);
                $sesionId = $sesionResult['sesion_id'] ?? null;
            }
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
