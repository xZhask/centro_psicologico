<?php
namespace Src\Controllers;

use Src\Core\Database;
use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\Sesion;
use Src\Models\Atencion;
use Src\Models\Cita;
use Src\Models\Subservicio;
use Src\Models\PacientePaquete;
use Src\Models\AdelantoPaciente;
use Src\Middleware\RoleMiddleware;

class SesionController {

    private const ALLOWED = ['administrador', 'profesional'];

    public function contexto(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);

        $pacienteId   = (int) ($_GET['paciente_id']    ?? 0);
        $atencionId   = (int) ($_GET['atencion_id']    ?? 0);
        $profesionalId = (int) ($_GET['profesional_id'] ?? 0);

        if (!$pacienteId || !$atencionId) {
            Response::json(['success' => false, 'message' => 'paciente_id y atencion_id requeridos'], 400);
            return;
        }

        $atencion = Atencion::findById($atencionId);
        if (!$atencion) {
            Response::json(['success' => false, 'message' => 'Atención no encontrada'], 404);
            return;
        }

        $subservicio      = Subservicio::findById((int) $atencion['subservicio_id']);
        $descuentoVirtual = $subservicio ? (float) $subservicio['descuento_virtual'] : 10.00;

        // Paquete activo — filtrar por profesional si se recibe el parámetro
        $pp = $profesionalId
            ? PacientePaquete::findActivoByPacienteYProfesional($pacienteId, $profesionalId)
            : PacientePaquete::findActivoByPaciente($pacienteId);

        $paqueteData  = null;
        if ($pp) {
            $sesInc          = (int) $pp['sesiones_incluidas'];
            $precioPorSesion = $sesInc > 0 ? round((float) $pp['precio_paquete'] / $sesInc, 2) : 0;

            // Descontar citas ya agendadas (pendiente/confirmada) que aún no consumieron sesión
            $profIdPaquete = $profesionalId ?: (int) ($pp['profesional_id'] ?? 0);
            $citasPendientes = 0;
            if ($profIdPaquete) {
                $row = Database::query(
                    "SELECT COUNT(*) AS total
                     FROM citas
                     WHERE paciente_id    = ?
                       AND profesional_id = ?
                       AND estado IN ('pendiente', 'confirmada')",
                    [$pacienteId, $profIdPaquete]
                )->fetch();
                $citasPendientes = (int) ($row['total'] ?? 0);
            }

            $sesionesDisponibles = max(0, (int) $pp['sesiones_restantes'] - $citasPendientes);

            $paqueteData = [
                'id'                   => (int) $pp['id'],
                'nombre'               => $pp['nombre_paquete'],
                'sesiones_restantes'   => (int) $pp['sesiones_restantes'],
                'sesiones_disponibles' => $sesionesDisponibles,
                'precio_por_sesion'    => $precioPorSesion,
            ];
        }

        // Adelanto activo
        $adel        = AdelantoPaciente::findActivoByPaciente($pacienteId, $atencionId);
        $adelantoData = null;
        if ($adel) {
            $adelantoData = [
                'id'                => (int) $adel['id'],
                'concepto'          => $adel['concepto'],
                'sesiones_acordadas'=> $adel['sesiones_acordadas'],
                'monto_total'       => (float) $adel['monto_total'],
                'monto_aplicado'    => (float) $adel['monto_aplicado'],
                'saldo_disponible'  => (float) $adel['saldo_disponible'],
            ];
        }

        Response::json([
            'success' => true,
            'data'    => [
                'precio_referencia'       => (float) ($atencion['precio_acordado'] ?? 0),
                'descuento_virtual'       => $descuentoVirtual,
                'paquete_activo'          => $paqueteData,
                'adelanto_activo'         => $adelantoData,
                'numero_sesion_siguiente' => Sesion::nextNumero($atencionId),
            ],
        ]);
    }

    public function nextNumero(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $atencionId = (int) ($_GET['atencion_id'] ?? 0);
        if (!$atencionId) {
            Response::json(['success' => false, 'message' => 'atencion_id requerido'], 400);
            return;
        }
        Response::json(['success' => true, 'data' => ['numero_sesion' => Sesion::nextNumero($atencionId)]]);
    }

    public function sesionSiguiente(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $atencionId = (int) ($_GET['atencion_id'] ?? 0);
        if (!$atencionId) {
            Response::json(['success' => false, 'message' => 'atencion_id requerido'], 400);
            return;
        }
        Response::json(['success' => true, 'data' => ['numero_siguiente' => Sesion::nextNumero($atencionId)]]);
    }

    public function store(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['atencion_id', 'duracion_min', 'precio_sesion', 'modalidad_sesion']);

        if (!empty($data['cita_id'])) {
            $cobertura = Cita::evaluarCobertura((int)$data['cita_id']);
            if (!$cobertura['habilitada_para_registro']) {
                Response::json([
                    'success' => false,
                    'message' => 'Esta cita requiere pago antes de registrar la sesión. ' . $cobertura['mensaje']
                ], 422);
                return;
            }
            // Inyectar cobertura de la cita
            $data['paciente_paquete_id']        = $cobertura['paquete_id'] ?: ($data['paciente_paquete_id'] ?? null);
            $data['paquete_nombre']             = $cobertura['paquete_nombre'] ?: ($data['paquete_nombre'] ?? null);
            $data['paquete_sesiones_restantes'] = $cobertura['paquete_sesiones_restantes'] ?: ($data['paquete_sesiones_restantes'] ?? null);
            $data['adelanto_id']                = $cobertura['adelanto_id'] ?: ($data['adelanto_id'] ?? null);
        } else if (empty($data['paciente_paquete_id'])) {
            $atencion = Atencion::findById((int) $data['atencion_id']);
            if ($atencion) {
                $paqueteActivo = PacientePaquete::findActivoByPaciente((int) $atencion['paciente_id']);
                if ($paqueteActivo) {
                    $data['paciente_paquete_id']        = (int) $paqueteActivo['id'];
                    $data['paquete_nombre']             = $paqueteActivo['nombre_paquete'];
                    $data['paquete_sesiones_restantes'] = $paqueteActivo['sesiones_restantes'];
                }
            }
        }

        $result = Sesion::crear($data);

        if (!empty($data['cita_id'])) {
            Cita::updateEstado((int) $data['cita_id'], 'completada');
        }

        Response::json([
            'success'                 => true,
            'data'                    => ['id' => $result['sesion_id']],
            'sesion_id'               => $result['sesion_id'],
            'cobertura'               => $result['cobertura'],
            'cuenta_cobro_id'         => $result['cuenta_cobro_id'],
            'saldo_adelanto_restante'  => $result['saldo_adelanto_restante'],
            'message'                 => $result['mensaje'],
        ]);
    }

    public function updateNota(Request $request): void {
        RoleMiddleware::handle(self::ALLOWED);
        $data = $request->json();
        Validator::required($data, ['id']);
        Sesion::updateNota((int) $data['id'], $data['nota_clinica'] ?? '');
        Response::json(['success' => true, 'message' => 'Nota actualizada']);
    }
}
