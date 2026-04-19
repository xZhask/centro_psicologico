/* ================================================================
   reportes.js — Reportes clínicos y financieros
   Roles: administrador (todos), profesional (solo clínicos, sus datos)
   ================================================================ */

// ── Instancias Chart.js ──────────────────────────────────────────
const _reportCharts = {};

function _destroyReportCharts() {
    Object.values(_reportCharts).forEach(c => { try { c.destroy(); } catch (_) {} });
    Object.keys(_reportCharts).forEach(k => delete _reportCharts[k]);
}

// ── Escape HTML ──────────────────────────────────────────────────
function _escR(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Formato monetario ────────────────────────────────────────────
function _money(n) {
    if (n == null || n === '') return '—';
    return 'S/ ' + parseFloat(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Paleta de marca ──────────────────────────────────────────────
const _C = {
    teal:    '#2A7F8F',
    tealD:   '#1D6270',
    tealA:   'rgba(42,127,143,.12)',
    gold:    '#E8B84B',
    goldD:   '#C9982A',
    goldA:   'rgba(232,184,75,.12)',
    success: '#27AE60',
    danger:  '#E74C3C',
    warning: '#F39C12',
    primary: '#2E86C1',
    muted:   '#6C757D',
};

// ── Iconos SVG 14 px ─────────────────────────────────────────────
const _ICONS = {
    progreso:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="18" y="3" width="4" height="18"/><rect x="12" y="8" width="4" height="13"/><rect x="6" y="13" width="4" height="8"/><rect x="0" y="18" width="4" height="3"/></svg>',
    asistencia:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>',
    carga:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    facturacion: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    morosidad:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    ingresos:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
};

// ── Fecha helpers ────────────────────────────────────────────────
function _hoy()           { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function _primerDiaMes()  { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; }
function _primerDiaAnio() { return `${new Date().getFullYear()}-01-01`; }

// ── KPI card ─────────────────────────────────────────────────────
function _kpi(label, value, color) {
    return `<div class="card" style="padding:.9rem 1.1rem;border-top:3px solid ${color}">
        <div style="font-size:.73rem;color:var(--color-text-muted);margin-bottom:.3rem;text-transform:uppercase;letter-spacing:.04em">${_escR(label)}</div>
        <div style="font-size:1.3rem;font-weight:700;color:${color}">${_escR(String(value ?? '—'))}</div>
    </div>`;
}

// ── Barra de progreso inline ─────────────────────────────────────
function _barraProgreso(pct, color) {
    const w = Math.min(Math.max(parseFloat(pct) || 0, 0), 100);
    return `<div style="display:flex;align-items:center;gap:.5rem;min-width:120px">
        <div style="flex:1;height:6px;background:var(--color-border);border-radius:3px">
            <div style="width:${w}%;height:100%;background:${color};border-radius:3px;transition:.3s"></div>
        </div>
        <span style="font-size:.8rem;color:var(--color-text-muted);white-space:nowrap">${w.toFixed(1)}%</span>
    </div>`;
}

/* ================================================================
   PUNTO DE ENTRADA
   ================================================================ */
async function reportes() {
    _destroyReportCharts();

    const user    = getUser();
    const esAdmin = user?.rol === 'administrador';

    const tabBtn = (id, label, grupo, color) =>
        `<button class="rep-tab" data-rep="${id}" data-grupo="${grupo}"
            onclick="_activarReporte('${id}')"
            style="display:inline-flex;align-items:center;gap:.4rem;padding:.42rem .82rem;
                   border-radius:var(--radius);border:.5px solid var(--color-border);
                   background:var(--color-bg);color:var(--color-text-muted);
                   font-size:.82rem;font-weight:500;cursor:pointer;white-space:nowrap;
                   transition:var(--transition)">
            ${_ICONS[id]}${_escR(label)}
        </button>`;

    const grupLabel = (txt, color) =>
        `<div style="font-size:.7rem;font-weight:600;letter-spacing:.07em;text-transform:uppercase;
                     color:${color};margin-bottom:.4rem;padding-left:.1rem">${txt}</div>`;

    const html = `<div style="padding:1.5rem">
        <h2 style="margin:0 0 1.4rem;font-size:1.3rem;font-weight:600">Reportes</h2>

        ${grupLabel('Clínicos', _C.teal)}
        <div style="display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:1.3rem">
            ${tabBtn('progreso',   'Progreso por paciente', 'teal', _C.teal)}
            ${tabBtn('asistencia', 'Tasa de asistencia',    'teal', _C.teal)}
            ${esAdmin ? tabBtn('carga', 'Carga por profesional', 'teal', _C.teal) : ''}
        </div>

        ${esAdmin ? `
        ${grupLabel('Financieros', _C.gold)}
        <div style="display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:1.3rem">
            ${tabBtn('facturacion', 'Facturación por período', 'gold', _C.gold)}
            ${tabBtn('morosidad',   'Cobranza y morosidad',    'gold', _C.gold)}
            ${tabBtn('ingresos',    'Ingresos por servicio',   'gold', _C.gold)}
        </div>` : ''}

        <div id="reporteContent" style="min-height:200px"></div>
    </div>`;

    document.getElementById('view').innerHTML = html;
    _activarReporte('progreso');
}

// ── Activar tab ──────────────────────────────────────────────────
function _activarReporte(id) {
    _destroyReportCharts();

    document.querySelectorAll('.rep-tab').forEach(t => {
        const activo = t.dataset.rep === id;
        const color  = t.dataset.grupo === 'gold' ? _C.gold : _C.teal;
        t.style.background  = activo ? color : '';
        t.style.color       = activo ? '#fff' : '';
        t.style.borderColor = activo ? color : '';
        t.style.boxShadow   = activo ? `0 2px 8px ${color}55` : '';
    });

    document.getElementById('reporteContent').innerHTML =
        '<p style="color:var(--color-text-muted);padding:1rem 0">Cargando…</p>';

    const dispatch = {
        progreso:    _renderProgreso,
        asistencia:  _renderAsistencia,
        carga:       _renderCarga,
        facturacion: _renderFacturacion,
        morosidad:   _renderMorosidad,
        ingresos:    _renderIngresos,
    };
    if (dispatch[id]) dispatch[id]();
}

/* ================================================================
   1 · PROGRESO POR PACIENTE
   ================================================================ */
async function _renderProgreso() {
    const user    = getUser();
    const esAdmin = user?.rol === 'administrador';
    const cont    = document.getElementById('reporteContent');

    cont.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:.75rem;align-items:flex-end;margin-bottom:1.2rem">
            ${esAdmin ? `<div class="form-group" style="margin:0;min-width:210px">
                <label>Profesional</label>
                <select id="fProgresoProf" class="input" onchange="_cargarProgreso()">
                    <option value="">Todos los profesionales</option>
                </select>
            </div>` : ''}
        </div>
        <div id="repBody"><p style="color:var(--color-text-muted)">Cargando…</p></div>`;

    if (esAdmin) {
        const rp  = await api('/api/profesionales');
        const sel = document.getElementById('fProgresoProf');
        if (sel && rp.data) {
            rp.data.forEach(p => {
                const o = document.createElement('option');
                o.value = p.id;
                o.textContent = `${p.apellidos || ''}, ${p.nombres || ''}`;
                sel.appendChild(o);
            });
        }
    }
    _cargarProgreso();
}

async function _cargarProgreso() {
    const user    = getUser();
    const esAdmin = user?.rol === 'administrador';
    const profId  = esAdmin ? (document.getElementById('fProgresoProf')?.value || '') : '';

    let url = '/api/reportes/progreso';
    if (profId) url += `?profesional_id=${encodeURIComponent(profId)}`;

    const res  = await api(url);
    const cont = document.getElementById('repBody');
    if (!cont) return;

    if (!res.success) { cont.innerHTML = `<p style="color:var(--color-danger)">${_escR(res.message)}</p>`; return; }

    const data = res.data || [];

    // KPIs
    const conPlan   = data.filter(d => d.sesiones_planificadas > 0);
    const avgAvance = conPlan.length
        ? (conPlan.reduce((s, d) => s + parseFloat(d.porcentaje_avance || 0), 0) / conPlan.length).toFixed(1)
        : null;
    const conEstado = data.filter(d => d.promedio_estado_emocional != null);
    const avgEstado = conEstado.length
        ? (conEstado.reduce((s, d) => s + parseFloat(d.promedio_estado_emocional), 0) / conEstado.length).toFixed(1)
        : null;
    const estadoColor = avgEstado == null ? _C.muted
        : parseFloat(avgEstado) >= 7 ? _C.success
        : parseFloat(avgEstado) >= 4 ? _C.warning : _C.danger;

    let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:1.5rem">
        ${_kpi('Atenciones activas',     data.length,                          _C.teal)}
        ${_kpi('Avance promedio',          avgAvance != null ? avgAvance + '%' : '—', _C.teal)}
        ${_kpi('Estado emocional (avg)',   avgEstado != null ? avgEstado + ' / 10' : '—', estadoColor)}
    </div>`;

    if (!data.length) {
        html += `<div class="card" style="padding:2rem;text-align:center;color:var(--color-text-muted)">Sin atenciones activas para mostrar.</div>`;
        cont.innerHTML = html;
        return;
    }

    html += `
    <div class="card" style="padding:1.2rem;margin-bottom:1.2rem">
        <h3 style="font-size:.93rem;font-weight:600;margin:0 0 1rem">Sesiones realizadas vs planificadas</h3>
        <div style="position:relative;height:240px"><canvas id="chartProgreso"></canvas></div>
    </div>
    <div class="card" style="padding:1.2rem;overflow-x:auto">
        <table class="table"><thead><tr>
            <th>Paciente</th>
            ${esAdmin ? '<th>Profesional</th>' : ''}
            <th>Subservicio</th>
            <th>Progreso</th>
            <th>Estado emocional</th>
            <th>Estrés</th>
            <th>Último check-in</th>
        </tr></thead><tbody>`;

    data.forEach(d => {
        const av  = d.porcentaje_avance != null ? parseFloat(d.porcentaje_avance) : null;
        const avC = av == null ? null : av >= 75 ? _C.success : av >= 40 ? _C.teal : _C.warning;
        const avCell = av != null
            ? _barraProgreso(av, avC)
            : `<span style="color:var(--color-text-muted);font-size:.83rem">Sin plan</span>`;

        const ev = d.promedio_estado_emocional != null ? parseFloat(d.promedio_estado_emocional) : null;
        const ec = ev == null ? _C.muted : ev >= 7 ? _C.success : ev >= 4 ? _C.warning : _C.danger;
        const evB = ev != null
            ? `<span class="badge" style="background:${ec};color:#fff">${ev.toFixed(1)}</span>`
            : '<span style="color:var(--color-text-muted)">—</span>';

        const sv = d.promedio_estres != null ? parseFloat(d.promedio_estres) : null;
        const sc = sv == null ? _C.muted : sv >= 7 ? _C.danger : sv >= 4 ? _C.warning : _C.success;
        const svB = sv != null
            ? `<span class="badge" style="background:${sc};color:#fff">${sv.toFixed(1)}</span>`
            : '<span style="color:var(--color-text-muted)">—</span>';

        html += `<tr>
            <td>${_escR(d.paciente)}</td>
            ${esAdmin ? `<td style="font-size:.87rem">${_escR(d.profesional)}</td>` : ''}
            <td style="font-size:.87rem">${_escR(d.subservicio)}</td>
            <td>${avCell}</td>
            <td>${evB}</td>
            <td>${svB}</td>
            <td style="white-space:nowrap;font-size:.83rem;color:var(--color-text-muted)">${d.ultimo_checkin ? _escR(String(d.ultimo_checkin).slice(0, 16)) : '—'}</td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    cont.innerHTML = html;

    const ctx = document.getElementById('chartProgreso');
    if (!ctx) return;
    _reportCharts.progreso = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.paciente.split(' ').slice(0, 2).join(' ')),
            datasets: [
                { label: 'Realizadas',   data: data.map(d => parseInt(d.sesiones_realizadas) || 0), backgroundColor: _C.teal, borderRadius: 4 },
                { label: 'Planificadas', data: data.map(d => d.sesiones_planificadas ? parseInt(d.sesiones_planificadas) : null), backgroundColor: 'rgba(42,127,143,.35)', borderRadius: 4 },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales:  { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
        },
    });
}

/* ================================================================
   2 · TASA DE ASISTENCIA
   ================================================================ */
async function _renderAsistencia() {
    const cont  = document.getElementById('reporteContent');
    const desde = _primerDiaMes();
    const hasta = _hoy();

    cont.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:.75rem;align-items:flex-end;margin-bottom:1.2rem">
            <div class="form-group" style="margin:0">
                <label>Desde</label>
                <input type="date" id="fAsistDesde" class="input" value="${desde}" style="width:148px">
            </div>
            <div class="form-group" style="margin:0">
                <label>Hasta</label>
                <input type="date" id="fAsistHasta" class="input" value="${hasta}" style="width:148px">
            </div>
            <button class="btn btn-primary" style="padding:.43rem .9rem;font-size:.85rem" onclick="_cargarAsistencia()">
                Aplicar
            </button>
        </div>
        <div id="repBody"><p style="color:var(--color-text-muted)">Cargando…</p></div>`;

    _cargarAsistencia();
}

async function _cargarAsistencia() {
    const desde = document.getElementById('fAsistDesde')?.value || _primerDiaMes();
    const hasta = document.getElementById('fAsistHasta')?.value || _hoy();
    const cont  = document.getElementById('repBody');
    if (!cont) return;

    const res = await api(`/api/reportes/asistencia?fecha_desde=${encodeURIComponent(desde)}&fecha_hasta=${encodeURIComponent(hasta)}`);
    if (!res.success) { cont.innerHTML = `<p style="color:var(--color-danger)">${_escR(res.message)}</p>`; return; }

    const { por_profesional: profs = [], tendencia = [] } = res.data || {};
    const totalCitas = profs.reduce((s, p) => s + parseInt(p.total_citas),  0);
    const totalComp  = profs.reduce((s, p) => s + parseInt(p.completadas), 0);
    const totalNA    = profs.reduce((s, p) => s + parseInt(p.no_asistio),  0);
    const tasaGlobal = totalCitas > 0 ? (totalComp / totalCitas * 100).toFixed(1) : null;
    const tgColor    = tasaGlobal == null ? _C.muted
        : parseFloat(tasaGlobal) >= 80 ? _C.success
        : parseFloat(tasaGlobal) >= 60 ? _C.warning : _C.danger;

    let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;margin-bottom:1.5rem">
        ${_kpi('Total citas',    totalCitas,  _C.teal)}
        ${_kpi('Completadas',    totalComp,   _C.success)}
        ${_kpi('Tasa global',    tasaGlobal != null ? tasaGlobal + '%' : '—', tgColor)}
        ${_kpi('No asistieron',  totalNA,     totalNA > 0 ? _C.danger : _C.muted)}
    </div>`;

    if (!profs.length) {
        html += `<div class="card" style="padding:2rem;text-align:center;color:var(--color-text-muted)">Sin citas en el período seleccionado.</div>`;
        cont.innerHTML = html;
        return;
    }

    html += `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.2rem">
        <div class="card" style="padding:1.2rem">
            <h3 style="font-size:.93rem;font-weight:600;margin:0 0 1rem">Tasa por profesional</h3>
            <div style="position:relative;height:220px"><canvas id="chartAsistBar"></canvas></div>
        </div>
        <div class="card" style="padding:1.2rem">
            <h3 style="font-size:.93rem;font-weight:600;margin:0 0 1rem">Tendencia semanal</h3>
            <div style="position:relative;height:220px"><canvas id="chartAsistLine"></canvas></div>
        </div>
    </div>
    <div class="card" style="padding:1.2rem;overflow-x:auto">
        <table class="table"><thead><tr>
            <th>Profesional</th><th style="text-align:center">Total</th>
            <th style="text-align:center">Completadas</th><th style="text-align:center">No asistió</th>
            <th style="text-align:center">Canceladas</th><th>Tasa</th>
        </tr></thead><tbody>`;

    profs.forEach(p => {
        const t = parseFloat(p.tasa_asistencia);
        const c = t >= 80 ? _C.success : t >= 60 ? _C.warning : _C.danger;
        html += `<tr>
            <td>${_escR(p.profesional)}</td>
            <td style="text-align:center">${p.total_citas}</td>
            <td style="text-align:center">${p.completadas}</td>
            <td style="text-align:center">${p.no_asistio}</td>
            <td style="text-align:center">${p.canceladas}</td>
            <td><span class="badge" style="background:${c};color:#fff">${t.toFixed(1)}%</span></td>
        </tr>`;
    });
    html += `</tbody></table></div>`;
    cont.innerHTML = html;

    const ctxBar = document.getElementById('chartAsistBar');
    if (ctxBar) {
        _reportCharts.asistBar = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: profs.map(p => p.profesional.split(' ').slice(0, 2).join(' ')),
                datasets: [{
                    label: 'Tasa (%)',
                    data:  profs.map(p => parseFloat(p.tasa_asistencia)),
                    backgroundColor: profs.map(p =>
                        parseFloat(p.tasa_asistencia) >= 80 ? _C.teal :
                        parseFloat(p.tasa_asistencia) >= 60 ? _C.warning : _C.danger),
                    borderRadius: 4,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales:  { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } },
            },
        });
    }

    const ctxLine = document.getElementById('chartAsistLine');
    if (ctxLine) {
        _reportCharts.asistLine = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: tendencia.map(t => t.inicio_semana ? String(t.inicio_semana).slice(0, 10) : t.semana),
                datasets: [{
                    label: 'Tasa (%)',
                    data:  tendencia.map(t => parseFloat(t.tasa)),
                    borderColor: _C.teal, backgroundColor: _C.tealA,
                    fill: true, tension: .3, pointRadius: 4,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales:  { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } },
            },
        });
    }
}

/* ================================================================
   3 · CARGA POR PROFESIONAL  (solo administrador)
   ================================================================ */
async function _renderCarga() {
    const cont = document.getElementById('reporteContent');
    const res  = await api('/api/reportes/carga');

    if (!res.success) { cont.innerHTML = `<p style="color:var(--color-danger)">${_escR(res.message)}</p>`; return; }

    const data = res.data || [];
    if (!data.length) {
        cont.innerHTML = `<div class="card" style="padding:2rem;text-align:center;color:var(--color-text-muted)">Sin datos disponibles.</div>`;
        return;
    }

    const totAt  = data.reduce((s, d) => s + parseInt(d.atenciones_activas), 0);
    const totPac = data.reduce((s, d) => s + parseInt(d.pacientes_distintos), 0);
    const totAl  = data.reduce((s, d) => s + parseInt(d.alertas_activas),    0);

    let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:1rem;margin-bottom:1.5rem">
        ${_kpi('Profesionales',       data.length,   _C.teal)}
        ${_kpi('Atenciones activas',  totAt,          _C.teal)}
        ${_kpi('Pacientes en proceso', totPac,        _C.teal)}
        ${_kpi('Alertas activas',     totAl,          totAl > 0 ? _C.warning : _C.success)}
    </div>
    <div class="card" style="padding:1.2rem;margin-bottom:1.2rem">
        <h3 style="font-size:.93rem;font-weight:600;margin:0 0 1rem">Carga de trabajo — últimos 7 días</h3>
        <div style="position:relative;height:240px"><canvas id="chartCarga"></canvas></div>
    </div>
    <div class="card" style="padding:1.2rem;overflow-x:auto">
        <table class="table"><thead><tr>
            <th>Profesional</th><th>Especialidad</th>
            <th style="text-align:center">Atenciones</th>
            <th style="text-align:center">Sesiones semana</th>
            <th style="text-align:center">Pacientes</th>
            <th style="text-align:center">Alertas</th>
        </tr></thead><tbody>`;

    data.forEach(d => {
        html += `<tr>
            <td>${_escR(d.profesional)}</td>
            <td style="color:var(--color-text-muted);font-size:.87rem">${_escR(d.especialidad || '—')}</td>
            <td style="text-align:center">${d.atenciones_activas}</td>
            <td style="text-align:center">${d.sesiones_semana}</td>
            <td style="text-align:center">${d.pacientes_distintos}</td>
            <td style="text-align:center">${parseInt(d.alertas_activas) > 0
                ? `<span class="badge" style="background:${_C.warning};color:#fff">${d.alertas_activas}</span>`
                : '<span style="color:var(--color-text-muted)">0</span>'}</td>
        </tr>`;
    });
    html += `</tbody></table></div>`;
    cont.innerHTML = html;

    const ctx = document.getElementById('chartCarga');
    if (!ctx) return;
    _reportCharts.carga = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.profesional.split(' ').slice(0, 2).join(' ')),
            datasets: [
                { label: 'Atenciones activas',  data: data.map(d => parseInt(d.atenciones_activas)), backgroundColor: _C.teal,    borderRadius: 3 },
                { label: 'Sesiones esta semana', data: data.map(d => parseInt(d.sesiones_semana)),    backgroundColor: _C.tealD,   borderRadius: 3 },
                { label: 'Alertas activas',      data: data.map(d => parseInt(d.alertas_activas)),    backgroundColor: _C.warning, borderRadius: 3 },
            ],
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales:  { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
        },
    });
}

/* ================================================================
   4 · FACTURACIÓN POR PERÍODO  (solo administrador)
   ================================================================ */
async function _renderFacturacion() {
    const cont  = document.getElementById('reporteContent');
    const desde = _primerDiaMes();
    const hasta = _hoy();

    cont.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:.75rem;align-items:flex-end;margin-bottom:1.2rem">
            <div class="form-group" style="margin:0">
                <label>Desde</label>
                <input type="date" id="fFactDesde" class="input" value="${desde}" style="width:148px">
            </div>
            <div class="form-group" style="margin:0">
                <label>Hasta</label>
                <input type="date" id="fFactHasta" class="input" value="${hasta}" style="width:148px">
            </div>
            <button class="btn btn-primary" style="padding:.43rem .9rem;font-size:.85rem" onclick="_cargarFacturacion()">
                Aplicar
            </button>
        </div>
        <div id="repBody"><p style="color:var(--color-text-muted)">Cargando…</p></div>`;

    _cargarFacturacion();
}

async function _cargarFacturacion() {
    const desde = document.getElementById('fFactDesde')?.value || _primerDiaMes();
    const hasta = document.getElementById('fFactHasta')?.value || _hoy();
    const cont  = document.getElementById('repBody');
    if (!cont) return;

    const res = await api(`/api/reportes/facturacion?fecha_desde=${encodeURIComponent(desde)}&fecha_hasta=${encodeURIComponent(hasta)}`);
    if (!res.success) { cont.innerHTML = `<p style="color:var(--color-danger)">${_escR(res.message)}</p>`; return; }

    const d   = res.data || {};
    const tf  = parseFloat(d.total_facturado  || 0);
    const tc  = parseFloat(d.total_cobrado    || 0);
    const tp  = parseFloat(d.total_pendiente  || 0);
    const pct = tf > 0 ? (tc / tf * 100).toFixed(1) : '0';
    const pctColor = parseFloat(pct) >= 80 ? _C.success : parseFloat(pct) >= 50 ? _C.warning : _C.danger;

    let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:1rem;margin-bottom:1.5rem">
        ${_kpi('Total facturado', _money(tf), _C.gold)}
        ${_kpi('Total cobrado',   _money(tc), _C.success)}
        ${_kpi('Pendiente',       _money(tp), tp > 0 ? _C.warning : _C.success)}
        ${_kpi('Tasa de cobro',   pct + '%',  pctColor)}
        ${_kpi('Atenciones',      d.cantidad_atenciones || 0, _C.gold)}
    </div>`;

    if (tf === 0) {
        html += `<div class="card" style="padding:2rem;text-align:center;color:var(--color-text-muted)">Sin facturación en el período seleccionado.</div>`;
        cont.innerHTML = html;
        return;
    }

    html += `
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:1rem;margin-bottom:1.2rem">
        <div class="card" style="padding:1.2rem">
            <h3 style="font-size:.93rem;font-weight:600;margin:0 0 1rem">Facturación semanal</h3>
            <div style="position:relative;height:220px"><canvas id="chartFactLine"></canvas></div>
        </div>
        <div class="card" style="padding:1.2rem">
            <h3 style="font-size:.93rem;font-weight:600;margin:0 0 1rem">Por servicio</h3>
            <div style="position:relative;height:220px"><canvas id="chartFactDonut"></canvas></div>
        </div>
    </div>`;

    cont.innerHTML = html;

    const semanas = d.por_semana || [];
    const ctxLine = document.getElementById('chartFactLine');
    if (ctxLine) {
        _reportCharts.factLine = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: semanas.map(s => s.inicio_semana ? String(s.inicio_semana).slice(0, 10) : s.semana),
                datasets: [{
                    label: 'Facturado (S/)',
                    data:  semanas.map(s => parseFloat(s.monto)),
                    borderColor: _C.gold, backgroundColor: _C.goldA,
                    fill: true, tension: .3, pointRadius: 4,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales:  { y: { beginAtZero: true, ticks: { callback: v => 'S/' + v } } },
            },
        });
    }

    const servicios = d.por_servicio || [];
    const ctxDonut  = document.getElementById('chartFactDonut');
    if (ctxDonut && servicios.length) {
        const pal = [_C.gold, _C.teal, _C.primary, _C.success, _C.warning, _C.danger];
        _reportCharts.factDonut = new Chart(ctxDonut, {
            type: 'doughnut',
            data: {
                labels:   servicios.map(s => s.servicio),
                datasets: [{ data: servicios.map(s => parseFloat(s.monto_facturado)), backgroundColor: pal.slice(0, servicios.length), borderWidth: 2, borderColor: '#fff' }],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend:  { position: 'bottom', labels: { font: { size: 11 } } },
                    tooltip: { callbacks: { label: ctx => `S/ ${ctx.parsed.toFixed(2)}` } },
                },
            },
        });
    }
}

/* ================================================================
   5 · COBRANZA Y MOROSIDAD  (solo administrador)
   ================================================================ */
async function _renderMorosidad() {
    const cont = document.getElementById('reporteContent');
    const res  = await api('/api/reportes/morosidad');

    if (!res.success) { cont.innerHTML = `<p style="color:var(--color-danger)">${_escR(res.message)}</p>`; return; }

    const data      = res.data || [];
    const totalPend = data.reduce((s, d) => s + parseFloat(d.saldo_pendiente), 0);
    const maxMora   = data.reduce((m, d) => Math.max(m, parseInt(d.dias_mora || 0)), 0);

    let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:1.5rem">
        ${_kpi('Cuentas en mora',  data.length,       data.length > 0 ? _C.warning : _C.success)}
        ${_kpi('Total pendiente',  _money(totalPend), totalPend > 0 ? _C.danger : _C.success)}
        ${_kpi('Mayor antigüedad', maxMora + ' días', maxMora > 60 ? _C.danger : maxMora > 30 ? _C.warning : _C.gold)}
    </div>`;

    if (!data.length) {
        html += `<div class="card" style="padding:2rem;text-align:center">
            <strong style="font-size:1.05rem;color:var(--color-success)">Sin cuentas en mora.</strong><br>
            <span style="color:var(--color-text-muted)">Todas las cuentas están al día.</span>
        </div>`;
        cont.innerHTML = html;
        return;
    }

    html += `<div class="card" style="padding:1.2rem;overflow-x:auto">
        <table class="table"><thead><tr>
            <th>Paciente</th><th>Concepto</th>
            <th>Total</th><th>Pagado</th><th>Pendiente</th>
            <th>Emisión</th><th style="text-align:center">Días mora</th><th>Estado</th>
        </tr></thead><tbody>`;

    data.forEach(d => {
        const dias   = parseInt(d.dias_mora || 0);
        const dColor = dias > 60 ? _C.danger : dias > 30 ? _C.warning : _C.gold;
        const eMap   = { pendiente: [_C.warning, 'Pendiente'], pago_parcial: [_C.gold, 'Parcial'] };
        const [eColor, eLabel] = eMap[d.estado] || [_C.muted, d.estado || ''];

        html += `<tr>
            <td>${_escR(d.paciente)}</td>
            <td style="font-size:.84rem;max-width:185px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_escR(d.concepto)}">${_escR(d.concepto)}</td>
            <td style="white-space:nowrap">${_money(d.monto_total)}</td>
            <td style="white-space:nowrap">${_money(d.monto_pagado)}</td>
            <td style="white-space:nowrap;font-weight:600;color:${_C.danger}">${_money(d.saldo_pendiente)}</td>
            <td style="white-space:nowrap;font-size:.84rem">${_escR(d.fecha_emision)}</td>
            <td style="text-align:center"><span class="badge" style="background:${dColor};color:#fff">${dias}d</span></td>
            <td><span class="badge" style="background:${eColor};color:#fff">${_escR(eLabel)}</span></td>
        </tr>`;
    });
    html += `</tbody></table></div>`;
    cont.innerHTML = html;
}

/* ================================================================
   6 · INGRESOS POR SERVICIO  (solo administrador)
   ================================================================ */
async function _renderIngresos() {
    const cont  = document.getElementById('reporteContent');
    const desde = _primerDiaAnio();
    const hasta = _hoy();

    cont.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:.75rem;align-items:flex-end;margin-bottom:1.2rem">
            <div class="form-group" style="margin:0">
                <label>Desde</label>
                <input type="date" id="fIngDesde" class="input" value="${desde}" style="width:148px">
            </div>
            <div class="form-group" style="margin:0">
                <label>Hasta</label>
                <input type="date" id="fIngHasta" class="input" value="${hasta}" style="width:148px">
            </div>
            <button class="btn btn-primary" style="padding:.43rem .9rem;font-size:.85rem" onclick="_cargarIngresos()">
                Aplicar
            </button>
        </div>
        <div id="repBody"><p style="color:var(--color-text-muted)">Cargando…</p></div>`;

    _cargarIngresos();
}

async function _cargarIngresos() {
    const desde = document.getElementById('fIngDesde')?.value || _primerDiaAnio();
    const hasta = document.getElementById('fIngHasta')?.value || _hoy();
    const cont  = document.getElementById('repBody');
    if (!cont) return;

    const res = await api(`/api/reportes/ingresos?fecha_desde=${encodeURIComponent(desde)}&fecha_hasta=${encodeURIComponent(hasta)}`);
    if (!res.success) { cont.innerHTML = `<p style="color:var(--color-danger)">${_escR(res.message)}</p>`; return; }

    const detalle = res.data?.detalle          || [];
    const resumen = res.data?.resumen_servicio || [];
    const totalFac = resumen.reduce((s, r) => s + parseFloat(r.total_facturado), 0);
    const totalCob = resumen.reduce((s, r) => s + parseFloat(r.total_cobrado),   0);

    let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:1.5rem">
        ${_kpi('Total facturado',   _money(totalFac),  _C.gold)}
        ${_kpi('Total cobrado',     _money(totalCob),  _C.success)}
        ${_kpi('Servicios activos', resumen.length,    _C.gold)}
    </div>`;

    if (!detalle.length) {
        html += `<div class="card" style="padding:2rem;text-align:center;color:var(--color-text-muted)">Sin datos en el período seleccionado.</div>`;
        cont.innerHTML = html;
        return;
    }

    html += `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.2rem">
        <div class="card" style="padding:1.2rem">
            <h3 style="font-size:.93rem;font-weight:600;margin:0 0 1rem">Distribución por servicio</h3>
            <div style="position:relative;height:240px"><canvas id="chartIngDonut"></canvas></div>
        </div>
        <div class="card" style="padding:1.2rem">
            <h3 style="font-size:.93rem;font-weight:600;margin:0 0 1rem">Facturado vs Cobrado</h3>
            <div style="position:relative;height:240px"><canvas id="chartIngBar"></canvas></div>
        </div>
    </div>`;

    // Tabla agrupada
    const grupos = {};
    detalle.forEach(d => { (grupos[d.servicio] = grupos[d.servicio] || []).push(d); });

    html += `<div class="card" style="padding:1.2rem;overflow-x:auto">
        <table class="table"><thead><tr>
            <th>Servicio / Subservicio</th><th style="text-align:center">Cuentas</th>
            <th>Facturado</th><th>Cobrado</th><th>Pendiente</th><th>Tasa cobro</th>
        </tr></thead><tbody>`;

    Object.entries(grupos).forEach(([srv, rows]) => {
        const tFac = rows.reduce((s, r) => s + parseFloat(r.total_facturado), 0);
        const tCob = rows.reduce((s, r) => s + parseFloat(r.total_cobrado),   0);
        const tPen = rows.reduce((s, r) => s + parseFloat(r.total_pendiente), 0);
        const tCnt = rows.reduce((s, r) => s + parseInt(r.total_cuentas),     0);

        html += `<tr style="background:var(--color-bg)">
            <td colspan="6" style="color:${_C.goldD};font-weight:700;font-size:.9rem;padding:.5rem 1rem">${_escR(srv)}</td>
        </tr>`;

        rows.forEach(r => {
            const tc = parseFloat(r.tasa_cobro);
            html += `<tr>
                <td style="padding-left:2rem;color:var(--color-text-muted);font-size:.87rem">└ ${_escR(r.subservicio)}</td>
                <td style="text-align:center">${r.total_cuentas}</td>
                <td>${_money(r.total_facturado)}</td>
                <td>${_money(r.total_cobrado)}</td>
                <td>${_money(r.total_pendiente)}</td>
                <td><span class="badge" style="background:${tc >= 80 ? _C.success : tc >= 50 ? _C.warning : _C.danger};color:#fff">${tc.toFixed(1)}%</span></td>
            </tr>`;
        });

        html += `<tr style="font-weight:600;border-top:1px solid var(--color-border)">
            <td style="padding-left:1rem;font-size:.88rem">Total ${_escR(srv)}</td>
            <td style="text-align:center">${tCnt}</td>
            <td>${_money(tFac)}</td><td>${_money(tCob)}</td><td>${_money(tPen)}</td><td></td>
        </tr>`;
    });
    html += `</tbody></table></div>`;
    cont.innerHTML = html;

    // Gráficos
    const pal = [_C.gold, _C.teal, _C.primary, _C.success, _C.warning, _C.danger];

    const ctxDonut = document.getElementById('chartIngDonut');
    if (ctxDonut && resumen.length) {
        _reportCharts.ingDonut = new Chart(ctxDonut, {
            type: 'doughnut',
            data: {
                labels:   resumen.map(r => r.servicio),
                datasets: [{ data: resumen.map(r => parseFloat(r.total_facturado)), backgroundColor: pal.slice(0, resumen.length), borderWidth: 2, borderColor: '#fff' }],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend:  { position: 'bottom', labels: { font: { size: 11 } } },
                    tooltip: { callbacks: { label: ctx => `S/ ${ctx.parsed.toFixed(2)}` } },
                },
            },
        });
    }

    const ctxBar = document.getElementById('chartIngBar');
    if (ctxBar && resumen.length) {
        _reportCharts.ingBar = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: resumen.map(r => r.servicio.split(' ').slice(0, 3).join(' ')),
                datasets: [
                    { label: 'Facturado', data: resumen.map(r => parseFloat(r.total_facturado)), backgroundColor: _C.gold, borderRadius: 4 },
                    { label: 'Cobrado',   data: resumen.map(r => parseFloat(r.total_cobrado)),   backgroundColor: _C.teal, borderRadius: 4 },
                ],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales:  { y: { beginAtZero: true, ticks: { callback: v => 'S/' + v } } },
            },
        });
    }
}
