<?php
/**
 * Script para ejecutarse mediante Cron (CLI).
 * Ejemplo Crontab:
 * */30 * * * * /usr/bin/php /ruta/al/proyecto/cron/send_reminders.php
 */

require_once __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../');
$dotenv->load();

require_once __DIR__ . '/../src/Core/Database.php';

use Src\Core\Database;
use Src\Services\NotificationService;

// Buscar citas dentro de las próximas 24 horas y que no se haya enviado recordatorio
$sql = "
    SELECT id, fecha_hora_inicio
    FROM citas
    WHERE estado IN ('pendiente', 'confirmada')
      AND recordatorio_enviado = 0
      AND fecha_hora_inicio >= NOW()
      AND fecha_hora_inicio <= DATE_ADD(NOW(), INTERVAL 24 HOUR)
";

try {
    $citas = Database::query($sql)->fetchAll();
    $count = 0;

    foreach ($citas as $cita) {
        $enviado = NotificationService::enviarWhatsAppRecordatorio((int)$cita['id']);
        if ($enviado) {
            $count++;
        }
        // Pequeño delay para no saturar la API de Twilio
        usleep(500000); 
    }

    echo "Proceso terminado. Se enviaron $count recordatorios de WhatsApp.\n";
} catch (\Exception $e) {
    error_log("Error en cron/send_reminders.php: " . $e->getMessage());
    echo "Error: " . $e->getMessage() . "\n";
}
