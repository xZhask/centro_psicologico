<?php
namespace Src\Core;

class CSRF {

    public static function generate(){
        if(empty($_SESSION['csrf'])){
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf'];
    }

    public static function validate($token): bool {
        return isset($_SESSION['csrf'])
            && is_string($token)
            && $token !== ''
            && hash_equals($_SESSION['csrf'], $token);
    }

    /** Lee el token enviado por el cliente en el header HTTP. */
    public static function fromRequest(): string {
        return $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    }
}
