<?php
require 'vendor/autoload.php';
require 'config/config.php';

use Src\Core\Database;

try {
    $res = Database::query("SELECT t.*, s.atencion_id FROM tareas t JOIN sesiones s ON s.id = t.sesion_id");
    $rows = $res->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($rows, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
