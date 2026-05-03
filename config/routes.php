<?php

use Src\Controllers\AuthController;
use Src\Controllers\PacienteController;
use Src\Controllers\CitaController;
use Src\Controllers\AtencionController;
use Src\Controllers\PagoController;
use Src\Controllers\ReporteController;
use Src\Controllers\ProfesionalController;
use Src\Controllers\ServicioController;
use Src\Controllers\SubservicioController;
use Src\Controllers\SesionController;
use Src\Controllers\TareaController;
use Src\Controllers\CheckinController;
use Src\Controllers\AlertaController;
use Src\Controllers\ApoderadoController;
use Src\Controllers\PlanillaController;
use Src\Controllers\UsuarioController;
use Src\Controllers\DashboardController;
use Src\Controllers\VinculoController;
use Src\Controllers\Cie10Controller;
use Src\Controllers\PDFController;
use Src\Controllers\ArchivoController;
use Src\Controllers\TallerController;
use Src\Controllers\PaqueteController;
use Src\Controllers\AdelantoController;
use Src\Controllers\PersonaController;

// Dashboard
$router->get('/api/dashboard', [DashboardController::class, 'stats']);

// CIE-10
$router->get('/api/cie10/buscar', [Cie10Controller::class, 'buscar']);

// PDF
$router->get('/api/pdf/historial', [PDFController::class, 'historial']);
$router->get('/api/pdf/cuenta',    [PDFController::class, 'cuenta']);

// Auth
$router->post('/api/login',     [AuthController::class, 'login']);
$router->get('/api/auth/me',    [AuthController::class, 'me']);
$router->post('/api/logout',    [AuthController::class, 'logout']);

// Personas — búsqueda por DNI (local + API externa)
$router->get('/api/personas/buscar-dni', [PersonaController::class, 'buscarDni']);

// Pacientes
$router->get('/api/pacientes',    [PacienteController::class, 'index']);
$router->get('/api/paciente',     [PacienteController::class, 'show']);
$router->post('/api/pacientes',   [PacienteController::class, 'store']);
$router->put('/api/pacientes',    [PacienteController::class, 'update']);
$router->delete('/api/pacientes', [PacienteController::class, 'delete']);

// Apoderados
$router->get('/api/apoderados/buscar-dni', [ApoderadoController::class, 'buscarDni']);
$router->get('/api/apoderados',            [ApoderadoController::class, 'index']);
$router->post('/api/apoderados',   [ApoderadoController::class, 'store']);
$router->put('/api/apoderados',    [ApoderadoController::class, 'update']);
$router->delete('/api/apoderados', [ApoderadoController::class, 'delete']);

// Citas
$router->get('/api/citas',[CitaController::class,'index']);
$router->get('/api/cita',[CitaController::class,'show']);
$router->post('/api/citas',[CitaController::class,'store']);
$router->put('/api/citas/estado',[CitaController::class,'updateEstado']);
$router->post('/api/citas/reprogramar',[CitaController::class,'reprogramar']);
$router->delete('/api/citas',[CitaController::class,'delete']);

// Atenciones
$router->get('/api/atenciones',           [AtencionController::class,'index']);
$router->get('/api/atenciones/paciente',  [AtencionController::class,'porPaciente']);
$router->get('/api/atencion',             [AtencionController::class,'show']);
$router->post('/api/atenciones',[AtencionController::class,'store']);
$router->put('/api/atenciones/cerrar',[AtencionController::class,'cerrar']);
$router->post('/api/atenciones/diagnostico',[AtencionController::class,'diagnostico']);
$router->post('/api/atenciones/sesion',[AtencionController::class,'sesion']);

// Pagos
$router->get('/api/pagos/resumen-paciente',[PagoController::class,'resumenPaciente']);
$router->get('/api/cuentas',[PagoController::class,'cuentas']);
$router->post('/api/cuentas',[PagoController::class,'crearCuenta']);
$router->get('/api/pagos',[PagoController::class,'pagos']);
$router->post('/api/pagos',[PagoController::class,'registrarPago']);

