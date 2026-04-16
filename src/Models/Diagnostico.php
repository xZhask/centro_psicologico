<?php
namespace Src\Models;
use Src\Core\Database;

class Diagnostico {

    public static function asignar($data){
        Database::query("
            INSERT INTO diagnosticos_atencion
            (atencion_id, cie10_codigo, tipo, fecha_dx, registrado_por)
            VALUES (?,?,?,?,?)
        ",[
            $data['atencion_id'],
            $data['cie10_codigo'],
            $data['tipo'],
            $data['fecha_dx'],
            $_SESSION['user']['id']
        ]);
    }
}
