<?php
require 'vendor/autoload.php';
// Cargar variables de entorno si es necesario, o definir constantes
define('DB_HOST', 'localhost');
define('DB_NAME', 'centro_psicologico');
define('DB_USER', 'root');
define('DB_PASS', '');

// Simular el núcleo si es necesario o simplemente usar PDO
try {
    $pdo = new PDO("mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $stmt = $pdo->query("SELECT t.*, s.atencion_id FROM tareas t JOIN sesiones s ON s.id = t.sesion_id");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($rows, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
