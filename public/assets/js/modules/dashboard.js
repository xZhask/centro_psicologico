/* ================================================================
   dashboard.js — Dashboard con KPIs y gráficos según rol
   ================================================================ */

// Guarda instancias de Chart.js para destruirlas antes de redibujar
const _dashCharts = {};

function _destroyDashCharts() {
    Object.values(_dashCharts).forEach(c => c.destroy());
    Object.keys(_dashCharts).forEach(k => delete _dashCharts[k]);
}

function escDash(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ----------------------------------------------------------------
// Punto de entrada — el router llama a dashboard()
// ----------------------------------------------------------------
async function dashboard() {
    _destroyDashCharts();

    document.getElementById('view').innerHTML =
        '<p style="padding:2rem;color:var(--color-text-muted)">Cargando dashboard...</p>';

    const res = await api('/api/dashboard');
    if (!res.success) {
        document.getElementById('view').innerHTML =
            `<p style="padding:2rem;color:var(--color-danger)">${escDash(res.message)}</p>`;
        return;
    }

    const d = res.data;
    if (d.rol === 'administrador') {
        _renderAdmin(d);
    } else if (d.rol === 'profesional') {
        _renderProfesional(d);
    } else {
        _renderPaciente(d);
    }
}

// ================================================================
// ADMINISTRADOR
// ================================================================
function _renderAdmin(d) {
    const alertaBorde = d.alertas_activas > 0
        ? 'border:2px solid var(--color-danger)'
        : 'border:2px solid var(--color-border)';
    const alertaColor = d.alertas_activas > 0 ? 'color:var(--color-danger)' : '';
    const pulso = d.alertas_activas > 0
        ? `<span style="position:absolute;top:8px;right:10px;width:10px;height:10px;
                        border-radius:50%;background:var(--color-danger);
                        animation:pulse 1.4s infinite"></span>` : '';

    document.getElementById('view').innerHTML = `
        <h2>Dashboard</h2>

        <!-- KPIs -->
        <div class="kpis">
            <div class="kpi">
                <span class="kpi-num">${escDash(d.pacientes_activos)}</span><br>Pacientes activos
            </div>
            <div class="kpi">
                <span class="kpi-num">${escDash(d.citas_hoy)}</span><br>Citas hoy
            </div>
            <div class="kpi">
                <span class="kpi-num">S/ ${parseFloat(d.ingresos_mes || 0).toFixed(2)}</span><br>Ingresos del mes
            </div>
            <div class="kpi" onclick="navigate('alertas')" style="cursor:pointer;position:relative;${alertaBorde}">
                <span class="kpi-num" style="${alertaColor}">${escDash(d.alertas_activas)}</span><br>Alertas activas
                ${pulso}
            </div>
        </div>

        <!-- Gráficos -->
        <div class="charts-grid">
            <div class="chart-card">
                <h3 style="margin-bottom:.8rem;font-size:.95rem;color:var(--color-text-muted)">
                    Citas por semana (últimas 4)
                </h3>
                <canvas id="chartCitasSemanas"></canvas>
            </div>
            <div class="chart-card">
                <h3 style="margin-bottom:.8rem;font-size:.95rem;color:var(--color-text-muted)">
                    Distribución por servicio
                </h3>
                <canvas id="chartDistServicios"></canvas>
            </div>
            <div class="chart-card">
                <h3 style="margin-bottom:.8rem;font-size:.95rem;color:var(--color-text-muted)">
                    Ingresos últimos 6 meses
                </h3>
                <canvas id="chartIngresosMeses"></canvas>
            </div>
        </div>

        <!-- Tabla: próximas citas de hoy -->
        <div class="card" style="margin-top:1.5rem;padding:1.2rem 1.4rem">
            <h3 style="margin-bottom:1rem">Próximas citas de hoy</h3>
            ${_tablaProximasCitas(d.proximas_citas_hoy)}
        </div>
    `;

    // Gráfico de barras: citas por semana
    _dashCharts.semanas = new Chart(
        document.getElementById('chartCitasSemanas').getContext('2d'), {
        type: 'bar',
        data: {
            labels:   (d.citas_semanas || []).map(s => `Sem. ${s.etiqueta}`),
            datasets: [{
                label:           'Citas',
                data:            (d.citas_semanas || []).map(s => s.total),
                backgroundColor: 'rgba(46,134,193,0.75)',
                borderColor:     '#2E86C1',
                borderWidth:     1,
                borderRadius:    4,
            }],
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales:  { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
        },
    });

    // Gráfico de torta: distribución por servicio
    const PALETA = ['#2E86C1','#27AE60','#F39C12','#E74C3C','#9B59B6','#1ABC9C','#E67E22'];
    _dashCharts.servicios = new Chart(
        document.getElementById('chartDistServicios').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels:   (d.dist_servicios || []).map(s => s.servicio),
            datasets: [{
                data:            (d.dist_servicios || []).map(s => s.total),
                backgroundColor: (d.dist_servicios || []).map((_, i) => PALETA[i % PALETA.length]),
                borderWidth:     2,
            }],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } },
            },
        },
    });

    // Gráfico de línea: ingresos por mes
    _dashCharts.ingresos = new Chart(
        document.getElementById('chartIngresosMeses').getContext('2d'), {
        type: 'line',
        data: {
            labels:   (d.ingresos_meses || []).map(m => m.mes),
            datasets: [{
                label:           'Ingresos (S/)',
                data:            (d.ingresos_meses || []).map(m => m.total),
                borderColor:     '#27AE60',
                backgroundColor: 'rgba(39,174,96,0.10)',
                fill:            true,
                tension:         0.35,
                pointRadius:     4,
            }],
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: v => 'S/ ' + v.toLocaleString() },
                },
            },
        },
    });
}

