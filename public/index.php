<?php

// ── Bootstrap: autoloader + variables de entorno ────────────────
require_once __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../');
$dotenv->load();

// ── Configuración de errores PHP ────────────────────────────────
$appDebug = filter_var($_ENV['APP_DEBUG'] ?? false, FILTER_VALIDATE_BOOLEAN);

if ($appDebug) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
    error_reporting(E_ALL);
}

ini_set('log_errors', '1');
$logPath = $_ENV['APP_LOG_PATH'] ?? '../logs/php_errors.log';
ini_set('error_log', __DIR__ . '/' . $logPath);

// ── Resto del front-controller ───────────────────────────────────
use Src\Core\Router;
use Src\Core\Request;
use Src\Core\CSRF;

session_start();

$request = new Request();
$uri = $request->getUri();

// Si es una petición a la API, despachar al router
if (strpos($uri, '/api/') === 0) {

    $router = new Router();
    require_once __DIR__ . '/../config/routes.php';
    $router->dispatch($request);
    exit;
}

// Si pide el token CSRF
if ($uri === '/csrf-token') {
    header('Content-Type: application/json');
    echo json_encode(['csrf_token' => CSRF::generate()]);
    exit;
}

// Para cualquier otra ruta, servir el frontend
$page = basename($uri);
if ($page === '' || $page === 'index.php') {
    header('Location: /login.html');
    exit;
}
