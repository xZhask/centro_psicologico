<?php
namespace Src\Controllers;

use Dompdf\Dompdf;
use Dompdf\Options;
use Src\Core\Auth;
use Src\Core\Database;
use Src\Models\CuentaCobro;
use Src\Models\PagoPaciente;
use Src\Models\Reporte;
use Src\Middleware\RoleMiddleware;

class PDFController {

    private const ALLOWED = ['administrador', 'profesional'];

    // ----------------------------------------------------------------
    // GET /api/pdf/historial?paciente_id=X
    // ----------------------------------------------------------------
    public function historial(): void {
        RoleMiddleware::handle(self::ALLOWED);

        $pacienteId = (int) ($_GET['paciente_id'] ?? 0);
        if (!$pacienteId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'paciente_id requerido']);
            exit;
        }

        // Datos del paciente
        $paciente = Database::query(
            "SELECT pe.nombres, pe.apellidos, pe.dni, pe.fecha_nacimiento,
                    pe.telefono, pe.email,
                    pa.ocupacion, pa.estado_civil, pa.grado_instruccion
             FROM pacientes pa
             JOIN personas pe ON pe.id = pa.persona_id
             WHERE pa.id = ?",
            [$pacienteId]
        )->fetch();

        if (!$paciente) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Paciente no encontrado']);
            exit;
        }

        // Usar historialPaciente() sin notas privadas.
        // Las notas privadas nunca se incluyen en el PDF.
        $rows = Reporte::historialPaciente($pacienteId);

        // Agrupar por atención
        $atenciones = [];
        foreach ($rows as $row) {
            $aid = $row['atencion_id'];
            if (!isset($atenciones[$aid])) {
                $atenciones[$aid] = [
                    'fecha_inicio'    => $row['fecha_inicio'],
                    'fecha_fin'       => $row['fecha_fin'],
                    'estado_atencion' => $row['estado_atencion'],
                    'motivo_consulta' => $row['motivo_consulta'],
                    'subservicio'     => $row['subservicio'],
                    'modalidad'       => $row['modalidad'],
                    'profesional'     => $row['profesional'],
                    'diagnostico'     => $row['diagnostico'],
                    'cie10_codigo'    => $row['cie10_codigo'],
                    'recomendaciones' => $row['recomendaciones'],
                    'sesiones'        => [],
                ];
            }
            if (!empty($row['sesion_id'])) {
                $atenciones[$aid]['sesiones'][] = [
                    'numero_sesion' => $row['numero_sesion'],
                    'fecha_sesion'  => $row['fecha_sesion'],
                    'estado_sesion' => $row['estado_sesion'],
                    'nota_clinica'  => $row['nota_clinica'],
                ];
            }
        }

        $user       = Auth::user();
        $generadoPor = trim(($user['nombres'] ?? '') . ' ' . ($user['apellidos'] ?? ''));
        $fechaHoy   = date('d/m/Y H:i');
        $nombreCompleto = $paciente['nombres'] . ' ' . $paciente['apellidos'];

        $html = $this->htmlHistorial($paciente, $atenciones, $generadoPor, $fechaHoy, $nombreCompleto);
        $this->streamPDF($html, 'historial_' . $pacienteId . '_' . date('Ymd') . '.pdf');
    }

    // ----------------------------------------------------------------
    // GET /api/pdf/cuenta?cuenta_id=X
    // ----------------------------------------------------------------
    public function cuenta(): void {
        RoleMiddleware::handle(self::ALLOWED);

        $cuentaId = (int) ($_GET['cuenta_id'] ?? 0);
        if (!$cuentaId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'cuenta_id requerido']);
            exit;
        }

        $cuenta = CuentaCobro::findById($cuentaId);
        if (!$cuenta) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Cuenta no encontrada']);
            exit;
        }

        $pagos = PagoPaciente::findByCuenta($cuentaId);

        $user        = Auth::user();
        $generadoPor = trim(($user['nombres'] ?? '') . ' ' . ($user['apellidos'] ?? ''));
        $fechaHoy    = date('d/m/Y H:i');

        $html = $this->htmlCuenta($cuenta, $pagos, $generadoPor, $fechaHoy);
        $this->streamPDF($html, 'comprobante_cuenta_' . $cuentaId . '_' . date('Ymd') . '.pdf');
    }

    // ----------------------------------------------------------------
    // Helpers internos
    // ----------------------------------------------------------------

    private function streamPDF(string $html, string $filename): void {
        $options = new Options();
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isRemoteEnabled', false);
        $options->set('defaultFont', 'Helvetica');

        $pdf = new Dompdf($options);
        $pdf->loadHtml($html, 'UTF-8');
        $pdf->setPaper('A4', 'portrait');
        $pdf->render();
        $pdf->stream($filename, ['Attachment' => true]);
        exit;
    }

    private function e(mixed $val): string {
        return htmlspecialchars((string) ($val ?? ''), ENT_QUOTES, 'UTF-8');
    }

    private function fmt(mixed $val): string {
        return number_format((float) ($val ?? 0), 2);
    }

    private function pageHeader(string $titulo, string $subtitulo = ''): string {
        return '
        <table width="100%" style="border-bottom:2px solid #2E86C1;margin-bottom:14px;padding-bottom:10px">
            <tr>
                <td style="width:70%">
                    <div style="font-size:18px;font-weight:bold;color:#1B4F72">Centro Psicológico</div>
                    <div style="font-size:11px;color:#6C757D;margin-top:2px">Sistema de Gestión Clínica</div>
                </td>
                <td style="width:30%;text-align:right;vertical-align:top">
                    <div style="font-size:14px;font-weight:bold;color:#2E86C1">' . $this->e($titulo) . '</div>
                    ' . ($subtitulo ? '<div style="font-size:10px;color:#6C757D;margin-top:2px">' . $this->e($subtitulo) . '</div>' : '') . '
                </td>
            </tr>
        </table>';
    }

    private function pageFooter(string $generadoPor, string $fechaHoy): string {
        return '
        <table width="100%" style="border-top:1px solid #DEE2E6;margin-top:20px;padding-top:8px;font-size:9px;color:#6C757D">
            <tr>
                <td>Generado por: <strong>' . $this->e($generadoPor) . '</strong></td>
                <td style="text-align:right">Fecha de generación: <strong>' . $this->e($fechaHoy) . '</strong></td>
            </tr>
        </table>';
    }

    // ----------------------------------------------------------------
    // Template: Historial Clínico
    // ----------------------------------------------------------------
    private function htmlHistorial(
        array  $paciente,
        array  $atenciones,
        string $generadoPor,
        string $fechaHoy,
        string $nombreCompleto
    ): string {
        $filasPaciente = '
            <tr><td width="30%" style="color:#6C757D">Nombre completo</td><td><strong>' . $this->e($nombreCompleto) . '</strong></td></tr>
            <tr><td style="color:#6C757D">DNI</td><td>' . $this->e($paciente['dni'] ?? '—') . '</td></tr>
            <tr><td style="color:#6C757D">Fecha de nacimiento</td><td>' . $this->e($paciente['fecha_nacimiento'] ?? '—') . '</td></tr>
            <tr><td style="color:#6C757D">Teléfono</td><td>' . $this->e($paciente['telefono'] ?? '—') . '</td></tr>
            <tr><td style="color:#6C757D">Ocupación</td><td>' . $this->e($paciente['ocupacion'] ?? '—') . '</td></tr>
            <tr><td style="color:#6C757D">Estado civil</td><td>' . $this->e($paciente['estado_civil'] ?? '—') . '</td></tr>';

        $bloqueAtenciones = '';
        if (empty($atenciones)) {
            $bloqueAtenciones = '<p style="color:#6C757D;font-style:italic">No hay atenciones registradas.</p>';
        } else {
            foreach ($atenciones as $at) {
                $fechaFin    = $at['fecha_fin'] ? ' — ' . $at['fecha_fin'] : '';
                $dx          = $at['cie10_codigo']
                    ? '[' . $at['cie10_codigo'] . '] ' . ($at['diagnostico'] ?? '')
                    : 'Sin diagnóstico principal';

                // Filas de sesiones
                $filasSesiones = '';
                if (!empty($at['sesiones'])) {
                    foreach ($at['sesiones'] as $s) {
                        $nota = $s['nota_clinica'] ? $this->e($s['nota_clinica']) : '<em style="color:#6C757D">Sin nota</em>';
                        $filasSesiones .= '
                            <tr>
                                <td style="text-align:center">' . $this->e($s['numero_sesion']) . '</td>
                                <td>' . $this->e($s['fecha_sesion'] ?? '—') . '</td>
                                <td>' . $this->e($s['estado_sesion'] ?? '—') . '</td>
                                <td style="font-size:9px">' . $nota . '</td>
                            </tr>';
                    }
                } else {
                    $filasSesiones = '<tr><td colspan="4" style="color:#6C757D;font-style:italic;text-align:center">Sin sesiones</td></tr>';
                }

                $bloqueAtenciones .= '
                <div style="border:1px solid #DEE2E6;border-radius:6px;margin-bottom:14px;overflow:hidden">
                    <div style="background:#2E86C1;color:#fff;padding:7px 12px;font-size:11px;font-weight:bold">
                        ' . $this->e($at['subservicio']) . '
                        <span style="font-weight:normal;font-size:10px;opacity:.85">
                            — ' . $this->e($at['modalidad'] ?? '') . '
                        </span>
                        <span style="float:right;font-weight:normal;font-size:10px">
                            ' . $this->e($at['fecha_inicio'] . $fechaFin) . ' &nbsp;|&nbsp; ' . $this->e($at['estado_atencion']) . '
                        </span>
                    </div>
                    <div style="padding:10px 12px;font-size:10px">
                        <p style="margin:0 0 5px"><strong>Profesional:</strong> ' . $this->e($at['profesional']) . '</p>
                        <p style="margin:0 0 5px"><strong>Motivo de consulta:</strong> ' . $this->e($at['motivo_consulta'] ?? '—') . '</p>
                        <p style="margin:0 0 8px"><strong>Diagnóstico principal:</strong> ' . $this->e($dx) . '</p>

                        <table width="100%" style="border-collapse:collapse;font-size:9px">
                            <thead>
                                <tr style="background:#F8F9FA">
                                    <th style="border:1px solid #DEE2E6;padding:4px 6px;text-align:center;width:8%">#</th>
                                    <th style="border:1px solid #DEE2E6;padding:4px 6px;width:20%">Fecha</th>
                                    <th style="border:1px solid #DEE2E6;padding:4px 6px;width:15%">Estado</th>
                                    <th style="border:1px solid #DEE2E6;padding:4px 6px">Nota clínica</th>
                                </tr>
                            </thead>
                            <tbody>' . $filasSesiones . '</tbody>
                        </table>

                        ' . ($at['recomendaciones'] ? '<p style="margin:8px 0 0;font-size:9px;color:#6C757D"><strong>Recomendaciones:</strong> ' . $this->e($at['recomendaciones']) . '</p>' : '') . '
                    </div>
                </div>';
            }
        }

        return '<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:Helvetica,Arial,sans-serif; font-size:10px; color:#212529; padding:20px 28px; }
        h2  { font-size:13px; color:#1B4F72; margin:14px 0 8px; border-bottom:1px solid #DEE2E6; padding-bottom:4px; }
        table { border-collapse:collapse; width:100%; }
        td   { padding:4px 6px; vertical-align:top; }
        .data-table td { border:1px solid #DEE2E6; }
        .data-table tr:nth-child(even) td { background:#F8F9FA; }
    </style>
</head>
<body>

' . $this->pageHeader('Historial Clínico', 'Reporte generado el ' . $fechaHoy) . '

<h2>Datos del Paciente</h2>
<table class="data-table" style="margin-bottom:16px">
    <tbody>' . $filasPaciente . '</tbody>
</table>

<h2>Historial de Atenciones (' . count($atenciones) . ')</h2>
' . $bloqueAtenciones . '

' . $this->pageFooter($generadoPor, $fechaHoy) . '

</body>
</html>';
    }

    // ----------------------------------------------------------------
    // Template: Comprobante de Cuenta / Pagos
    // ----------------------------------------------------------------
    private function htmlCuenta(
        array  $cuenta,
        array  $pagos,
        string $generadoPor,
        string $fechaHoy
    ): string {
        $saldo        = (float) $cuenta['saldo_pendiente'];
        $saldoColor   = $saldo > 0 ? '#E74C3C' : '#27AE60';
        $descuento    = (float) $cuenta['descuento_aplicado'];

        // Métodos de pago legibles
        $metodoLabel = [
            'efectivo'        => 'Efectivo',
            'transferencia'   => 'Transferencia',
            'tarjeta_debito'  => 'T. Débito',
            'tarjeta_credito' => 'T. Crédito',
            'yape'            => 'Yape',
            'plin'            => 'Plin',
            'otro'            => 'Otro',
        ];

        // Filas de pagos
        $filasPagos = '';
        $totalPagado = 0;
        if (!empty($pagos)) {
            foreach ($pagos as $p) {
                $pagador = $p['nombre_paciente']
                    ?? $p['nombre_apoderado']
                    ?? $p['pagado_por_externo']
                    ?? '—';
                $monto = (float) $p['monto'];
                $totalPagado += $monto;
                $metodo = $metodoLabel[$p['metodo_pago']] ?? $p['metodo_pago'];
                $filasPagos .= '
                    <tr>
                        <td>' . $this->e($p['fecha_pago']) . '</td>
                        <td style="text-align:right;font-weight:bold">S/ ' . $this->fmt($monto) . '</td>
                        <td>' . $this->e($metodo) . '</td>
                        <td>' . $this->e($p['numero_comprobante'] ?? '—') . '</td>
                        <td>' . $this->e($pagador) . '</td>
                        <td style="color:#6C757D;font-size:9px">' . $this->e($p['notas'] ?? '') . '</td>
                    </tr>';
            }
        } else {
            $filasPagos = '<tr><td colspan="6" style="text-align:center;color:#6C757D;font-style:italic">Sin pagos registrados</td></tr>';
        }

        $descuentoRow = $descuento > 0
            ? '<tr><td style="color:#6C757D">Descuento aplicado</td><td style="color:#F39C12">-S/ ' . $this->fmt($descuento) . '</td></tr>'
            : '';
        $motivoDescRow = ($descuento > 0 && !empty($cuenta['motivo_descuento']))
            ? '<tr><td style="color:#6C757D">Motivo descuento</td><td>' . $this->e($cuenta['motivo_descuento']) . '</td></tr>'
            : '';
        $venceRow = !empty($cuenta['fecha_vencimiento'])
            ? '<tr><td style="color:#6C757D">Fecha vencimiento</td><td>' . $this->e($cuenta['fecha_vencimiento']) . '</td></tr>'
            : '';

        return '<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:Helvetica,Arial,sans-serif; font-size:10px; color:#212529; padding:20px 28px; }
        h2   { font-size:13px; color:#1B4F72; margin:14px 0 8px; border-bottom:1px solid #DEE2E6; padding-bottom:4px; }
        table { border-collapse:collapse; width:100%; }
        td    { padding:4px 6px; vertical-align:top; }
        .data-table td { border:1px solid #DEE2E6; }
        .data-table tr:nth-child(even) td { background:#F8F9FA; }
        .pago-table thead td { background:#2E86C1; color:#fff; font-weight:bold; }
        .pago-table td { border:1px solid #DEE2E6; }
        .pago-table tr:nth-child(even) td { background:#F8F9FA; }
        .resumen-box { background:#F8F9FA; border:1px solid #DEE2E6; border-radius:6px; padding:12px 16px; margin-top:14px; }
    </style>
</head>
<body>

' . $this->pageHeader('Comprobante de Pago', 'N° cuenta: ' . $this->e($cuenta['id'])) . '

<h2>Datos del Paciente y la Cuenta</h2>
<table class="data-table" style="margin-bottom:14px">
    <tbody>
        <tr><td width="30%" style="color:#6C757D">Paciente</td><td><strong>' . $this->e($cuenta['paciente_nombre'] ?? '—') . '</strong></td></tr>
        <tr><td style="color:#6C757D">Concepto</td><td>' . $this->e($cuenta['concepto']) . '</td></tr>
        <tr><td style="color:#6C757D">Fecha de emisión</td><td>' . $this->e($cuenta['fecha_emision']) . '</td></tr>
        ' . $venceRow . '
        <tr><td style="color:#6C757D">Monto total</td><td>S/ ' . $this->fmt($cuenta['monto_total']) . '</td></tr>
        ' . $descuentoRow . '
        ' . $motivoDescRow . '
        <tr><td style="color:#6C757D">Estado</td><td>' . $this->e(ucfirst($cuenta['estado'])) . '</td></tr>
    </tbody>
</table>

<h2>Historial de Pagos</h2>
<table class="pago-table" style="margin-bottom:14px">
    <thead>
        <tr>
            <td>Fecha</td>
            <td style="text-align:right">Monto</td>
            <td>Método</td>
            <td>Comprobante</td>
            <td>Pagado por</td>
            <td>Notas</td>
        </tr>
    </thead>
    <tbody>' . $filasPagos . '</tbody>
</table>

<div class="resumen-box">
    <table>
        <tr>
            <td width="60%"></td>
            <td width="20%" style="text-align:right;font-size:10px;color:#6C757D">Monto total</td>
            <td width="20%" style="text-align:right">S/ ' . $this->fmt($cuenta['monto_total']) . '</td>
        </tr>
        ' . ($descuento > 0 ? '
        <tr>
            <td></td>
            <td style="text-align:right;font-size:10px;color:#6C757D">Descuento</td>
            <td style="text-align:right;color:#F39C12">-S/ ' . $this->fmt($descuento) . '</td>
        </tr>' : '') . '
        <tr>
            <td></td>
            <td style="text-align:right;font-size:10px;color:#6C757D">Total pagado</td>
            <td style="text-align:right;color:#27AE60;font-weight:bold">S/ ' . $this->fmt($cuenta['monto_pagado']) . '</td>
        </tr>
        <tr>
            <td></td>
            <td style="text-align:right;font-size:11px;font-weight:bold;color:#1B4F72">Saldo pendiente</td>
            <td style="text-align:right;font-size:13px;font-weight:bold;color:' . $saldoColor . '">S/ ' . $this->fmt($saldo) . '</td>
        </tr>
    </table>
</div>

' . $this->pageFooter($generadoPor, $fechaHoy) . '

</body>
</html>';
    }
}
