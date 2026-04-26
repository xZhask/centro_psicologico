/* ================================================================
   dashboard.js — Dashboard con KPIs y gráficos según rol
   ================================================================ */

const _dashCharts = {};

function _destroyDashCharts() {
    Object.values(_dashCharts).forEach(c => c.destroy());
    Object.keys(_dashCharts).forEach(k => delete _dashCharts[k]);
}

function escDash(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _initials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return (parts[0][0] || '?').toUpperCase();
    return ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase();
}

function _saludo(nombres) {
    const h = new Date().getHours();
    const s = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    return `${s}, ${nombres}`;
}

// ----------------------------------------------------------------
// Punto de entrada
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

    if (d.rol === 'administrador' && !d.alertas_lista) {
        const ar = await api('/api/alertas');
        d.alertas_lista = ar.success ? (ar.data || []).slice(0, 5) : [];
    }

    if (d.rol === 'administrador')   _renderAdmin(d);
    else if (d.rol === 'profesional') _renderProfesional(d);
    else {
        // Cargar paquete activo del paciente en paralelo
        const pqRes = await api('/api/paciente-paquetes/mio').catch(() => null);
        d._paqueteActivo = (pqRes?.success && pqRes.data) ? pqRes.data : null;
        _renderPaciente(d);
    }
}

// ================================================================
// SHARED HELPERS
// ================================================================

function _kpiCard(color, label, value, tendencia) {
    return `
        <div style="background:#fff;border:0.5px solid var(--color-border);border-left:3px solid ${color};border-radius:12px;padding:14px 16px">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-muted);margin-bottom:4px">${label}</div>
            <div style="font-size:26px;font-weight:500;color:${color};margin-bottom:4px">${escDash(value)}</div>
            <div style="font-size:11px;color:var(--color-text-muted)">${tendencia}</div>
        </div>`;
}

function _kpiCardAlertas(count) {
    const urgente = count > 0;
    const borderStyle = urgente
        ? 'border:0.5px solid rgba(231,76,60,.3);border-left:3px solid #E74C3C;background:#FFF8F8'
        : 'border:0.5px solid var(--color-border);border-left:3px solid #E74C3C';
    const labelColor = urgente ? 'color:#E74C3C' : 'color:var(--color-text-muted)';
    const valColor   = urgente ? '#E74C3C' : 'var(--color-success)';
    const tendencia  = urgente
        ? `<span style="color:#E74C3C">⚠ requieren atención</span>`
        : `<span style="color:var(--color-success)">todo en orden</span>`;
    return `
        <div onclick="navigate('alertas')" style="cursor:pointer;${borderStyle};border-radius:12px;padding:14px 16px">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;${labelColor}">ALERTAS ACTIVAS</div>
            <div style="font-size:26px;font-weight:500;color:${valColor};margin-bottom:4px">${count}</div>
            <div style="font-size:11px">${tendencia}</div>
        </div>`;
}

function _proxCitasHoy(citas) {
    if (!citas || !citas.length) {
        return '<p style="text-align:center;color:var(--color-text-muted);font-size:11.5px;font-weight:300;padding:14px 0">No hay citas programadas para hoy</p>';
    }
    const BG = ['rgba(42,127,143,.12)', 'rgba(155,126,200,.12)', 'rgba(232,131,106,.12)', 'rgba(232,184,75,.12)'];
    const FG = ['#2A7F8F', '#7B5EA7', '#C0392B', '#9A7010'];
    const ESTADO = {
        confirmada: 'background:rgba(155,126,200,.15);color:#7B5EA7',
        pendiente:  'background:rgba(232,184,75,.15);color:#9A7010',
    };
    const list = citas.slice(0, 5);
    return list.map((c, i) => {
        const isLast = i === list.length - 1;
        const hora = _horaCorta(c.fecha_hora_inicio);
        const ini  = _initials(c.paciente || '');
        const estilo = ESTADO[c.estado] || 'background:rgba(108,117,125,.12);color:#6C757D';
        return `
            <div style="display:flex;align-items:center;gap:9px;padding:7px 0;${isLast ? '' : 'border-bottom:0.5px solid var(--color-border)'}">
                <span style="font-size:11px;font-weight:500;color:#2A7F8F;min-width:38px;flex-shrink:0">${escDash(hora)}</span>
                <div style="width:26px;height:26px;border-radius:50%;background:${BG[i % 4]};color:${FG[i % 4]};font-size:10px;font-weight:500;display:flex;align-items:center;justify-content:center;flex-shrink:0">${escDash(ini)}</div>
                <div style="flex:1;min-width:0">
                    <div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escDash(c.paciente)}</div>
                    <div style="font-size:10.5px;font-weight:300;color:var(--color-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escDash(c.subservicio || '')}${c.profesional ? ' · ' + escDash(c.profesional) : ''}</div>
                </div>
                <span style="font-size:10px;padding:2px 7px;border-radius:99px;${estilo};flex-shrink:0">${escDash(c.estado)}</span>
            </div>`;
    }).join('');
}

