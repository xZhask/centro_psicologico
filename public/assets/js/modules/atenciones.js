
// ---- Helpers ----

function setAtError(fieldId, message) {
    const el    = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (el)    el.classList.toggle('is-invalid', !!message);
    if (errEl) errEl.textContent = message || '';
}

function clearAtErrors() {
    ['atPaciente','atProfesional','atSubservicio','atFechaInicio',
     'atPrecioAcordado','atMotivoConsulta']
        .forEach(id => setAtError(id, ''));
}

// Estado para navegación de retorno desde el detalle
let _atencionBack      = null;
let _currentAtencionId = null;
let _currentAtencion   = null;

// ---- Estado modal de sesión ----
let _sesionModo          = 'nueva';       // 'nueva' | 'editar-grupal'
let _sesionModalidad     = 'individual';
let _sesionVinculoId     = null;
let _sesionGrupalId      = null;
let _sesionParticipantes = [];
let _sesionVinculoNombre = '';

// ---- Estado búsqueda CIE-10 ----
let _cie10Timer   = null;
let _cie10Results = [];

// Mapa temporal nota actual por sesión (evita problemas de escaping en onclick)
const _sesionNotasMap = {};
const _sgNotasMap     = {};

// ---- Adjuntos de sesión ----

let _adjPendientes = []; // [{ file: File, uid: string }]

function _adjIconSvg(tipo) {
    if (tipo === 'application/pdf') {
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
                    stroke-linecap="round" stroke-linejoin="round" style="color:#E74C3C">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>
                </svg>`;
    }
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
                stroke-linecap="round" stroke-linejoin="round" style="color:#2A7F8F">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
            </svg>`;
}

function _adjFormatBytes(bytes) {
    if (bytes < 1024)             return bytes + ' B';
    if (bytes < 1024 * 1024)      return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function _adjRenderPendientes(containerId) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    cont.innerHTML = '';
    _adjPendientes.forEach(({ file, uid }) => {
        const chip = document.createElement('div');
        chip.className  = 'adjunto-chip';
        chip.dataset.uid = uid;
        chip.innerHTML  = `
            <span class="adjunto-chip-icon">${_adjIconSvg(file.type)}</span>
            <span class="adjunto-chip-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
            <span class="adjunto-chip-size">${_adjFormatBytes(file.size)}</span>
            <button class="adjunto-chip-btn" onclick="_adjQuitarPendiente('${uid}','${containerId}')" title="Quitar">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                     stroke-width="2.2" stroke-linecap="round">
                    <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
                </svg>
            </button>`;
        cont.appendChild(chip);
    });
}

function _adjQuitarPendiente(uid, containerId) {
    _adjPendientes = _adjPendientes.filter(a => a.uid !== uid);
    _adjRenderPendientes(containerId);
}

function _adjAgregarArchivos(files, pendientesId) {
    const MAX       = 5;
    const MAX_BYTES = 10 * 1024 * 1024;
    const TIPOS     = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

    Array.from(files).forEach(file => {
        if (_adjPendientes.length >= MAX)          { showToast('Máximo 5 archivos por sesión'); return; }
        if (!TIPOS.includes(file.type))             { showToast(`Tipo no permitido: ${file.name}`); return; }
        if (file.size > MAX_BYTES)                  { showToast(`${file.name} supera 10 MB`); return; }
        const uid = Math.random().toString(36).slice(2) + Date.now();
        _adjPendientes.push({ file, uid });
    });
    _adjRenderPendientes(pendientesId);
}

function _adjIniciarDropZone(dropId, inputId, pendientesId) {
    const drop  = document.getElementById(dropId);
    const input = document.getElementById(inputId);
    if (!drop || !input) return;

    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
        _adjAgregarArchivos(input.files, pendientesId);
        input.value = '';
    });
    drop.addEventListener('dragover',  e => { e.preventDefault(); drop.classList.add('drag-over'); });
    drop.addEventListener('dragleave', ()  => drop.classList.remove('drag-over'));
    drop.addEventListener('drop', e => {
        e.preventDefault();
        drop.classList.remove('drag-over');
        _adjAgregarArchivos(e.dataTransfer.files, pendientesId);
    });
}

async function _adjSubirPendientes(sesionId, sesionGrupoId) {
    for (const { file, uid } of _adjPendientes) {
        const fd = new FormData();
        fd.append('archivo', file);
        if (sesionId)      fd.append('sesion_id',       sesionId);
        if (sesionGrupoId) fd.append('sesion_grupo_id', sesionGrupoId);
        await apiUpload('/api/sesiones/archivos', fd);
    }
    _adjPendientes = [];
}

function _adjHtmlDropZone(dropId, inputId, pendientesId, existingId = null) {
    const existingSlot = existingId ? `<div id="${existingId}"></div>` : '';
    return `
    <div class="adjuntos-wrap">
        <div class="adjuntos-label">
            Archivos adjuntos
            <span class="adjuntos-hint">PDF, JPG, PNG o WEBP · Máx. 10 MB · Máx. 5 archivos</span>
        </div>
        ${existingSlot}
        <div id="${dropId}" class="adjuntos-drop">
            <input type="file" id="${inputId}" multiple
                   accept=".pdf,.jpg,.jpeg,.png,.webp" style="display:none">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span>Arrastra archivos aquí o <u>selecciona</u></span>
        </div>
        <div id="${pendientesId}"></div>
    </div>`;
}

async function _adjCargarExistentes(sesionId, sesionGrupoId, containerId) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    const qs = sesionId ? `sesion_id=${sesionId}` : `sesion_grupo_id=${sesionGrupoId}`;
    const res = await api(`/api/sesiones/archivos?${qs}`);
    if (!res.success || !res.data || !res.data.length) { cont.innerHTML = ''; return; }

    cont.innerHTML = res.data.map(a => `
        <div class="adjunto-chip" id="adjChip_${a.id}">
            <span class="adjunto-chip-icon">${_adjIconSvg(a.tipo_mime)}</span>
            <span class="adjunto-chip-name" title="${escapeHtml(a.nombre_original)}">${escapeHtml(a.nombre_original)}</span>
            <span class="adjunto-chip-size">${_adjFormatBytes(parseInt(a.tamano_bytes))}</span>
            <a href="/api/archivos/descargar?id=${a.id}" download="${escapeHtml(a.nombre_original)}"
               class="adjunto-chip-btn" title="Descargar">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round">
                    <path d="M8 2v8m0 0l-3-3m3 3l3-3"/><path d="M3 13h10"/>
                </svg>
            </a>
            <button class="adjunto-chip-btn" title="Eliminar"
                    onclick="_adjEliminarExistente(${a.id},'${containerId}',${sesionId || 'null'},${sesionGrupoId || 'null'})">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                     stroke-width="2.2" stroke-linecap="round">
                    <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
                </svg>
            </button>
        </div>`).join('');
}

async function _adjEliminarExistente(archivoId, containerId, sesionId, sesionGrupoId) {
    if (!confirm('¿Eliminar este archivo adjunto?')) return;
    const res = await api('/api/sesiones/archivos', 'DELETE', { id: archivoId });
    if (res.success) {
        await _adjCargarExistentes(sesionId, sesionGrupoId, containerId);
    } else {
        showToast(res.message || 'Error al eliminar');
    }
}

// ---- Constantes compartidas con tareas.js ----

const TAREA_ESTADO_LABEL = {
    pendiente:    'Pendiente',
    en_proceso:   'En proceso',
    completada:   'Completada',
    no_realizada: 'No realizada',
};

// ---- Etiquetas legibles ----

const GRADO_LABEL = {
    sin_instruccion:       'Sin instrucción',
    primaria_incompleta:   'Primaria incompleta',
    primaria_completa:     'Primaria completa',
    secundaria_incompleta: 'Secundaria incompleta',
    secundaria_completa:   'Secundaria completa',
    tecnico_incompleto:    'Técnico incompleto',
    tecnico_completo:      'Técnico completo',
    superior_incompleto:   'Superior incompleto',
    superior_completo:     'Superior completo',
    posgrado:              'Posgrado',
    no_especificado:       'No especificado',
};

const CIVIL_LABEL = {
    soltero:        'Soltero/a',
    casado:         'Casado/a',
    conviviente:    'Conviviente',
    divorciado:     'Divorciado/a',
    separado:       'Separado/a',
    viudo:          'Viudo/a',
    no_especificado:'No especificado',
};

const ESTADO_AT_BADGE = {
    activa:     'badge-confirmada',
    pausada:    'badge-warning',
    completada: 'badge-success',
    cancelada:  'badge-danger',
};

