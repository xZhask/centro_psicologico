<?php
namespace Src\Controllers;

use Src\Core\Database;
use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\Apoderado;
use Src\Middleware\RoleMiddleware;

class ApoderadoController {

    private const ALLOWED = ['administrador', 'profesional'];

    // ----------------------------------------------------------------
    // GET /api/apoderados/buscar-dni?dni=X
    // Busca si ya existe una persona (y apoderado) con ese DNI.
    // Devuelve los datos para pre-rellenar el modal.
    // ----------------------------------------------------------------
    public function buscarDni(): void {
        RoleMiddleware::handle(self::ALLOWED);
        $dni = trim($_GET['dni'] ?? '');
        if (!$dni) {
            Response::json(['success' => false, 'message' => 'dni requerido'], 400);
            return;
        }

        $apo = Apoderado::findByDni($dni);
        if ($apo) {
            Response::json(['success' => true, 'data' => $apo]);
            return;
        }

        // Puede que sea persona pero no apoderado aún
        $persona = Database::query(
            "SELECT id AS persona_id, nombres, apellidos, telefono, email
             FROM personas WHERE dni = ?",
            [$dni]
        )->fetch();

        Response::json([
            'success' => $persona ? true : false,
            'data'    => $persona ?: null,
        ]);
    }

    // ----------------------------------------------------------------
    // GET /api/apoderados?paciente_id=X
    // ----------------------------------------------------------------
    public function index(): void {
        RoleMiddleware::handle(self::ALLOWED);

        $pacienteId = (int) ($_GET['paciente_id'] ?? 0);
        if (!$pacienteId) {
            Response::json(['success' => false, 'message' => 'paciente_id requerido'], 400);
            return;
        }

        Response::json([
            'success' => true,
            'data'    => Apoderado::findByPaciente($pacienteId),
        ]);
    }

    // ----------------------------------------------------------------
    // POST /api/apoderados
    // Crea (o reutiliza) un apoderado y lo vincula a un paciente.
    // Body: { paciente_id, parentesco, dni, nombres, apellidos,
    //         telefono?, email?,
    //         es_contacto_principal?, es_responsable_pago?,
    //         puede_ver_historial?, notas? }
    // Si el DNI ya existe en personas+apoderados, reutiliza el registro.
    // ----------------------------------------------------------------
    public function store(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();

        Validator::required($data, ['paciente_id', 'parentesco', 'dni', 'nombres', 'apellidos']);

        $pacienteId = (int) $data['paciente_id'];
        $dni        = trim($data['dni']);

        // Validar que el paciente existe
        $paciente = Database::query(
            "SELECT id FROM pacientes WHERE id = ?",
            [$pacienteId]
        )->fetch();
        if (!$paciente) {
            Response::json(['success' => false, 'message' => 'Paciente no encontrado'], 404);
            return;
        }

        // Buscar si ya existe un apoderado con ese DNI
        $existente = Apoderado::findByDni($dni);

        if ($existente) {
            $apoderadoId = (int) $existente['apoderado_id'];

            // Verificar que no esté ya vinculado a este paciente
            $yaVinculado = Database::query(
                "SELECT id FROM apoderado_paciente WHERE apoderado_id = ? AND paciente_id = ?",
                [$apoderadoId, $pacienteId]
            )->fetch();

            if ($yaVinculado) {
                Response::json([
                    'success' => false,
                    'message' => 'Este apoderado ya está vinculado al paciente',
                ], 409);
                return;
            }
        } else {
            // Crear nueva persona + apoderado
            $apoderadoId = Apoderado::create([
                'dni'      => $dni,
                'nombres'  => trim($data['nombres']),
                'apellidos'=> trim($data['apellidos']),
                'telefono' => !empty($data['telefono']) ? trim($data['telefono']) : null,
                'email'    => !empty($data['email'])    ? trim($data['email'])    : null,
            ]);
        }

        // Desvincular contacto principal si el nuevo será el principal
        $esContactoPrincipal = !empty($data['es_contacto_principal']) ? 1 : 0;

        $vinculoId = Apoderado::vincular($pacienteId, $apoderadoId, [
            'parentesco'            => $data['parentesco'],
            'es_contacto_principal' => $esContactoPrincipal,
            'es_responsable_pago'   => !empty($data['es_responsable_pago'])  ? 1 : 0,
            'puede_ver_historial'   => isset($data['puede_ver_historial'])
                                        ? (int) $data['puede_ver_historial'] : 1,
            'notas'                 => !empty($data['notas']) ? trim($data['notas']) : null,
        ]);

        if ($esContactoPrincipal) {
            Apoderado::desmarcarContactoPrincipal($pacienteId, $vinculoId);
        }

        Response::json([
            'success'   => true,
            'message'   => $existente ? 'Apoderado vinculado' : 'Apoderado creado y vinculado',
            'vinculo_id'=> $vinculoId,
        ], 201);
    }

    // ----------------------------------------------------------------
    // PUT /api/apoderados
    // Actualiza datos de persona y/o permisos del vínculo.
    // Body: { vinculo_id, [nombres, apellidos, telefono, email, dni,
    //          parentesco, es_contacto_principal, es_responsable_pago,
    //          puede_ver_historial, notas] }
    // ----------------------------------------------------------------
    public function update(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();

        Validator::required($data, ['vinculo_id']);

        $vinculoId = (int) $data['vinculo_id'];

        // Verificar que el vínculo existe
        $vinculo = Database::query(
            "SELECT ap.id, ap.paciente_id, ap.es_contacto_principal
             FROM apoderado_paciente ap WHERE ap.id = ?",
            [$vinculoId]
        )->fetch();

        if (!$vinculo) {
            Response::json(['success' => false, 'message' => 'Vínculo no encontrado'], 404);
            return;
        }

        // Si se está marcando como contacto principal, desmarcar los demás
        if (isset($data['es_contacto_principal']) && (int) $data['es_contacto_principal'] === 1) {
            Apoderado::desmarcarContactoPrincipal((int) $vinculo['paciente_id'], $vinculoId);
        }

        // Filtrar solo campos permitidos
        $camposPermitidos = [
            'nombres', 'apellidos', 'telefono', 'email', 'dni',
            'parentesco', 'es_contacto_principal', 'es_responsable_pago',
            'puede_ver_historial', 'notas',
        ];
        $payload = array_intersect_key($data, array_flip($camposPermitidos));

        if (empty($payload)) {
            Response::json(['success' => false, 'message' => 'No hay campos para actualizar'], 400);
            return;
        }

        Apoderado::update($vinculoId, $payload);
        Response::json(['success' => true, 'message' => 'Apoderado actualizado']);
    }

    // ----------------------------------------------------------------
    // DELETE /api/apoderados
    // Desvincula un apoderado de un paciente (no borra la persona).
    // Body: { vinculo_id }
    // ----------------------------------------------------------------
    public function delete(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();

        Validator::required($data, ['vinculo_id']);

        $vinculoId = (int) $data['vinculo_id'];

        $vinculo = Database::query(
            "SELECT id FROM apoderado_paciente WHERE id = ?",
            [$vinculoId]
        )->fetch();

        if (!$vinculo) {
            Response::json(['success' => false, 'message' => 'Vínculo no encontrado'], 404);
            return;
        }

        Apoderado::desvincular($vinculoId);
        Response::json(['success' => true, 'message' => 'Apoderado desvinculado']);
    }
}