function _alertasList(alertas) {
    if (!alertas || !alertas.length) {
        return '<p style="text-align:center;color:var(--color-success);font-size:11.5px;font-weight:300;padding:14px 0">Sin alertas activas</p>';
    }
    const DOT = { critica: '#E74C3C', alta: '#E8836A', moderada: '#E8B84B', informativa: '#9B7EC8' };
    const list = alertas.slice(0, 5);
    return list.map((a, i) => {
        const isLast = i === list.length - 1;
        const color  = DOT[a.nivel] || '#6C757D';
        const titulo = (a.tipo || 'Alerta').replace(/_/g, ' ');
        const desc   = a.descripcion
            ? (a.descripcion.length > 60 ? a.descripcion.substring(0, 60) + '…' : a.descripcion)
            : '';
        return `
            <div style="display:flex;align-items:flex-start;gap:9px;padding:7px 0;${isLast ? '' : 'border-bottom:0.5px solid var(--color-border)'}">
                <span style="width:8px;height:8px;border-radius:50%;background:${color};margin-top:4px;flex-shrink:0"></span>
                <div style="flex:1;min-width:0">
                    <div style="font-size:12px;font-weight:500">${escDash(titulo)}</div>
                    ${desc ? `<div style="font-size:11px;font-weight:300;color:var(--color-text-muted)">${escDash(desc)}</div>` : ''}
                </div>
                <span style="font-size:10.5px;color:${color};flex-shrink:0">${escDash(a.nivel || '')}</span>
            </div>`;
    }).join('');
}

