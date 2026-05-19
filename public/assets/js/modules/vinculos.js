// ================================================================
// Módulo: Vínculos Grupales (pareja, familiar, grupal)
// ================================================================

// Estado de navegación
let _vinculoBack      = null;
let _currentVinculoId = null;
let _currentVinculo   = null;

// Callback opcional para refrescar el listado tras crear/cerrar un vínculo.
// Se establece desde atenciones.js cuando el módulo se usa embebido.
let _vinculoPostSave = null;

// Mapa de notas de sesiones grupales para evitar problemas de escaping
const _vgSgNotasMap = {};

// Estado para el modal de nueva tarea grupal
// _vgEspejoMap[atencion_id][numero_sesion] = sesion_espejo_id
let _vgEspejoMap         = {};
let _vgModalParticipantes = []; // array de { atencion_id, nombre }
let _vgModalSesiones      = []; // array de { numero_sesion, sesion_grupo_id, fecha_hora }

// ----------------------------------------------------------------
// Etiquetas
// ----------------------------------------------------------------

const TIPO_VINCULO_LABEL = {
    pareja:   'Pareja',
    familiar: 'Familiar',
    grupal:   'Grupal',
};

const TIPO_VINCULO_BADGE = {
    pareja:   'badge-info',
    familiar: 'badge-warning',
    grupal:   'badge-confirmada',
};

const ESTADO_VG_BADGE = {
    activo:     'badge-success',
    completado: 'badge-confirmada',
    cancelado:  'badge-danger',
};

const ESTADO_SG_BADGE = {
    programada: '',
    realizada:  'badge-success',
    cancelada:  'badge-danger',
    no_asistio: 'badge-warning',
};

const ESTADO_AT_BADGE_V = {
    activa:     'badge-confirmada',
    pausada:    'badge-warning',
    completada: 'badge-success',
    cancelada:  'badge-danger',
};

const ROL_GRUPO_LABEL = {
    consultante:      'Consultante',
    acompanante:      'Acompañante',
    familiar:         'Familiar',
    participante:     'Participante',
    paciente_titular: 'Titular',
};

// ----------------------------------------------------------------
// Helpers de formato (copias locales — sin dependencia cruzada)
// ----------------------------------------------------------------

function _fmtDDMMYYYYV(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function _fmtFechaHoraCortaV(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}

function _fmtFechaLargaV(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }).replace(/^\w/, c => c.toUpperCase());
}

function _adjPdfThumbV() {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
                stroke-linecap="round" stroke-linejoin="round" style="color:#E74C3C">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>
            </svg>`;
}

function _renderAdjuntoThumbV(a) {
    const nombre = escapeHtmlV(a.nombre_display || a.nombre_original);
    if (a.tipo_mime && a.tipo_mime.startsWith('image/')) {
        return `<button class="at-adj-thumb" title="${nombre}"
                    onclick="abrirLightbox('/api/archivos/descargar?id=${a.id}&preview=1','${nombre}')">
                    <img src="/api/archivos/descargar?id=${a.id}&preview=1" alt="${nombre}" loading="lazy">
                </button>`;
    }
    return `<a class="at-adj-thumb at-adj-pdf"
               href="/api/archivos/descargar?id=${a.id}&preview=1"
               target="_blank" rel="noopener" title="${nombre}">
                ${_adjPdfThumbV()}
                <span class="at-adj-pdf-name">${nombre}</span>
            </a>`;
}

async function _cargarAdjuntosSesionesVinculo(v) {
    for (const sg of (v.sesiones_grupo || [])) {
        const cont = document.getElementById(`adjuntos-sg-${sg.id}`);
        if (!cont) continue;
        const res = await api(`/api/sesiones/archivos?sesion_grupo_id=${sg.id}`);
        if (!res.success || !res.data?.length) {
            cont.innerHTML = '';
            continue;
        }
        cont.innerHTML = res.data.map(ar => _renderAdjuntoThumbV(ar)).join('');
    }
}

// ----------------------------------------------------------------
// Vista principal: listado de vínculos
// ----------------------------------------------------------------

async function vinculos() {
    const res = await api('/api/vinculos');

    let rows = '';
    if (res.data && res.data.length > 0) {
        res.data.forEach(v => {
            const tipoBadge   = TIPO_VINCULO_BADGE[v.tipo_vinculo]  || '';
            const tipoLabel   = TIPO_VINCULO_LABEL[v.tipo_vinculo]  || v.tipo_vinculo;
            const estadoBadge = ESTADO_VG_BADGE[v.estado] || 'badge-confirmada';
            const esActivo    = v.estado === 'activo';
            rows += `<tr>
                <td><strong>${escapeHtmlV(v.nombre_grupo || '—')}</strong></td>
                <td><span class="badge ${tipoBadge}">${tipoLabel}</span></td>
                <td>${escapeHtmlV(v.profesional)}</td>
                <td>${v.fecha_inicio || '-'}</td>
                <td>${v.total_participantes}</td>
                <td><span class="badge ${estadoBadge}">${v.estado}</span></td>
                <td>
                    <button class="btn-sm" title="Ver detalle" onclick="verDetalleVinculo(${v.id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="8" cy="8" r="3"/><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
                        </svg>
                    </button>
                    ${esActivo ? `
                    <button class="btn-sm" title="Completar proceso" onclick="cerrarVinculo(${v.id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="2 8 6 12 14 4"/>
                        </svg>
                    </button>` : ''}
                </td>
            </tr>`;
        });
    } else {
        rows = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:24px">No hay procesos grupales registrados</td></tr>';
    }

    document.getElementById('view').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
            <h2 style="margin:0">Atenciones Grupales</h2>
            <button class="btn-primary" onclick="abrirModalNuevoVinculo()">+ Nuevo proceso grupal</button>
        </div>
        <table class="table">
            <tr>
                <th>Nombre del proceso</th>
                <th>Tipo</th>
                <th>Profesional</th>
                <th>Fecha inicio</th>
                <th>Participantes</th>
                <th>Estado</th>
                <th>Acciones</th>
            </tr>
            ${rows}
        </table>
    `;
}

// ----------------------------------------------------------------
// Renders del detalle de vínculo
// ----------------------------------------------------------------

function _renderVinculoBreadcrumb(v) {
    const nombre = v.nombre_grupo || TIPO_VINCULO_LABEL[v.tipo_vinculo] || v.tipo_vinculo;
    return `
        <div class="at-breadcrumb">
            <a href="#" onclick="atenciones(); return false;">Atenciones</a>
            <span style="margin:0 4px">›</span>
            <a href="#" onclick="vinculos(); return false;">Procesos grupales</a>
            <span style="margin:0 4px">›</span>
            <span style="color:var(--color-text)">${escapeHtmlV(nombre)}</span>
        </div>
    `;
}

function _renderVinculoBanner(v) {
    const tipoBadge   = TIPO_VINCULO_BADGE[v.tipo_vinculo] || '';
    const tipoLabel   = TIPO_VINCULO_LABEL[v.tipo_vinculo] || v.tipo_vinculo;
    const estadoBadge = ESTADO_VG_BADGE[v.estado] || 'badge-confirmada';
    const nPart       = v.participantes ? v.participantes.length : 0;
    const diasTransc  = v.fecha_inicio
        ? Math.floor((new Date() - new Date(v.fecha_inicio + 'T00:00:00')) / 86400000) + 1
        : 0;

    // Subservicio: no expuesto en findById directamente; se infiere del primer participante.
    const subservicio = v.participantes?.[0]?.subservicio || '';

    // Badge financiero: datos no disponibles en el endpoint actual.
    // TODO: exponer suma de precio_final de participantes vs total pagado por vínculo cuando se implemente.
    let finBadge = '';
    if (v.finanzas) {
        if (v.finanzas.pendiente > 0) {
            finBadge = `<span class="badge" style="background:var(--color-warning); color:#fff; margin-left:8px">⚠ Pendiente: S/ ${parseFloat(v.finanzas.pendiente).toFixed(2)}</span>`;
        } else {
            finBadge = `<span class="badge" style="background:var(--color-success); color:#fff; margin-left:8px">✓ Al día</span>`;
        }
    }

    const fechaFinLabel = v.fecha_fin
        ? `Fecha fin: ${_fmtDDMMYYYYV(v.fecha_fin)}`
        : 'En curso';
    const motivoCorto = v.motivo_consulta_proceso 
        ? ' · Motivo: ' + escapeHtmlV(v.motivo_consulta_proceso.length > 100 ? v.motivo_consulta_proceso.substring(0, 100) + '...' : v.motivo_consulta_proceso)
        : '';
    const pbSecondary = `${fechaFinLabel}${motivoCorto}`;

    return `
        <div class="patient-banner">
            <div class="pb-info">
                <h1 class="pb-name">${escapeHtmlV(v.nombre_grupo || tipoLabel)}</h1>
                <div class="pb-meta">
                    <span class="badge ${tipoBadge}">${tipoLabel}</span>
                    <span class="badge ${estadoBadge}">${v.estado.toUpperCase()}</span>
                    <span style="color:var(--color-border);margin:0 4px">|</span>
                    <span>${nPart} participante${nPart !== 1 ? 's' : ''}</span>
                </div>
            </div>
            <div class="pb-right">
                ${finBadge}
                <div style="text-align:right;font-size:.8rem">
                    <div style="font-weight:600;color:var(--color-primary)">${escapeHtmlV(v.profesional)}</div>
                    ${subservicio ? `<div style="color:var(--color-text-muted)">${escapeHtmlV(subservicio)}</div>` : ''}
                    <div style="color:var(--color-text-muted);font-size:.75rem">
                        Inicio: ${_fmtDDMMYYYYV(v.fecha_inicio)} · día ${diasTransc}
                    </div>
                </div>
            </div>
            <div class="pb-secondary-data">${pbSecondary}</div>
        </div>
    `;
}

