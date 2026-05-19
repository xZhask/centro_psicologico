<?php
namespace Src\Controllers;

use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Core\Auth;
use Src\Models\AtencionVinculada;
use Src\Models\SesionGrupo;
use Src\Models\SesionArchivo;
use Src\Models\Tarea;
use Src\Models\CuentaCobro;
use Src\Models\Cita;
use Src\Models\PacientePaquete;
use Src\Middleware\RoleMiddleware;

class VinculoController {

    private const ALLOWED = ['administrador', 'profesional'];

    // ----------------------------------------------------------------
    // Vínculos grupales
    // ----------------------------------------------------------------

    /** GET /api/vinculos */
    public function index(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $user         = Auth::user();
        $tipo         = $_GET['tipo']   ?? null;
        $search       = trim($_GET['search'] ?? '');
        $desde        = $_GET['desde']  ?? null;
        $hasta        = $_GET['hasta']  ?? null;
        $estado       = trim($_GET['estado'] ?? '');
        $profesionalId = ($user['rol'] === 'administrador') ? (int) ($_GET['profesional_id'] ?? 0) : 0;
        Response::json(['success' => true, 'data' => AtencionVinculada::findAll($tipo, $search, $desde, $hasta, $profesionalId, $estado)]);
    }

    /** GET /api/vinculo?id=X  — detalle completo: participantes + sesiones */
    public function show(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $id      = (int) ($_GET['id'] ?? 0);
        $vinculo = AtencionVinculada::findById($id);

        if (!$vinculo) {
            Response::json(['success' => false, 'message' => 'Vínculo no encontrado'], 404);
            return;
        }

        $participantes = AtencionVinculada::findParticipantes($id);
        foreach ($participantes as &$p) {
            $p['diagnosticos'] = AtencionVinculada::getDiagnosticosByAtencion((int) $p['atencion_id']);
            $p['contexto_clinico_inicial'] = [
                'observacion_general'    => $p['observacion_general'] ?? '',
                'observacion_conducta'   => $p['observacion_conducta'] ?? '',
                'antecedentes_relevantes' => $p['antecedentes_relevantes'] ?? ''
            ];
        }
        unset($p);
        $vinculo['participantes'] = $participantes;
        $vinculo['diagnosticos_proceso'] = \Src\Models\Diagnostico::findByVinculo($id);

        $vinculo['tareas_proceso'] = SesionGrupo::getTareasByVinculo($id);

        $sesiones = SesionGrupo::findByVinculoConDetalle($id);
        foreach ($sesiones as &$sg) {
            $sg['archivos'] = SesionArchivo::findBySesion(null, $sg['id']);

            $titularEspejo = array_values(array_filter(
                $sg['notas_privadas'],
                fn(array $n): bool => $n['rol_en_grupo'] === 'paciente_titular'
            ));
            $sg['tareas'] = (!empty($titularEspejo) && $titularEspejo[0]['sesion_espejo_id'])
                ? Tarea::findBySesion((int) $titularEspejo[0]['sesion_espejo_id'])
                : [];
        }
        unset($sg);
        $vinculo['sesiones_grupo'] = $sesiones;

        Response::json(['success' => true, 'data' => $vinculo]);
    }

    /** POST /api/vinculos */
    public function store(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['tipo_vinculo', 'profesional_id', 'fecha_inicio', 'subservicio_id']);

        $data['created_by'] = Auth::user()['id'];

