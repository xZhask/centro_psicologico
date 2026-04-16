<?php
namespace Src\Controllers;

use Src\Core\Auth;
use Src\Core\Database;
use Src\Core\Response;
use Src\Middleware\RoleMiddleware;

class DashboardController {

    private const ALL = ['administrador', 'profesional', 'paciente'];

    public function stats(): void {
        RoleMiddleware::handle(self::ALL);
        $user = Auth::user();

        match ($user['rol']) {
            'administrador' => $this->statsAdmin(),
            'profesional'   => $this->statsProfesional($user),
            'paciente'      => $this->statsPaciente($user),
            default         => Response::json(['success' => false, 'message' => 'Rol no reconocido'], 403),
        };
    }

    // ----------------------------------------------------------------
    // ADMINISTRADOR
    // ----------------------------------------------------------------
    private function statsAdmin(): void {
        $pacientesActivos = (int) Database::query(
            "SELECT COUNT(*) FROM pacientes WHERE activo = 1"
        )->fetchColumn();

        $citasHoy = (int) Database::query(
            "SELECT COUNT(*) FROM citas
             WHERE DATE(fecha_hora_inicio) = CURDATE()
               AND estado NOT IN ('cancelada','reprogramada')"
        )->fetchColumn();

        $ingresosMes = (float) Database::query(
            "SELECT COALESCE(SUM(monto), 0) FROM pagos_paciente
             WHERE MONTH(fecha_pago) = MONTH(CURDATE())
               AND YEAR(fecha_pago)  = YEAR(CURDATE())"
        )->fetchColumn();

        $alertasActivas = (int) Database::query(
            "SELECT COUNT(*) FROM alertas WHERE estado = 'activa'"
        )->fetchColumn();

        // Citas agrupadas por semana ISO — últimas 4 semanas
        $citasSemanas = Database::query(
            "SELECT DATE_FORMAT(MIN(DATE(fecha_hora_inicio)), '%d/%m') AS etiqueta,
                    COUNT(*) AS total
             FROM citas
             WHERE fecha_hora_inicio >= DATE_SUB(CURDATE(), INTERVAL 28 DAY)
               AND estado NOT IN ('cancelada','reprogramada')
             GROUP BY YEARWEEK(fecha_hora_inicio, 1)
             ORDER BY YEARWEEK(fecha_hora_inicio, 1)"
        )->fetchAll();

        // Distribución de atenciones por tipo de servicio
        $distServicios = Database::query(
            "SELECT se.nombre AS servicio, COUNT(a.id) AS total
             FROM atenciones a
             JOIN subservicios ss ON ss.id = a.subservicio_id
             JOIN servicios    se ON se.id = ss.servicio_id
             GROUP BY se.id, se.nombre
             ORDER BY total DESC"
        )->fetchAll();

        // Ingresos mensuales — últimos 6 meses
        $ingresosMeses = Database::query(
            "SELECT DATE_FORMAT(fecha_pago, '%b %Y') AS mes,
                    ROUND(SUM(monto), 2)              AS total
             FROM pagos_paciente
             WHERE fecha_pago >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
             GROUP BY DATE_FORMAT(fecha_pago, '%Y-%m')
             ORDER BY MIN(fecha_pago)"
        )->fetchAll();

        // Próximas 5 citas del día con paciente y profesional
        $proximasCitasHoy = Database::query(
            "SELECT ci.id,
                    ci.fecha_hora_inicio,
                    ci.estado,
                    CONCAT(pe_p.nombres,' ',pe_p.apellidos) AS paciente,
                    CONCAT(pe_r.nombres,' ',pe_r.apellidos) AS profesional,
                    ss.nombre AS subservicio
             FROM citas ci
             JOIN pacientes    p    ON p.id    = ci.paciente_id
             JOIN personas     pe_p ON pe_p.id = p.persona_id
             JOIN profesionales pr  ON pr.id   = ci.profesional_id
             JOIN personas     pe_r ON pe_r.id = pr.persona_id
             JOIN subservicios ss   ON ss.id   = ci.subservicio_id
             WHERE DATE(ci.fecha_hora_inicio) = CURDATE()
               AND ci.estado NOT IN ('cancelada','reprogramada')
             ORDER BY ci.fecha_hora_inicio
             LIMIT 5"
        )->fetchAll();

        Response::json(['success' => true, 'data' => [
            'rol'                => 'administrador',
            'pacientes_activos'  => $pacientesActivos,
            'citas_hoy'          => $citasHoy,
            'ingresos_mes'       => $ingresosMes,
            'alertas_activas'    => $alertasActivas,
            'citas_semanas'      => $citasSemanas,
            'dist_servicios'     => $distServicios,
            'ingresos_meses'     => $ingresosMeses,
            'proximas_citas_hoy' => $proximasCitasHoy,
        ]]);
    }