function _renderVinculoProgress(v) {
    const sesiones  = v.sesiones_grupo || [];
    const realizadas = sesiones.length;
    const planificadas = v.numero_sesiones_plan || 0;
    const pct = planificadas > 0 ? Math.min(100, Math.round((realizadas / planificadas) * 100)) : 0;

    const ultimaSesion = realizadas > 0 ? sesiones[realizadas - 1].fecha_hora : null;
    const ultimaHtml   = ultimaSesion
        ? `Última sesión: ${_fmtFechaHoraCortaV(ultimaSesion)}`
        : 'Sin sesiones';

    let proximaHtml = '<span style="color:var(--color-text-muted)">Sin citas programadas</span>';
    if (v.proxima_cita) {
        proximaHtml = `<span style="font-weight:600; color:var(--color-success)">Próxima: ${_fmtFechaHoraCortaV(v.proxima_cita.fecha_hora_inicio || v.proxima_cita.fecha_hora)} (${v.proxima_cita.modalidad || ''})</span>`;
    }

    return `
        <div class="at-progress-wrap">
            <div style="width:120px; font-weight:700; font-size:0.9rem">
                Progreso: ${realizadas} ${planificadas ? '/ ' + planificadas : ''}
            </div>
            <div class="at-progress-bar-container">
                <div class="at-progress-bar-fill" style="width:${planificadas ? pct : 0}%"></div>
            </div>
            <div style="text-align:right; font-size:0.75rem">
                <div>${ultimaHtml}</div>
                <div>${proximaHtml}</div>
            </div>
        </div>
    `;
}


// ----------------------------------------------------------------
// Secciones consolidadas debajo del timeline (Fase 3)
// ----------------------------------------------------------------

const ESTADO_TAREA_BADGE_V = {
    pendiente:      'badge-warning',
    en_proceso:     'badge-warning',
    completada:     'badge-success',
    no_realizada:   'badge-danger',
    no_completada:  'badge-danger',
};

function _renderTareasProceso(v) {
    const tareas = v.tareas_proceso || [];

    let cuerpo;
    if (tareas.length === 0) {
        cuerpo = '<p style="color:var(--color-text-muted);font-size:.875rem;margin:0;padding:8px 0">Sin tareas asignadas en este proceso.</p>';
    } else {
        const filas = tareas.map(t => {
            const estadoBadge = ESTADO_TAREA_BADGE_V[t.estado] || '';
            const limite      = t.fecha_limite ? _fmtDDMMYYYYV(t.fecha_limite) : '—';
            const sgAncla     = t.sesion_grupo_id
                ? `<a href="#" style="font-weight:600;text-decoration:none;color:var(--color-primary)"
                        onclick="event.preventDefault();_vgScrollToSesion(${t.sesion_grupo_id})">
                        Sesión ${t.numero_sesion}
                   </a>`
                : `<span style="font-weight:600">Sesión ${t.numero_sesion}</span>`;
            return `<tr>
                <td style="white-space:nowrap">${sgAncla}</td>
                <td>
                    <span style="font-weight:500">${escapeHtmlV(t.titulo)}</span>
                    ${t.descripcion ? `<br><span style="font-size:.8rem;color:var(--color-text-muted)">${escapeHtmlV(t.descripcion)}</span>` : ''}
                </td>
                <td style="white-space:nowrap">${escapeHtmlV(t.asignada_a)}</td>
                <td style="white-space:nowrap">${limite}</td>
                <td><span class="badge ${estadoBadge}">${t.estado.replace(/_/g,' ')}</span></td>
            </tr>`;
        }).join('');

        cuerpo = `<table class="table" style="margin:0">
            <tr>
                <th>Sesión</th>
                <th>Tarea</th>
                <th>Asignada a</th>
                <th>Límite</th>
                <th>Estado</th>
            </tr>
            ${filas}
        </table>`;
    }

    const esActivo = v.estado === 'activo';
    return `
        <div class="card" style="padding:16px;margin-bottom:16px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <h4 style="margin:0;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">
                    Tareas terapéuticas del proceso
                </h4>
                ${esActivo ? `<button class="btn-sm" onclick="abrirModalTareaGrupo(${v.id})">+ Nueva tarea</button>` : ''}
            </div>
            ${cuerpo}
        </div>`;
}

function _renderDiagnosticosPorParticipante(v) {
    const participantes = (v.participantes || []).filter(p => p.diagnosticos && p.diagnosticos.length > 0);

    let cuerpo;
    if (participantes.length === 0) {
        cuerpo = '<p style="color:var(--color-text-muted);font-size:.875rem;margin:0;padding:8px 0">Sin diagnósticos registrados en los participantes.</p>';
    } else {
        cuerpo = participantes.map(p => {
            const filas = p.diagnosticos.map(d => {
                const jerBadge  = d.jerarquia === 'principal' ? 'badge-danger' : 'badge-warning';
                const certBadge = d.nivel_certeza === 'definitivo' ? 'badge-success'
                                : d.nivel_certeza === 'descartado' ? 'badge-danger' : 'badge-info';
                return `<tr>
                    <td style="font-family:monospace;font-weight:700">${escapeHtmlV(d.cie10_codigo)}</td>
                    <td style="font-size:.85rem">${escapeHtmlV(d.descripcion_corta || d.descripcion_cie10 || '')}</td>
                    <td><span class="badge ${jerBadge}">${d.jerarquia.toUpperCase()}</span></td>
                    <td><span class="badge ${certBadge}">${d.nivel_certeza.toUpperCase()}</span></td>
                </tr>`;
            }).join('');

            return `<div style="margin-bottom:14px">
                <div style="font-weight:600;font-size:.875rem;margin-bottom:6px">${escapeHtmlV(p.paciente)}</div>
                <table class="table" style="margin:0;font-size:.85rem">
                    <tr><th>Código</th><th>Descripción</th><th>Jerarquía</th><th>Certeza</th></tr>
                    ${filas}
                </table>
            </div>`;
        }).join('');
    }

    return `
        <div class="card" style="padding:16px;margin-bottom:16px">
            <h4 style="margin:0 0 12px;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">
                Diagnósticos por participante
            </h4>
            ${cuerpo}
        </div>`;
}