function _tablaProximasCitas(citas) {
    if (!citas || !citas.length) {
        return '<p style="color:var(--color-text-muted)">Sin citas programadas para hoy.</p>';
    }
    const BADGE = {
        pendiente:  'badge-pendiente',
        confirmada: 'badge-confirmada',
        completada: 'badge-completada',
    };
    let rows = citas.map(c => `
        <tr>
            <td>${escDash(_horaCorta(c.fecha_hora_inicio))}</td>
            <td>${escDash(c.paciente)}</td>
            <td>${escDash(c.profesional)}</td>
            <td>${escDash(c.subservicio)}</td>
            <td><span class="badge ${BADGE[c.estado] || 'badge-info'}">${escDash(c.estado)}</span></td>
        </tr>`).join('');
    return `
        <div style="overflow-x:auto">
            <table class="table">
                <thead>
                    <tr><th>Hora</th><th>Paciente</th><th>Profesional</th><th>Servicio</th><th>Estado</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

// ================================================================
// PROFESIONAL
// ================================================================
function _renderProfesional(d) {
    const alertaBorde = d.mis_alertas_activas > 0
        ? 'border:2px solid var(--color-danger)' : 'border:2px solid var(--color-border)';
    const alertaColor = d.mis_alertas_activas > 0 ? 'color:var(--color-danger)' : '';
    const pulso = d.mis_alertas_activas > 0
        ? `<span style="position:absolute;top:8px;right:10px;width:10px;height:10px;
                        border-radius:50%;background:var(--color-danger);
                        animation:pulse 1.4s infinite"></span>` : '';

    // Acceso rápido al último paciente
    let ultimoPacienteCard = '';
    if (d.ultimo_paciente) {
        const up = d.ultimo_paciente;
        ultimoPacienteCard = `
            <div class="card" style="margin-top:1.5rem;padding:1.2rem 1.4rem;
                         display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
                <div>
                    <p style="font-size:.82rem;color:var(--color-text-muted);margin-bottom:.2rem">Último paciente atendido</p>
                    <strong style="font-size:1.1rem">${escDash(up.paciente)}</strong>
                    <span style="color:var(--color-text-muted);font-size:.85rem;margin-left:.5rem">
                        desde ${escDash(up.fecha_inicio)}
                    </span>
                </div>
                <button class="btn btn-primary btn-sm"
                        onclick="verDetalleAtencion(${escDash(up.atencion_id)})">
                    Ver historial
                </button>
            </div>`;
    }

    document.getElementById('view').innerHTML = `
        <h2>Mi Dashboard</h2>

        <!-- KPIs -->
        <div class="kpis">
            <div class="kpi">
                <span class="kpi-num">${escDash(d.mis_pacientes_activos)}</span><br>Mis pacientes activos
            </div>
            <div class="kpi">
                <span class="kpi-num">${escDash(d.mis_citas_hoy)}</span><br>Mis citas hoy
            </div>
            <div class="kpi" onclick="navigate('alertas')" style="cursor:pointer;position:relative;${alertaBorde}">
                <span class="kpi-num" style="${alertaColor}">${escDash(d.mis_alertas_activas)}</span><br>Alertas activas
                ${pulso}
            </div>
        </div>

        <!-- Dos columnas -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;margin-top:1.5rem">
            <!-- Citas de hoy -->
            <div class="card" style="padding:1.2rem 1.4rem">
                <h3 style="margin-bottom:1rem">Mis citas de hoy</h3>
                ${_listaCitasHoyProf(d.citas_hoy_lista)}
            </div>
            <!-- Alertas activas -->
            <div class="card" style="padding:1.2rem 1.4rem">
                <h3 style="margin-bottom:1rem">Alertas activas de mis pacientes</h3>
                ${_listaAlertasProf(d.alertas_lista)}
            </div>
        </div>

        ${ultimoPacienteCard}
    `;
}

