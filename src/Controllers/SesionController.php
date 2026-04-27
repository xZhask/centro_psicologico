<?php
namespace Src\Controllers;

use Src\Core\Response;
use Src\Core\Request;
use Src\Core\Validator;
use Src\Models\Sesion;
use Src\Models\Atencion;
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

        // Paquete activo
        $pp           = PacientePaquete::findActivoByPaciente($pacienteId);
        $paqueteData  = null;
        if ($pp) {
            $sesInc           = (int) $pp['sesiones_incluidas'];
            $precioPorSesion  = $sesInc > 0 ? round((float) $pp['precio_paquete'] / $sesInc, 2) : 0;
            $paqueteData = [
                'id'                => (int) $pp['id'],
                'nombre'            => $pp['nombre_paquete'],
                'sesiones_restantes'=> (int) $pp['sesiones_restantes'],
                'precio_por_sesion' => $precioPorSesion,
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
                'precio_referencia'       => (float) $atencion['precio_acordado'],
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

        $result = Sesion::crear($data);

        Response::json([
            'success'                => true,
            'data'                   => ['id' => $result['sesion_id']],
            'sesion_id'              => $result['sesion_id'],
            'cobertura'              => $result['cobertura'],
            'cuenta_cobro_id'        => $result['cuenta_cobro_id'],
            'saldo_adelanto_restante' => $result['saldo_adelanto_restante'],
            'message'                => $result['mensaje'],
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
