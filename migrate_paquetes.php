<?php

require_once __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

use Src\Core\Database;

try {
    echo "Iniciando migración...\n";

    // 1. Alterar tabla
    echo "Agregando atencion_id a paciente_paquetes...\n";
    // Database::query("
    //    ALTER TABLE paciente_paquetes 
    //    ADD COLUMN atencion_id INT UNSIGNED NULL AFTER profesional_id;
    // ");

    // Database::query("
    //    ALTER TABLE paciente_paquetes 
    //    ADD CONSTRAINT fk_paquetes_atencion 
    //    FOREIGN KEY (atencion_id) REFERENCES atenciones(id) ON DELETE SET NULL;
    // ");
    echo "Columna agregada.\n";

    // 2. Migrar históricos basándonos en las sesiones
    echo "Migrando históricos...\n";
    Database::query("
        UPDATE paciente_paquetes pp
        JOIN (
            SELECT paciente_paquete_id, MIN(atencion_id) as atencion_id
            FROM sesiones
            WHERE paciente_paquete_id IS NOT NULL
            GROUP BY paciente_paquete_id
        ) s_first ON s_first.paciente_paquete_id = pp.id
        SET pp.atencion_id = s_first.atencion_id
        WHERE pp.atencion_id IS NULL;
    ");
    echo "Históricos migrados exitosamente.\n";

} catch (\Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