        $id = AtencionVinculada::create($data);
        Response::json(['success' => true, 'data' => ['id' => $id], 'message' => 'Vínculo grupal creado']);
    }

    /** PUT /api/vinculos/cerrar */
    public function cerrar(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['id']);
        AtencionVinculada::completar((int) $data['id']);
        Response::json(['success' => true, 'message' => 'Proceso grupal completado']);
    }

    // ----------------------------------------------------------------
    // Participantes
    // ----------------------------------------------------------------

    /** POST /api/vinculos/participante */
    public function addParticipante(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['vinculo_id', 'atencion_id', 'rol_en_grupo']);

        AtencionVinculada::addParticipante(
            (int) $data['vinculo_id'],
            (int) $data['atencion_id'],
            $data['rol_en_grupo']
        );

        Response::json(['success' => true, 'message' => 'Participante agregado']);
    }

    /** DELETE /api/vinculos/participante?id=X */
    public function removeParticipante(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) {
            Response::json(['success' => false, 'message' => 'id requerido'], 400);
            return;
        }
        AtencionVinculada::removeParticipante($id);
        Response::json(['success' => true]);
    }

    // ----------------------------------------------------------------
    // Sesiones grupales
    // ----------------------------------------------------------------

    /** GET /api/sesiones-grupo?vinculo_id=X */
    public function sesionesIndex(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $vinculoId = (int) ($_GET['vinculo_id'] ?? 0);
        if (!$vinculoId) {
            Response::json(['success' => false, 'message' => 'vinculo_id requerido'], 400);
            return;
        }
        Response::json(['success' => true, 'data' => SesionGrupo::findByVinculo($vinculoId)]);
    }

    /** POST /api/sesiones-grupo */
    public function sesionesStore(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['vinculo_id']);

        // Notas privadas por atencion_id (nuevo flujo — van a sesiones.nota_clinica)
        $notasPrivadas = is_array($data['notas_privadas'] ?? null) ? $data['notas_privadas'] : [];

        // Limpiar campos p1/p2/p3 (flujo antiguo, no se llenan en el nuevo flujo)
        $data['nota_privada_p1'] = null;
        $data['nota_privada_p2'] = null;
        $data['nota_privada_p3'] = null;

        $fechaHora = $data['fecha_hora'] ?? date('Y-m-d H:i:s');
        $data['fecha_hora'] = $fechaHora;

        $citaId = !empty($data['cita_id']) ? (int) $data['cita_id'] : null;

        // Datos del subservicio del vínculo (precio y nombre) — necesario antes de crear espejos
        $vinculoInfo = \Src\Core\Database::query("
            SELECT ss.nombre AS subservicio_nombre, ss.precio_base
            FROM atenciones_vinculadas av
            JOIN subservicios ss ON ss.id = av.subservicio_id
            WHERE av.id = ?
        ", [(int) $data['vinculo_id']])->fetch();

        $precioTitular = 0.00;
        $paqueteTitularId = null;

        if ($citaId) {
            // Sesión 2+: evaluar cobertura de la cita para detectar paquete activo
            $cobertura = Cita::evaluarCobertura($citaId);
            $paqueteTitularId = $cobertura['paquete_id'] ?? null;
            
            // Usar precio de la cita si existe
            $citaRow = \Src\Core\Database::query("SELECT precio_acordado FROM citas WHERE id = ?", [$citaId])->fetch();
            if ($citaRow) {
                $precioTitular = (float) $citaRow['precio_acordado'];
            }
        } else {
            // Sin cita, usar el precio base del subservicio
            $precioTitular = $vinculoInfo ? (float) $vinculoInfo['precio_base'] : 0.00;
            
            // Primera sesión sin cita: buscar paquete activo del titular directamente
            $titularRow = \Src\Core\Database::query("
                SELECT a.paciente_id, av.profesional_id
                FROM atencion_vinculo_detalle avd
                JOIN atenciones a             ON a.id  = avd.atencion_id
                JOIN atenciones_vinculadas av ON av.id = avd.vinculo_id
                WHERE avd.vinculo_id = ? AND avd.rol_en_grupo = 'paciente_titular'
                LIMIT 1
            ", [(int) $data['vinculo_id']])->fetch();

            if ($titularRow) {
                $pp = PacientePaquete::findActivoByPacienteYProfesional(
                    (int) $titularRow['paciente_id'],
                    (int) $titularRow['profesional_id']
                );
                $paqueteTitularId = $pp ? (int) $pp['id'] : null;
            }
        }

        $sgId    = SesionGrupo::create($data);
        $espejos = SesionGrupo::crearEspejos(
            (int) $data['vinculo_id'],
            $fechaHora,
            isset($data['duracion_min']) ? (int) $data['duracion_min'] : null,
            $notasPrivadas,
            $citaId,
            $paqueteTitularId,
            $precioTitular
        );

        // Gestionar cuenta de cobro para la sesión grupal (sin paquete)
        if ($precioTitular > 0 && !$paqueteTitularId) {
            $numSesion = (int) (\Src\Core\Database::query(
                "SELECT numero_sesion FROM sesiones_grupo WHERE id = ?", [$sgId]
            )->fetch()['numero_sesion'] ?? 1);

            if ($citaId) {
                // La cita ya genera su propia cuenta: solo vincularla al proceso grupal
                $cuentaExistente = CuentaCobro::findByCitaId($citaId);
                if ($cuentaExistente) {
                    CuentaCobro::linkVinculo((int) $cuentaExistente['id'], (int) $data['vinculo_id']);
                } else {
                    // Aún no hay pago: crear cuenta con ambas anclas (cita + vínculo)
                    $citaRow = \Src\Core\Database::query(
                        "SELECT paciente_id, precio_acordado FROM citas WHERE id = ?", [$citaId]
                    )->fetch();
                    CuentaCobro::create([
                        'cita_id'       => $citaId,
                        'vinculo_id'    => (int) $data['vinculo_id'],
                        'paciente_id'   => $citaRow ? (int) $citaRow['paciente_id'] : null,
                        'concepto'      => 'Sesión #' . $numSesion . ' — ' . $vinculoInfo['subservicio_nombre'],
                        'monto_total'   => $citaRow ? (float) $citaRow['precio_acordado'] : (float) $vinculoInfo['precio_base'],
                        'fecha_emision' => date('Y-m-d'),
                    ]);
                }
            } else {
                // Sin cita asociada: cuenta directa al proceso grupal
                CuentaCobro::create([
                    'vinculo_id'    => (int) $data['vinculo_id'],
                    'paciente_id'   => null,
                    'concepto'      => 'Sesión #' . $numSesion . ' — ' . $vinculoInfo['subservicio_nombre'],
                    'monto_total'   => (float) $vinculoInfo['precio_base'],
                    'fecha_emision' => date('Y-m-d'),
                ]);
            }
        }

        // Buscar titular para retornar sesion_id y marcar cita como completada
        $titularSesionId   = null;
        $titularAtencionId = null;
        foreach ($espejos as $atId => $info) {
            if ($info['rol_en_grupo'] === 'paciente_titular') {
                $titularSesionId   = $info['sesion_id'];
                $titularAtencionId = (int) $atId;
                break;
            }
        }

        // Marcar la cita como completada para que el botón cambie a "Ver"
        if ($citaId) {
            Cita::updateEstado($citaId, 'completada', $titularAtencionId);
        }

        Response::json([
            'success' => true,
            'data' => [
                'id' => $sgId,
                'titular_sesion_id' => $titularSesionId
            ],
            'message' => 'Sesión grupal registrada'
        ]);
    }

    /** PUT /api/sesiones-grupo/nota */
    public function updateNota(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['id']);

        $sgId = (int) $data['id'];

        SesionGrupo::updateNota(
            $sgId,
            $data['nota_clinica_compartida'] ?? null
        );

        // Actualizar notas privadas en las sesiones espejo individuales
        $notasPrivadas = is_array($data['notas_privadas'] ?? null) ? $data['notas_privadas'] : [];
        if (!empty($notasPrivadas)) {
            $row = \Src\Core\Database::query(
                "SELECT numero_sesion FROM sesiones_grupo WHERE id = ?", [$sgId]
            )->fetch();
            $numSesion = $row ? (int) $row['numero_sesion'] : null;

            if ($numSesion) {
                foreach ($notasPrivadas as $atencionId => $nota) {
                    \Src\Core\Database::query(
                        "UPDATE sesiones SET nota_clinica = ? WHERE atencion_id = ? AND numero_sesion = ?",
                        [trim($nota) ?: null, (int) $atencionId, $numSesion]
                    );
                }
            }
        }

        Response::json(['success' => true]);
    }

    /** GET /api/sesiones-grupo/notas-privadas?sg_id=X */
    public function notasPrivadas(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $sgId = (int) ($_GET['sg_id'] ?? 0);
        if (!$sgId) {
            Response::json(['success' => false, 'message' => 'sg_id requerido'], 400);
            return;
        }

        $rows = \Src\Core\Database::query("
            SELECT avd.atencion_id, s.nota_clinica
            FROM sesiones_grupo sg
            JOIN atencion_vinculo_detalle avd ON avd.vinculo_id = sg.vinculo_id
            LEFT JOIN sesiones s ON s.atencion_id = avd.atencion_id
                                 AND s.numero_sesion = sg.numero_sesion
            WHERE sg.id = ?
            ORDER BY avd.id
        ", [$sgId])->fetchAll();

        $map = [];
        foreach ($rows as $r) {
            $map[(int) $r['atencion_id']] = $r['nota_clinica'];
        }
        Response::json(['success' => true, 'data' => $map]);
    }

    /** PUT /api/sesiones-grupo/estado */
    public function updateEstado(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['id', 'estado']);
        SesionGrupo::updateEstado((int) $data['id'], $data['estado']);
        Response::json(['success' => true]);
    }

    /** PUT /api/vinculo/proceso */
    public function updateProceso(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['id']);
        
        AtencionVinculada::updateProcesoData((int) $data['id'], $data);
        Response::json(['success' => true, 'message' => 'Datos clínicos del proceso actualizados']);
    }

    /** GET /api/vinculo/diagnosticos?vinculo_id=X */
    public function listDiagnosticos(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $vinculoId = (int) ($_GET['vinculo_id'] ?? 0);
        if (!$vinculoId) {
            Response::json(['success' => false, 'message' => 'vinculo_id requerido'], 400);
            return;
        }
        Response::json(['success' => true, 'data' => \Src\Models\Diagnostico::findByVinculo($vinculoId)]);
    }

    /** POST /api/vinculo/diagnosticos */
    public function addDiagnostico(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['vinculo_id', 'cie10_codigo', 'jerarquia', 'nivel_certeza']);
        
        $data['fecha_dx'] = date('Y-m-d');
        \Src\Models\Diagnostico::asignar($data);
        
        Response::json(['success' => true, 'message' => 'Diagnóstico agregado al proceso']);
    }

    /** DELETE /api/vinculo/diagnosticos?id=X */
    public function removeDiagnostico(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) {
            Response::json(['success' => false, 'message' => 'id requerido'], 400);
            return;
        }
        \Src\Models\Diagnostico::delete($id);
        Response::json(['success' => true, 'message' => 'Diagnóstico eliminado']);
    }
}