// ---- Vista principal ----

async function atenciones() {
    const res = await api('/api/atenciones');

    let rows = '';
    if (res.data && res.data.length > 0) {
        res.data.forEach(a => {
            const badgeClass = ESTADO_AT_BADGE[a.estado] || '';
            rows += `<tr>
                <td>${a.paciente}</td>
                <td>${a.profesional}</td>
                <td>${a.servicio} — ${a.subservicio}</td>
                <td>${a.fecha_inicio || ''}</td>
                <td><span class="badge ${badgeClass}">${a.estado}</span></td>
                <td>
                    <button class="btn-sm" title="Ver detalle" onclick="verDetalleAtencion(${a.id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="8" cy="8" r="3"/><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
                        </svg>
                    </button>
                    ${a.estado === 'activa' ? `
                    <button class="btn-sm" title="Cerrar atención" onclick="cerrarAtencion(${a.id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="2 8 6 12 14 4"/>
                        </svg>
                    </button>` : ''}
                </td>
            </tr>`;
        });
    } else {
        rows = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:24px">No hay atenciones registradas</td></tr>';
    }

    document.getElementById('view').innerHTML = `
        <h2>Atenciones</h2>
        <button class="btn-primary" onclick="abrirModalAtencion()" style="margin-bottom:12px">+ Nueva Atención</button>
        <table class="table">
            <tr>
                <th>Paciente</th>
                <th>Profesional</th>
                <th>Servicio</th>
                <th>Fecha inicio</th>
                <th>Estado</th>
                <th>Acciones</th>
            </tr>
            ${rows}
        </table>
    `;
}

// ---- Detalle de atención ----