function _listaCitasHoyProf(citas) {
    if (!citas || !citas.length) {
        return '<p style="color:var(--color-text-muted);font-size:.9rem">Sin citas programadas para hoy.</p>';
    }
    const BADGE = { pendiente: 'badge-pendiente', confirmada: 'badge-confirmada', completada: 'badge-completada' };
    return citas.map(c => `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:.55rem 0;border-bottom:1px solid var(--color-border)">
            <div>
                <strong style="font-size:.93rem">${escDash(c.paciente)}</strong><br>
                <span style="font-size:.82rem;color:var(--color-text-muted)">
                    ${escDash(_horaCorta(c.fecha_hora_inicio))} · ${escDash(c.subservicio)} · ${escDash(c.duracion_min)} min
                </span>
            </div>
            <span class="badge ${BADGE[c.estado] || 'badge-info'}">${escDash(c.estado)}</span>
        </div>`).join('');
}

function _listaAlertasProf(alertas) {
    if (!alertas || !alertas.length) {
        return '<p style="color:var(--color-text-muted);font-size:.9rem">Sin alertas activas.</p>';
    }
    const NIVEL_COLOR = {
        critica:     'var(--color-danger)',
        alta:        '#e67e22',
        moderada:    'var(--color-warning)',
        informativa: 'var(--color-info)',
    };
    return alertas.map(a => `
        <div style="padding:.55rem 0;border-bottom:1px solid var(--color-border)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <strong style="font-size:.9rem">${escDash(a.paciente)}</strong>
                <span class="badge" style="background:${NIVEL_COLOR[a.nivel] || '#6c757d'};color:#fff;font-size:.75rem">
                    ${escDash(a.nivel)}
                </span>
            </div>
            <p style="font-size:.82rem;color:var(--color-text-muted);margin:.15rem 0 0">
                ${escDash(a.tipo.replace(/_/g, ' '))} — ${escDash(a.descripcion || '')}
            </p>
        </div>`).join('');
}

