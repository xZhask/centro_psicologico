<?php
namespace Src\Controllers;

use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Core\Database;
use Src\Models\TallerInstitucional;
use Src\Models\TallerFecha;
use Src\Models\Cita;
use Src\Middleware\RoleMiddleware;

class TallerController {

    private const ALLOWED       = ['administrador', 'profesional'];
    private const SOLO_ADMIN    = ['administrador'];

    // ----------------------------------------------------------------
    // GET /api/talleres
    // El profesional ve solo los suyos; el admin los ve todos.
    // ----------------------------------------------------------------
    public function index(): void {
        RoleMiddleware::handle(self::ALLOWED);

        $rol  = $_SESSION['user']['rol'] ?? '';
        $profId = null;

        if ($rol === 'profesional') {
            $profId = (int) ($_SESSION['user']['profesional_id'] ?? 0) ?: null;
        } elseif (!empty($_GET['profesional_id'])) {
            $profId = (int) $_GET['profesional_id'];
        }

        Response::json([
            'success' => true,
            'data'    => TallerInstitucional::findAll($profId),
        ]);
    }

    // ----------------------------------------------------------------
    // GET /api/taller?id=X
    // ----------------------------------------------------------------
    public function show(): void {
        RoleMiddleware::handle(self::ALLOWED);

        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) {
            Response::json(['success' => false, 'message' => 'id requerido'], 400);
            return;
        }

        $taller = TallerInstitucional::findById($id);
        if (!$taller) {
            Response::json(['success' => false, 'message' => 'Taller no encontrado'], 404);
            return;
        }

        // Profesional solo puede ver sus propios talleres
        if (($_SESSION['user']['rol'] ?? '') === 'profesional') {
            $profId = (int) ($_SESSION['user']['profesional_id'] ?? 0);
            if ((int) $taller['profesional_id'] !== $profId) {
                Response::json(['success' => false, 'message' => 'Acceso denegado'], 403);
                return;
            }
        }

