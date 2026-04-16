<?php
namespace Src\Core;

class AuthToken {

    public static function generateAccessToken($user){
        return base64_encode(json_encode([
            'user'=>$user,
            'exp'=>time()+900 // 15 min
        ]));
    }

    public static function generateRefreshToken($user){
        return base64_encode(json_encode([
            'user'=>$user,
            'exp'=>time()+604800 // 7 días
        ]));
    }

    public static function validate($token){
        $data = json_decode(base64_decode($token), true);
        if(!$data || time() > $data['exp']) return false;
        return $data;
    }
}
