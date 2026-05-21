<?php
require_once __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

require_once __DIR__ . '/src/Core/Database.php';

use Src\Core\Database;

try {
    Database::query("ALTER TABLE citas ADD COLUMN recordatorio_enviado TINYINT(1) DEFAULT 0");
    echo "Migración ejecutada con éxito.\n";
} catch (\Exception $e) {
    if (strpos($e->getMessage(), 'Duplicate column name') !== false) {
        echo "La columna ya existe.\n";
    } else {
        echo "Error: " . $e->getMessage() . "\n";
    }
}