// ================================================================
// PACIENTE
// ================================================================
function _renderPaciente(d) {
    // Próxima cita
    let proximaCitaHtml;
    if (d.proxima_cita) {
        const c = d.proxima_cita;
        const estadoBadge = c.estado === 'confirmada'
            ? '<span class="badge badge-confirmada">Confirmada</span>'
            : '<span class="badge badge-pendiente">Pendiente</span>';
        proximaCitaHtml = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.8rem">
                <div>
                    <p style="font-size:1.4rem;font-weight:600;margin-bottom:.2rem">
                        ${escDash(_fechaLegible(c.fecha_hora_inicio))}
                    </p>
                    <p style="color:var(--color-text-muted);font-size:.9rem">
                        ${escDash(c.subservicio)} · ${escDash(c.profesional)} · ${escDash(c.duracion_min)} min
                    </p>
                </div>
                ${estadoBadge}
            </div>`;
    } else {
        proximaCitaHtml = `<p style="color:var(--color-text-muted)">No tienes citas próximas agendadas.</p>`;
    }

    // Tareas pendientes
    let tareasHtml;
    if (d.tareas_pendientes && d.tareas_pendientes.length) {
        tareasHtml = d.tareas_pendientes.map(t => {
            const vencimiento = t.fecha_limite
                ? `<span style="font-size:.8rem;color:var(--color-text-muted)">Hasta ${escDash(t.fecha_limite)}</span>`
                : '';
            return `
                <div style="display:flex;justify-content:space-between;align-items:flex-start;
                            padding:.6rem 0;border-bottom:1px solid var(--color-border)">
                    <div>
                        <strong style="font-size:.93rem">${escDash(t.titulo)}</strong><br>
                        <span style="font-size:.82rem;color:var(--color-text-muted)">
                            Sesión #${escDash(t.numero_sesion)}${t.descripcion ? ' — ' + escDash(t.descripcion) : ''}
                        </span>
                    </div>
                    ${vencimiento}
                </div>`;
        }).join('');
    } else {
        tareasHtml = `<p style="color:var(--color-text-muted);font-size:.9rem">Sin tareas pendientes. ¡Bien hecho!</p>`;
    }

    // Mini gráfico emocional
    const hayCheckins = d.checkins_recientes && d.checkins_recientes.length > 0;

    document.getElementById('view').innerHTML = `
        <h2>Mi Panel</h2>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;margin-bottom:1.2rem">
            <!-- Próxima cita -->
            <div class="card" style="padding:1.2rem 1.4rem">
                <h3 style="margin-bottom:.8rem">Próxima cita</h3>
                ${proximaCitaHtml}
            </div>

            <!-- Acceso rápido al check-in -->
            <div class="card" style="padding:1.2rem 1.4rem;display:flex;flex-direction:column;
                         justify-content:center;align-items:center;gap:.8rem;text-align:center">
                <p style="font-size:.95rem;color:var(--color-text-muted)">
                    ¿Cómo te sientes hoy?
                </p>
                <button class="btn btn-primary" style="font-size:1rem;padding:.65rem 1.8rem"
                        onclick="navigate('checkin')">
                    Hacer Check-in Emocional
                </button>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.2rem">
            <!-- Tareas pendientes -->
            <div class="card" style="padding:1.2rem 1.4rem">
                <h3 style="margin-bottom:.8rem">
                    Tareas pendientes
                    ${d.tareas_pendientes && d.tareas_pendientes.length
                        ? `<span class="badge badge-danger" style="font-size:.8rem;margin-left:.4rem">
                               ${d.tareas_pendientes.length}
                           </span>` : ''}
                </h3>
                ${tareasHtml}
            </div>

            <!-- Gráfico evolución emocional -->
            <div class="chart-card" style="padding:1.2rem 1.4rem">
                <h3 style="margin-bottom:.8rem;font-size:.95rem;color:var(--color-text-muted)">
                    Mi evolución emocional (últimos 7 check-ins)
                </h3>
                ${hayCheckins
                    ? '<canvas id="chartEmocional"></canvas>'
                    : '<p style="color:var(--color-text-muted);font-size:.9rem;margin-top:.5rem">Aún no tienes check-ins registrados.</p>'}
            </div>
        </div>
    `;

    if (hayCheckins) {
        const ci = d.checkins_recientes;
        _dashCharts.emocional = new Chart(
            document.getElementById('chartEmocional').getContext('2d'), {
            type: 'line',
            data: {
                labels: ci.map(c => c.fecha),
                datasets: [
                    {
                        label:           'Estado de ánimo',
                        data:            ci.map(c => c.como_te_sientes),
                        borderColor:     '#2E86C1',
                        backgroundColor: 'rgba(46,134,193,0.08)',
                        fill:            false,
                        tension:         0.35,
                        pointRadius:     4,
                    },
                    {
                        label:           'Sueño',
                        data:            ci.map(c => c.dormiste_bien),
                        borderColor:     '#27AE60',
                        backgroundColor: 'rgba(39,174,96,0.08)',
                        fill:            false,
                        tension:         0.35,
                        pointRadius:     4,
                    },
                    {
                        label:           'Estrés',
                        data:            ci.map(c => c.nivel_estres),
                        borderColor:     '#E74C3C',
                        backgroundColor: 'rgba(231,76,60,0.08)',
                        fill:            false,
                        tension:         0.35,
                        pointRadius:     4,
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10 } },
                },
                scales: {
                    y: {
                        min: 0, max: 10,
                        ticks: { stepSize: 2 },
                    },
                },
            },
        });
    }
}

// ================================================================
// Utilidades de formato
// ================================================================
function _horaCorta(fechaHora) {
    if (!fechaHora) return '-';
    const partes = String(fechaHora).split(' ');
    return partes[1] ? partes[1].substring(0, 5) : partes[0];
}

function _fechaLegible(fechaHora) {
    if (!fechaHora) return '-';
    try {
        const dt = new Date(String(fechaHora).replace(' ', 'T'));
        return dt.toLocaleString('es-PE', {
            weekday: 'long', day: 'numeric', month: 'long',
            hour: '2-digit', minute: '2-digit',
        });
    } catch (_) {
        return fechaHora;
    }
}