// Adelantos de pacientes
$router->get('/api/adelantos/sesiones', [AdelantoController::class, 'sesiones']);
$router->get('/api/adelantos',          [AdelantoController::class, 'index']);
$router->post('/api/adelantos',         [AdelantoController::class, 'store']);
$router->put('/api/adelantos/cancelar', [AdelantoController::class, 'cancelar']);

// Profesionales
$router->get('/api/profesionales',  [ProfesionalController::class, 'index']);
$router->get('/api/profesional',    [ProfesionalController::class, 'show']);
$router->post('/api/profesionales', [ProfesionalController::class, 'store']);
$router->put('/api/profesionales',  [ProfesionalController::class, 'update']);
$router->delete('/api/profesionales', [ProfesionalController::class, 'delete']);

// Tareas
$router->get('/api/tareas',              [TareaController::class, 'index']);
$router->post('/api/tareas',             [TareaController::class, 'store']);
$router->put('/api/tareas/estado',       [TareaController::class, 'updateEstado']);
$router->put('/api/tareas/respuesta',    [TareaController::class, 'registrarRespuesta']);

// Check-in emocional
$router->get('/api/checkin',   [CheckinController::class, 'index']);
$router->post('/api/checkin',  [CheckinController::class, 'store']);

// Alertas y seguimiento
$router->get('/api/alertas',                  [AlertaController::class, 'index']);
$router->get('/api/alertas/conteo',           [AlertaController::class, 'conteo']);
$router->post('/api/alertas',                 [AlertaController::class, 'store']);
$router->put('/api/alertas/atender',          [AlertaController::class, 'atender']);
$router->put('/api/alertas/descartar',        [AlertaController::class, 'descartar']);
$router->get('/api/planes-seguimiento',       [AlertaController::class, 'showPlan']);
$router->post('/api/planes-seguimiento',      [AlertaController::class, 'crearPlan']);

// Archivos adjuntos de sesiones
$router->get('/api/sesiones/archivos',    [ArchivoController::class, 'index']);
$router->post('/api/sesiones/archivos',   [ArchivoController::class, 'store']);
$router->get('/api/archivos/descargar',   [ArchivoController::class, 'descargar']);
$router->delete('/api/sesiones/archivos', [ArchivoController::class, 'eliminar']);

// Sesiones
$router->get('/api/sesiones/contexto',           [SesionController::class, 'contexto']);
$router->get('/api/sesiones/next-numero',        [SesionController::class, 'nextNumero']);
$router->get('/api/atenciones/sesion-siguiente', [SesionController::class, 'sesionSiguiente']);
$router->post('/api/sesiones',     [SesionController::class, 'store']);
$router->put('/api/sesiones/nota', [SesionController::class, 'updateNota']);

// Servicios
$router->get('/api/servicios',  [ServicioController::class, 'index']);
$router->get('/api/servicio',   [ServicioController::class, 'show']);
$router->post('/api/servicios', [ServicioController::class, 'store']);
$router->put('/api/servicios',  [ServicioController::class, 'update']);

// Subservicios
$router->get('/api/subservicios',             [SubservicioController::class, 'index']);
$router->get('/api/subservicios/por-servicio',[SubservicioController::class, 'byServicio']);
$router->get('/api/subservicio',              [SubservicioController::class, 'show']);
$router->post('/api/subservicios',            [SubservicioController::class, 'store']);
$router->put('/api/subservicios',             [SubservicioController::class, 'update']);

// Usuarios (solo administrador)
$router->get('/api/usuarios',                    [UsuarioController::class, 'index']);
$router->post('/api/usuarios',                   [UsuarioController::class, 'store']);
$router->put('/api/usuarios/rol',                [UsuarioController::class, 'updateRol']);
$router->put('/api/usuarios/estado',             [UsuarioController::class, 'toggleEstado']);
$router->put('/api/usuarios/cambiar-password',   [UsuarioController::class, 'cambiarPassword']);

