<?php
namespace Src\Core;

class Request {

    public function getMethod(): string {
        return $_SERVER['REQUEST_METHOD'];
    }

    public function getUri(): string {
        return parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    }

    public function input($key, $default = null) {
        if (isset($_POST[$key])) return $_POST[$key];
        if (isset($_GET[$key]))  return $_GET[$key];

        // Leer cuerpo JSON si el Content-Type es application/json
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (str_contains($contentType, 'application/json')) {
            $body = $this->json();
            if (isset($body[$key])) return $body[$key];
        }

        return $default;
    }

    public function all(): array {
        return $_REQUEST;
    }

    public function json(): array {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
}
