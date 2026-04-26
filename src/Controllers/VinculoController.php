<?php
namespace Src\Controllers;

use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Core\Auth;
use Src\Models\AtencionVinculada;
use Src\Models\SesionGrupo;
use Src\Middleware\RoleMiddleware;

class VinculoController {

    private const ALLOWED = ['administrador', 'profesional'];

    // ----------------------------------------------------------------
    // Vínculos grupales
    // ----------------------------------------------------------------

    /** GET /api/vinculos */
    public function index(): void {
        RoleMiddleware::handle(self::ALLOWED);
        Response::json(['success' => true, 'data' => AtencionVinculada::findAll()]);
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

        $vinculo['participantes']  = AtencionVinculada::findParticipantes($id);
        $vinculo['sesiones_grupo'] = SesionGrupo::findByVinculo($id);

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

        $data['nota_privada_p1'] = !empty($data['nota_privada_p1']) ? trim($data['nota_privada_p1']) : null;
        $data['nota_privada_p2'] = !empty($data['nota_privada_p2']) ? trim($data['nota_privada_p2']) : null;
        $data['nota_privada_p3'] = !empty($data['nota_privada_p3']) ? trim($data['nota_privada_p3']) : null;

        $fechaHora = $data['fecha_hora'] ?? date('Y-m-d H:i:s');
        $data['fecha_hora'] = $fechaHora;

        $sgId = SesionGrupo::create($data);
        SesionGrupo::crearEspejos(
            (int) $data['vinculo_id'],
            $fechaHora,
            isset($data['duracion_min']) ? (int) $data['duracion_min'] : null
        );
        Response::json(['success' => true, 'data' => ['id' => $sgId], 'message' => 'Sesión grupal registrada']);
    }

    /** PUT /api/sesiones-grupo/nota */
    public function updateNota(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['id']);

        $np1 = !empty($data['nota_privada_p1']) ? trim($data['nota_privada_p1']) : null;
        $np2 = !empty($data['nota_privada_p2']) ? trim($data['nota_privada_p2']) : null;
        $np3 = !empty($data['nota_privada_p3']) ? trim($data['nota_privada_p3']) : null;

        SesionGrupo::updateNota(
            (int) $data['id'],
            $data['nota_clinica_compartida'] ?? null,
            $np1,
            $np2,
            $np3
        );
        Response::json(['success' => true]);
    }

    /** PUT /api/sesiones-grupo/estado */
    public function updateEstado(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['id', 'estado']);
        SesionGrupo::updateEstado((int) $data['id'], $data['estado']);
        Response::json(['success' => true]);
    }
}
