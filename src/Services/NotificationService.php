<?php
namespace Src\Services;

use Src\Models\Cita;
use Src\Models\Paciente;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;
use Twilio\Rest\Client;
use Src\Core\Database;

class NotificationService {

    public static function enviarCorreoNuevaCita(int $citaId): void {
        self::enviarCorreoCita($citaId, 'nueva');
    }

    public static function enviarCorreoCitaReprogramada(int $citaId): void {
        self::enviarCorreoCita($citaId, 'reprogramada');
    }

    private static function enviarCorreoCita(int $citaId, string $tipo): void {
        try {
            $cita = Cita::findById($citaId);
            if (!$cita) return;

            $paciente = Paciente::findById($cita['paciente_id']);
            if (!$paciente || empty($paciente['email'])) return;

            $mail = self::getConfiguredMailer();
            $mail->addAddress($paciente['email'], $paciente['nombres'] . ' ' . $paciente['apellidos']);

            if ($tipo === 'nueva') {
                $mail->Subject = 'Confirmación de Cita - Centro Psicológico';
                $cuerpo = "Hola {$paciente['nombres']},\n\nTu cita ha sido agendada con éxito.\n";
            } else {
                $mail->Subject = 'Reprogramación de Cita - Centro Psicológico';
                $cuerpo = "Hola {$paciente['nombres']},\n\nTu cita ha sido reprogramada.\n";
            }

            $cuerpo .= "Profesional: {$cita['profesional']}\n";
            $cuerpo .= "Servicio: {$cita['subservicio']}\n";
            $cuerpo .= "Fecha y Hora: {$cita['fecha_hora_inicio']}\n";
            $cuerpo .= "Modalidad: {$cita['modalidad_sesion']}\n\n";
            $cuerpo .= "¡Te esperamos!";

            $mail->Body = $cuerpo;
            $mail->send();
        } catch (\Throwable $e) {
            error_log("Error enviando correo de cita $citaId: " . $e->getMessage());
        }
    }

    public static function enviarWhatsAppRecordatorio(int $citaId): bool {
        try {
            $cita = Cita::findById($citaId);
            if (!$cita) return false;

            $paciente = Paciente::findById($cita['paciente_id']);
            if (!$paciente || empty($paciente['telefono'])) return false;

            $telefono = self::formatPhoneNumber($paciente['telefono']);
            
            $sid    = $_ENV['TWILIO_SID'] ?? '';
            $token  = $_ENV['TWILIO_TOKEN'] ?? '';
            $from   = $_ENV['TWILIO_WHATSAPP_FROM'] ?? '';

            if (!$sid || !$token || !$from) {
                error_log("Twilio no está configurado.");
                return false;
            }

            $twilio = new Client($sid, $token);

            $mensaje = "Hola {$paciente['nombres']}. Te recordamos que tienes una cita mañana en Centro Psicológico.\n";
            $mensaje .= "Profesional: {$cita['profesional']}\n";
            $mensaje .= "Hora: " . date('H:i', strtotime($cita['fecha_hora_inicio'])) . "\n";
            $mensaje .= "Por favor, confirma tu asistencia.";

            $twilio->messages->create(
                "whatsapp:" . $telefono,
                [
                    "from" => "whatsapp:" . $from,
                    "body" => $mensaje
                ]
            );

            // Marcar como enviado
            Database::query("UPDATE citas SET recordatorio_enviado = 1 WHERE id = ?", [$citaId]);
            return true;
        } catch (\Throwable $e) {
            error_log("Error enviando WhatsApp recordatorio a cita $citaId: " . $e->getMessage());
            return false;
        }
    }

    private static function getConfiguredMailer(): PHPMailer {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host       = $_ENV['SMTP_HOST'] ?? '';
        $mail->SMTPAuth   = true;
        $mail->Username   = $_ENV['SMTP_USER'] ?? '';
        $mail->Password   = $_ENV['SMTP_PASS'] ?? '';
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = $_ENV['SMTP_PORT'] ?? 587;
        
        // Charset and formatting
        $mail->CharSet = 'UTF-8';

        $fromEmail = $_ENV['SMTP_FROM_EMAIL'] ?? 'no-reply@centro.com';
        $fromName  = $_ENV['SMTP_FROM_NAME'] ?? 'Centro Psicológico';
        $mail->setFrom($fromEmail, $fromName);

        return $mail;
    }

    private static function formatPhoneNumber(string $phone): string {
        $phone = preg_replace('/[^0-9]/', '', $phone);
        if (strlen($phone) === 9 && strpos($phone, '9') === 0) {
            return '+51' . $phone; // Default to Peru if 9 digits starting with 9
        }
        return '+' . $phone;
    }
}
