<?php
namespace Src\Middleware;

use Src\Core\Auth;
use Src\Core\Response;

/*class AuthMiddleware {

    public static function handle() {
        if (!Auth::check()) {
            Response::json([
                'success'=>false,
                'message'=>'No autenticado'
            ],401);
        }
    }
}*/
class AuthMiddleware {
    public static function handle(){
        if(!isset($_SESSION['user'])){
            Response::json(['success'=>false,'message'=>'No autenticado'],401);
        }
    }
}