function _vgScrollToSesion(sesionGrupoId) {
    const el = document.getElementById('sg-' + sesionGrupoId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ----------------------------------------------------------------
// Detalle de vínculo
// ----------------------------------------------------------------

async function verDetalleVinculo(id, backFn) {
    _vinculoBack      = backFn || (() => vinculos());
    _currentVinculoId = id;

    const res = await api('/api/vinculo?id=' + id);
    if (!res.success) { showToast(res.message || 'Error al cargar el vínculo'); return; }
    const v = res.data;
    _currentVinculo = v;

    // Limpiar mapas de estado
    Object.keys(_vgSgNotasMap).forEach(k => delete _vgSgNotasMap[k]);
    _vgEspejoMap         = {};
    _vgModalParticipantes = [];
    _vgModalSesiones      = [];

    // Participantes
    let partHtml = '';
    if (v.participantes && v.participantes.length > 0) {
        v.participantes.forEach(p => {
            const atBadge  = ESTADO_AT_BADGE_V[p.atencion_estado] || '';
            const rolLabel = ROL_GRUPO_LABEL[p.rol_en_grupo] || p.rol_en_grupo || '—';
            partHtml += `<tr>
                <td><strong>${escapeHtmlV(p.paciente)}</strong><br><span style="font-size:.78rem;color:var(--color-text-muted)">DNI ${p.paciente_dni || '-'}</span></td>
                <td>${escapeHtmlV(rolLabel)}</td>
                <td>${escapeHtmlV(p.subservicio || '-')} <span style="font-size:.78rem;color:var(--color-text-muted)">(${p.modalidad || ''})</span></td>
                <td><span class="badge ${atBadge}">${p.atencion_estado}</span></td>
                <td>
                    <button class="btn-sm" title="Ver atención individual"
                        onclick="verDetalleAtencion(${p.atencion_id}, () => verDetalleVinculo(${v.id}))">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M2 2h12v12H2z"/><path d="M6 6h4M6 9h4M6 12h2"/>
                        </svg>
                    </button>
                    ${v.estado === 'activo' ? `
                    <button class="btn-sm" title="Quitar participante" onclick="quitarParticipante(${p.id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
                        </svg>
                    </button>` : ''}
                </td>
            </tr>`;
        });
    } else {
        partHtml = '<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:12px">Sin participantes registrados</td></tr>';
    }

    // Sesiones grupales — timeline
    let sesHtml = '';
    if (v.sesiones_grupo && v.sesiones_grupo.length > 0) {
        const lockIconV = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="10" height="7" rx="1"/><path d="M5 8V5a3 3 0 0 1 6 0v3"/></svg>`;
        const arrowsIconV = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>`;

        const items = [...v.sesiones_grupo].reverse().map((s, idx, arr) => {
            _vgSgNotasMap[s.id] = s.nota_clinica_compartida || '';

            // numero_sesion disponible desde SesionGrupo::findByVinculoConDetalle; fallback por índice cronológico
            const nSesion = s.numero_sesion != null ? s.numero_sesion : (v.sesiones_grupo.indexOf(s) + 1);
            const badgeExtra = ESTADO_SG_BADGE[s.estado] || 'badge-default';
            const estadoLabels = {
                realizada: 'Realizada',
                programada: 'Programada',
                cancelada: 'Cancelada',
                no_asistio: 'No asistió'
            };
            const estadoText = estadoLabels[s.estado] || s.estado || '';
            const badgeHtml  = `<span class="badge ${badgeExtra}">${escapeHtmlV(estadoText)}</span>`;

            // Modalidad
            const modalidadHtml = s.modalidad_sesion === 'virtual'
                ? `<span style="padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; background:rgba(59,130,246,0.1); color:#2563EB">Virtual</span>`
                : `<span style="padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; background:rgba(32,178,170,0.1); color:#1A7F79">Presencial</span>`;

            // Nota compartida
            const notaCompartidaHtml = s.nota_clinica_compartida
                ? `<div style="font-size:0.9rem;line-height:1.6;white-space:pre-wrap">${escapeHtmlV(s.nota_clinica_compartida)}</div>`
                : `<div style="font-size:0.9rem"><span style="color:var(--color-text-muted);font-style:italic">Sin nota compartida registrada</span></div>`;

            // Notas privadas por participante
            let notasPrivHtml = '';
            if (s.notas_privadas && s.notas_privadas.length > 0) {
                const gridStyle = s.notas_privadas.length > 1
                    ? 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px'
                    : 'margin-top:10px';
                const blocks = s.notas_privadas.map(np => {
                    const rolLabel  = ROL_GRUPO_LABEL[np.rol_en_grupo] || np.rol_en_grupo || '';
                    const contenido = np.nota
                        ? escapeHtmlV(np.nota)
                        : `<span style="color:var(--color-text-muted);font-style:italic">Sin nota registrada</span>`;
                    return `<div style="background:#fffbea;border-left:3px solid var(--color-warning);padding:8px 12px;border-radius:0 var(--radius) var(--radius) 0;font-size:0.875rem;white-space:pre-wrap">
                        <span style="font-size:11px;font-weight:600;color:var(--color-text-muted);display:flex;align-items:center;gap:4px;margin-bottom:4px">
                            ${lockIconV} Nota privada — ${escapeHtmlV(np.paciente || '')} <span style="font-weight:400">(${escapeHtmlV(rolLabel)})</span>
                        </span>
                        ${contenido}
                    </div>`;
                }).join('');
                notasPrivHtml = `<div style="${gridStyle}">${blocks}</div>`;
            }

            return `
            <div class="at-timeline-item">
                <div class="at-timeline-dot"></div>
                <div class="at-timeline-card" id="sg-${s.id}">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
                        <div>
                            <span style="font-size:1.1rem;font-weight:700;color:var(--color-primary)">Sesión ${nSesion}</span>
                            <span style="margin-left:8px;font-size:0.85rem;color:var(--color-text-muted)">${_fmtFechaLargaV(s.fecha_hora)}${s.duracion_min ? ' · ' + s.duracion_min + ' min' : ''}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px">
                            ${modalidadHtml}
                            ${badgeHtml}
                            <button class="btn-sm" title="Editar nota" onclick="abrirModalEditarNotaGrupo(${s.id})">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button class="btn-sm" title="Cambiar estado" onclick="abrirModalCambiarEstadoSesionGrupo(${s.id}, '${s.estado}')">
                                ${arrowsIconV}
                            </button>
                        </div>
                    </div>
                    ${notaCompartidaHtml}
                    ${notasPrivHtml}
                    <div id="adjuntos-sg-${s.id}" class="at-sesion-adjuntos"></div>
                </div>
            </div>`;
        }).join('');

        sesHtml = `<div class="at-timeline">${items}</div>`;
    } else {
        sesHtml = '<p style="text-align:center;color:var(--color-text-muted);padding:16px">Sin sesiones grupales registradas</p>';
    }

    // Construir mapa espejo para modal de nueva tarea grupal
    (v.sesiones_grupo || []).forEach(sg => {
        _vgModalSesiones.push({ numero_sesion: sg.numero_sesion, sesion_grupo_id: sg.id, fecha_hora: sg.fecha_hora });
        (sg.notas_privadas || []).forEach(np => {
            if (!_vgEspejoMap[np.atencion_id]) _vgEspejoMap[np.atencion_id] = {};
            _vgEspejoMap[np.atencion_id][sg.numero_sesion] = np.sesion_espejo_id;
        });
    });
    _vgModalParticipantes = (v.participantes || []).map(p => ({ atencion_id: p.atencion_id, nombre: p.paciente }));

    const esActivo = v.estado === 'activo';

    document.getElementById('view').innerHTML = `
        ${_renderVinculoBreadcrumb(v)}
        ${_renderVinculoBanner(v)}
        ${_renderVinculoProgress(v)}

        <div style="display:grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start;">

            <!-- Columna izquierda -->
            <div>
                <!-- Participantes -->
                <div class="card" style="padding:16px; margin-bottom:16px">
                    <h4 style="margin:0 0 12px; font-size:.875rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.05em">
                        Participantes (${v.participantes ? v.participantes.length : 0})
                    </h4>
                    <table class="table">
                        <thead>
                            <tr><th>Paciente</th><th>Rol en el proceso</th><th>Servicio</th><th>Estado atención</th><th>Acciones</th></tr>
                        </thead>
                        <tbody>
                            ${partHtml}
                        </tbody>
                    </table>
                </div>

                <!-- Sesiones grupales -->
                <div style="margin-bottom:24px">
                    <h4 style="margin:0 0 12px; font-size:.875rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.05em">
                        Sesiones grupales (${v.sesiones_grupo ? v.sesiones_grupo.length : 0})
                    </h4>
                    ${sesHtml}
                </div>

                ${_renderTareasProceso(v)}
                ${_renderDiagnosticosProceso(v)}
                ${_renderDiagnosticosPorParticipante(v)}
                ${_renderHipotesisSistemicaCard(v)}
                ${_renderContextoClinicoProceso(v)}
                ${_renderContextoClinicoInicialPorParticipante(v)}
            </div>

            <!-- Sidebar de acciones (Columna derecha) -->
            <div class="at-side-column">
                <div class="card" style="padding:16px; position: sticky; top: 10px;">
                    <h4 style="margin:0 0 12px; font-size:.8rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.05em">ACCIONES</h4>
                    <div style="display:flex; flex-direction:column; gap:8px">
                        ${esActivo ? `
                        <button class="btn-sm" style="width:100%"
                                onclick="document.getElementById('tareas-proceso-card')?.scrollIntoView({ behavior: 'smooth' }); abrirModalTareaGrupo(${v.id})">
                            + Nueva tarea
                        </button>` : ''}

                        ${esActivo ? `
                        <button class="btn-sm" style="width:100%"
                                onclick="abrirModalAgregarParticipante(${v.id})">
                            + Agregar participante
                        </button>` : ''}

                        <button class="btn-sm" style="width:100%"
                                onclick="abrirModalEditarProceso()">
                            Editar proceso
                        </button>

                        ${esActivo ? `
                        <button class="btn-sm" style="width:100%; color:var(--color-danger); border-color:var(--color-danger)"
                                onclick="cerrarVinculo(${v.id})">
                            Cerrar proceso
                        </button>` : ''}

                        <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--color-border)">
                            <label style="display:flex; align-items:center; gap:8px; font-size:.8rem; cursor:pointer">
                                <input type="checkbox" id="toggleFinanzasV" onchange="_toggleFinanzasAdminV(this.checked)">
                                Ver información financiera
                            </label>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    `;

    _toggleFinanzasAdminV(document.getElementById('toggleFinanzasV')?.checked);
    _cargarAdjuntosSesionesVinculo(v);
}

function _toggleFinanzasAdminV(show) {
    document.querySelectorAll('.at-fin-info').forEach(el => el.classList.toggle('hidden', !show));
}

function abrirModalEditarProceso() {
    if (!_currentVinculo) return;
    document.getElementById('veVinculoId').value = _currentVinculo.id;
    document.getElementById('veMotivo').value = _currentVinculo.motivo_consulta_proceso || '';
    document.getElementById('veHipotesis').value = _currentVinculo.hipotesis_sistemica || '';
    document.getElementById('veRecomendaciones').value = _currentVinculo.recomendaciones || '';
    document.getElementById('veSesionesPlan').value = _currentVinculo.numero_sesiones_plan || '';
    document.getElementById('modalEditarProceso').classList.remove('hidden');
}

async function guardarEditarProceso() {
    const id = document.getElementById('veVinculoId').value;
    const motivo = document.getElementById('veMotivo').value.trim();
    const hipotesis = document.getElementById('veHipotesis').value.trim();
    const recomendaciones = document.getElementById('veRecomendaciones').value.trim();
    const plan = document.getElementById('veSesionesPlan').value.trim();

    const res = await api('/api/vinculo/proceso', 'PUT', {
        id: id,
        motivo_consulta_proceso: motivo || null,
        hipotesis_sistemica: hipotesis || null,
        recomendaciones: recomendaciones || null,
        numero_sesiones_plan: plan ? parseInt(plan) : null
    });

    if (res.success) {
        showToast('Proceso actualizado correctamente');
        cerrarModal('modalEditarProceso');
        verDetalleVinculo(id, _vinculoBack);
    } else {
        showToast(res.message || 'Error al actualizar proceso');
    }
}


function goBackFromVinculo() {
    if (_vinculoBack) _vinculoBack();
    else vinculos();
}

// ----------------------------------------------------------------
// Acciones de vínculo
// ----------------------------------------------------------------

async function cerrarVinculo(id) {
    if (!confirm('¿Marcar como completado este proceso grupal?')) return;
    const res = await api('/api/vinculos/cerrar', 'PUT', { id });
    if (res.success) {
        showToast('Proceso completado');
        goBackFromVinculo();
    } else {
        showToast(res.message || 'Error al completar');
    }
}

async function quitarParticipante(participanteId) {
    if (!confirm('¿Quitar este participante del proceso grupal?')) return;
    const res = await api('/api/vinculos/participante?id=' + participanteId, 'DELETE');
    if (res.success) {
        showToast('Participante removido');
        verDetalleVinculo(_currentVinculoId, _vinculoBack);
    } else {
        showToast(res.message || 'Error al quitar participante');
    }
}

async function cambiarEstadoSesionGrupo(sesionId, nuevoEstado) {
    const res = await api('/api/sesiones-grupo/estado', 'PUT', { id: sesionId, estado: nuevoEstado });
    if (!res.success) {
        showToast(res.message || 'Error al actualizar estado');
        verDetalleVinculo(_currentVinculoId, _vinculoBack);
    }
}

// ----------------------------------------------------------------
// Modal: Nuevo vínculo grupal
// ----------------------------------------------------------------

async function abrirModalNuevoVinculo() {
    // Cargar profesionales
    const resPro = await api('/api/profesionales');
    const selPro = document.getElementById('vgProfesional');
    selPro.innerHTML = '<option value="">Seleccionar profesional…</option>';
    if (resPro.data) {
        resPro.data.forEach(p => {
            const espec = p.especialidad ? ` (${p.especialidad})` : '';
            selPro.innerHTML += `<option value="${p.id}">${p.apellidos}, ${p.nombres}${espec}</option>`;
        });
    }

    // Cargar subservicios con modalidad pareja/familiar/grupal
    const resSubs = await api('/api/subservicios');
    const selSubs = document.getElementById('vgSubservicio');
    selSubs.innerHTML = '<option value="">Seleccionar subservicio…</option>';
    if (resSubs.data) {
        resSubs.data
            .filter(s => ['pareja','familiar','grupal'].includes(s.modalidad))
            .forEach(s => {
                selSubs.innerHTML += `<option value="${s.id}">${s.nombre} (${s.modalidad})</option>`;
            });
    }

    document.getElementById('vgNombre').value      = '';
    document.getElementById('vgTipo').value         = 'pareja';
    document.getElementById('vgFechaInicio').value  = _localDate();
    document.getElementById('vgMotivo').value       = '';
    document.getElementById('vgSesionesPlan').value = '';
    clearVgErrors();
    document.getElementById('modalNuevoVinculo').classList.remove('hidden');
}

function clearVgErrors() {
    ['vgNombre', 'vgProfesional', 'vgSubservicio', 'vgFechaInicio'].forEach(id => {
        const el  = document.getElementById(id);
        const err = document.getElementById(id + '-error');
        if (el)  el.classList.remove('is-invalid');
        if (err) err.textContent = '';
    });
}

function setVgError(fieldId, msg) {
    const el  = document.getElementById(fieldId);
    const err = document.getElementById(fieldId + '-error');
    if (el)  el.classList.toggle('is-invalid', !!msg);
    if (err) err.textContent = msg || '';
}

async function guardarNuevoVinculo() {
    clearVgErrors();
    const nombreGrupo   = document.getElementById('vgNombre').value.trim();
    const tipoVinculo   = document.getElementById('vgTipo').value;
    const profesional   = document.getElementById('vgProfesional').value;
    const subservicio   = document.getElementById('vgSubservicio').value;
    const fechaInicio   = document.getElementById('vgFechaInicio').value;
    const motivo        = document.getElementById('vgMotivo').value.trim();
    const sesionesPlan  = document.getElementById('vgSesionesPlan').value;

    let valido = true;
    if (!profesional) { setVgError('vgProfesional', 'Seleccione un profesional');   valido = false; }
    if (!subservicio) { setVgError('vgSubservicio', 'Seleccione un subservicio');    valido = false; }
    if (!fechaInicio) { setVgError('vgFechaInicio', 'Ingrese la fecha de inicio');   valido = false; }
    if (!valido) return;

    const res = await api('/api/vinculos', 'POST', {
        tipo_vinculo:   tipoVinculo,
        nombre_grupo:   nombreGrupo || null,
        profesional_id: parseInt(profesional),
        subservicio_id: parseInt(subservicio),
        fecha_inicio:   fechaInicio,
        motivo_consulta_proceso: motivo || null,
        numero_sesiones_plan:    sesionesPlan ? parseInt(sesionesPlan) : null,
    });

    if (res.success) {
        showToast('Proceso grupal creado');
        cerrarModal('modalNuevoVinculo');
        const cb = _vinculoPostSave;
        _vinculoPostSave = null;
        if (typeof cb === 'function') cb();
        else vinculos();
    } else {
        showToast(res.message || 'Error al crear el vínculo');
    }
}

// ----------------------------------------------------------------
// Modal: Agregar participante
// ----------------------------------------------------------------

async function abrirModalAgregarParticipante(vinculoId) {
    document.getElementById('apVinculoId').value = vinculoId;
    document.getElementById('apRolGrupo').value   = 'participante';

    // Cargar atenciones activas
    const res = await api('/api/atenciones');
    const sel = document.getElementById('apAtencionSelect');
    sel.innerHTML = '<option value="">Seleccionar atención…</option>';
    if (res.data) {
        res.data
            .filter(a => a.estado === 'activa')
            .forEach(a => {
                sel.innerHTML += `<option value="${a.id}">${a.paciente} — ${a.subservicio} (${a.profesional})</option>`;
            });
    }

    sel.classList.remove('is-invalid');
    document.getElementById('apAtencion-error').textContent = '';
    document.getElementById('modalAgregarParticipante').classList.remove('hidden');
}

async function guardarParticipante() {
    const vinculoId  = parseInt(document.getElementById('apVinculoId').value);
    const atencionId = parseInt(document.getElementById('apAtencionSelect').value);
    const rolEnGrupo = document.getElementById('apRolGrupo').value;

    if (!atencionId) {
        document.getElementById('apAtencionSelect').classList.add('is-invalid');
        document.getElementById('apAtencion-error').textContent = 'Seleccione una atención';
        return;
    }
    document.getElementById('apAtencionSelect').classList.remove('is-invalid');
    document.getElementById('apAtencion-error').textContent = '';

    const res = await api('/api/vinculos/participante', 'POST', {
        vinculo_id:   vinculoId,
        atencion_id:  atencionId,
        rol_en_grupo: rolEnGrupo,
    });

    if (res.success) {
        showToast('Participante agregado');
        cerrarModal('modalAgregarParticipante');
        verDetalleVinculo(_currentVinculoId, _vinculoBack);
    } else {
        showToast(res.message || 'Error al agregar participante');
    }
}

// ----------------------------------------------------------------
// Modal: Nueva sesión grupal
// ----------------------------------------------------------------

function abrirModalNuevaSesionGrupo(vinculoId) {
    document.getElementById('sgVinculoId').value  = vinculoId;
    document.getElementById('sgFechaHora').value  = _localDatetime();
    document.getElementById('sgDuracion').value   = '60';
    document.getElementById('sgEstado').value     = 'programada';
    document.getElementById('sgNota').value       = '';
    clearSgErrors();
    document.getElementById('modalSesionGrupo').classList.remove('hidden');
}

function clearSgErrors() {
    ['sgFechaHora', 'sgDuracion'].forEach(id => {
        const el  = document.getElementById(id);
        const err = document.getElementById(id + '-error');
        if (el)  el.classList.remove('is-invalid');
        if (err) err.textContent = '';
    });
}

function setSgError(fieldId, msg) {
    const el  = document.getElementById(fieldId);
    const err = document.getElementById(fieldId + '-error');
    if (el)  el.classList.toggle('is-invalid', !!msg);
    if (err) err.textContent = msg || '';
}

async function guardarSesionGrupo() {
    clearSgErrors();
    const vinculoId = parseInt(document.getElementById('sgVinculoId').value);
    const fecha     = document.getElementById('sgFechaHora').value;
    const duracion  = document.getElementById('sgDuracion').value;
    const estado    = document.getElementById('sgEstado').value;
    const nota      = document.getElementById('sgNota').value.trim();

    let valido = true;
    if (!fecha)                              { setSgError('sgFechaHora','Ingrese la fecha y hora'); valido = false; }
    if (!duracion || parseInt(duracion) < 1) { setSgError('sgDuracion', 'Ingrese la duración');    valido = false; }
    if (!valido) return;

    const res = await api('/api/sesiones-grupo', 'POST', {
        vinculo_id:              vinculoId,
        fecha_hora:              fecha,
        duracion_min:            parseInt(duracion),
        estado,
        nota_clinica_compartida: nota || null,
    });

    if (res.success) {
        showToast('Sesión grupal registrada');
        cerrarModal('modalSesionGrupo');
        verDetalleVinculo(_currentVinculoId, _vinculoBack);
    } else {
        showToast(res.message || 'Error al guardar sesión grupal');
    }
}

// ----------------------------------------------------------------
// Modal: Cambiar estado de sesión grupal
// ----------------------------------------------------------------

function abrirModalCambiarEstadoSesionGrupo(sesionId, estadoActual) {
    document.getElementById('csesgId').value     = sesionId;
    document.getElementById('csesgEstado').value = estadoActual || 'programada';
    document.getElementById('modalCambiarEstadoSesionGrupo').classList.remove('hidden');
}

async function guardarCambioEstadoSesionGrupo() {
    const id     = parseInt(document.getElementById('csesgId').value);
    const estado = document.getElementById('csesgEstado').value;
    const res    = await api('/api/sesiones-grupo/estado', 'PUT', { id, estado });
    if (res.success) {
        showToast('Estado actualizado');
        cerrarModal('modalCambiarEstadoSesionGrupo');
        verDetalleVinculo(_currentVinculoId, _vinculoBack);
    } else {
        showToast(res.message || 'Error al actualizar estado');
    }
}

// ----------------------------------------------------------------
// Modal: Editar nota compartida de sesión grupal
// ----------------------------------------------------------------

function abrirModalEditarNotaGrupo(sesionId) {
    const nota = _vgSgNotasMap[sesionId] || '';
    document.getElementById('sgEditNotaId').value         = sesionId;
    document.getElementById('sgEditNotaContenido').value  = nota;
    document.getElementById('sgEditNotaContenido').classList.remove('is-invalid');
    document.getElementById('sgEditNota-error').textContent = '';
    document.getElementById('modalEditarNotaGrupo').classList.remove('hidden');
}

async function guardarNotaGrupo() {
    const id   = parseInt(document.getElementById('sgEditNotaId').value);
    const nota = document.getElementById('sgEditNotaContenido').value.trim();

    const res = await api('/api/sesiones-grupo/nota', 'PUT', { id, nota_clinica_compartida: nota || null });

    if (res.success) {
        showToast('Nota compartida actualizada');
        cerrarModal('modalEditarNotaGrupo');
        verDetalleVinculo(_currentVinculoId, _vinculoBack);
    } else {
        showToast(res.message || 'Error al actualizar nota');
    }
}

// ----------------------------------------------------------------
// Modal: Nueva tarea terapéutica grupal
// ----------------------------------------------------------------

function abrirModalTareaGrupo(vinculoId) {
    document.getElementById('tgVinculoId').value = vinculoId;

    // Poblar select de participantes
    const selPart = document.getElementById('tgParticipanteSelect');
    selPart.innerHTML = _vgModalParticipantes.length > 0
        ? '<option value="">Seleccionar participante…</option>' +
          _vgModalParticipantes.map(p =>
              `<option value="${p.atencion_id}">${escapeHtmlV(p.nombre)}</option>`
          ).join('')
        : '<option value="">Sin participantes</option>';

    // Reset sesiones (se actualizan al seleccionar participante)
    document.getElementById('tgSesionSelect').innerHTML = '<option value="">Seleccione un participante primero…</option>';

    // Limpiar campos
    ['tgTitulo','tgDescripcion','tgFechaLimite'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['tgParticipante-error','tgSesion-error','tgTitulo-error'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '';
    });
    ['tgParticipanteSelect','tgSesionSelect','tgTitulo'].forEach(id => {
        document.getElementById(id)?.classList.remove('is-invalid');
    });

    document.getElementById('modalTareaGrupo').classList.remove('hidden');
}

function tgActualizarSesiones() {
    const atencionId = parseInt(document.getElementById('tgParticipanteSelect').value);
    const selSes     = document.getElementById('tgSesionSelect');

    if (!atencionId) {
        selSes.innerHTML = '<option value="">Seleccione un participante primero…</option>';
        return;
    }

    const espejos = _vgEspejoMap[atencionId] || {};
    // Mostrar solo las sesiones donde el participante tiene espejo creado
    const sesionesConEspejo = _vgModalSesiones.filter(
        sg => espejos[sg.numero_sesion] != null
    ).sort((a, b) => b.numero_sesion - a.numero_sesion);

    selSes.innerHTML = sesionesConEspejo.length > 0
        ? '<option value="">Seleccionar sesión…</option>' +
          sesionesConEspejo.map(sg => {
              const fecha = sg.fecha_hora ? sg.fecha_hora.replace('T',' ').slice(0,16) : '';
              return `<option value="${sg.numero_sesion}">Sesión ${sg.numero_sesion}${fecha ? ' — ' + fecha : ''}</option>`;
          }).join('')
        : '<option value="">Sin sesiones con espejo disponibles</option>';
}

async function guardarTareaGrupo() {
    const atencionId   = parseInt(document.getElementById('tgParticipanteSelect').value);
    const numeroSesion = parseInt(document.getElementById('tgSesionSelect').value);
    const titulo       = document.getElementById('tgTitulo').value.trim();

    // Limpiar errores
    ['tgParticipante-error','tgSesion-error','tgTitulo-error'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '';
    });
    ['tgParticipanteSelect','tgSesionSelect','tgTitulo'].forEach(id => {
        document.getElementById(id)?.classList.remove('is-invalid');
    });

    let valido = true;
    if (!atencionId) {
        document.getElementById('tgParticipanteSelect').classList.add('is-invalid');
        document.getElementById('tgParticipante-error').textContent = 'Seleccione un participante';
        valido = false;
    }
    if (!numeroSesion) {
        document.getElementById('tgSesionSelect').classList.add('is-invalid');
        document.getElementById('tgSesion-error').textContent = 'Seleccione una sesión';
        valido = false;
    }
    if (!titulo) {
        document.getElementById('tgTitulo').classList.add('is-invalid');
        document.getElementById('tgTitulo-error').textContent = 'El título es obligatorio';
        valido = false;
    }
    if (!valido) return;

    const sesionId = _vgEspejoMap[atencionId]?.[numeroSesion];
    if (!sesionId) {
        showToast('No se encontró la sesión espejo para este participante');
        return;
    }

    const res = await api('/api/tareas', 'POST', {
        sesion_id:    sesionId,
        titulo,
        descripcion:  document.getElementById('tgDescripcion').value.trim() || null,
        fecha_limite: document.getElementById('tgFechaLimite').value || null,
        estado:       'pendiente',
    });

    if (res.success) {
        showToast('Tarea creada');
        cerrarModal('modalTareaGrupo');
        verDetalleVinculo(_currentVinculoId, _vinculoBack);
    } else {
        showToast(res.message || 'Error al crear la tarea');
    }
}

// ----------------------------------------------------------------
// Integración con atenciones.js — sección de vínculo grupal
// ----------------------------------------------------------------

// Carga los vínculos activos en el select del modal de atención
async function cargarVinculosActivosEnModal(tipoVinculo) {
    const res = await api('/api/vinculos');
    const sel = document.getElementById('atVinculoSelect');
    sel.innerHTML = '<option value="">Seleccionar proceso grupal…</option>';
    if (res.data) {
        res.data
            .filter(v => v.estado === 'activo' && (!tipoVinculo || v.tipo_vinculo === tipoVinculo))
            .forEach(v => {
                const label = v.nombre_grupo
                    ? `${v.nombre_grupo} (${TIPO_VINCULO_LABEL[v.tipo_vinculo] || v.tipo_vinculo})`
                    : `${TIPO_VINCULO_LABEL[v.tipo_vinculo] || v.tipo_vinculo} — inicio ${v.fecha_inicio}`;
                sel.innerHTML += `<option value="${v.id}">${escapeHtmlV(label)}</option>`;
            });
    }
}

// Llamada desde atenciones.js al cambiar opción de vínculo
function _onVinculoRadioChange(opcion) {
    document.getElementById('atVinculoExistenteBox').style.display = opcion === 'existente' ? '' : 'none';
    document.getElementById('atVinculoNuevoBox').style.display     = opcion === 'nuevo'     ? '' : 'none';
    if (opcion === 'existente') {
        // Inferir tipo de vínculo según modalidad del subservicio seleccionado
        const modalidad = document.getElementById('atSubservicio')?.selectedOptions[0]?.dataset?.modalidad || '';
        const tipoMap   = { pareja: 'pareja', familiar: 'familiar', grupal: 'grupal' };
        cargarVinculosActivosEnModal(tipoMap[modalidad] || null);
    }
}

// ----------------------------------------------------------------
// Helper local de escape
// ----------------------------------------------------------------

function escapeHtmlV(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function _renderDiagnosticosProceso(v) {
    const dxs = v.diagnosticos_proceso || [];
    const rows = dxs.map(d => `
        <tr id="dx-proceso-row-${d.id}">
            <td style="font-family:monospace; font-weight:700">${d.cie10_codigo}</td>
            <td style="font-size:0.85rem">${escapeHtmlV(d.descripcion_corta || d.descripcion_cie10 || '')}</td>
            <td><span class="badge ${d.jerarquia === 'principal' ? 'badge-danger' : 'badge-warning'}">${d.jerarquia.toUpperCase()}</span></td>
            <td><span class="badge ${d.nivel_certeza === 'definitivo' ? 'badge-success' : d.nivel_certeza === 'descartado' ? 'badge-danger' : 'badge-info'}">${d.nivel_certeza.toUpperCase()}</span></td>
            <td style="white-space:nowrap">
                <button class="btn-sm" title="Eliminar diagnóstico del proceso"
                        onclick="if(confirm('¿Eliminar diagnóstico del proceso?')) eliminarDiagnosticoProceso(${d.id})">&times;</button>
            </td>
        </tr>
    `).join('');

    const esActivo = v.estado === 'activo';
    return `
        <div class="card" style="padding:16px; margin-bottom:16px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
                <h4 style="margin:0; font-size:.875rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.05em">Diagnósticos Relacionales/Proceso</h4>
                ${esActivo ? `<button class="btn-primary" style="font-size:0.75rem; padding:4px 10px" onclick="toggleDxProcesoForm()">+ Agregar diagnóstico</button>` : ''}
            </div>
            
            <div id="dx-proceso-form-container" class="hidden" style="background:var(--color-bg); padding:15px; border-radius:var(--radius); margin-bottom:15px; border:1px solid var(--color-border)">
                <div style="display:grid; grid-template-columns: 1fr 150px 150px 100px; gap:10px; align-items: flex-end">
                    <div class="form-group" style="margin:0; position:relative">
                        <label>Buscar diagnóstico</label>
                        <input type="text" id="cie10ProcesoSearchInput" class="input" placeholder="Código o descripción..." oninput="cie10ProcesoOnInput()">
                        <div id="cie10ProcesoDropdown" style="display:none; position:absolute; z-index:100; left:0; right:0; top:100%; background:#fff; border:1px solid var(--color-border); box-shadow:var(--shadow); max-height:200px; overflow-y:auto"></div>
                    </div>
                    <div class="form-group" style="margin:0">
                        <label>Jerarquía</label>
                        <select id="cie10ProcesoJerarquiaSelect" class="input"><option value="principal">Principal</option><option value="secundario">Secundario</option></select>
                    </div>
                    <div class="form-group" style="margin:0">
                        <label>Certeza</label>
                        <select id="cie10ProcesoNivelCertezaSelect" class="input"><option value="presuntivo">Presuntivo</option><option value="definitivo">Definitivo</option><option value="descartado">Descartado</option></select>
                    </div>
                    <button class="btn-primary" onclick="agregarDiagnosticoProceso(${v.id})">Añadir</button>
                </div>
                <input type="hidden" id="cie10ProcesoSelectedCode">
                <div id="cie10ProcesoSelectedInfo" style="font-size:0.75rem; color:var(--color-text-muted); margin-top:5px"></div>
                <div id="cie10ProcesoErrorMsg" class="error hidden"></div>
            </div>

            <table class="table" style="margin-top:0">
                <thead><tr><th>Cód.</th><th>Descripción</th><th>Jerarquía</th><th>Certeza</th><th></th></tr></thead>
                <tbody>${rows || '<tr><td colspan="5" style="text-align:center; color:var(--color-text-muted)">Sin diagnósticos relacionales registrados</td></tr>'}</tbody>
            </table>
        </div>
    `;
}

function _renderContextoClinicoProceso(v) {
    const esActivo = v.estado === 'activo';
    const motivo = v.motivo_consulta_proceso || '';
    const hipotesis = v.hipotesis_sistemica || '';
    const recomendaciones = v.recomendaciones || '';
    const plan = v.numero_sesiones_plan || '';

    return `
        <div class="card" style="padding:16px; margin-bottom:16px" id="contexto-clinico-proceso">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
                <h4 style="margin:0; font-size:.875rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.05em">
                    Información Clínica del Proceso Grupal
                </h4>
                ${esActivo ? `<button class="btn-primary" style="font-size:0.75rem; padding:4px 10px" onclick="toggleEditarClinicaProceso()">✏ Editar Datos</button>` : ''}
            </div>

            <!-- Modo Vista -->
            <div id="clinica-proceso-vista">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:10px">
                    <div>
                        <h5 style="margin:0 0 5px; font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase">Motivo de consulta</h5>
                        <p style="margin:0; font-size:0.875rem; white-space:pre-wrap; font-style:italic">${escapeHtmlV(motivo || '—')}</p>
                    </div>
                    <div>
                        <h5 style="margin:0 0 5px; font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase">Hipótesis Sistémica / Relacional</h5>
                        <p style="margin:0; font-size:0.875rem; white-space:pre-wrap">${escapeHtmlV(hipotesis || '—')}</p>
                    </div>
                </div>
                <div style="margin-top:10px">
                    <h5 style="margin:0 0 5px; font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase">Recomendaciones y Plan</h5>
                    <p style="margin:0; font-size:0.875rem; white-space:pre-wrap">${escapeHtmlV(recomendaciones || '—')}</p>
                </div>
                <div style="margin-top:10px">
                    <h5 style="margin:0 0 5px; font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase">Sesiones Planificadas</h5>
                    <p style="margin:0; font-size:0.875rem">${plan ? plan + ' sesiones' : '—'}</p>
                </div>
            </div>

            <!-- Modo Edición -->
            <div id="clinica-proceso-edicion" class="hidden" style="margin-top:15px; border-top:1px solid var(--color-border); padding-top:15px">
                <div class="form-row" style="margin-bottom:10px">
                    <div class="form-group">
                        <label for="clProcesoMotivo">Motivo de consulta del proceso</label>
                        <textarea id="clProcesoMotivo" class="input" style="height:80px; resize:vertical">${escapeHtmlV(motivo)}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="clProcesoHipotesis">Hipótesis Sistémica / Relacional</label>
                        <textarea id="clProcesoHipotesis" class="input" style="height:80px; resize:vertical">${escapeHtmlV(hipotesis)}</textarea>
                    </div>
                </div>
                <div class="form-row" style="margin-bottom:10px">
                    <div class="form-group">
                        <label for="clProcesoRecomendaciones">Recomendaciones y Plan</label>
                        <textarea id="clProcesoRecomendaciones" class="input" style="height:80px; resize:vertical">${escapeHtmlV(recomendaciones)}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="clProcesoPlan">Sesiones Planificadas</label>
                        <input type="number" min="0" id="clProcesoPlan" class="input" value="${plan}">
                    </div>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:15px">
                    <button class="btn-primary" onclick="guardarClinicaProceso(${v.id})">Guardar Cambios</button>
                    <button class="btn-sm" onclick="toggleEditarClinicaProceso()">Cancelar</button>
                </div>
            </div>
        </div>
    `;
}

function toggleEditarClinicaProceso() {
    const vista = document.getElementById('clinica-proceso-vista');
    const edicion = document.getElementById('clinica-proceso-edicion');
    if (vista && edicion) {
        vista.classList.toggle('hidden');
        edicion.classList.toggle('hidden');
    }
}

async function guardarClinicaProceso(vinculoId) {
    const motivo = document.getElementById('clProcesoMotivo').value.trim();
    const hipotesis = document.getElementById('clProcesoHipotesis').value.trim();
    const recomendaciones = document.getElementById('clProcesoRecomendaciones').value.trim();
    const plan = document.getElementById('clProcesoPlan').value.trim();

    const res = await api('/api/vinculo/proceso', 'PUT', {
        id: vinculoId,
        motivo_consulta_proceso: motivo || null,
        hipotesis_sistemica: hipotesis || null,
        recomendaciones: recomendaciones || null,
        numero_sesiones_plan: plan ? parseInt(plan) : null
    });

    if (res.success) {
        showToast('Información clínica del proceso actualizada');
        verDetalleVinculo(vinculoId, _vinculoBack);
    } else {
        showToast(res.message || 'Error al guardar cambios clínicos');
    }
}

function toggleDxProcesoForm() {
    const el = document.getElementById('dx-proceso-form-container');
    if (el) {
        el.classList.toggle('hidden');
        if (!el.classList.contains('hidden')) {
            document.getElementById('cie10ProcesoSearchInput').focus();
            document.getElementById('cie10ProcesoSelectedCode').value = '';
            document.getElementById('cie10ProcesoSearchInput').value = '';
            document.getElementById('cie10ProcesoSelectedInfo').textContent = 'Ningún código seleccionado';
            document.getElementById('cie10ProcesoSelectedInfo').style.color = 'var(--color-text-muted)';
            document.getElementById('cie10ProcesoErrorMsg').style.display = 'none';
        }
    }
}

let _cie10ProcesoTimer = null;
let _cie10ProcesoResults = [];

function cie10ProcesoOnInput() {
    clearTimeout(_cie10ProcesoTimer);

    document.getElementById('cie10ProcesoSelectedCode').value = '';
    document.getElementById('cie10ProcesoSelectedInfo').textContent = 'Ningún código seleccionado';
    document.getElementById('cie10ProcesoSelectedInfo').style.color = 'var(--color-text-muted)';
    document.getElementById('cie10ProcesoErrorMsg').style.display = 'none';

    const q = document.getElementById('cie10ProcesoSearchInput').value.trim();
    if (q.length < 2) {
        document.getElementById('cie10ProcesoDropdown').style.display = 'none';
        return;
    }

    _cie10ProcesoTimer = setTimeout(() => {
        api('/api/cie10/buscar?q=' + encodeURIComponent(q)).then(res => {
            _cie10ProcesoResults = res.data || [];
            const dd = document.getElementById('cie10ProcesoDropdown');
            if (!dd) return;

            if (!_cie10ProcesoResults.length) {
                dd.innerHTML = '<div style="padding:.5rem .8rem;color:var(--color-text-muted);font-size:.85rem">Sin resultados para esta búsqueda</div>';
                dd.style.display = 'block';
                return;
            }

            dd.innerHTML = _cie10ProcesoResults.map((r, i) => `
                <div role="option"
                     style="padding:.45rem .8rem;cursor:pointer;font-size:.85rem;
                            border-bottom:1px solid var(--color-border);transition:background var(--transition)"
                     onmouseenter="this.style.background='var(--color-bg)'"
                     onmouseleave="this.style.background=''"
                     onmousedown="cie10ProcesoSelect(${i})">
                    <strong style="color:var(--color-primary)">${escapeHtmlV(r.codigo)}</strong>
                    <span style="color:var(--color-text-muted)"> — </span>${escapeHtmlV(r.descripcion_corta || r.descripcion)}
                </div>
            `).join('');
            dd.style.display = 'block';
        });
    }, 400);
}

function cie10ProcesoSelect(idx) {
    const r = _cie10ProcesoResults[idx];
    if (!r) return;

    document.getElementById('cie10ProcesoSelectedCode').value = r.codigo;
    document.getElementById('cie10ProcesoSearchInput').value  = r.codigo;
    document.getElementById('cie10ProcesoSelectedInfo').textContent =
        r.codigo + ': ' + (r.descripcion_corta || r.descripcion || '');
    document.getElementById('cie10ProcesoSelectedInfo').style.color = 'var(--color-text)';
    document.getElementById('cie10ProcesoDropdown').style.display = 'none';
    document.getElementById('cie10ProcesoErrorMsg').style.display = 'none';
}

async function agregarDiagnosticoProceso(vinculoId) {
    const code = document.getElementById('cie10ProcesoSelectedCode').value;
    const jerarquia = document.getElementById('cie10ProcesoJerarquiaSelect').value;
    const certeza = document.getElementById('cie10ProcesoNivelCertezaSelect').value;
    const err = document.getElementById('cie10ProcesoErrorMsg');

    if (!code) {
        err.textContent = 'Seleccione un diagnóstico de la lista de sugerencias';
        err.style.display = 'block';
        return;
    }
    err.style.display = 'none';

    const res = await api('/api/vinculo/diagnosticos', 'POST', {
        vinculo_id: vinculoId,
        cie10_codigo: code,
        jerarquia: jerarquia,
        nivel_certeza: certeza
    });

    if (res.success) {
        showToast('Diagnóstico agregado al proceso');
        verDetalleVinculo(vinculoId, _vinculoBack);
    } else {
        err.textContent = res.message || 'Error al agregar el diagnóstico';
        err.style.display = 'block';
    }
}

async function eliminarDiagnosticoProceso(dxId) {
    const res = await api('/api/vinculo/diagnosticos?id=' + dxId, 'DELETE');
    if (res.success) {
        showToast('Diagnóstico eliminado');
        verDetalleVinculo(_currentVinculoId, _vinculoBack);
    } else {
        showToast(res.message || 'Error al eliminar');
    }
}

// ----------------------------------------------------------------
// Funciones de renderizado e interacción de Fase 3
// ----------------------------------------------------------------

function _renderTareasProceso(v) {
    const tareas = v.tareas_proceso || [];
    const esActivo = v.estado === 'activo';

    let html = `
        <div class="card" id="tareas-proceso-card" style="padding:16px; margin-bottom:16px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
                <h4 style="margin:0; font-size:.875rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.05em">Tareas Terapéuticas del Proceso</h4>
                ${esActivo ? `<button class="btn-primary" style="font-size:0.75rem; padding:4px 10px" onclick="abrirModalTareaGrupo(${v.id})">+ Nueva tarea</button>` : ''}
            </div>
    `;

    if (tareas.length === 0) {
        html += `<p style="text-align:center; color:var(--color-text-muted); font-style:italic; padding:16px; margin:0">Sin tareas asignadas en este proceso</p>`;
    } else {
        const rows = tareas.map(t => {
            const estadoBadges = {
                pendiente: 'badge-warning',
                completada: 'badge-success',
                vencida: 'badge-danger',
                en_proceso: 'badge-info',
                no_realizada: 'badge-danger',
                no_completada: 'badge-danger'
            };
            const estadoLabels = {
                pendiente: 'Pendiente',
                completada: 'Completada',
                vencida: 'Vencida',
                en_proceso: 'En proceso',
                no_realizada: 'No realizada',
                no_completada: 'No completada'
            };
            const badgeClass = estadoBadges[t.estado] || 'badge-default';
            const estadoText = estadoLabels[t.estado] || t.estado || '';

            const asignadaA = escapeHtmlV(`${t.asignada_a_nombres || ''} ${t.asignada_a_apellidos || ''}`.trim());
            const limite = t.fecha_limite ? t.fecha_limite.split('-').reverse().join('/') : '—';

            let rptaHtml = '';
            if (t.respuesta_paciente) {
                rptaHtml = `<div style="margin-top:4px; font-size:0.75rem; background:rgba(34,197,94,0.08); border-left:2px solid var(--color-success); padding:3px 8px; border-radius:0 var(--radius) var(--radius) 0; color:#15803d; word-break:break-word">
                    <strong>Respuesta:</strong> ${escapeHtmlV(t.respuesta_paciente)}
                </div>`;
            }

            const sesLink = t.sesion_grupo_id
                ? `<a href="#sg-${t.sesion_grupo_id}" class="badge badge-info" style="text-decoration:none; display:inline-block">Sesión ${t.numero_sesion}</a>`
                : `<span class="badge badge-default">Sesión ${t.numero_sesion}</span>`;

            return `
                <tr>
                    <td style="vertical-align:top; white-space:nowrap">${sesLink}</td>
                    <td style="vertical-align:top">
                        <strong style="font-size:0.875rem; color:var(--color-text)">${escapeHtmlV(t.titulo)}</strong>
                        ${t.descripcion ? `<div style="font-size:0.75rem; color:var(--color-text-muted); margin-top:2px; line-height:1.4">${escapeHtmlV(t.descripcion)}</div>` : ''}
                        ${rptaHtml}
                    </td>
                    <td style="vertical-align:top; font-size:0.85rem">${asignadaA}</td>
                    <td style="vertical-align:top; font-size:0.85rem; white-space:nowrap">${limite}</td>
                    <td style="vertical-align:top; white-space:nowrap"><span class="badge ${badgeClass}">${escapeHtmlV(estadoText)}</span></td>
                </tr>
            `;
        }).join('');

        html += `
            <table class="table" style="margin:0">
                <thead>
                    <tr><th>Sesión</th><th>Tarea</th><th>Asignada a</th><th>Límite</th><th>Estado</th></tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }

    html += `</div>`;
    return html;
}

function _renderDiagnosticosPorParticipante(v) {
    const participantes = v.participantes || [];
    const conDx = participantes.filter(p => p.diagnosticos && p.diagnosticos.length > 0);

    let html = `
        <div class="card" style="padding:16px; margin-bottom:16px">
            <h4 style="margin:0 0 4px; font-size:.875rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.05em">Diagnósticos Individuales por Participante</h4>
            <div style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:12px; font-style:italic">
                Para editar estos diagnósticos, abrir la atención individual del participante.
            </div>
    `;

    if (conDx.length === 0) {
        html += `<p style="text-align:center; color:var(--color-text-muted); font-style:italic; padding:16px; margin:0">Sin diagnósticos individuales registrados</p>`;
    } else {
        const sections = conDx.map(p => {
            const rows = p.diagnosticos.map(d => `
                <tr>
                    <td style="font-family:monospace; font-weight:700; width:80px">${d.cie10_codigo}</td>
                    <td style="font-size:0.85rem">${escapeHtmlV(d.descripcion_corta || d.descripcion_cie10 || '')}</td>
                    <td><span class="badge ${d.jerarquia === 'principal' ? 'badge-danger' : 'badge-warning'}">${d.jerarquia.toUpperCase()}</span></td>
                    <td><span class="badge ${d.nivel_certeza === 'definitivo' ? 'badge-success' : d.nivel_certeza === 'descartado' ? 'badge-danger' : 'badge-info'}">${d.nivel_certeza.toUpperCase()}</span></td>
                </tr>
            `).join('');

            return `
                <div style="margin-top:12px; border-top:1px solid var(--color-border); padding-top:12px">
                    <h5 style="margin:0 8px 8px 0; font-size:0.85rem; color:var(--color-primary); font-weight:600">${escapeHtmlV(p.paciente)} <span style="font-weight:400; color:var(--color-text-muted)">(${escapeHtmlV(ROL_GRUPO_LABEL[p.rol_en_grupo] || p.rol_en_grupo)})</span></h5>
                    <table class="table" style="margin:0">
                        <thead><tr><th>Cód.</th><th>Descripción</th><th>Jerarquía</th><th>Certeza</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        }).join('');

        html += sections;
    }

    html += `</div>`;
    return html;
}