async function verDetalleAtencion(id, backFn) {
    _atencionBack      = backFn || (() => atenciones());
    _currentAtencionId = id;

    const res = await api('/api/atencion?id=' + id);
    if (!res.success) { showToast(res.message || 'Error al cargar atención'); return; }
    const a = res.data;

    // Cargar paquete activo del paciente en paralelo con el renderizado
    let _paqueteActivo = null;
    if (a.paciente_id) {
        const pqRes = await api('/api/paciente-paquetes?paciente_id=' + a.paciente_id + '&activo=1');
        if (pqRes.success && pqRes.data) _paqueteActivo = pqRes.data;
    }
    window._atPaqueteActivo   = _paqueteActivo;
    window._atPacienteId      = a.paciente_id;
    window._atProfesionalId   = a.profesional_id;
    a.sesiones       = Array.isArray(a.sesiones)       ? a.sesiones       : [];
    a.sesiones_grupo = Array.isArray(a.sesiones_grupo) ? a.sesiones_grupo : [];
    a.diagnosticos   = Array.isArray(a.diagnosticos)   ? a.diagnosticos   : [];
    a.tareas         = Array.isArray(a.tareas)         ? a.tareas         : [];

    _currentAtencion = a;

    const esGrupal = ['pareja', 'familiar', 'grupal'].includes(a.subservicio_modalidad);

    // Sesiones individuales (tabla sin nota para atenciones grupales)
    let sesionesHtml = '';
    Object.keys(_sesionNotasMap).forEach(k => delete _sesionNotasMap[k]);
    Object.keys(_sgNotasMap).forEach(k => delete _sgNotasMap[k]);
    a.sesiones_grupo.forEach(sg => { _sgNotasMap[sg.id] = sg; });
    if (a.sesiones.length > 0) {
        const estadoMap = {
            realizada: 'badge-success', programada: 'badge-confirmada',
            cancelada: 'badge-danger',  no_asistio: 'badge-warning',
        };
        a.sesiones.forEach(s => {
            _sesionNotasMap[s.id] = s.nota_clinica || '';
            const estadoClass = estadoMap[s.estado] || '';
            const paqueteBadge = s.nombre_paquete
                ? `<span style="display:inline-block;margin-left:4px;padding:1px 5px;border-radius:4px;font-size:.7rem;font-weight:600;background:rgba(155,126,200,.12);color:#7B5EA7">[P]</span>`
                : '';
            if (esGrupal) {
                sesionesHtml += `<tr>
                    <td>${s.numero_sesion}${paqueteBadge}</td>
                    <td>${s.fecha_hora ? s.fecha_hora.replace('T',' ') : '-'}</td>
                    <td>${s.duracion_min ? s.duracion_min + ' min' : '-'}</td>
                    <td><span class="badge ${estadoClass}">${s.estado.replace('_',' ')}</span></td>
                </tr>`;
            } else {
                sesionesHtml += `<tr>
                    <td>${s.numero_sesion}${paqueteBadge}</td>
                    <td>${s.fecha_hora ? s.fecha_hora.replace('T',' ') : '-'}</td>
                    <td>${s.duracion_min ? s.duracion_min + ' min' : '-'}</td>
                    <td><span class="badge ${estadoClass}">${s.estado.replace('_',' ')}</span></td>
                    <td style="max-width:220px;white-space:pre-line">${s.nota_clinica || '<span style="color:var(--color-text-muted)">—</span>'}</td>
                    <td>
                        <button class="btn-sm" title="Editar nota clínica" onclick="abrirModalEditarNota(${s.id})">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 2l3 3-9 9H2v-3L11 2z"/>
                            </svg>
                        </button>
                    </td>
                </tr>`;
            }
        });
    } else {
        const cols = esGrupal ? 4 : 6;
        sesionesHtml = `<tr><td colspan="${cols}" style="text-align:center;color:var(--color-text-muted);padding:12px">Sin sesiones registradas</td></tr>`;
    }

    // Notas de sesiones grupales
    let sesGrupoHtml = '';
    if (esGrupal) {
        if (a.sesiones_grupo.length > 0) {
            a.sesiones_grupo.forEach(sg => {
                const estadoMap = {
                    realizada: 'badge-success', programada: 'badge-confirmada',
                    cancelada: 'badge-danger',  no_asistio: 'badge-warning',
                };
                const durText = sg.duracion_min ? ` · ${sg.duracion_min} min` : '';
                const fechaText = sg.fecha_hora ? sg.fecha_hora.replace('T',' ') : '-';
                sesGrupoHtml += `
                <div style="border-left:3px solid var(--color-info);padding:.75rem 1rem;margin-bottom:.75rem;background:var(--color-bg);border-radius:0 var(--radius) var(--radius) 0">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.25rem;margin-bottom:.5rem">
                        <strong style="font-size:.9rem">Sesión grupal #${sg.numero_sesion}</strong>
                        <div style="display:flex;align-items:center;gap:8px">
                            <span style="font-size:.8rem;color:var(--color-text-muted)">${escapeHtml(fechaText)}${durText}</span>
                            <button class="btn-sm" title="Editar notas" onclick="abrirModalEditarNotaGrupal(${sg.id})">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2l3 3-9 9H2v-3L11 2z"/></svg>
                            </button>
                        </div>
                    </div>
                    ${sg.nota_clinica_compartida ? `
                    <div style="margin-bottom:.4rem">
                        <span style="font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--color-info)">Nota compartida</span>
                        <p style="font-size:.875rem;margin:.2rem 0 0;white-space:pre-wrap">${escapeHtml(sg.nota_clinica_compartida)}</p>
                    </div>` : ''}
                    ${sg.nota_privada_p1 ? `
                    <div style="margin-bottom:.4rem">
                        <span style="font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-muted)">Nota privada — participante 1</span>
                        <p style="font-size:.875rem;margin:.2rem 0 0;white-space:pre-wrap;color:var(--color-text-muted)">${escapeHtml(sg.nota_privada_p1)}</p>
                    </div>` : ''}
                    ${sg.nota_privada_p2 ? `
                    <div style="margin-bottom:.4rem">
                        <span style="font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-muted)">Nota privada — participante 2</span>
                        <p style="font-size:.875rem;margin:.2rem 0 0;white-space:pre-wrap;color:var(--color-text-muted)">${escapeHtml(sg.nota_privada_p2)}</p>
                    </div>` : ''}
                    ${sg.nota_privada_p3 ? `
                    <div>
                        <span style="font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-muted)">Nota privada — participante 3</span>
                        <p style="font-size:.875rem;margin:.2rem 0 0;white-space:pre-wrap;color:var(--color-text-muted)">${escapeHtml(sg.nota_privada_p3)}</p>
                    </div>` : ''}
                </div>`;
            });
        } else {
            sesGrupoHtml = '<p style="font-size:.875rem;color:var(--color-text-muted)">Sin sesiones grupales registradas.</p>';
        }
    }

    // Diagnósticos
    let dxHtml = '';
    if (a.diagnosticos.length > 0) {
        a.diagnosticos.forEach(d => {
            const tipoLabel = { principal:'Principal', secundario:'Secundario', presuntivo:'Presuntivo', descartado:'Descartado' }[d.tipo] || d.tipo;
            const tipoClass = { principal:'badge-danger', secundario:'badge-warning', presuntivo:'badge-info', descartado:'badge-pendiente' }[d.tipo] || '';
            dxHtml += `<tr>
                <td><code style="font-size:.8rem">${d.cie10_codigo}</code></td>
                <td>${d.descripcion_corta || d.descripcion_cie10 || '-'}</td>
                <td><span class="badge ${tipoClass}">${tipoLabel}</span></td>
                <td>${d.fecha_dx || '-'}</td>
                <td style="max-width:200px;white-space:normal">${d.observacion_clinica || '-'}</td>
            </tr>`;
        });
    } else {
        dxHtml = '<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:12px">Sin diagnósticos registrados</td></tr>';
    }

    // Tareas — mapa sesionId→numeroSesion para el modal de nueva tarea
    const _sesionNumMap = {};
    a.sesiones.forEach(s => { _sesionNumMap[s.id] = s.numero_sesion; });

    let tareasHtml = '';
    if (a.tareas.length > 0) {
        a.tareas.forEach(t => {
            const tieneResp = !!t.respuesta_paciente;
            const esNoRealizada = t.estado === 'no_realizada';

            const controlEstado = esNoRealizada
                ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                       ${badgeTarea(t.estado)}
                       <button class="btn-sm" style="font-size:.75rem;color:var(--color-primary)"
                           onclick="if(confirm('¿Reactivar esta tarea? El paciente podrá responderla nuevamente.')) cambiarEstadoTareaEnAtencion(${t.id},'pendiente')">
                           Reactivar
                       </button>
                   </div>`
                : `<div>
                       <select class="input" style="font-size:.8rem;padding:4px 8px;min-width:120px"
                           onchange="cambiarEstadoTareaEnAtencion(${t.id}, this.value)">
                           ${['pendiente','en_proceso','completada'].map(e =>
                               `<option value="${e}" ${t.estado === e ? 'selected' : ''}>${TAREA_ESTADO_LABEL[e]}</option>`
                           ).join('')}
                       </select>
                       <p style="margin:3px 0 0;font-size:.73rem;color:var(--color-text-muted)">
                           El estado 'No realizada' se asigna automáticamente cuando vence la fecha límite sin respuesta.
                       </p>
                   </div>`;

            tareasHtml += `<tr>
                <td style="font-size:.8rem">Sesión ${t.numero_sesion}</td>
                <td>
                    <strong>${escapeHtml(t.titulo)}</strong>
                    ${t.descripcion ? `<br><span style="font-size:.8rem;color:var(--color-text-muted)">${escapeHtml(t.descripcion)}</span>` : ''}
                </td>
                <td>${controlEstado}</td>
                <td>${t.fecha_limite || '-'}</td>
                <td style="max-width:200px;white-space:pre-line;font-size:.875rem">
                    ${tieneResp
                        ? escapeHtml(t.respuesta_paciente)
                        : '<span style="color:var(--color-text-muted)">Sin respuesta</span>'}
                </td>
            </tr>`;
        });
    } else {
        tareasHtml = '<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:12px">Sin tareas asignadas</td></tr>';
    }

    // Guardar sesiones del detalle actual para el modal de nueva tarea
    window._atencionSesiones = a.sesiones || [];

    const estadoBadge = ESTADO_AT_BADGE[a.estado] || '';

    document.getElementById('view').innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
            <button onclick="goBackFromAtencion()" style="display:flex;align-items:center;gap:6px;font-size:.875rem">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="10 4 6 8 10 12"/></svg>
                Volver
            </button>
            <h2 style="margin:0">Detalle de Atención #${a.id}</h2>
            <span class="badge ${estadoBadge}">${a.estado}</span>
        </div>

        <!-- Cabecera -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
            <div class="card" style="padding:16px">
                <h4 style="margin:0 0 12px;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Paciente</h4>
                <p style="margin:0 0 4px;font-weight:600">${a.paciente}</p>
                <p style="margin:0 0 4px;font-size:.875rem">DNI: ${a.paciente_dni || '-'}</p>
                <p style="margin:0 0 4px;font-size:.875rem">Grado instrucción: ${GRADO_LABEL[a.grado_instruccion] || a.grado_instruccion || '-'}</p>
                <p style="margin:0 0 4px;font-size:.875rem">Ocupación: ${a.ocupacion || '-'}</p>
                <p style="margin:0;font-size:.875rem">Estado civil: ${CIVIL_LABEL[a.estado_civil] || a.estado_civil || '-'}</p>
            </div>
            <div class="card" style="padding:16px">
                <h4 style="margin:0 0 12px;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Atención</h4>
                <p style="margin:0 0 4px;font-size:.875rem">Profesional: <strong>${a.profesional}</strong></p>
                <p style="margin:0 0 4px;font-size:.875rem">Servicio: ${a.servicio} — ${a.subservicio} (${a.subservicio_modalidad})</p>
                <p style="margin:0 0 4px;font-size:.875rem">Inicio: ${a.fecha_inicio || '-'}${a.fecha_fin ? '  •  Fin: ' + a.fecha_fin : ''}</p>
                <p style="margin:0 0 4px;font-size:.875rem">Precio acordado: S/ ${a.precio_acordado ? parseFloat(a.precio_acordado).toFixed(2) : '-'}</p>
                <p style="margin:0;font-size:.875rem">Sesiones plan: ${a.numero_sesiones_plan || '-'}</p>
            </div>
        </div>

        ${a.motivo_consulta ? `
        <div class="card" style="padding:16px;margin-bottom:16px">
            <h4 style="margin:0 0 8px;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Motivo de consulta</h4>
            <p style="margin:0;white-space:pre-line">${a.motivo_consulta}</p>
        </div>` : ''}

        ${a.antecedentes_relevantes ? `
        <div class="card" style="padding:16px;margin-bottom:16px">
            <h4 style="margin:0 0 8px;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Antecedentes relevantes</h4>
            <p style="margin:0;white-space:pre-line">${a.antecedentes_relevantes}</p>
        </div>` : ''}

        <!-- Sesiones -->
        <div class="card" style="padding:16px;margin-bottom:16px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <h4 style="margin:0;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Sesiones (${a.sesiones.length})</h4>
                <button class="btn-primary" style="font-size:.8rem;padding:4px 12px"
                    onclick="abrirModalSesion(${a.id}, ${esGrupal ? a.sesiones_grupo.length + 1 : a.sesiones.length + 1})">+ Nueva sesión</button>
            </div>
            <table class="table">
                ${esGrupal
                    ? '<tr><th>#</th><th>Fecha / Hora</th><th>Duración</th><th>Estado</th></tr>'
                    : '<tr><th>#</th><th>Fecha / Hora</th><th>Duración</th><th>Estado</th><th>Nota clínica</th><th></th></tr>'
                }
                ${sesionesHtml}
            </table>
        </div>

        ${esGrupal ? `
        <!-- Notas de sesiones grupales -->
        <div class="card" style="padding:16px;margin-bottom:16px">
            <h4 style="margin:0 0 12px;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">
                Notas de sesiones grupales (${a.sesiones_grupo.length})
            </h4>
            ${sesGrupoHtml}
        </div>` : ''}

        <!-- Diagnósticos -->
        <div class="card" style="padding:16px;margin-bottom:16px">
            <h4 style="margin:0 0 12px;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Diagnósticos CIE-10 (${a.diagnosticos.length})</h4>

            ${a.estado === 'activa' ? `
            <div style="position:relative;margin-bottom:1rem" id="cie10SearchBox">
                <div style="display:flex;gap:.6rem;align-items:flex-end;flex-wrap:wrap">
                    <div class="form-group" style="flex:1;min-width:220px;margin:0;position:relative">
                        <label style="font-size:.8rem;color:var(--color-text-muted);display:block;margin-bottom:4px">Buscar diagnóstico CIE-10</label>
                        <input type="text" id="cie10SearchInput" class="input"
                               placeholder="Código o descripción…"
                               autocomplete="off"
                               oninput="_cie10OnInput(${a.id})">
                        <div id="cie10Dropdown"
                             style="display:none;position:absolute;z-index:999;top:100%;left:0;right:0;
                                    background:var(--color-surface);border:1px solid var(--color-border);
                                    border-radius:var(--radius);box-shadow:var(--shadow);
                                    max-height:220px;overflow-y:auto"></div>
                    </div>
                    <div class="form-group" style="margin:0;min-width:150px">
                        <label style="font-size:.8rem;color:var(--color-text-muted);display:block;margin-bottom:4px">Tipo</label>
                        <select id="cie10TipoSelect" class="input" style="padding:6px 10px">
                            <option value="presuntivo">Presuntivo</option>
                            <option value="principal">Principal</option>
                            <option value="secundario">Secundario</option>
                            <option value="descartado">Descartado</option>
                        </select>
                    </div>
                    <button class="btn-primary" style="font-size:.8rem;padding:6px 14px;white-space:nowrap"
                        onclick="agregarDiagnostico(${a.id})">Agregar</button>
                </div>
                <div id="cie10SelectedInfo" style="margin-top:.35rem;font-size:.82rem;color:var(--color-text-muted)">
                    Ningún código seleccionado
                </div>
                <div id="cie10ErrorMsg" style="display:none;color:var(--color-danger);font-size:.82rem;margin-top:.25rem"></div>
                <input type="hidden" id="cie10SelectedCode" value="">
            </div>` : ''}

            <table class="table">
                <tr><th>Código</th><th>Diagnóstico</th><th>Tipo</th><th>Fecha</th><th>Observación</th></tr>
                ${dxHtml}
            </table>
        </div>

        <!-- Tareas -->
        <div class="card" style="padding:16px;margin-bottom:16px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <h4 style="margin:0;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Tareas (${a.tareas.length})</h4>
                ${(a.sesiones && a.sesiones.length > 0) ? `
                <button class="btn-primary" style="font-size:.8rem;padding:4px 12px"
                    onclick="abrirModalTareaDesdeAtencion()">+ Nueva tarea</button>` : ''}
            </div>
            <table class="table">
                <tr><th>Sesión</th><th>Título</th><th>Estado</th><th>Límite</th><th>Respuesta paciente</th></tr>
                ${tareasHtml}
            </table>
        </div>

        <!-- Paquete -->
        <div class="card" style="padding:16px">
            ${_paqueteActivo ? _pqCardActivo(_paqueteActivo) : _pqCardSinPaquete()}
        </div>
    `;
}

function goBackFromAtencion() {
    if (_atencionBack) _atencionBack();
    else atenciones();
}

// ---- CIE-10: búsqueda con debounce ----

function _cie10OnInput(atencionId) {
    clearTimeout(_cie10Timer);

    // Limpiar selección previa al escribir de nuevo
    document.getElementById('cie10SelectedCode').value = '';
    document.getElementById('cie10SelectedInfo').textContent = 'Ningún código seleccionado';
    document.getElementById('cie10SelectedInfo').style.color = 'var(--color-text-muted)';
    _ocultarCie10Error();

    const q = document.getElementById('cie10SearchInput').value.trim();
    if (q.length < 2) {
        _ocultarCie10Dropdown();
        return;
    }

    _cie10Timer = setTimeout(() => _cie10Fetch(q), 400);
}

async function _cie10Fetch(q) {
    const res = await api('/api/cie10/buscar?q=' + encodeURIComponent(q));
    _cie10Results = res.data || [];

    const dd = document.getElementById('cie10Dropdown');
    if (!dd) return;

    if (!_cie10Results.length) {
        dd.innerHTML = '<div style="padding:.5rem .8rem;color:var(--color-text-muted);font-size:.85rem">Sin resultados para esta búsqueda</div>';
        dd.style.display = 'block';
        return;
    }

    dd.innerHTML = _cie10Results.map((r, i) => `
        <div role="option"
             style="padding:.45rem .8rem;cursor:pointer;font-size:.85rem;
                    border-bottom:1px solid var(--color-border);transition:background var(--transition)"
             onmouseenter="this.style.background='var(--color-bg)'"
             onmouseleave="this.style.background=''"
             onmousedown="_cie10Select(${i})">
            <strong style="color:var(--color-primary)">${escapeHtml(r.codigo)}</strong>
            <span style="color:var(--color-text-muted)"> — </span>${escapeHtml(r.descripcion_corta || r.descripcion)}
        </div>
    `).join('');
    dd.style.display = 'block';
}

function _cie10Select(idx) {
    const r = _cie10Results[idx];
    if (!r) return;

    document.getElementById('cie10SelectedCode').value = r.codigo;
    document.getElementById('cie10SearchInput').value  = r.codigo;
    document.getElementById('cie10SelectedInfo').textContent =
        r.codigo + ': ' + (r.descripcion_corta || r.descripcion || '');
    document.getElementById('cie10SelectedInfo').style.color = 'var(--color-text)';
    _ocultarCie10Dropdown();
    _ocultarCie10Error();
}

function _ocultarCie10Dropdown() {
    const dd = document.getElementById('cie10Dropdown');
    if (dd) dd.style.display = 'none';
}

function _ocultarCie10Error() {
    const el = document.getElementById('cie10ErrorMsg');
    if (el) el.style.display = 'none';
}

function _mostrarCie10Error(msg) {
    const el = document.getElementById('cie10ErrorMsg');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
}

async function agregarDiagnostico(atencionId) {
    _ocultarCie10Error();

    const codigo = (document.getElementById('cie10SelectedCode')?.value || '').trim();
    const tipo   = document.getElementById('cie10TipoSelect')?.value || 'presuntivo';

    if (!codigo) {
        _mostrarCie10Error('Seleccione un diagnóstico de la lista desplegable.');
        return;
    }

    const hoy = new Date().toISOString().slice(0, 10);
    const res = await api('/api/atenciones/diagnostico', 'POST', {
        atencion_id:  atencionId,
        cie10_codigo: codigo,
        tipo,
        fecha_dx:     hoy,
    });

    if (res.success) {
        showToast('Diagnóstico agregado');
        verDetalleAtencion(atencionId, _atencionBack);
    } else {
        _mostrarCie10Error(res.message || 'Error al agregar el diagnóstico.');
    }
}

// Cierre del dropdown al hacer clic fuera (se registra una sola vez)
if (!window._cie10ClickListenerAdded) {
    window._cie10ClickListenerAdded = true;
    document.addEventListener('mousedown', function (e) {
        const dd    = document.getElementById('cie10Dropdown');
        const input = document.getElementById('cie10SearchInput');
        if (dd && input && !dd.contains(e.target) && e.target !== input) {
            dd.style.display = 'none';
        }
    });
}

async function cerrarAtencion(id) {
    const fecha = prompt('Fecha de cierre (YYYY-MM-DD):');
    if (!fecha) return;
    const res = await api('/api/atenciones/cerrar', 'PUT', { id, fecha_fin: fecha });
    if (res.success) {
        showToast('Atención cerrada');
        atenciones();
    } else {
        showToast(res.message || 'Error al cerrar');
    }
}

// ---- Modal nueva atención ----

async function abrirModalAtencion(pacienteIdPreset = null) {
    clearAtErrors();

    // Limpiar campos
    ['atPrecioAcordado','atDescuentoMonto','atOcupacion',
     'atMotivoConsulta','atObservacionGeneral','atAntecedentes',
     'atNumeroSesionesPlan'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('atGradoInstruccion').value = 'no_especificado';
    document.getElementById('atEstadoCivil').value      = 'no_especificado';
    document.getElementById('atFechaInicio').value      = new Date().toISOString().slice(0,10);

    // Cargar pacientes
    const resPac = await api('/api/pacientes');
    const selPac = document.getElementById('atPaciente');
    selPac.innerHTML = '<option value="">Seleccionar paciente…</option>';
    if (resPac.data) {
        resPac.data.forEach(p => {
            selPac.innerHTML += `<option value="${p.id}">${p.apellidos}, ${p.nombres} — ${p.dni}</option>`;
        });
    }

    // Cargar profesionales o mostrar campo de solo lectura según rol
    const selPro     = document.getElementById('atProfesional');
    const userAt     = getUser();
    const esProfAt   = userAt?.rol === 'profesional';

    if (esProfAt) {
        selPro.style.display = 'none';
        let rdPro = document.getElementById('atProfesional-readonly');
        if (!rdPro) {
            rdPro = document.createElement('div');
            rdPro.id = 'atProfesional-readonly';
            rdPro.className = 'readonly-field';
            selPro.parentNode.insertBefore(rdPro, selPro.nextSibling);
        }
        rdPro.textContent  = `${userAt.nombres} ${userAt.apellidos}`;
        rdPro.style.display = '';
    } else {
        selPro.style.display = '';
        const rdPro = document.getElementById('atProfesional-readonly');
        if (rdPro) rdPro.style.display = 'none';

        const resPro = await api('/api/profesionales');
        selPro.innerHTML = '<option value="">Seleccionar profesional…</option>';
        if (resPro.data) {
            resPro.data.forEach(p => {
                const espec = p.especialidad ? ` (${p.especialidad})` : '';
                selPro.innerHTML += `<option value="${p.id}">${p.apellidos}, ${p.nombres}${espec}</option>`;
            });
        }
    }

    // Cargar subservicios
    const resSub = await api('/api/subservicios');
    const selSub = document.getElementById('atSubservicio');
    selSub.innerHTML = '<option value="">Seleccionar servicio…</option>';
    if (resSub.data) {
        resSub.data.forEach(s => {
            selSub.innerHTML += `<option value="${s.id}" data-precio="${s.precio_base}" data-modalidad="${s.modalidad || ''}">${s.servicio} — ${s.nombre} (${s.modalidad})</option>`;
        });
    }

    // Ocultar sección vínculo al abrir el modal
    _toggleVinculoSection('');
    // Limpiar opciones de vínculo
    document.getElementById('atVinculoSelect').innerHTML = '<option value="">Cargando…</option>';
    document.getElementById('atRolVinculoExistente').value = '';
    document.getElementById('atVinculoNombre').value       = '';
    document.getElementById('atRolVinculoNuevo').value     = '';
    document.getElementById('atVinculoTipo').value         = 'pareja';
    // Deseleccionar radio "ninguno"
    const radioNinguno = document.querySelector('input[name="atVinculoOpcion"][value="ninguno"]');
    if (radioNinguno) radioNinguno.checked = true;
    _onVinculoRadioChange('ninguno');

    // Pre-seleccionar paciente y cargar sus datos si se indica
    if (pacienteIdPreset) {
        selPac.value = pacienteIdPreset;
        await cargarDatosPacienteEnModal(pacienteIdPreset);
    }

    // Precio base automático y sección vínculo al cambiar subservicio
    selSub.onchange = function () {
        const opt        = this.options[this.selectedIndex];
        const precio     = opt ? opt.dataset.precio    : '';
        const modalidad  = opt ? opt.dataset.modalidad : '';
        if (precio && !document.getElementById('atPrecioAcordado').value) {
            document.getElementById('atPrecioAcordado').value = parseFloat(precio).toFixed(2);
        }
        _toggleVinculoSection(modalidad);
    };

    document.getElementById('modalAtencion').classList.remove('hidden');
}

async function cargarDatosPacienteEnModal(pacienteId) {
    if (!pacienteId) return;
    const res = await api('/api/paciente?id=' + pacienteId);
    if (!res.data) return;
    const p = res.data;
    document.getElementById('atGradoInstruccion').value = p.grado_instruccion || 'no_especificado';
    document.getElementById('atOcupacion').value        = p.ocupacion        || '';
    document.getElementById('atEstadoCivil').value      = p.estado_civil     || 'no_especificado';
}

// ---- Helper: escapar HTML ----

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ---- Helpers errores sesión ----

function setSesError(fieldId, message) {
    const el    = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (el)    el.classList.toggle('is-invalid', !!message);
    if (errEl) errEl.textContent = message || '';
}

function clearSesErrors() {
    document.querySelectorAll('#sesionModalBody .field-error').forEach(el => { el.textContent = ''; });
    document.querySelectorAll('#sesionModalBody .is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

// ---- Render del cuerpo del modal de sesión ----

function _renderBodyIndividual(atencionId, siguienteNum, paqueteActivo) {
    const a = _currentAtencion;

    const paqueteBlock = paqueteActivo ? `
        <div style="border:1px solid var(--color-border);border-radius:var(--radius);padding:12px;margin-bottom:16px;background:rgba(155,126,200,.06)">
            <p style="margin:0 0 8px;font-size:.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#7B5EA7">Paquete disponible</p>
            <p style="margin:0 0 8px;font-size:.875rem"><strong>${escapeHtml(paqueteActivo.nombre_paquete)}</strong> · ${paqueteActivo.sesiones_restantes} sesiones restantes</p>
            <div style="display:flex;flex-direction:column;gap:6px">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.875rem">
                    <input type="radio" name="sesionPaqueteOp" value="aplicar" checked style="accent-color:#7B5EA7">
                    Aplicar este paquete a la sesión
                </label>
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.875rem">
                    <input type="radio" name="sesionPaqueteOp" value="no_aplicar" style="accent-color:#7B5EA7">
                    No aplicar paquete
                </label>
            </div>
            <input type="hidden" id="sesionPaqueteId" value="${paqueteActivo.id}">
        </div>` : '';

    document.getElementById('sesionModalBody').innerHTML = `
        <input type="hidden" id="sesionAtencionId" value="${atencionId}">

        <div style="background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius);padding:12px;margin-bottom:16px;font-size:.875rem">
            <p style="margin:0 0 4px"><strong>${escapeHtml(a?.paciente || '')}</strong></p>
            <p style="margin:0 0 2px;color:var(--color-text-muted)">Profesional: ${escapeHtml(a?.profesional || '')}</p>
            <p style="margin:0;color:var(--color-text-muted)">Servicio: ${escapeHtml(a?.subservicio || '')} (${a?.subservicio_modalidad || 'individual'})</p>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label>N° sesión</label>
                <input id="sesionNumero" type="number" min="1" value="${siguienteNum}" readonly class="readonly-field">
                <span class="field-error" id="sesionNumero-error"></span>
            </div>
            <div class="form-group">
                <label class="required">Duración (min)</label>
                <input id="sesionDuracion" type="number" min="1" value="50" placeholder="50">
                <span class="field-error" id="sesionDuracion-error"></span>
            </div>
        </div>

        <div class="form-group">
            <label class="required">Fecha y hora</label>
            <input id="sesionFechaHora" type="datetime-local" value="${new Date().toISOString().slice(0, 16)}">
            <span class="field-error" id="sesionFechaHora-error"></span>
        </div>

        <div class="form-group">
            <label>Estado</label>
            <select id="sesionEstado">
                <option value="programada">Programada</option>
                <option value="realizada" selected>Realizada</option>
                <option value="cancelada">Cancelada</option>
                <option value="no_asistio">No asistió</option>
            </select>
        </div>

        ${paqueteBlock}

        <div class="form-group">
            <label>Nota clínica</label>
            <textarea id="sesionNota" rows="4" placeholder="Observaciones clínicas de la sesión…"></textarea>
        </div>
        ${_adjHtmlDropZone('adjDrop', 'adjInput', 'adjPendientes')}
    `;
    _adjPendientes = [];
    requestAnimationFrame(() => _adjIniciarDropZone('adjDrop', 'adjInput', 'adjPendientes'));
}

function _renderBodyGrupal(a, siguienteNum, modalidad, sgExistente) {
    const participantes  = _sesionParticipantes;
    const badgeColor     = {pareja:'#3498DB', familiar:'#27AE60', grupal:'#8E44AD'}[modalidad] || '#6C757D';
    const modalidadLabel = {pareja:'Pareja', familiar:'Familiar', grupal:'Grupal'}[modalidad] || modalidad;
    const lockIcon = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="10" height="7" rx="1"/><path d="M5 8V5a3 3 0 0 1 6 0v3"/></svg>`;

    const numSesion = sgExistente ? (sgExistente.numero_sesion || '—') : (siguienteNum ?? '—');
    const duracion  = sgExistente ? (sgExistente.duracion_min ?? 50) : 50;

    const notaCompartida = sgExistente?.nota_clinica_compartida || '';
    const np1 = sgExistente?.nota_privada_p1 || '';
    const np2 = sgExistente?.nota_privada_p2 || '';
    const np3 = sgExistente?.nota_privada_p3 || '';

    const nombre = (idx) => escapeHtml(participantes[idx]?.paciente || `Participante ${idx + 1}`);

    const notaPrivadaBlock = (fieldId, nombreP, valor) => `
        <div class="form-group">
            <label style="display:flex;align-items:center;gap:4px">${lockIcon} Observación privada — ${nombreP}</label>
            <span style="display:block;font-size:11px;color:var(--color-text-muted);margin-bottom:4px">Solo visible para el profesional tratante. No aparece en el expediente del paciente ni en el PDF.</span>
            <textarea id="${fieldId}" rows="3" class="textarea-privado">${escapeHtml(valor)}</textarea>
        </div>`;

    let notasPrivadasHtml = notaPrivadaBlock('sgNotaP1', nombre(0), np1);
    if (participantes.length >= 2) notasPrivadasHtml += notaPrivadaBlock('sgNotaP2', nombre(1), np2);
    if (participantes.length >= 3) notasPrivadasHtml += notaPrivadaBlock('sgNotaP3', nombre(2), np3);

    const hiddenFields = sgExistente
        ? `<input type="hidden" id="sesionGrupalId" value="${sgExistente.id}">`
        : `<input type="hidden" id="sesionAtencionId" value="${a.id}">`;

    const campoDuracion = sgExistente
        ? `<label>Duración (min)</label>
           <input type="text" value="${duracion}" readonly class="readonly-field">`
        : `<label class="required">Duración (min)</label>
           <input id="sesionDuracion" type="number" min="1" value="${duracion}" placeholder="50">
           <span class="field-error" id="sesionDuracion-error"></span>`;

    document.getElementById('sesionModalBody').innerHTML = `
        ${hiddenFields}

        <div style="background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius);padding:12px;margin-bottom:16px;font-size:.875rem">
            <p style="margin:0 0 4px"><strong>${escapeHtml(a?.paciente || '')}</strong></p>
            <p style="margin:0 0 2px;color:var(--color-text-muted)">Profesional: ${escapeHtml(a?.profesional || '')}</p>
            <p style="margin:0 0 2px;color:var(--color-text-muted)">Servicio: ${escapeHtml(a?.subservicio || '')}</p>
            <p style="margin:0;color:var(--color-text-muted)">Proceso: ${escapeHtml(_sesionVinculoNombre || 'Proceso grupal')}
                <span style="display:inline-block;margin-left:4px;padding:1px 7px;border-radius:9px;font-size:11px;font-weight:600;color:#fff;background:${badgeColor}">${modalidadLabel}</span>
            </p>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label>N° sesión</label>
                <input type="text" value="${numSesion}" readonly class="readonly-field">
            </div>
            <div class="form-group">
                ${campoDuracion}
            </div>
        </div>

        <p style="font-size:11px;color:var(--color-text-muted);margin:0 0 14px;display:flex;align-items:flex-start;gap:5px">
            ${lockIcon}
            <span>La fecha y hora se registrarán automáticamente al guardar. Las observaciones privadas son confidenciales y no se comparten entre participantes.</span>
        </p>

        <div class="form-group">
            <label>Nota de sesión</label>
            <span style="display:block;font-size:11px;color:var(--color-text-muted);margin-bottom:4px">Visible para todos los participantes del proceso y en el historial clínico.</span>
            <textarea id="sgNotaCompartida" rows="4" placeholder="Dinámica grupal, hallazgos generales, intervenciones de la sesión…">${escapeHtml(notaCompartida)}</textarea>
        </div>

        <div style="display:flex;align-items:center;gap:8px;margin:16px 0">
            <div style="flex:1;border-top:.5px solid var(--color-border)"></div>
            <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-muted);display:flex;align-items:center;gap:4px;white-space:nowrap">
                ${lockIcon} Observaciones clínicas privadas
            </span>
            <div style="flex:1;border-top:.5px solid var(--color-border)"></div>
        </div>

        ${notasPrivadasHtml}
        ${_adjHtmlDropZone('adjDrop', 'adjInput', 'adjPendientes', 'adjExistentes')}
    `;
    _adjPendientes = [];
    requestAnimationFrame(() => _adjIniciarDropZone('adjDrop', 'adjInput', 'adjPendientes'));
}

// ---- Modal nueva sesión ----

async function abrirModalSesion(atencionId, siguienteNum) {
    const a         = _currentAtencion;
    const modalidad = (a?.subservicio_modalidad || 'individual').toLowerCase();
    const esGrupal  = ['pareja', 'familiar', 'grupal'].includes(modalidad);

    _sesionModo          = 'nueva';
    _sesionModalidad     = modalidad;
    _sesionVinculoId     = a?.vinculo_id || null;
    _sesionGrupalId      = null;
    _sesionParticipantes = [];
    _sesionVinculoNombre = '';

    if (esGrupal) {
        if (_sesionVinculoId) {
            const vRes = await api('/api/vinculo?id=' + _sesionVinculoId);
            if (vRes.success) {
                _sesionParticipantes = vRes.data.participantes || [];
                _sesionVinculoNombre = vRes.data.nombre_grupo || vRes.data.tipo_vinculo || 'Proceso grupal';
            }
        }
        document.getElementById('sesionModalTitle').textContent = 'Nueva sesión grupal';
        document.getElementById('sesionGuardarBtn').textContent = 'Registrar sesión';
        _renderBodyGrupal(a, siguienteNum, modalidad, null);
    } else {
        // Cargar paquete activo del paciente para mostrarlo en el modal
        let paqueteModal = window._atPaqueteActivo || null;
        if (!paqueteModal && a?.paciente_id) {
            const pqRes = await api('/api/paciente-paquetes?paciente_id=' + a.paciente_id + '&activo=1');
            if (pqRes.success && pqRes.data) paqueteModal = pqRes.data;
        }
        document.getElementById('sesionModalTitle').textContent = 'Nueva Sesión';
        document.getElementById('sesionGuardarBtn').textContent = 'Registrar sesión';
        _renderBodyIndividual(atencionId, siguienteNum, paqueteModal);
    }
    document.getElementById('modalSesion').classList.remove('hidden');
}

async function abrirModalEditarNotaGrupal(sgId) {
    const sg = _sgNotasMap[sgId];
    if (!sg) { showToast('Sesión no encontrada'); return; }

    const a         = _currentAtencion;
    const modalidad = (a?.subservicio_modalidad || 'grupal').toLowerCase();

    _sesionModo          = 'editar-grupal';
    _sesionModalidad     = modalidad;
    _sesionVinculoId     = a?.vinculo_id || null;
    _sesionGrupalId      = sgId;
    _sesionParticipantes = [];
    _sesionVinculoNombre = '';

    if (_sesionVinculoId) {
        const vRes = await api('/api/vinculo?id=' + _sesionVinculoId);
        if (vRes.success) {
            _sesionParticipantes = vRes.data.participantes || [];
            _sesionVinculoNombre = vRes.data.nombre_grupo || vRes.data.tipo_vinculo || 'Proceso grupal';
        }
    }

    document.getElementById('sesionModalTitle').textContent = 'Editar nota de sesión';
    document.getElementById('sesionGuardarBtn').textContent = 'Guardar cambios';
    _renderBodyGrupal(a, null, modalidad, sg);
    document.getElementById('modalSesion').classList.remove('hidden');

    // Cargar archivos existentes de la sesión grupal
    const adjExist = document.getElementById('adjExistentes');
    if (adjExist) await _adjCargarExistentes(null, sgId, 'adjExistentes');
}

async function guardarSesion() {
    const esGrupal = ['pareja', 'familiar', 'grupal'].includes(_sesionModalidad);

    if (esGrupal && _sesionModo === 'editar-grupal') {
        await _guardarEditarNotaGrupal();
        return;
    }
    if (esGrupal) {
        await _guardarNuevaSesionGrupal();
        return;
    }

    // Sesión individual: comportamiento original
    clearSesErrors();
    const atencionId = parseInt(document.getElementById('sesionAtencionId').value);
    const numero     = document.getElementById('sesionNumero').value;
    const fecha      = document.getElementById('sesionFechaHora').value;
    const duracion   = document.getElementById('sesionDuracion').value;
    const estado     = document.getElementById('sesionEstado').value;
    const nota       = document.getElementById('sesionNota').value.trim();

    let valido = true;
    if (!numero || parseInt(numero) < 1)     { setSesError('sesionNumero',   'Ingrese el número de sesión'); valido = false; }
    if (!fecha)                               { setSesError('sesionFechaHora', 'Ingrese la fecha y hora');    valido = false; }
    if (!duracion || parseInt(duracion) < 1) { setSesError('sesionDuracion', 'Ingrese la duración');         valido = false; }
    if (!valido) return;

    // Determinar si se aplica paquete
    const paqOp  = document.querySelector('input[name="sesionPaqueteOp"]:checked');
    const paqId  = document.getElementById('sesionPaqueteId')?.value;
    const paqAplicar = paqOp?.value === 'aplicar' && paqId;

    const res = await api('/api/sesiones', 'POST', {
        atencion_id:          atencionId,
        numero_sesion:        parseInt(numero),
        fecha_hora:           fecha,
        duracion_min:         parseInt(duracion),
        estado,
        nota_clinica:         nota || null,
        paciente_paquete_id:  paqAplicar ? parseInt(paqId) : null,
    });

    if (res.success) {
        if (_adjPendientes.length) await _adjSubirPendientes(res.data?.id, null);
        showToast('Sesión registrada');
        cerrarModal('modalSesion');
        verDetalleAtencion(atencionId, _atencionBack);
    } else {
        showToast(res.message || 'Error al guardar sesión');
    }
}

async function _guardarNuevaSesionGrupal() {
    const duracion = document.getElementById('sesionDuracion')?.value;
    if (!duracion || parseInt(duracion) < 1) {
        setSesError('sesionDuracion', 'Ingrese la duración');
        return;
    }

    const notaCompartida = document.getElementById('sgNotaCompartida')?.value.trim() || null;
    const np1 = document.getElementById('sgNotaP1')?.value.trim() || null;
    const np2 = document.getElementById('sgNotaP2')?.value.trim() || null;
    const np3 = document.getElementById('sgNotaP3')?.value.trim() || null;

    const atencionId = _currentAtencion?.id;
    const res = await api('/api/sesiones-grupo', 'POST', {
        vinculo_id:              _sesionVinculoId,
        duracion_min:            parseInt(duracion),
        nota_clinica_compartida: notaCompartida,
        nota_privada_p1:         np1,
        nota_privada_p2:         np2,
        nota_privada_p3:         np3,
    });

    if (res.success) {
        if (_adjPendientes.length) await _adjSubirPendientes(null, res.data?.id);
        showToast('Sesión grupal registrada');
        cerrarModal('modalSesion');
        verDetalleAtencion(atencionId, _atencionBack);
    } else {
        showToast(res.message || 'Error al registrar sesión grupal');
    }
}

async function _guardarEditarNotaGrupal() {
    const notaCompartida = document.getElementById('sgNotaCompartida')?.value.trim() || null;
    const np1 = document.getElementById('sgNotaP1')?.value.trim() || null;
    const np2 = document.getElementById('sgNotaP2')?.value.trim() || null;
    const np3 = document.getElementById('sgNotaP3')?.value.trim() || null;

    const atencionId = _currentAtencion?.id;
    const res = await api('/api/sesiones-grupo/nota', 'PUT', {
        id:                      _sesionGrupalId,
        nota_clinica_compartida: notaCompartida,
        nota_privada_p1:         np1,
        nota_privada_p2:         np2,
        nota_privada_p3:         np3,
    });

    if (res.success) {
        if (_adjPendientes.length) await _adjSubirPendientes(null, _sesionGrupalId);
        showToast('Nota actualizada');
        cerrarModal('modalSesion');
        verDetalleAtencion(atencionId, _atencionBack);
    } else {
        showToast(res.message || 'Error al actualizar nota');
    }
}

// ---- Modal editar nota clínica ----

async function abrirModalEditarNota(sesionId) {
    const nota = _sesionNotasMap[sesionId] || '';
    document.getElementById('editNotaSesionId').value     = sesionId;
    document.getElementById('editNotaContenido').value    = nota;
    document.getElementById('editNotaContenido').classList.remove('is-invalid');
    document.getElementById('editNota-error').textContent = '';
    _adjPendientes = [];

    // Inyectar sección adjuntos si no existe aún
    let adjWrap = document.getElementById('editNotaAdjuntosWrap');
    if (!adjWrap) {
        adjWrap = document.createElement('div');
        adjWrap.id = 'editNotaAdjuntosWrap';
        document.getElementById('editNotaContenido').parentElement.after(adjWrap);
    }
    adjWrap.innerHTML =
        '<div id="editNotaExistentes"></div>' +
        _adjHtmlDropZone('editAdjDrop', 'editAdjInput', 'editAdjPendientes');

    document.getElementById('modalEditarNota').classList.remove('hidden');
    requestAnimationFrame(() => _adjIniciarDropZone('editAdjDrop', 'editAdjInput', 'editAdjPendientes'));
    await _adjCargarExistentes(sesionId, null, 'editNotaExistentes');
}

async function guardarNotaSesion() {
    const id   = parseInt(document.getElementById('editNotaSesionId').value);
    const nota = document.getElementById('editNotaContenido').value.trim();

    if (!nota) {
        document.getElementById('editNotaContenido').classList.add('is-invalid');
        document.getElementById('editNota-error').textContent = 'La nota no puede estar vacía';
        return;
    }

    const res = await api('/api/sesiones/nota', 'PUT', { id, nota_clinica: nota });

    if (res.success) {
        if (_adjPendientes.length) await _adjSubirPendientes(id, null);
        showToast('Nota actualizada');
        cerrarModal('modalEditarNota');
        verDetalleAtencion(_currentAtencionId, _atencionBack);
    } else {
        showToast(res.message || 'Error al actualizar nota');
    }
}

// ---- Nueva tarea desde detalle de atención ----

function abrirModalTareaDesdeAtencion() {
    const sesiones = window._atencionSesiones || [];
    const sel = document.getElementById('tareaSesionSelect');
    sel.innerHTML = sesiones.length > 0
        ? sesiones.map(s => `<option value="${s.id}">Sesión ${s.numero_sesion} — ${s.fecha_hora ? s.fecha_hora.replace('T',' ').slice(0,16) : ''}</option>`).join('')
        : '<option value="">Sin sesiones disponibles</option>';

    ['tareaTitulo','tareaDescripcion','tareaFechaLimite'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('tareaEstadoInicial').value    = 'pendiente';
    document.getElementById('tareaTituloError').textContent = '';
    document.getElementById('tareaTitulo').classList.remove('is-invalid');
    document.getElementById('modalTarea').classList.remove('hidden');
}

// ---- Sección de vínculo grupal en el modal de nueva atención ----

function _toggleVinculoSection(modalidad) {
    const section    = document.getElementById('atVinculoSection');
    const esGrupal   = ['pareja','familiar','grupal'].includes(modalidad);
    section.style.display = esGrupal ? '' : 'none';
    if (!esGrupal) {
        const radioNinguno = document.querySelector('input[name="atVinculoOpcion"][value="ninguno"]');
        if (radioNinguno) radioNinguno.checked = true;
        _onVinculoRadioChange('ninguno');
    }
}

function _onVinculoRadioChange(valor) {
    document.getElementById('atVinculoExistenteBox').style.display = valor === 'existente' ? '' : 'none';
    document.getElementById('atVinculoNuevoBox').style.display     = valor === 'nuevo'     ? '' : 'none';

    if (valor === 'existente') {
        _cargarVinculosEnSelect();
    }
}

async function _cargarVinculosEnSelect() {
    const sel = document.getElementById('atVinculoSelect');
    sel.innerHTML = '<option value="">Cargando…</option>';
    const res = await api('/api/vinculos');
    sel.innerHTML = '<option value="">Seleccionar proceso grupal…</option>';
    if (res.data) {
        res.data.filter(v => v.estado === 'activo').forEach(v => {
            const tipoLabel = { pareja:'Pareja', familiar:'Familiar', grupal:'Grupal', taller:'Taller' }[v.tipo] || v.tipo;
            sel.innerHTML += `<option value="${v.id}">[${tipoLabel}] ${v.nombre} — ${v.profesional}</option>`;
        });
    }
}

// Llamado inline desde la tabla de tareas en el detalle de atención
async function cambiarEstadoTareaEnAtencion(tareaId, nuevoEstado) {
    const res = await api('/api/tareas/estado', 'PUT', { id: tareaId, estado: nuevoEstado });
    if (res.success) {
        showToast('Estado actualizado');
        if (_currentAtencionId) verDetalleAtencion(_currentAtencionId, _atencionBack);
    } else {
        showToast(res.message || 'Error al actualizar estado');
        if (_currentAtencionId) verDetalleAtencion(_currentAtencionId, _atencionBack);
    }
}

// ---- Modal nueva atención ----

async function guardarAtencion() {
    clearAtErrors();

    const esProfAt      = getUser()?.rol === 'profesional';
    const pacienteId    = document.getElementById('atPaciente').value;
    const profesionalId = esProfAt ? null : document.getElementById('atProfesional').value;
    const subservicioId = document.getElementById('atSubservicio').value;
    const fechaInicio   = document.getElementById('atFechaInicio').value;
    const precio        = document.getElementById('atPrecioAcordado').value;
    const motivo        = document.getElementById('atMotivoConsulta').value.trim();

    let valido = true;

    if (!pacienteId)               { setAtError('atPaciente',     'Seleccione un paciente');    valido = false; }
    if (!esProfAt && !profesionalId) { setAtError('atProfesional', 'Seleccione un profesional'); valido = false; }
    if (!subservicioId)            { setAtError('atSubservicio',   'Seleccione un servicio');    valido = false; }
    if (!fechaInicio)              { setAtError('atFechaInicio',   'Ingrese la fecha de inicio'); valido = false; }
    if (!precio || isNaN(parseFloat(precio))) {
        setAtError('atPrecioAcordado', 'Ingrese el precio acordado');
        valido = false;
    }
    if (!motivo)                   { setAtError('atMotivoConsulta', 'El motivo es obligatorio'); valido = false; }

    if (!valido) return;

    const data = {
        paciente_id:            parseInt(pacienteId),
        ...(esProfAt ? {} : { profesional_id: parseInt(profesionalId) }),
        subservicio_id:         parseInt(subservicioId),
        fecha_inicio:           fechaInicio,
        precio_acordado:        parseFloat(precio),
        descuento_monto:        parseFloat(document.getElementById('atDescuentoMonto').value) || 0,
        grado_instruccion:      document.getElementById('atGradoInstruccion').value,
        ocupacion:              document.getElementById('atOcupacion').value.trim()           || null,
        estado_civil:           document.getElementById('atEstadoCivil').value,
        motivo_consulta:        motivo,
        observacion_general:    document.getElementById('atObservacionGeneral').value.trim()  || null,
        antecedentes_relevantes: document.getElementById('atAntecedentes').value.trim()       || null,
        numero_sesiones_plan:   document.getElementById('atNumeroSesionesPlan').value
                                    ? parseInt(document.getElementById('atNumeroSesionesPlan').value) : null,
    };

    const res = await api('/api/atenciones', 'POST', data);

    if (res.success) {
        // Vincular a proceso grupal si el profesional lo indicó
        await _procesarVinculoPostAtencion(res.data ? res.data.id : null);

        showToast('Atención creada');
        cerrarModal('modalAtencion');
        atenciones();
    } else {
        showToast(res.message || 'Error al guardar');
    }
}

// ---- Sección de paquete en detalle de atención ----

function _pqCardSinPaquete() {
    return `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h4 style="margin:0;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Paquete de sesiones</h4>
            <button class="btn-primary" style="font-size:.8rem;padding:4px 12px" onclick="abrirModalContratarPaquete()">Asignar paquete</button>
        </div>
        <p style="margin:0;font-size:.875rem;color:var(--color-text-muted)">Este paciente no tiene paquete activo asignado.</p>`;
}

function _pqCardActivo(p) {
    const utilizadas = parseInt(p.sesiones_incluidas) - parseInt(p.sesiones_restantes);
    const total      = parseInt(p.sesiones_incluidas);
    const pct        = total > 0 ? Math.round((utilizadas / total) * 100) : 0;

    const estadoBadgeMap = {
        activo:    'badge-success',
        agotado:   'badge-warning',
        vencido:   'badge-danger',
        cancelado: 'badge-danger',
    };
    const estadoBadge = estadoBadgeMap[p.estado] || '';

    return `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h4 style="margin:0;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Paquete de sesiones</h4>
            <button style="font-size:.8rem;padding:4px 12px;border:1px solid var(--color-danger);color:var(--color-danger);background:transparent;border-radius:var(--radius);cursor:pointer"
                onclick="if(confirm('¿Cancelar este paquete? La cuenta de cobro generada no se eliminará.')) cancelarPaqueteActivo(${p.id})">
                Cancelar paquete
            </button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;flex-wrap:wrap">
            <div>
                <p style="margin:0 0 4px;font-weight:600">${escapeHtml(p.nombre_paquete)}</p>
                <p style="margin:0 0 4px;font-size:.875rem;color:var(--color-text-muted)">Activación: ${p.fecha_activacion || '-'}</p>
                ${p.fecha_vencimiento ? `<p style="margin:0 0 4px;font-size:.875rem;color:var(--color-text-muted)">Vencimiento: ${p.fecha_vencimiento}</p>` : ''}
                <span class="badge ${estadoBadge}">${p.estado}</span>
            </div>
            <div>
                <p style="margin:0 0 6px;font-size:.875rem">${utilizadas} de ${total} sesiones utilizadas</p>
                <div style="height:8px;background:var(--color-border);border-radius:4px;overflow:hidden">
                    <div style="width:${pct}%;height:100%;background:#7B5EA7;border-radius:4px;transition:.3s"></div>
                </div>
                <p style="margin:4px 0 0;font-size:.8rem;color:var(--color-text-muted)">${p.sesiones_restantes} restantes (${pct}% utilizado)</p>
            </div>
        </div>`;
}

async function cancelarPaqueteActivo(ppId) {
    const res = await api('/api/paciente-paquetes/cancelar', 'PUT', { id: ppId });
    if (res.success) {
        showToast('Paquete cancelado');
        window._atPaqueteActivo = null;
        verDetalleAtencion(_currentAtencionId, _atencionBack);
    } else {
        showToast(res.message || 'Error al cancelar paquete');
    }
}

async function abrirModalContratarPaquete() {
    // Cargar catálogo de paquetes activos
    const res = await api('/api/paquetes?activo=1');
    const paquetes = (res.data || []).filter(p => p.activo == 1 || p.activo === true);

    const sel = document.getElementById('cpqPaqueteSelect');
    sel.innerHTML = '<option value="">Seleccionar paquete…</option>';
    paquetes.forEach(p => {
        const pxs = p.sesiones_incluidas > 0 ? (parseFloat(p.precio_paquete) / parseInt(p.sesiones_incluidas)).toFixed(2) : '—';
        sel.innerHTML += `<option value="${p.id}" data-precio="${p.precio_paquete}" data-sesiones="${p.sesiones_incluidas}">
            ${escapeHtml(p.nombre)} — ${p.sesiones_incluidas} ses. · S/ ${parseFloat(p.precio_paquete).toFixed(2)} (S/${pxs}/ses.)
        </option>`;
    });

    document.getElementById('cpqFechaActivacion').value = new Date().toISOString().slice(0, 10);
    document.getElementById('cpqFechaVencimiento').value = '';
    document.getElementById('cpqNotas').value = '';
    document.getElementById('modalContratarPaquete').classList.remove('hidden');
}

async function guardarContratarPaquete() {
    const paqueteId = document.getElementById('cpqPaqueteSelect').value;
    if (!paqueteId) { showToast('Selecciona un paquete'); return; }

    const pacienteId    = window._atPacienteId;
    const profesionalId = window._atProfesionalId;

    const res = await api('/api/paciente-paquetes', 'POST', {
        paquete_id:        parseInt(paqueteId),
        paciente_id:       pacienteId,
        profesional_id:    profesionalId,
        fecha_activacion:  document.getElementById('cpqFechaActivacion').value || null,
        fecha_vencimiento: document.getElementById('cpqFechaVencimiento').value || null,
        notas:             document.getElementById('cpqNotas').value.trim() || null,
    });

    if (res.success) {
        showToast(res.message || 'Paquete contratado');
        cerrarModal('modalContratarPaquete');
        verDetalleAtencion(_currentAtencionId, _atencionBack);
    } else {
        showToast(res.message || 'Error al contratar paquete');
    }
}

async function _procesarVinculoPostAtencion(atencionId) {
    // Si el backend no devuelve el id de la atención recién creada, no podemos vincular
    if (!atencionId) return;

    const opcionRadio = document.querySelector('input[name="atVinculoOpcion"]:checked');
    const opcion      = opcionRadio ? opcionRadio.value : 'ninguno';
    if (opcion === 'ninguno') return;

    const rol = opcion === 'existente'
        ? document.getElementById('atRolVinculoExistente').value.trim()
        : document.getElementById('atRolVinculoNuevo').value.trim();

    if (opcion === 'existente') {
        const vinculoId = parseInt(document.getElementById('atVinculoSelect').value);
        if (!vinculoId) return;
        await api('/api/vinculos/participante', 'POST', {
            vinculo_id:  vinculoId,
            atencion_id: atencionId,
            rol:         rol || null,
        });

    } else if (opcion === 'nuevo') {
        const nombre  = document.getElementById('atVinculoNombre').value.trim();
        const tipo    = document.getElementById('atVinculoTipo').value;
        const userVinculo = getUser();
        const profId = userVinculo?.rol === 'profesional'
            ? (userVinculo.profesional_id || 0)
            : parseInt(document.getElementById('atProfesional').value);
        const fecha  = document.getElementById('atFechaInicio').value;
        if (!nombre || !profId) return;

        const resV = await api('/api/vinculos', 'POST', {
            nombre,
            tipo,
            profesional_id: profId,
            fecha_inicio:   fecha,
        });

        if (resV.success && resV.data && resV.data.id) {
            await api('/api/vinculos/participante', 'POST', {
                vinculo_id:  resV.data.id,
                atencion_id: atencionId,
                rol:         rol || null,
            });
        }
    }
}