    // ----------------------------------------------------------------
    // PROFESIONAL
    // ----------------------------------------------------------------
    private function statsProfesional(array $user): void {
        $profRow = Database::query(
            "SELECT id FROM profesionales WHERE persona_id = ?",
            [(int) $user['persona_id']]
        )->fetch();

        if (!$profRow) {
            Response::json(['success' => false, 'message' => 'Profesional no encontrado'], 404);
            return;
        }
        $profId = (int) $profRow['id'];

        $misPacientesActivos = (int) Database::query(
            "SELECT COUNT(DISTINCT paciente_id) FROM atenciones
             WHERE profesional_id = ? AND estado = 'activa'",
            [$profId]
        )->fetchColumn();

        $misCitasHoy = (int) Database::query(
            "SELECT COUNT(*) FROM citas
             WHERE profesional_id = ?
               AND DATE(fecha_hora_inicio) = CURDATE()
               AND estado NOT IN ('cancelada','reprogramada')",
            [$profId]
        )->fetchColumn();

        $misAlertasActivas = (int) Database::query(
            "SELECT COUNT(*) FROM alertas
             WHERE profesional_id = ? AND estado = 'activa'",
            [$profId]
        )->fetchColumn();

        $citasHoyLista = Database::query(
            "SELECT ci.id,
                    ci.fecha_hora_inicio,
                    ci.estado,
                    CONCAT(pe_p.nombres,' ',pe_p.apellidos) AS paciente,
                    ss.nombre AS subservicio,
                    ss.duracion_min
             FROM citas ci
             JOIN pacientes    p    ON p.id    = ci.paciente_id
             JOIN personas     pe_p ON pe_p.id = p.persona_id
             JOIN subservicios ss   ON ss.id   = ci.subservicio_id
             WHERE ci.profesional_id = ?
               AND DATE(ci.fecha_hora_inicio) = CURDATE()
             ORDER BY ci.fecha_hora_inicio",
            [$profId]
        )->fetchAll();

        $alertasLista = Database::query(
            "SELECT a.id, a.tipo, a.nivel, a.descripcion, a.created_at,
                    CONCAT(pe_p.nombres,' ',pe_p.apellidos) AS paciente,
                    atn.id AS atencion_id
             FROM alertas a
             JOIN atenciones  atn  ON atn.id   = a.atencion_id
             JOIN pacientes   p    ON p.id      = a.paciente_id
             JOIN personas    pe_p ON pe_p.id   = p.persona_id
             WHERE a.profesional_id = ? AND a.estado = 'activa'
             ORDER BY FIELD(a.nivel,'critica','alta','moderada','informativa'),
                      a.created_at DESC
             LIMIT 10",
            [$profId]
        )->fetchAll();

        $ultimoPaciente = Database::query(
            "SELECT a.id AS atencion_id,
                    a.paciente_id,
                    CONCAT(pe_p.nombres,' ',pe_p.apellidos) AS paciente,
                    a.fecha_inicio
             FROM atenciones a
             JOIN pacientes p    ON p.id    = a.paciente_id
             JOIN personas  pe_p ON pe_p.id = p.persona_id
             WHERE a.profesional_id = ?
             ORDER BY a.fecha_inicio DESC
             LIMIT 1",
            [$profId]
        )->fetch();

        Response::json(['success' => true, 'data' => [
            'rol'                   => 'profesional',
            'mis_pacientes_activos' => $misPacientesActivos,
            'mis_citas_hoy'         => $misCitasHoy,
            'mis_alertas_activas'   => $misAlertasActivas,
            'citas_hoy_lista'       => $citasHoyLista,
            'alertas_lista'         => $alertasLista,
            'ultimo_paciente'       => $ultimoPaciente ?: null,
        ]]);
    }

    // ----------------------------------------------------------------
    // PACIENTE
    // ----------------------------------------------------------------
    private function statsPaciente(array $user): void {
        $pacRow = Database::query(
            "SELECT id FROM pacientes WHERE persona_id = ?",
            [(int) $user['persona_id']]
        )->fetch();

        if (!$pacRow) {
            Response::json(['success' => false, 'message' => 'Paciente no encontrado'], 404);
            return;
        }
        $pacId = (int) $pacRow['id'];

        $proximaCita = Database::query(
            "SELECT ci.id,
                    ci.fecha_hora_inicio,
                    ci.estado,
                    CONCAT(pe_r.nombres,' ',pe_r.apellidos) AS profesional,
                    ss.nombre AS subservicio,
                    ss.duracion_min
             FROM citas ci
             JOIN profesionales pr   ON pr.id   = ci.profesional_id
             JOIN personas      pe_r ON pe_r.id = pr.persona_id
             JOIN subservicios  ss   ON ss.id   = ci.subservicio_id
             WHERE ci.paciente_id = ?
               AND ci.fecha_hora_inicio >= NOW()
               AND ci.estado IN ('pendiente','confirmada')
             ORDER BY ci.fecha_hora_inicio
             LIMIT 1",
            [$pacId]
        )->fetch();

        $tareasPendientes = Database::query(
            "SELECT t.id, t.titulo, t.descripcion, t.fecha_limite,
                    s.numero_sesion
             FROM tareas t
             JOIN sesiones   s ON s.id = t.sesion_id
             JOIN atenciones a ON a.id = s.atencion_id
             WHERE a.paciente_id = ? AND t.estado = 'pendiente'
             ORDER BY t.fecha_limite ASC
             LIMIT 10",
            [$pacId]
        )->fetchAll();

        // Últimos 7 check-ins en orden cronológico (para el gráfico)
        $checkinsRecientes = array_reverse(Database::query(
            "SELECT DATE_FORMAT(fecha_hora, '%d/%m') AS fecha,
                    como_te_sientes,
                    dormiste_bien,
                    nivel_estres
             FROM checkin_emocional
             WHERE paciente_id = ?
             ORDER BY fecha_hora DESC
             LIMIT 7",
            [$pacId]
        )->fetchAll());

        Response::json(['success' => true, 'data' => [
            'rol'                => 'paciente',
            'proxima_cita'       => $proximaCita ?: null,
            'tareas_pendientes'  => $tareasPendientes,
            'checkins_recientes' => $checkinsRecientes,
        ]]);
    }
}
