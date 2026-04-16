<?php
namespace Src\Core;

class Auth {

    public static function login($user): void {
        $_SESSION['user'] = $user;
        unset($_SESSION['csrf']); // fuerza un token CSRF fresco tras el login
        session_regenerate_id(true);
    }

    public static function user() {
        return $_SESSION['user'] ?? null;
    }

    public static function check(): bool {
        return isset($_SESSION['user']);
    }

    public static function logout() {
        session_destroy();
    }

    public static function hasRole($role): bool {
        return self::user()['rol'] === $role;
    }
}
