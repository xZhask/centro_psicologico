<?php
namespace Src\Core;

class Router {

    /** Rutas POST que no requieren sesión activa (y por tanto no tienen token CSRF). */
    private const CSRF_EXEMPT = ['/api/login'];

    private array $routes = [];

    public function get($uri, $action) {
        $this->routes['GET'][$uri] = $action;
    }

    public function post($uri, $action) {
        $this->routes['POST'][$uri] = $action;
    }

    public function put($uri, $action) {
        $this->routes['PUT'][$uri] = $action;
    }

    public function delete($uri, $action) {
        $this->routes['DELETE'][$uri] = $action;
    }

    public function dispatch(Request $request): void {

        $method = $request->getMethod();
        $uri    = $request->getUri();

        // Verificar token CSRF en toda petición de escritura que no sea pública
        if (in_array($method, ['POST', 'PUT', 'DELETE'], true)
            && !in_array($uri, self::CSRF_EXEMPT, true)
        ) {
            if (!CSRF::validate(CSRF::fromRequest())) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Token CSRF inválido o ausente']);
                return;
            }
        }

        if (!isset($this->routes[$method][$uri])) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Ruta no encontrada']);
            return;
        }

        [$controller, $methodName] = $this->routes[$method][$uri];

        try {
            (new $controller())->$methodName($request);
        } catch (\InvalidArgumentException $e) {
            // Errores de validación de inputs (Validator::required)
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        } catch (\Throwable $e) {
            // Cualquier error no anticipado — nunca exponer detalles al cliente
            error_log('[ERROR] ' . $e->getMessage() . ' en ' . $e->getFile() . ':' . $e->getLine());
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error interno del servidor']);
        }
    }
}
