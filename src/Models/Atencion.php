<?php
namespace Src\Models;
use Src\Core\Database;

class Atencion {

    private static function _buildConditions(int $profesionalId, string $search, ?string $desde, ?string $hasta, string $estado): array {
        $conditions = [
            'NOT EXISTS (SELECT 1 FROM atencion_vinculo_detalle avd WHERE avd.atencion_id = a.id)',
        ];
        $params = [];

        if ($profesionalId) {
            $conditions[] = 'a.profesional_id = ?';
            $params[]     = $profesionalId;
        }
        if ($search !== '') {
            $conditions[] = '(CONCAT(pe_p.nombres, " ", pe_p.apellidos) LIKE ? OR pe_p.dni LIKE ?)';
            $like         = '%' . $search . '%';
            $params[]     = $like;
            $params[]     = $like;
        }
        if ($desde) {
            $conditions[] = 'a.fecha_inicio >= ?';
            $params[]     = $desde;
        }
        if ($hasta) {
            $conditions[] = 'a.fecha_inicio <= ?';
            $params[]     = $hasta;
        }
        if ($estado !== '') {
            $conditions[] = 'a.estado = ?';
            $params[]     = $estado;
        }

        return [$conditions, $params];
    }

    public static function findAll(int $profesionalId = 0, string $search = '', ?string $desde = null, ?string $hasta = null, string $estado = ''): array {
        [$conditions, $params] = self::_buildConditions($profesionalId, $search, $desde, $hasta, $estado);
        $where = 'WHERE ' . implode(' AND ', $conditions);

        return Database::query("
            SELECT a.id,
                   a.paciente_id,
                   a.profesional_id,
                   a.fecha_inicio,
                   a.fecha_fin,
                   a.estado,
                   a.motivo_consulta,
                   a.numero_sesiones_plan,
                   pe_p.dni                                   AS paciente_dni,
                   CONCAT(pe_p.nombres, ' ', pe_p.apellidos) AS paciente,
                   CONCAT(pe_r.nombres, ' ', pe_r.apellidos) AS profesional,
                   ss.nombre  AS subservicio,
                   se.nombre  AS servicio,
                   (SELECT COUNT(*) FROM sesiones s WHERE s.atencion_id = a.id) AS sesiones_realizadas
            FROM atenciones a
            JOIN pacientes    p    ON p.id    = a.paciente_id
            JOIN personas     pe_p ON pe_p.id = p.persona_id
            JOIN profesionales pr  ON pr.id   = a.profesional_id
            JOIN personas     pe_r ON pe_r.id = pr.persona_id
            JOIN subservicios ss   ON ss.id   = a.subservicio_id
            JOIN servicios    se   ON se.id   = ss.servicio_id
            $where
            ORDER BY a.fecha_inicio DESC
        ", $params)->fetchAll();
    }

    public static function countAll(int $profesionalId = 0, string $search = '', ?string $desde = null, ?string $hasta = null, string $estado = ''): int {
        [$conditions, $params] = self::_buildConditions($profesionalId, $search, $desde, $hasta, $estado);
        $where = 'WHERE ' . implode(' AND ', $conditions);

        $row = Database::query("
            SELECT COUNT(*) AS total
            FROM atenciones a
            JOIN pacientes    p    ON p.id    = a.paciente_id
            JOIN personas     pe_p ON pe_p.id = p.persona_id
            JOIN profesionales pr  ON pr.id   = a.profesional_id
            JOIN personas     pe_r ON pe_r.id = pr.persona_id
            JOIN subservicios ss   ON ss.id   = a.subservicio_id
            JOIN servicios    se   ON se.id   = ss.servicio_id
            $where
        ", $params)->fetch();

        return (int) ($row['total'] ?? 0);
    }

    public static function findById(int|string $id): array|false {
        return Database::query("
            SELECT * FROM atenciones WHERE id = ?
        ", [$id])->fetch();
    }

    /**
     * Historial de atenciones de un paciente, con conteo de sesiones realizadas.
     */
    public static function findByPaciente(int $pacienteId, int $profesionalId = 0): array {
        $extraWhere = $profesionalId ? ' AND a.profesional_id = ?' : '';
        $params     = $profesionalId ? [$pacienteId, $profesionalId] : [$pacienteId];

        return Database::query("
            SELECT a.id,
                   a.cita_id,
                   a.profesional_id,
                   a.subservicio_id,
                   a.fecha_inicio,
                   a.fecha_fin,
                   a.estado,
                   a.motivo_consulta,
                   a.numero_sesiones_plan,
                   CONCAT(pe_r.nombres, ' ', pe_r.apellidos) AS profesional,
                   ss.nombre           AS subservicio,
                   ss.modalidad        AS subservicio_modalidad,
                   ss.duracion_min     AS duracion_min,
                   ss.precio_base      AS precio_base,
                   ss.descuento_virtual AS descuento_virtual,
                   se.nombre           AS servicio,
                   COUNT(s.id)     AS sesiones_realizadas,
                   (SELECT COUNT(*) FROM sesiones WHERE atencion_id = a.id) AS total_sesiones,
                   (SELECT avd.vinculo_id FROM atencion_vinculo_detalle avd WHERE avd.atencion_id = a.id LIMIT 1) AS vinculo_id
            FROM atenciones a
            JOIN profesionales pr  ON pr.id   = a.profesional_id
            JOIN personas     pe_r ON pe_r.id = pr.persona_id
            JOIN subservicios ss   ON ss.id   = a.subservicio_id
            JOIN servicios    se   ON se.id   = ss.servicio_id
            LEFT JOIN sesiones s ON s.atencion_id = a.id
            WHERE a.paciente_id = ?$extraWhere
            GROUP BY a.id
            ORDER BY a.fecha_inicio DESC
        ", $params)->fetchAll();
    }

    /**
     * Atención con detalle completo: sesiones, diagnósticos CIE-10 y tareas.
     */
    public static function findWithDetail(int $id): array|false {
        $atencion = Database::query("
            SELECT a.*,
                   CONCAT(pe_p.nombres, ' ', pe_p.apellidos) AS paciente,
                   pe_p.dni                                  AS paciente_dni,
                   pe_p.fecha_nacimiento,
                   pe_p.sexo,
                   a.paciente_id,
                   CONCAT(pe_r.nombres, ' ', pe_r.apellidos) AS profesional,
                   ss.nombre    AS subservicio,
                   ss.modalidad AS subservicio_modalidad,
                   se.nombre    AS servicio
            FROM atenciones a
            JOIN pacientes    p    ON p.id    = a.paciente_id
            JOIN personas     pe_p ON pe_p.id = p.persona_id
            JOIN profesionales pr  ON pr.id   = a.profesional_id
            JOIN personas     pe_r ON pe_r.id = pr.persona_id
            JOIN subservicios ss   ON ss.id   = a.subservicio_id
            JOIN servicios    se   ON se.id   = ss.servicio_id
            WHERE a.id = ?
        ", [$id])->fetch();

        if (!$atencion) return false;

        $atencion['sesiones'] = Database::query("
            SELECT s.id, s.numero_sesion, s.fecha_hora, s.duracion_min, s.nota_clinica,
                   s.modalidad_sesion, s.precio_sesion, s.paciente_paquete_id,
                   'realizada' AS estado,
                   pk.nombre AS nombre_paquete,
                   (SELECT COUNT(*) FROM adelanto_sesion WHERE sesion_id = s.id) > 0 AS tiene_adelanto
            FROM sesiones s
            LEFT JOIN paciente_paquetes pp ON pp.id = s.paciente_paquete_id
            LEFT JOIN paquetes          pk ON pk.id = pp.paquete_id
            WHERE s.atencion_id = ?
            ORDER BY s.numero_sesion
        ", [$id])->fetchAll();

        $vinculoRow = Database::query("
            SELECT avd.vinculo_id,
                   av.tipo_vinculo, av.nombre_grupo, av.estado AS vinculo_estado,
                   av.motivo_consulta_proceso, av.numero_sesiones_plan,
                   av.recomendaciones AS recomendaciones_proceso, av.hipotesis_sistemica,
                   avd.rol_en_grupo, avd.es_responsable_pago,
                   avd.precio_cuota, avd.precio_final
            FROM atencion_vinculo_detalle avd
            JOIN atenciones_vinculadas av ON av.id = avd.vinculo_id
            WHERE avd.atencion_id = ?
            LIMIT 1
        ", [$id])->fetch();

        if ($vinculoRow) {
            $vinculoId = (int) $vinculoRow['vinculo_id'];

            $participantes = Database::query("
                SELECT avd2.atencion_id, avd2.rol_en_grupo, avd2.relacion_con_titular,
                       avd2.precio_cuota, avd2.precio_final,
                       CONCAT(pe.nombres, ' ', pe.apellidos) AS paciente,
                       pe.dni AS paciente_dni,
                       a.estado AS atencion_estado
                FROM atencion_vinculo_detalle avd2
                JOIN atenciones  a  ON a.id  = avd2.atencion_id
                JOIN pacientes   p  ON p.id  = a.paciente_id
                JOIN personas    pe ON pe.id = p.persona_id
                WHERE avd2.vinculo_id = ? AND avd2.atencion_id != ?
                ORDER BY avd2.id
            ", [$vinculoId, $id])->fetchAll();

            $atencion['vinculo_id'] = $vinculoId;
            $atencion['vinculo'] = [
                'id'                      => $vinculoId,
                'tipo_vinculo'            => $vinculoRow['tipo_vinculo'],
                'nombre_grupo'            => $vinculoRow['nombre_grupo'],
                'estado'                  => $vinculoRow['vinculo_estado'],
                'rol_en_grupo'            => $vinculoRow['rol_en_grupo'],
                'es_responsable_pago'     => (bool) $vinculoRow['es_responsable_pago'],
                'precio_cuota'            => $vinculoRow['precio_cuota'] !== null ? (float) $vinculoRow['precio_cuota'] : null,
                'precio_final'            => $vinculoRow['precio_final'] !== null ? (float) $vinculoRow['precio_final'] : null,
                'motivo_consulta_proceso' => $vinculoRow['motivo_consulta_proceso'],
                'numero_sesiones_plan'    => $vinculoRow['numero_sesiones_plan'] !== null ? (int) $vinculoRow['numero_sesiones_plan'] : null,
                'recomendaciones_proceso' => $vinculoRow['recomendaciones_proceso'],
                'hipotesis_sistemica'     => $vinculoRow['hipotesis_sistemica'],
                'participantes'           => $participantes,
            ];
            $atencion['sesiones_grupo'] = SesionGrupo::findByVinculo($vinculoId);
            $atencion['numero_sesiones_plan_efectivo'] = $vinculoRow['numero_sesiones_plan'] !== null ? (int) $vinculoRow['numero_sesiones_plan'] : null;
        } else {
            $atencion['vinculo_id']     = null;
            $atencion['vinculo']        = null;
            $atencion['sesiones_grupo'] = [];
            $atencion['numero_sesiones_plan_efectivo'] = $atencion['numero_sesiones_plan'] !== null ? (int) $atencion['numero_sesiones_plan'] : null;
        }

        $atencion['diagnosticos'] = Database::query("
            SELECT da.id,
                   da.cie10_codigo,
                   da.jerarquia,
                   da.nivel_certeza,
                   da.fecha_dx,
                   da.observacion_clinica,
                   c.descripcion_corta,
                   c.descripcion AS descripcion_cie10
            FROM diagnosticos_atencion da
            JOIN cie10 c ON c.codigo = da.cie10_codigo
            WHERE da.atencion_id = ?
            ORDER BY da.jerarquia, da.fecha_dx
        ", [$id])->fetchAll();

        $atencion['tareas'] = Database::query("
            SELECT t.id,
                   t.titulo,
                   t.descripcion,
                   t.fecha_asignacion,
                   t.fecha_limite,
                   t.estado,
                   t.respuesta_paciente,
                   s.numero_sesion
            FROM tareas t
            JOIN sesiones s ON s.id = t.sesion_id
            WHERE s.atencion_id = ?
            ORDER BY t.fecha_asignacion DESC
        ", [$id])->fetchAll();

        // --- EXTRAS PARA REDISEÑO ---

        // 1. Check-ins emocionales vinculados a la atención
        $atencion['checkins'] = Database::query("
            SELECT * FROM checkin_emocional 
            WHERE atencion_id = ? 
            ORDER BY fecha_hora DESC
        ", [$id])->fetchAll();

        // 2. Información Financiera para el Badge
        // Paquete activo
        $atencion['finanzas']['paquete'] = Database::query("
            SELECT pp.id, pp.sesiones_restantes, pk.nombre AS nombre_paquete, pk.sesiones_incluidas
            FROM paciente_paquetes pp
            JOIN paquetes pk ON pk.id = pp.paquete_id
            WHERE pp.atencion_id = ? AND pp.estado = 'activo'
            LIMIT 1
        ", [$id])->fetch();

        // Adelanto disponible
        $atencion['finanzas']['adelanto'] = Database::query("
            SELECT SUM(saldo_disponible) AS saldo_disponible
            FROM adelantos_paciente
            WHERE paciente_id = ? AND profesional_id = ? AND estado = 'activo'
        ", [$atencion['paciente_id'], $atencion['profesional_id']])->fetch();

        // Saldo pendiente de esta atención (incluye cuentas grupales del vínculo)
        $atencion['finanzas']['pendiente'] = Database::query("
            SELECT SUM(saldo_pendiente) AS total_pendiente
            FROM cuentas_cobro
            WHERE estado IN ('pendiente', 'pago_parcial')
              AND (atencion_id = ? OR vinculo_id = ?)
        ", [$id, $atencion['vinculo_id'] ?? 0])->fetch();

        // 3. Próxima Cita
        $atencion['proxima_cita'] = Database::query("
            SELECT fecha_hora_inicio, modalidad_sesion AS modalidad
            FROM citas
            WHERE atencion_id = ? AND estado IN ('pendiente', 'confirmada') AND fecha_hora_inicio > NOW()
            ORDER BY fecha_hora_inicio ASC
            LIMIT 1
        ", [$id])->fetch();

        return $atencion;
    }

    public static function create(array $data): int {
        Database::query("
            INSERT INTO atenciones (
                paciente_id, profesional_id, cita_id, subservicio_id,
                grado_instruccion, ocupacion, estado_civil, edad,
                motivo_consulta, observacion_general, observacion_conducta,
                antecedentes_relevantes, recomendaciones,
                fecha_inicio, numero_sesiones_plan
            )
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ", [
            $data['paciente_id'],
            $data['profesional_id'],
            $data['cita_id']               ?? null,
            $data['subservicio_id'],
            $data['grado_instruccion']     ?? 'no_especificado',
            $data['ocupacion']             ?? null,
            $data['estado_civil']          ?? 'no_especificado',
            isset($data['edad']) && $data['edad'] !== null ? (int) $data['edad'] : null,
            $data['motivo_consulta'],
            $data['observacion_general']   ?? null,
            $data['observacion_conducta']  ?? null,
            $data['antecedentes_relevantes'] ?? null,
            $data['recomendaciones']       ?? null,
            $data['fecha_inicio'],
            $data['numero_sesiones_plan']  ?? null,
        ]);
        return (int) Database::getInstance()->lastInsertId();
    }

    public static function cerrar(int|string $id, string $fecha_fin): void {
        Database::query("
            UPDATE atenciones SET estado = 'completada', fecha_fin = ? WHERE id = ?
        ", [$fecha_fin, $id]);
    }

    public static function pausar(int $id): void {
        Database::query("UPDATE atenciones SET estado = 'pausada' WHERE id = ?", [$id]);
    }

    public static function reactivar(int $id): void {
        Database::query("UPDATE atenciones SET estado = 'activa' WHERE id = ?", [$id]);
    }

    public static function update(int $id, array $data): void {
        Database::query("
            UPDATE atenciones
            SET numero_sesiones_plan   = ?,
                motivo_consulta        = ?,
                observacion_general    = ?,
                observacion_conducta   = ?,
                antecedentes_relevantes = ?
            WHERE id = ?
        ", [
            isset($data['numero_sesiones_plan']) && $data['numero_sesiones_plan'] !== ''
                ? (int) $data['numero_sesiones_plan'] : null,
            $data['motivo_consulta']         ?? null,
            $data['observacion_general']     ?? null,
            $data['observacion_conducta']    ?? null,
            $data['antecedentes_relevantes'] ?? null,
            $id,
        ]);
    }
}