function _renderHipotesisSistemicaCard(v) {
    const hipotesis = v.hipotesis_sistemica || '';
    return `
        <div class="card" style="padding:16px; margin-bottom:16px">
            <h4 style="margin:0 0 10px; font-size:.875rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.05em">Hipótesis Sistémica / Relacional</h4>
            <div class="form-group" style="margin-bottom:12px">
                <textarea id="clHipotesisDirecta" class="input" rows="4" style="resize:vertical"
                          placeholder="Formulación clínica sobre la dinámica del grupo, patrones observados, hipótesis de trabajo…">${escapeHtmlV(hipotesis)}</textarea>
            </div>
            <div style="display:flex; justify-content:flex-end">
                <button class="btn-primary" onclick="guardarHipotesisDirecta(${v.id})">Guardar Hipótesis</button>
            </div>
        </div>
    `;
}

async function guardarHipotesisDirecta(vinculoId) {
    const hipotesis = document.getElementById('clHipotesisDirecta').value.trim();
    const res = await api('/api/vinculo/proceso', 'PUT', {
        id: vinculoId,
        hipotesis_sistemica: hipotesis || null
    });

    if (res.success) {
        showToast('Hipótesis sistémica actualizada');
        verDetalleVinculo(vinculoId, _vinculoBack);
    } else {
        showToast(res.message || 'Error al guardar hipótesis');
    }
}

