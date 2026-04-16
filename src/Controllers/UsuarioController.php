<?php
namespace Src\Controllers;

use Src\Core\Auth;
use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\Usuario;
use Src\Middleware\RoleMiddleware;

class UsuarioController {

    private const ADMIN_ONLY = ['administrador'];
    private const ROLES_VALIDOS = ['administrador', 'profesional', 'paciente'];

    // ----------------------------------------------------------------
    // GET /api/usuarios
    // ----------------------------------------------------------------
    public function index(): void {
        RoleMiddleware::handle(self::ADMIN_ONLY);
        Response::json(['success' => true, 'data' => Usuario::findAll()]);
    }

    // ----------------------------------------------------------------
    // POST /api/usuarios
    // Body: { dni, nombres, apellidos, rol, password,
    //         email?, telefono? }
    // ----------------------------------------------------------------
    public function store(Request $request): void {
        RoleMiddleware::handle(self::ADMIN_ONLY);
        $data = $request->json();

        Validator::required($data, ['dni', 'nombres', 'apellidos', 'rol', 'password']);

        if (!in_array($data['rol'], self::ROLES_VALIDOS, true)) {
            Response::json(['success' => false, 'message' => 'Rol inválido'], 422);
            return;
        }

        if (strlen($data['password']) < 6) {
            Response::json([
                'success' => false,
                'message' => 'La contraseña debe tener al menos 6 caracteres',
            ], 422);
            return;
        }

        try {
            $id = Usuario::create($data);
            Response::json([
                'success' => true,
                'message' => 'Usuario creado. Deberá cambiar su contraseña en el primer acceso.',
                'id'      => $id,
            ], 201);
        } catch (\PDOException $e) {
            // Entrada duplicada (DNI o email únicos)
            if ($e->getCode() === '23000') {
                Response::json([
                    'success' => false,
                    'message' => 'El DNI o email ya está registrado en el sistema',
                ], 409);
                return;
            }
            throw $e;
        }
    }

    // ----------------------------------------------------------------
    // PUT /api/usuarios/rol
    // Body: { usuario_id, rol }
    // ----------------------------------------------------------------
    public function updateRol(Request $request): void {
        RoleMiddleware::handle(self::ADMIN_ONLY);
        $data = $request->json();

        Validator::required($data, ['usuario_id', 'rol']);

        if (!in_array($data['rol'], self::ROLES_VALIDOS, true)) {
            Response::json(['success' => false, 'message' => 'Rol inválido'], 422);
            return;
        }

        // Un admin no puede quitarse a sí mismo el rol de administrador
        if ((int) $data['usuario_id'] === (int) Auth::user()['id'] &&
            $data['rol'] !== 'administrador') {
            Response::json([
                'success' => false,
                'message' => 'No puede cambiar su propio rol de administrador',
            ], 409);
            return;
        }

        $ok = Usuario::updateRol((int) $data['usuario_id'], $data['rol']);
        if (!$ok) {
            Response::json(['success' => false, 'message' => 'Usuario no encontrado'], 404);
            return;
        }
        Response::json(['success' => true, 'message' => 'Rol actualizado']);
    }

    // ----------------------------------------------------------------
    // PUT /api/usuarios/estado
    // Body: { usuario_id }
    // ----------------------------------------------------------------
    public function toggleEstado(Request $request): void {
        RoleMiddleware::handle(self::ADMIN_ONLY);
        $data = $request->json();

        Validator::required($data, ['usuario_id']);

        // No puede desactivarse a sí mismo
        if ((int) $data['usuario_id'] === (int) Auth::user()['id']) {
            Response::json([
                'success' => false,
                'message' => 'No puede desactivar su propia cuenta',
            ], 409);
            return;
        }

        $ok = Usuario::toggleActivo((int) $data['usuario_id']);
        if (!$ok) {
            Response::json(['success' => false, 'message' => 'Usuario no encontrado'], 404);
            return;
        }
        Response::json(['success' => true, 'message' => 'Estado actualizado']);
    }

    // ----------------------------------------------------------------
    // PUT /api/usuarios/cambiar-password
    // Body: { password_actual, password_nuevo }
    // Disponible para cualquier usuario autenticado (auto-servicio).
    // ----------------------------------------------------------------
    public function cambiarPassword(Request $request): void {
        if (!Auth::check()) {
            Response::json(['success' => false, 'message' => 'No autenticado'], 401);
            return;
        }

        $data = $request->json();
        Validator::required($data, ['password_actual', 'password_nuevo']);

        if (strlen($data['password_nuevo']) < 6) {
            Response::json([
                'success' => false,
                'message' => 'La nueva contraseña debe tener al menos 6 caracteres',
            ], 422);
            return;
        }

        $userId = (int) Auth::user()['id'];

        // Verificar contraseña actual
        $row = \Src\Core\Database::query(
            "SELECT password_hash FROM usuarios WHERE id = ?",
            [$userId]
        )->fetch();

        if (!$row || !password_verify($data['password_actual'], $row['password_hash'])) {
            Response::json(['success' => false, 'message' => 'Contraseña actual incorrecta'], 401);
            return;
        }

        Usuario::cambiarPassword($userId, $data['password_nuevo']);

        // Limpiar el flag en la sesión activa
        if (isset($_SESSION['user'])) {
            $_SESSION['user']['debe_cambiar_password'] = 0;
        }

        Response::json(['success' => true, 'message' => 'Contraseña actualizada correctamente']);
    }
}
