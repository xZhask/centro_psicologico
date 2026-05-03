<?php
namespace Src\Controllers;

use Src\Core\Database;
use Src\Core\Response;
use Src\Middleware\RoleMiddleware;

class PersonaController {

    private const ALLOWED   = ['administrador', 'profesional'];
    private const API_TOKEN  = 'e49fddfa2a41c2c2f26d48840f7d81a66dc78dc2b0e085742a883f0ab0f84158';
    private const API_BASE   = 'https://apiperu.dev/api/dni';

    // ----------------------------------------------------------------
    // GET /api/personas/buscar-dni?dni=X
    // 1. Busca en BD local (personas)
    // 2. Si no existe, consulta la API externa (apiperu.dev)
    // 3. Si tampoco existe en la API → posible menor de edad u otro caso
    // ----------------------------------------------------------------
    public function buscarDni(): void {
        RoleMiddleware::handle(self::ALLOWED);

        $dni = trim($_GET['dni'] ?? '');
        if (!$dni || !preg_match('/^\d{7,15}$/', $dni)) {
            Response::json(['success' => false, 'message' => 'DNI inválido'], 400);
            return;
        }

        // 1. Buscar en la base de datos local
        $persona = Database::query(
            "SELECT id AS persona_id, nombres, apellidos, telefono, email, fecha_nacimiento, sexo
             FROM personas WHERE dni = ?",
            [$dni]
        )->fetch();

        if ($persona) {
            Response::json([
                'success' => true,
                'source'  => 'local',
                'data'    => $persona,
            ]);
            return;
        }

        // 2. Consultar la API externa
        $apiData = $this->consultarApi($dni);

        if ($apiData !== null) {
            $nombres   = ucwords(strtolower(trim($apiData['nombres'] ?? '')));
            $paterno   = ucwords(strtolower(trim($apiData['apellido_paterno'] ?? '')));
            $materno   = ucwords(strtolower(trim($apiData['apellido_materno'] ?? '')));
            $apellidos = trim($paterno . ($materno ? ' ' . $materno : ''));

            Response::json([
                'success' => true,
                'source'  => 'api',
                'data'    => [
                    'persona_id'       => null,
                    'nombres'          => $nombres,
                    'apellidos'        => $apellidos,
                    'telefono'         => null,
                    'email'            => null,
                    'fecha_nacimiento' => null,
                    'sexo'             => null,
                ],
            ]);
            return;
        }

        // 3. No encontrado (posible menor de edad — RENIEC no comparte sus datos)
        Response::json([
            'success' => false,
            'source'  => 'not_found',
            'message' => 'No se encontraron datos para este DNI.',
        ]);
    }

    private function consultarApi(string $dni): ?array {
        $url = self::API_BASE . '/' . rawurlencode($dni) . '?api_token=' . self::API_TOKEN;
        $ch  = curl_init($url);

        // Detectar CA bundle: php.ini → rutas conocidas de Laragon → sin verificación
        $caInfo = ini_get('curl.cainfo') ?: null;
        if (!$caInfo) {
            $candidatos = [
                'C:/laragon/etc/ssl/cacert.pem',
                dirname(__DIR__, 2) . '/cacert.pem',
            ];
            foreach ($candidatos as $ruta) {
                if (file_exists($ruta)) { $caInfo = $ruta; break; }
            }
        }

        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
            CURLOPT_HTTPAUTH       => CURLAUTH_ANY,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_SSL_VERIFYPEER => (bool) $caInfo,
            CURLOPT_SSL_VERIFYHOST => $caInfo ? 2 : 0,
        ];
        if ($caInfo) {
            $opts[CURLOPT_CAINFO] = $caInfo;
        }

        curl_setopt_array($ch, $opts);
        $response = curl_exec($ch);
        $err      = curl_error($ch);
        $code     = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        // Diagnóstico detallado en el log de PHP
        error_log("[DNI] URL={$url} | HTTP={$code} | cURL_err={$err} | response=" . substr((string)$response, 0, 300));

        if ($err || !$response || $code !== 200) return null;

        $body = json_decode($response, true);
        if (empty($body['data'])) return null;

        return $body['data'];
    }
}