function _renderContextoClinicoInicialPorParticipante(v) {
    const participantes = v.participantes || [];

    const blocks = participantes.map(p => {
        const ctx = p.contexto_clinico_inicial || {};
        const obsGen = (ctx.observacion_general || '').trim();
        const obsCond = (ctx.observacion_conducta || '').trim();
        const antRel = (ctx.antecedentes_relevantes || '').trim();

        const estaVacio = !obsGen && !obsCond && !antRel;

        let content = '';
        if (estaVacio) {
            content = `<p style="margin:0; font-size:0.85rem; color:var(--color-text-muted); font-style:italic">Sin contexto inicial registrado</p>`;
        } else {
            content = `
                ${obsGen ? `<div style="margin-bottom:8px">
                    <h6 style="margin:0 0 2px; font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase">Observación General</h6>
                    <p style="margin:0; font-size:0.875rem; white-space:pre-wrap">${escapeHtmlV(obsGen)}</p>
                </div>` : ''}
                ${obsCond ? `<div style="margin-bottom:8px">
                    <h6 style="margin:0 0 2px; font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase">Observación de Conducta</h6>
                    <p style="margin:0; font-size:0.875rem; white-space:pre-wrap">${escapeHtmlV(obsCond)}</p>
                </div>` : ''}
                ${antRel ? `<div>
                    <h6 style="margin:0 0 2px; font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase">Antecedentes Relevantes</h6>
                    <p style="margin:0; font-size:0.875rem; white-space:pre-wrap">${escapeHtmlV(antRel)}</p>
                </div>` : ''}
            `;
        }

        return `
            <div style="margin-top:12px; border-top:1px solid var(--color-border); padding-top:12px">
                <h5 style="margin:0 0 8px; font-size:0.85rem; color:var(--color-primary); font-weight:600">${escapeHtmlV(p.paciente)} <span style="font-weight:400; color:var(--color-text-muted)">(${escapeHtmlV(ROL_GRUPO_LABEL[p.rol_en_grupo] || p.rol_en_grupo)})</span></h5>
                ${content}
            </div>
        `;
    }).join('');

    return `
        <details class="card" style="padding:16px; margin-bottom:16px; cursor:pointer" id="contexto-inicial-details">
            <summary style="font-size:.875rem; font-weight:600; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.05em; outline:none; user-select:none">
                Contexto Clínico Inicial por Participante
            </summary>
            <div style="cursor:default; margin-top:4px" onclick="event.stopPropagation()">
                <div style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:12px; font-style:italic">
                    Datos iniciales individuales registrados antes de su incorporación al proceso.
                </div>
                ${blocks}
            </div>
        </details>
    `;
}
