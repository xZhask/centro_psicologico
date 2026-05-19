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

    private function updatePersonaData(int $pacienteId, ?string $sexo, ?string $fechaNac): void {
        if (!$sexo && !$fechaNac) return;
        
        $sets = [];
        $params = [];
        
        if ($sexo) {
            $sets[] = "pe.sexo = ?";
            $params[] = $sexo;
        }
        if ($fechaNac) {
            $sets[] = "pe.fecha_nacimiento = ?";
            $params[] = $fechaNac;
        }
        
        if (empty($sets)) return;
        
        $params[] = $pacienteId;
        $setStr = implode(", ", $sets);
        
        \Src\Core\Database::query("
            UPDATE personas pe
            JOIN pacientes p ON p.persona_id = pe.id
            SET $setStr
            WHERE p.id = ?
        ", $params);
    }

    private function resolveListParams(): array {
        $user    = Auth::user();
        $search  = trim($_GET['search'] ?? '');
        $desde   = $_GET['desde']  ?? null;
        $hasta   = $_GET['hasta']  ?? null;
        $estado  = trim($_GET['estado'] ?? '');

        if ($user['rol'] === 'profesional') {
            $profId = $this->resolveProfesionalId();
            return [$profId, $search, $desde, $hasta, $estado];
        }

        $filtroProfId = (int) ($_GET['profesional_id'] ?? 0);
        return [$filtroProfId, $search, $desde, $hasta, $estado];
    }

    public function index(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $user = Auth::user();

        [$profId, $search, $desde, $hasta, $estado] = $this->resolveListParams();

        if ($user['rol'] === 'profesional' && !$profId) {
            Response::json(['success' => true, 'data' => []]);
            return;
        }

        Response::json(['success' => true, 'data' => Atencion::findAll($profId, $search, $desde, $hasta, $estado)]);
    }

    public function conteos(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $user = Auth::user();

        [$profId, $search, $desde, $hasta, $estado] = $this->resolveListParams();

        if ($user['rol'] === 'profesional' && !$profId) {
            Response::json(['success' => true, 'data' => ['individual' => 0, 'pareja' => 0, 'familiar' => 0, 'grupal' => 0]]);
            return;
        }

        Response::json([
            'success' => true,
            'data'    => [
                'individual' => Atencion::countAll($profId, $search, $desde, $hasta, $estado),
                'pareja'     => AtencionVinculada::countAll('pareja',   $search, $desde, $hasta, $profId, $estado),
                'familiar'   => AtencionVinculada::countAll('familiar', $search, $desde, $hasta, $profId, $estado),
                'grupal'     => AtencionVinculada::countAll('grupal',   $search, $desde, $hasta, $profId, $estado),
            ],
        ]);
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

        if (empty($data['cita_id'])) {
            Response::json(['success' => false, 'message' => 'Debe seleccionar una cita para registrar una atención'], 422);
            return;
        }

        $cita = null;
        if (!empty($data['cita_id'])) {
            $citaId = (int) $data['cita_id'];
            $cita = Cita::findById($citaId);
            if ($cita) {
                // Validar Cobertura
                $cobertura = Cita::evaluarCobertura($citaId);
                if (!$cobertura['habilitada_para_registro']) {
                    Response::json([
                        'success' => false,
                        'message' => 'Esta cita requiere pago antes de registrar la atención. ' . $cobertura['mensaje']
                    ], 422);
                    return;
                }

                if (empty($data['paciente_id']))    $data['paciente_id']    = $cita['paciente_id'];
                if (empty($data['subservicio_id'])) $data['subservicio_id'] = $cita['subservicio_id'];
                if ($user['rol'] !== 'profesional' && empty($data['profesional_id'])) {
                    $data['profesional_id'] = $cita['profesional_id'];
                }
                if (empty($data['fecha_inicio'])) {
                    $data['fecha_inicio'] = (new \DateTime($cita['fecha_hora_inicio']))->format('Y-m-d');
                }

                // Inyectar cobertura para la primera sesión
                $data['paciente_paquete_id'] = $cobertura['paquete_id'];
                $data['adelanto_id']         = $cobertura['adelanto_id'];
            }
        }

        Validator::required($data, [
            'paciente_id', 'profesional_id', 'subservicio_id',
            'motivo_consulta', 'fecha_inicio',
        ]);

        $subId = (int) $data['subservicio_id'];
        $ss = \Src\Core\Database::query("SELECT modalidad FROM subservicios WHERE id = ?", [$subId])->fetch();
        $modSs = $ss ? strtolower($ss['modalidad']) : 'individual';
        $isGrupal = in_array($modSs, ['pareja', 'familiar', 'grupal']);

        $motivoConsultaProceso = $data['motivo_consulta'];
        $numeroSesionesPlanProceso = $data['numero_sesiones_plan'] ?? null;

        if ($isGrupal) {
            $data['motivo_consulta'] = null;
            $data['numero_sesiones_plan'] = null;
            $data['observacion_general'] = null;
        }

        $atencionId = Atencion::create($data);

        // Actualizar datos de la persona (sexo, fecha nacimiento) si se proporcionan
        $this->updatePersonaData((int) $data['paciente_id'], $data['sexo'] ?? null, $data['fecha_nacimiento'] ?? null);

        if (!empty($data['cita_id'])) {
            Cita::updateEstado((int) $data['cita_id'], 'completada', $atencionId);
        }

        $sesionId      = null;
        $sesionGrupoId = null;
        $vinculoId     = null;
        if (!empty($data['primera_sesion_duracion'])) {
            $pacienteIdAtencion = $cita ? (int) $cita['paciente_id'] : (int) $data['paciente_id'];
            $paqueteActivo = PacientePaquete::findActivoByPaciente($pacienteIdAtencion);
            $modalidad = $cita ? ($cita['modalidad_sesion'] ?? 'presencial') : ($data['modalidad_sesion'] ?? 'presencial');
            $precio = $cita ? (float) ($cita['precio_acordado'] ?? 0) : (float) ($data['precio_acordado'] ?? 0);

            if ($isGrupal && !empty($data['participantes'])) {
                // 1. Crear Vínculo (Grupo)
                $userAuth = Auth::user();
                $vinculoId = AtencionVinculada::create([
                    'tipo_vinculo'         => $modSs,
                    'nombre_grupo'         => 'Proceso ' . $modSs . ' (' . date('d/m/Y') . ')',
                    'subservicio_id'       => $subId,
                    'profesional_id'       => (int) $data['profesional_id'],
                    'fecha_inicio'         => $data['fecha_inicio'] ?? date('Y-m-d'),
                    'created_by'           => $userAuth['id'],
                    'motivo_consulta'      => $motivoConsultaProceso,
                    'numero_sesiones_plan' => $numeroSesionesPlanProceso
                ]);

                // Link existing cuenta_cobro to the new vinculo_id
                if (!empty($data['cita_id'])) {
                    $cuentaExistente = \Src\Models\CuentaCobro::findByCitaId((int) $data['cita_id']);
                    if ($cuentaExistente && empty($cuentaExistente['vinculo_id'])) {
                        \Src\Models\CuentaCobro::linkVinculo((int) $cuentaExistente['id'], $vinculoId);
                    }
                }

                // 2. Crear Sesión Grupal (Shared Data)
                $sesionGrupoId = SesionGrupo::create([
                    'vinculo_id'              => $vinculoId,
                    'numero_sesion'           => 1,
                    'fecha_hora'              => date('Y-m-d H:i:s'),
                    'duracion_min'            => (int) $data['primera_sesion_duracion'],
                    'nota_clinica_compartida' => $data['primera_sesion_nota_compartida'] ?? null,
                    'estado'                  => 'realizada',
                    'cita_id'                 => !empty($data['cita_id']) ? (int) $data['cita_id'] : null,
                    'modalidad_sesion'        => $modalidad
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
                            'motivo_consulta'      => null,
                            'numero_sesiones_plan' => null,
                            'fecha_inicio'         => $data['fecha_inicio'] ?? date('Y-m-d'),
                            'observacion_general'  => null,
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

                    // Actualizar datos de la persona si se proporcionan en el grupo
                    if (!$isTitular) {
                        $this->updatePersonaData($pId, $pData['sexo'] ?? null, $pData['fecha_nacimiento'] ?? null);
                    }

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
                    'cita_id'                    => $citaId,
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
            'data'    => [
                'id'              => $atencionId,
                'sesion_id'       => $sesionId,
                'sesion_grupo_id' => $sesionGrupoId,
                'vinculo_id'      => $vinculoId,
            ],
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

    public function pausar(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $d      = $request->json();
        $id     = (int) ($d['id'] ?? 0);
        $accion = $d['accion'] ?? 'pausar';
        if (!$id) {
            Response::json(['success' => false, 'message' => 'id requerido'], 400);
            return;
        }
        if ($accion === 'reactivar') {
            Atencion::reactivar($id);
            Response::json(['success' => true, 'message' => 'Atención reactivada']);
        } else {
            Atencion::pausar($id);
            Response::json(['success' => true, 'message' => 'Atención pausada']);
        }
    }

    public function update(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        $id   = (int) ($data['id'] ?? 0);
        if (!$id) {
            Response::json(['success' => false, 'message' => 'id requerido'], 400);
            return;
        }
        Atencion::update($id, $data);
        Response::json(['success' => true, 'message' => 'Atención actualizada']);
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

    public function updateDiagnostico(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['id', 'jerarquia', 'nivel_certeza']);
        $id = (int) $data['id'];

        if ($data['jerarquia'] === 'principal') {
            $dx = Diagnostico::findById($id);
            if ($dx && Diagnostico::hasPrincipalExcepto((int) $dx['atencion_id'], $id)) {
                Response::json([
                    'success' => false,
                    'message' => 'Ya existe otro diagnóstico principal en esta atención.',
                ], 400);
                return;
            }
        }

        Diagnostico::update($id, $data['jerarquia'], $data['nivel_certeza']);
        Response::json(['success' => true, 'message' => 'Diagnóstico actualizado']);
    }

    public function deleteDiagnostico(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        $id   = (int) ($data['id'] ?? 0);
        if (!$id) {
            Response::json(['success' => false, 'message' => 'id requerido'], 400);
            return;
        }
        Diagnostico::delete($id);
        Response::json(['success' => true, 'message' => 'Diagnóstico eliminado']);
    }

    public function sesion(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['atencion_id', 'numero_sesion', 'fecha_hora', 'duracion_min']);
        $id = Sesion::crear($data);
        Response::json(['success' => true, 'data' => ['id' => $id]]);
    }
}