// ================================================================
// ADMINISTRADOR
// ================================================================
function _renderAdmin(d) {
    const nombres = (getUser()?.nombres || '').split(' ')[0] || 'Administrador';
    const alertasCount = parseInt(d.alertas_activas || 0);
    const ingresosNum  = parseFloat(d.ingresos_mes || 0);
    const ingresosStr  = 'S/ ' + ingresosNum.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    document.getElementById('view').innerHTML = `
        <div style="margin-bottom:18px">
            <div style="font-size:18px;font-weight:500;color:var(--color-text)">${escDash(_saludo(nombres))}</div>
            <div style="font-size:12.5px;font-weight:300;color:var(--color-text-muted)">Aquí tienes el resumen de hoy</div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">
            ${_kpiCard('#2A7F8F', 'PACIENTES ACTIVOS',  d.pacientes_activos, 'total registrados')}
            ${_kpiCard('#9B7EC8', 'CITAS HOY',           d.citas_hoy,         'programadas para hoy')}
            ${_kpiCard('#E8B84B', 'INGRESOS DEL MES',    ingresosStr,         ingresosNum === 0 ? 'sin pagos registrados' : 'acumulado este mes')}
            ${_kpiCardAlertas(alertasCount)}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
            <div style="background:#fff;border:0.5px solid var(--color-border);border-radius:12px;padding:16px 18px">
                <div style="font-size:12px;font-weight:500;color:var(--color-text)">Citas por semana</div>
                <div style="font-size:11px;font-weight:300;color:var(--color-text-muted);margin-bottom:10px">Últimas 4 semanas</div>
                <div style="position:relative;height:160px"><canvas id="chartCitasSemanas"></canvas></div>
            </div>
            <div style="background:#fff;border:0.5px solid var(--color-border);border-radius:12px;padding:16px 18px">
                <div style="font-size:12px;font-weight:500;color:var(--color-text)">Ingresos mensuales</div>
                <div style="font-size:11px;font-weight:300;color:var(--color-text-muted);margin-bottom:10px">Últimos 6 meses (S/)</div>
                <div style="position:relative;height:160px"><canvas id="chartIngresosMeses"></canvas></div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div style="background:#fff;border:0.5px solid var(--color-border);border-radius:12px;padding:16px 18px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <span style="font-size:12px;font-weight:500">Próximas citas de hoy</span>
                    <button onclick="navigate('citas')" style="background:none;border:none;font-size:11.5px;color:#2A7F8F;cursor:pointer;padding:0;font-family:var(--font)">Ver todas</button>
                </div>
                ${_proxCitasHoy(d.proximas_citas_hoy)}
            </div>
            <div style="background:#fff;border:0.5px solid var(--color-border);border-radius:12px;padding:16px 18px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <span style="font-size:12px;font-weight:500;${alertasCount > 0 ? 'color:#E74C3C' : 'color:var(--color-text)'}">Alertas activas</span>
                    <button onclick="navigate('alertas')" style="background:none;border:none;font-size:11.5px;color:#2A7F8F;cursor:pointer;padding:0;font-family:var(--font)">Gestionar</button>
                </div>
                ${_alertasList(d.alertas_lista)}
            </div>
        </div>
    `;

    _dashCharts.semanas = new Chart(
        document.getElementById('chartCitasSemanas').getContext('2d'), {
        type: 'bar',
        data: {
            labels:   (d.citas_semanas || []).map(s => `Sem. ${s.etiqueta}`),
            datasets: [{ data: (d.citas_semanas || []).map(s => s.total), backgroundColor: '#2A7F8F33', borderColor: '#2A7F8F', borderWidth: 1.5, borderRadius: 5 }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 }, color: '#888' }, grid: { color: '#f0f0f0' } },
                x: { ticks: { font: { size: 10 }, color: '#888' }, grid: { display: false } },
            },
        },
    });

    _dashCharts.ingresos = new Chart(
        document.getElementById('chartIngresosMeses').getContext('2d'), {
        type: 'line',
        data: {
            labels:   (d.ingresos_meses || []).map(m => m.mes),
            datasets: [{ data: (d.ingresos_meses || []).map(m => m.total), borderColor: '#E8836A', backgroundColor: '#E8836A18', fill: true, tension: 0.35, pointRadius: 3, borderWidth: 2 }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => 'S/ ' + v.toLocaleString(), font: { size: 10 }, color: '#888' }, grid: { color: '#f0f0f0' } },
                x: { ticks: { font: { size: 10 }, color: '#888' }, grid: { display: false } },
            },
        },
    });
}

// ================================================================
// PROFESIONAL
// ================================================================
function _renderProfesional(d) {
    const nombres = (getUser()?.nombres || '').split(' ')[0] || 'Profesional';
    const alertasCount = parseInt(d.mis_alertas_activas || 0);

    document.getElementById('view').innerHTML = `
        <div style="margin-bottom:18px">
            <div style="font-size:18px;font-weight:500;color:var(--color-text)">${escDash(_saludo(nombres))}</div>
            <div style="font-size:12.5px;font-weight:300;color:var(--color-text-muted)">Aquí tienes el resumen de hoy</div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">
            ${_kpiCard('#2A7F8F', 'MIS PACIENTES ACTIVOS', d.mis_pacientes_activos, 'total registrados')}
            ${_kpiCard('#9B7EC8', 'MIS CITAS HOY',          d.mis_citas_hoy,          'programadas para hoy')}
            ${_kpiCardAlertas(alertasCount)}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div style="background:#fff;border:0.5px solid var(--color-border);border-radius:12px;padding:16px 18px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <span style="font-size:12px;font-weight:500">Mis citas de hoy</span>
                    <button onclick="navigate('citas')" style="background:none;border:none;font-size:11.5px;color:#2A7F8F;cursor:pointer;padding:0;font-family:var(--font)">Ver todas</button>
                </div>
                ${_proxCitasHoy(d.citas_hoy_lista)}
            </div>
            <div style="background:#fff;border:0.5px solid var(--color-border);border-radius:12px;padding:16px 18px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <span style="font-size:12px;font-weight:500;${alertasCount > 0 ? 'color:#E74C3C' : 'color:var(--color-text)'}">Alertas activas</span>
                    <button onclick="navigate('alertas')" style="background:none;border:none;font-size:11.5px;color:#2A7F8F;cursor:pointer;padding:0;font-family:var(--font)">Gestionar</button>
                </div>
                ${_alertasList(d.alertas_lista)}
            </div>
        </div>
    `;
}

