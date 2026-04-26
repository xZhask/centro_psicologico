<?php
namespace Src\Controllers;

use Src\Core\Auth;
use Src\Core\Database;
use Src\Core\Response;
use Src\Core\Request;
use Src\Models\SesionArchivo;
use Src\Middleware\RoleMiddleware;

class ArchivoController {

    private const UPLOAD_ROLES = ['administrador', 'profesional'];

    /** GET /api/sesiones/archivos?sesion_id=X  o  ?sesion_grupo_id=X */
    public function index(): void {
        RoleMiddleware::handle(self::UPLOAD_ROLES);

        $sesionId      = isset($_GET['sesion_id'])       ? (int) $_GET['sesion_id']       : null;
        $sesionGrupoId = isset($_GET['sesion_grupo_id']) ? (int) $_GET['sesion_grupo_id'] : null;

        if (!$sesionId && !$sesionGrupoId) {
            Response::json(['success' => false, 'message' => 'sesion_id o sesion_grupo_id requerido'], 400);
            return;
        }

        $archivos = SesionArchivo::findBySesion($sesionId, $sesionGrupoId);
        Response::json(['success' => true, 'data' => $archivos]);
    }

    /** POST /api/sesiones/archivos  (multipart/form-data) */
    public function store(Request $request): void {
        RoleMiddleware::handle(self::UPLOAD_ROLES);

        $sesionId      = !empty($_POST['sesion_id'])       ? (int) $_POST['sesion_id']       : null;
        $sesionGrupoId = !empty($_POST['sesion_grupo_id']) ? (int) $_POST['sesion_grupo_id'] : null;

        if (!$sesionId && !$sesionGrupoId) {
            Response::json(['success' => false, 'message' => 'sesion_id o sesion_grupo_id requerido'], 400);
            return;
        }

        if (empty($_FILES['archivo']) || $_FILES['archivo']['error'] !== UPLOAD_ERR_OK) {
            $errCode = $_FILES['archivo']['error'] ?? -1;
            Response::json(['success' => false, 'message' => "Error de subida (código {$errCode})"], 400);
            return;
        }

        $user    = Auth::user();
        $archivo = SesionArchivo::subir($_FILES['archivo'], $sesionId, $sesionGrupoId, (int) $user['id']);

        if ($archivo === false) {
            Response::json([
                'success' => false,
                'message' => 'Archivo rechazado. Verifica el tipo (PDF/imagen), el tamaño (máx. 10 MB) y que no supere el límite de 5 archivos por sesión.',
            ], 422);
            return;
        }

        Response::json(['success' => true, 'data' => $archivo, 'message' => 'Archivo subido']);
    }

    /** GET /api/archivos/descargar?id=X */
    public function descargar(): void {
        RoleMiddleware::handle(['administrador', 'profesional', 'paciente']);

        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) {
            Response::json(['success' => false, 'message' => 'id requerido'], 400);
            return;
        }

        $registro = SesionArchivo::findById($id);
        if (!$registro) {
            Response::json(['success' => false, 'message' => 'Archivo no encontrado'], 404);
            return;
        }

        $user = Auth::user();

        // Admins acceden a todo; profesionales solo si subieron el archivo o atienden la sesión
        if ($user['rol'] === 'profesional') {
            if ((int) $registro['subido_por'] !== (int) $user['id'] && !$this->profesionalTieneAcceso($registro, $user)) {
                Response::json(['success' => false, 'message' => 'No autorizado'], 403);
                return;
            }
        }

        $ruta = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'sesiones' . DIRECTORY_SEPARATOR . $registro['nombre_guardado'];

        if (!file_exists($ruta)) {
            Response::json(['success' => false, 'message' => 'Archivo no encontrado en disco'], 404);
            return;
        }

        header('Content-Type: '        . $registro['tipo_mime']);
        header('Content-Disposition: attachment; filename="' . addslashes($registro['nombre_original']) . '"');
        header('Content-Length: '      . $registro['tamano_bytes']);
        header('Cache-Control: private, no-cache');
        readfile($ruta);
        exit;
    }

    /** DELETE /api/sesiones/archivos  body: { id } */
    public function eliminar(Request $request): void {
        RoleMiddleware::handle(self::UPLOAD_ROLES);

        $data = $request->json();
        $id   = (int) ($data['id'] ?? 0);
        if (!$id) {
            Response::json(['success' => false, 'message' => 'id requerido'], 400);
            return;
        }

        $registro = SesionArchivo::findById($id);
        if (!$registro) {
            Response::json(['success' => false, 'message' => 'Archivo no encontrado'], 404);
            return;
        }

        $user = Auth::user();
        if ($user['rol'] === 'profesional' && (int) $registro['subido_por'] !== (int) $user['id']) {
            Response::json(['success' => false, 'message' => 'Solo puede eliminar archivos que usted subió'], 403);
            return;
        }

        SesionArchivo::eliminar($id);
        Response::json(['success' => true, 'message' => 'Archivo eliminado']);
    }

    private function profesionalTieneAcceso(array $registro, array $user): bool {
        if ($registro['sesion_id']) {
            $row = Database::query(
                "SELECT a.profesional_id
                 FROM sesiones s
                 JOIN atenciones a ON a.id = s.atencion_id
                 JOIN profesionales pr ON pr.id = a.profesional_id
                 WHERE s.id = ? AND pr.persona_id = ?",
                [$registro['sesion_id'], $user['persona_id']]
            )->fetch();
            return (bool) $row;
        }

        if ($registro['sesion_grupo_id']) {
            $row = Database::query(
                "SELECT 1
                 FROM sesiones_grupo sg
                 JOIN atenciones_vinculadas av ON av.id = sg.vinculo_id
                 JOIN atencion_vinculo_detalle avd ON avd.vinculo_id = av.id
                 JOIN atenciones a ON a.id = avd.atencion_id
                 JOIN profesionales pr ON pr.id = a.profesional_id
                 WHERE sg.id = ? AND pr.persona_id = ?
                 LIMIT 1",
                [$registro['sesion_grupo_id'], $user['persona_id']]
            )->fetch();
            return (bool) $row;
        }

        return false;
    }
}