// Planillas y pagos al personal (solo administrador)
$router->get('/api/planillas/preview',      [PlanillaController::class, 'preview']);
$router->get('/api/planillas/conceptos',    [PlanillaController::class, 'conceptos']);
$router->get('/api/planillas',              [PlanillaController::class, 'index']);
$router->post('/api/planillas',             [PlanillaController::class, 'store']);
$router->put('/api/planillas/aprobar',      [PlanillaController::class, 'aprobar']);
$router->get('/api/pagos-personal',         [PlanillaController::class, 'pagos']);
$router->post('/api/pagos-personal',        [PlanillaController::class, 'registrarPago']);

// Vínculos grupales (pareja, familiar, grupal, taller)
$router->get('/api/vinculos',                    [VinculoController::class, 'index']);
$router->get('/api/vinculo',                     [VinculoController::class, 'show']);
$router->post('/api/vinculos',                   [VinculoController::class, 'store']);
$router->put('/api/vinculos/cerrar',             [VinculoController::class, 'cerrar']);
$router->post('/api/vinculos/participante',      [VinculoController::class, 'addParticipante']);
$router->delete('/api/vinculos/participante',    [VinculoController::class, 'removeParticipante']);
$router->get('/api/sesiones-grupo',              [VinculoController::class, 'sesionesIndex']);
$router->post('/api/sesiones-grupo',             [VinculoController::class, 'sesionesStore']);
$router->put('/api/sesiones-grupo/nota',         [VinculoController::class, 'updateNota']);
$router->put('/api/sesiones-grupo/estado',       [VinculoController::class, 'updateEstado']);

// Talleres institucionales
$router->get('/api/talleres',          [TallerController::class, 'index']);
$router->get('/api/taller',            [TallerController::class, 'show']);
$router->post('/api/talleres',         [TallerController::class, 'store']);
$router->put('/api/talleres',          [TallerController::class, 'update']);
$router->put('/api/talleres/estado',   [TallerController::class, 'cambiarEstado']);
$router->post('/api/talleres/fecha',   [TallerController::class, 'agregarFecha']);
$router->put('/api/talleres/fecha',    [TallerController::class, 'actualizarFecha']);
$router->delete('/api/talleres/fecha', [TallerController::class, 'eliminarFecha']);

// Paquetes — catálogo (solo admin)
$router->get('/api/paquetes',                    [PaqueteController::class, 'index']);
$router->post('/api/paquetes',                   [PaqueteController::class, 'store']);
$router->put('/api/paquetes',                    [PaqueteController::class, 'update']);
$router->delete('/api/paquetes/toggle-activo',   [PaqueteController::class, 'toggleActivo']);
// Paquetes — por paciente (admin y profesional)
$router->get('/api/paciente-paquetes/mio',       [PaqueteController::class, 'miPaquete']);
$router->get('/api/paciente-paquetes',           [PaqueteController::class, 'porPaciente']);
$router->post('/api/paciente-paquetes',          [PaqueteController::class, 'contratar']);
$router->put('/api/paciente-paquetes/cancelar',  [PaqueteController::class, 'cancelar']);

// Reportes — clínicos
$router->get('/api/reportes/progreso',    [ReporteController::class, 'progreso']);
$router->get('/api/reportes/asistencia',  [ReporteController::class, 'asistencia']);
$router->get('/api/reportes/carga',       [ReporteController::class, 'carga']);
// Reportes — financieros
$router->get('/api/reportes/facturacion', [ReporteController::class, 'facturacion']);
$router->get('/api/reportes/morosidad',   [ReporteController::class, 'morosidad']);
$router->get('/api/reportes/ingresos',    [ReporteController::class, 'ingresos']);
// Reportes — legacy (usados por /api/pdf y rutas previas)
$router->get('/api/reportes/historial',         [ReporteController::class, 'historial']);
$router->get('/api/reportes/historial-completo',[ReporteController::class, 'historialCompleto']);
$router->get('/api/reportes/saldos',      [ReporteController::class, 'saldos']);
$router->get('/api/reportes/checkin',     [ReporteController::class, 'checkin']);
$router->get('/api/reportes/agenda',      [ReporteController::class, 'agenda']);