// ================================================================
// PACIENTE
// ================================================================
function _renderPaciente(d) {
    const nombres = (getUser()?.nombres || '').split(' ')[0] || 'Usuario';

    let proximaCitaHtml;
    if (d.proxima_cita) {
        const c = d.proxima_cita;
        const estilo = c.estado === 'confirmada'
            ? 'background:rgba(155,126,200,.15);color:#7B5EA7'
            : 'background:rgba(232,184,75,.15);color:#9A7010';
        proximaCitaHtml = `
            <div style="font-size:20px;font-weight:500;color:#2A7F8F;margin-bottom:6px">${escDash(_fechaLegible(c.fecha_hora_inicio))}</div>
            <div style="font-size:13px;color:var(--color-text-muted);margin-bottom:10px">${escDash(c.subservicio)} · ${escDash(c.profesional)}</div>
            <span style="font-size:10px;padding:2px 8px;border-radius:99px;${estilo}">${escDash(c.estado)}</span>
            <div style="margin-top:14px">
                <button onclick="navigate('citas')" style="padding:8px 16px;font-size:13px;border-radius:8px;border:none;cursor:pointer;color:#fff;background:#2A7F8F;font-family:var(--font)">Ver mis citas</button>
            </div>`;
    } else {
        proximaCitaHtml = `
            <p style="color:var(--color-text-muted);font-size:13px;margin:0 0 12px">No tienes citas próximas agendadas.</p>
            <button onclick="navigate('citas')" style="padding:8px 16px;font-size:13px;border-radius:8px;border:1px solid #2A7F8F;cursor:pointer;color:#2A7F8F;background:transparent;font-family:var(--font)">Solicitar cita</button>`;
    }

    let tareasHtml;
    if (d.tareas_pendientes && d.tareas_pendientes.length) {
        const list = d.tareas_pendientes.slice(0, 4);
        tareasHtml = list.map((t, i) => {
            const isLast = i === list.length - 1;
            return `
                <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:7px 0;${isLast ? '' : 'border-bottom:0.5px solid var(--color-border)'}">
                    <div>
                        <div style="font-size:12px;font-weight:500">${escDash(t.titulo)}</div>
                        ${t.fecha_limite ? `<div style="font-size:11px;color:var(--color-text-muted)">Hasta ${escDash(t.fecha_limite)}</div>` : ''}
                    </div>
                    <button style="font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid var(--color-border);background:none;cursor:pointer;color:var(--color-text-muted);font-family:var(--font)">Responder</button>
                </div>`;
        }).join('');
    } else {
        tareasHtml = '<p style="text-align:center;color:var(--color-text-muted);font-size:11.5px;font-weight:300;padding:14px 0">Sin tareas asignadas</p>';
    }

    const hayCheckins = d.checkins_recientes && d.checkins_recientes.length > 0;

    document.getElementById('view').innerHTML = `
        <div style="margin-bottom:18px">
            <div style="font-size:18px;font-weight:500;color:var(--color-text)">${escDash(_saludo(nombres))}</div>
            <div style="font-size:12.5px;font-weight:300;color:var(--color-text-muted)">Aquí tienes tu panel personal</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div style="background:#fff;border:0.5px solid var(--color-border);border-radius:12px;padding:16px 18px">
                <div style="font-size:12px;font-weight:500;margin-bottom:12px">Tu próxima cita</div>
                ${proximaCitaHtml}
            </div>
            <div style="background:#fff;border:0.5px solid var(--color-border);border-radius:12px;padding:16px 18px">
                <div style="font-size:12px;font-weight:500;margin-bottom:12px">Tareas pendientes</div>
                ${tareasHtml}
            </div>
        </div>

        <div style="background:#fff;border:0.5px solid var(--color-border);border-radius:12px;padding:16px 18px;margin-bottom:10px">
            <div style="font-size:12px;font-weight:500;margin-bottom:12px">Mi estado emocional</div>
            ${hayCheckins
                ? '<div style="position:relative;height:100px"><canvas id="chartEmocional"></canvas></div>'
                : '<p style="text-align:center;color:var(--color-text-muted);font-size:11.5px;font-weight:300;padding:10px 0">Aún no tienes check-ins registrados.</p>'}
            <div style="margin-top:12px;text-align:center">
                <button onclick="navigate('checkin')" style="padding:8px 20px;font-size:13px;border-radius:8px;border:none;cursor:pointer;color:#fff;background:#2A7F8F;font-family:var(--font)">Registrar check-in de hoy</button>
            </div>
        </div>

        ${d._paqueteActivo ? `
        <div style="background:#fff;border:0.5px solid rgba(155,126,200,.4);border-radius:12px;padding:16px 18px">
            <div style="font-size:12px;font-weight:500;margin-bottom:12px;color:#7B5EA7">Tu paquete actual</div>
            <div style="font-size:15px;font-weight:500;margin-bottom:4px">${escDash(d._paqueteActivo.nombre_paquete)}</div>
            <div style="margin:10px 0 6px;font-size:12px;color:var(--color-text-muted)">
                ${parseInt(d._paqueteActivo.sesiones_incluidas) - parseInt(d._paqueteActivo.sesiones_restantes)} de ${parseInt(d._paqueteActivo.sesiones_incluidas)} sesiones utilizadas
            </div>
            <div style="height:8px;background:var(--color-border);border-radius:4px;overflow:hidden;margin-bottom:6px">
                <div style="width:${d._paqueteActivo.sesiones_incluidas > 0 ? Math.round(((parseInt(d._paqueteActivo.sesiones_incluidas) - parseInt(d._paqueteActivo.sesiones_restantes)) / parseInt(d._paqueteActivo.sesiones_incluidas)) * 100) : 0}%;height:100%;background:#7B5EA7;border-radius:4px"></div>
            </div>
            <div style="font-size:22px;font-weight:500;color:#2A7F8F">${d._paqueteActivo.sesiones_restantes}</div>
            <div style="font-size:11px;color:var(--color-text-muted)">sesiones restantes</div>
        </div>` : ''}
    `;

    if (hayCheckins) {
        const ci = d.checkins_recientes;
        _dashCharts.emocional = new Chart(
            document.getElementById('chartEmocional').getContext('2d'), {
            type: 'line',
            data: {
                labels: ci.map(c => c.fecha),
                datasets: [
                    { label: 'Estado',  data: ci.map(c => c.como_te_sientes), borderColor: '#2A7F8F', backgroundColor: 'rgba(42,127,143,.08)',  fill: false, tension: .35, pointRadius: 3 },
                    { label: 'Estrés',  data: ci.map(c => c.nivel_estres),    borderColor: '#E8836A', backgroundColor: 'rgba(232,131,106,.08)', fill: false, tension: .35, pointRadius: 3 },
                    { label: 'Sueño',   data: ci.map(c => c.dormiste_bien),   borderColor: '#9B7EC8', backgroundColor: 'rgba(155,126,200,.08)', fill: false, tension: .35, pointRadius: 3 },
                ],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 10 } } } },
                scales: {
                    y: { min: 0, max: 10, ticks: { stepSize: 2, font: { size: 10 }, color: '#888' }, grid: { color: '#f0f0f0' } },
                    x: { ticks: { font: { size: 10 }, color: '#888' }, grid: { display: false } },
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
        return dt.toLocaleString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    } catch (_) { return fechaHora; }
}
