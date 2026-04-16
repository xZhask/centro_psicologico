<?php
namespace Src\Middleware;

use Src\Core\Auth;
use Src\Core\Response;

class RoleMiddleware {

    /**
     * Verifica que exista sesión activa y que el rol del usuario
     * esté en la lista de roles permitidos.
     * Termina la ejecución con 401/403 si no se cumple.
     *
     * @param string[] $roles  Roles que tienen acceso al endpoint.
     */
    public static function handle(array $roles): void {
        if (!Auth::check()) {
            Response::json(['success' => false, 'message' => 'No autenticado'], 401);
        }

        $userRole = Auth::user()['rol'] ?? '';

        if (!in_array($userRole, $roles, true)) {
            Response::json(['success' => false, 'message' => 'No autorizado'], 403);
        }
    }
}
