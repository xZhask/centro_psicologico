<?php
namespace Src\Controllers;

use PDO;
use Src\Core\Database;
use Src\Core\Response;
use Src\Core\Auth;
use Src\Core\CSRF;
use Src\Core\Request;

class AuthController {

    public function login(Request $request): void {

        $dni      = $request->input('dni');
        $password = $request->input('password');

        $user = Database::query("
            SELECT u.id, u.persona_id, u.rol, u.activo,
                   u.debe_cambiar_password, u.ultimo_acceso,
                   u.password_hash,
                   p.nombres, p.apellidos, p.email, p.dni
            FROM usuarios u
            JOIN personas p ON p.id = u.persona_id
            WHERE p.dni = ?
              AND u.activo = 1
        ", [$dni])->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($password, $user['password_hash'])) {
            Response::json([
                'success' => false,
                'message' => 'Credenciales incorrectas'
            ], 401);
        }

        unset($user['password_hash']);
        Auth::login($user);

        Response::json([
            'success' => true,
            'data'    => $user
        ]);
    }

    public function me(Request $request): void {
        $user = Auth::user();

        if (!$user) {
            Response::json(['success' => false, 'message' => 'No autenticado'], 401);
        }

        Response::json(['success' => true, 'data' => $user, 'csrf' => CSRF::generate()]);
    }

    public function logout(Request $request): void {
        Auth::logout();

        Response::json(['success' => true]);
    }
}
