<?php
namespace Src\Models;
use Src\Core\Database;

class Reporte {

    public static function historialPaciente(int $pacienteId): array {
        return Database::query(
            "SELECT * FROM v_historial_paciente WHERE paciente_id = ? ORDER BY fecha_inicio DESC, numero_sesion ASC",
            [$pacienteId]
        )->fetchAll();
    }

    public static function saldoPacientes(){
        return Database::query("SELECT * FROM v_saldo_pacientes")->fetchAll();
    }

    public static function resumenCheckin(){
        return Database::query("SELECT * FROM v_resumen_checkin")->fetchAll();
    }

    public static function agendaHoy(){
        return Database::query("SELECT * FROM v_agenda_dia")->fetchAll();
    }
}
