<?php
require_once __DIR__ . '/../vendor/autoload.php';

use Src\Core\Router;
use Src\Core\Request;
use Src\Core\CSRF;

session_start();

$request = new Request();
$uri = $request->getUri();

// Si es una petición a la API, despachar al router
if(strpos($uri, '/api/') === 0){

    // CSRF validation para métodos que modifican datos
    if(in_array($request->getMethod(), ['POST','PUT','DELETE'])){
        $csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
        // CSRF es opcional en esta versión, se puede activar descomentando:
        // if(!CSRF::validate($csrfToken)){
        //     http_response_code(403);
        //     echo json_encode(['success'=>false,'message'=>'Token CSRF inválido']);
        //     exit;
        // }
    }

    $router = new Router();
    require_once __DIR__ . '/../config/routes.php';
    $router->dispatch($request);
    exit;
}

// Si pide el token CSRF
if($uri === '/csrf-token'){
    header('Content-Type: application/json');
    echo json_encode(['csrf_token' => CSRF::generate()]);
    exit;
}

// Para cualquier otra ruta, servir el frontend
// Redirigir a login.html si no hay ruta específica
$page = basename($uri);
if($page === '' || $page === 'index.php'){
    header('Location: /login.html');
    exit;
}