        Response::json(['success' => true, 'data' => $taller]);
    }

    // ----------------------------------------------------------------
    // POST /api/talleres
    // ----------------------------------------------------------------
    public function store(Request $request): void {
        RoleMiddleware::handle(self::SOLO_ADMIN);

        $data = $request->json();
        Validator::required($data, [
            'profesional_id', 'subservicio_id', 'tema',
            'precio_acordado', 'porcentaje_prof',
        ]);

        $fechas = $data['fechas'] ?? [];
        if (empty($fechas)) {
            Response::json([
                'success' => false,
                'message' => 'Debe ingresar al menos una fecha para el taller',
            ], 422);
            return;
        }

        // Validar cruce de horario para cada fecha
        foreach ($fechas as $i => $f) {
            if (empty($f['fecha_hora']) || empty($f['duracion_min'])) {
                Response::json([
                    'success' => false,
                    'message' => "Fecha #" . ($i + 1) . ": fecha_hora y duracion_min son requeridos",
                ], 422);
                return;
            }
            if (Cita::existeCruce(
                (int) $data['profesional_id'],
                $f['fecha_hora'],
                (int) $f['duracion_min']
            )) {
                Response::json([
                    'success' => false,
                    'message' => "Fecha #" . ($i + 1) . " (" . $f['fecha_hora'] . "): el profesional ya tiene otro evento en ese horario",
                ], 409);
                return;
            }
        }

        $pdo = Database::getInstance();
        $pdo->beginTransaction();
        try {
            $tallerId = TallerInstitucional::create($data);
            TallerFecha::create($tallerId, $fechas);

            // Crear cuenta de cobro si el precio es mayor a cero
            if ((float) $data['precio_acordado'] > 0) {
                Database::query("
                    INSERT INTO cuentas_cobro
                        (taller_id, monto_total, concepto, estado, registrado_por)
                    VALUES (?, ?, ?, 'pendiente', ?)
                ", [
                    $tallerId,
                    (float) $data['precio_acordado'],
                    'Taller: ' . trim($data['tema']),
                    $_SESSION['user']['id'],
                ]);
            }

            $pdo->commit();
        } catch (\Exception $e) {
            $pdo->rollBack();
            Response::json(['success' => false, 'message' => 'Error al crear el taller: ' . $e->getMessage()], 500);
            return;
        }

        Response::json([
            'success' => true,
            'message' => 'Taller creado correctamente',
            'id'      => $tallerId,
        ], 201);
    }

    // ----------------------------------------------------------------
    // PUT /api/talleres
    // Body: { id, profesional_id, subservicio_id, tema, ... }
    // ----------------------------------------------------------------
    public function update(Request $request): void {
        RoleMiddleware::handle(self::SOLO_ADMIN);

        $data = $request->json();
        Validator::required($data, [
            'id', 'profesional_id', 'subservicio_id', 'tema',
            'precio_acordado', 'porcentaje_prof',
        ]);

        $id = (int) $data['id'];
        if (!TallerInstitucional::findById($id)) {
            Response::json(['success' => false, 'message' => 'Taller no encontrado'], 404);
            return;
        }

        $ok = TallerInstitucional::update($id, $data);
        Response::json([
            'success' => $ok,
            'message' => $ok ? 'Taller actualizado' : 'Sin cambios',
        ]);
    }

    // ----------------------------------------------------------------
    // PUT /api/talleres/estado
    // Body: { id, estado }
    // ----------------------------------------------------------------
    public function cambiarEstado(Request $request): void {
        RoleMiddleware::handle(self::SOLO_ADMIN);

        $data = $request->json();
        Validator::required($data, ['id', 'estado']);

        $estadosValidos = ['programado', 'realizado', 'cancelado'];
        if (!in_array($data['estado'], $estadosValidos, true)) {
            Response::json(['success' => false, 'message' => 'Estado inválido'], 422);
            return;
        }

        $ok = TallerInstitucional::cambiarEstado((int) $data['id'], $data['estado']);
        Response::json([
            'success' => $ok,
            'message' => $ok ? 'Estado actualizado' : 'Taller no encontrado',
        ]);
    }

    // ----------------------------------------------------------------
    // POST /api/talleres/fecha
    // Body: { taller_id, fecha_hora, duracion_min }
    // ----------------------------------------------------------------
    public function agregarFecha(Request $request): void {
        RoleMiddleware::handle(self::SOLO_ADMIN);

        $data = $request->json();
        Validator::required($data, ['taller_id', 'fecha_hora', 'duracion_min']);

        $tallerId   = (int) $data['taller_id'];
        $taller     = TallerInstitucional::findById($tallerId);
        if (!$taller) {
            Response::json(['success' => false, 'message' => 'Taller no encontrado'], 404);
            return;
        }

        if (Cita::existeCruce(
            (int) $taller['profesional_id'],
            $data['fecha_hora'],
            (int) $data['duracion_min']
        )) {
            Response::json([
                'success' => false,
                'message' => 'El profesional ya tiene otro evento en ese horario',
            ], 409);
            return;
        }

        TallerFecha::create($tallerId, [[
            'fecha_hora'   => $data['fecha_hora'],
            'duracion_min' => (int) $data['duracion_min'],
        ]]);

        Response::json(['success' => true, 'message' => 'Fecha agregada'], 201);
    }

    // ----------------------------------------------------------------
    // PUT /api/talleres/fecha
    // Body: { id, estado?, asistentes?, notas? }
    // ----------------------------------------------------------------
    public function actualizarFecha(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);

        $data = $request->json();
        Validator::required($data, ['id']);

        $id    = (int) $data['id'];
        $fecha = TallerFecha::findById($id);
        if (!$fecha) {
            Response::json(['success' => false, 'message' => 'Fecha no encontrada'], 404);
            return;
        }

        // Profesional solo puede actualizar fechas de sus propios talleres
        if (($_SESSION['user']['rol'] ?? '') === 'profesional') {
            $profId = (int) ($_SESSION['user']['profesional_id'] ?? 0);
            if ((int) $fecha['profesional_id'] !== $profId) {
                Response::json(['success' => false, 'message' => 'Acceso denegado'], 403);
                return;
            }
        }

        $campos = array_intersect_key($data, array_flip(['estado', 'asistentes', 'notas']));
        if (empty($campos)) {
            Response::json(['success' => false, 'message' => 'Nada que actualizar'], 422);
            return;
        }

        $ok = TallerFecha::update($id, $campos);
        Response::json([
            'success' => $ok,
            'message' => $ok ? 'Fecha actualizada' : 'Sin cambios',
        ]);
    }

    // ----------------------------------------------------------------
    // DELETE /api/talleres/fecha?id=X
    // ----------------------------------------------------------------
    public function eliminarFecha(): void {
        RoleMiddleware::handle(self::SOLO_ADMIN);

        $id = (int) ($_GET['id'] ?? 0);
        if (!$id) {
            Response::json(['success' => false, 'message' => 'id requerido'], 400);
            return;
        }

        $ok = TallerFecha::eliminar($id);
        if (!$ok) {
            Response::json([
                'success' => false,
                'message' => 'No se puede eliminar: la fecha no existe o ya fue realizada',
            ], 409);
            return;
        }

        Response::json(['success' => true, 'message' => 'Fecha eliminada']);
    }
}
