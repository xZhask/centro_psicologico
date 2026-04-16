// ================================================================
// Módulo: Vínculos Grupales (pareja, familiar, grupal)
// ================================================================

// Estado de navegación
let _vinculoBack      = null;
let _currentVinculoId = null;

// Mapa de notas de sesiones grupales para evitar problemas de escaping
const _sgNotasMap = {};

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
    programada: 'badge-confirmada',
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
    consultante:  'Consultante',
    acompanante:  'Acompañante',
    familiar:     'Familiar',
    participante: 'Participante',
};

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
// Detalle de vínculo
// ----------------------------------------------------------------

async function verDetalleVinculo(id, backFn) {
    _vinculoBack      = backFn || (() => vinculos());
    _currentVinculoId = id;

    const res = await api('/api/vinculo?id=' + id);
    if (!res.success) { showToast(res.message || 'Error al cargar el vínculo'); return; }
    const v = res.data;

    // Limpiar mapa de notas
    Object.keys(_sgNotasMap).forEach(k => delete _sgNotasMap[k]);

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

    // Sesiones grupales
    let sesHtml = '';
    if (v.sesiones_grupo && v.sesiones_grupo.length > 0) {
        v.sesiones_grupo.forEach((s, idx) => {
            _sgNotasMap[s.id] = s.nota_clinica_compartida || '';
            const estadoClass = ESTADO_SG_BADGE[s.estado] || '';
            sesHtml += `<tr>
                <td>${idx + 1}</td>
                <td>${s.fecha_hora ? s.fecha_hora.replace('T', ' ') : '-'}</td>
                <td>${s.duracion_min ? s.duracion_min + ' min' : '-'}</td>
                <td>
                    <select class="input" style="font-size:.8rem;padding:4px 8px;min-width:120px"
                        onchange="cambiarEstadoSesionGrupo(${s.id}, this.value)">
                        ${['programada','realizada','cancelada','no_asistio'].map(e =>
                            `<option value="${e}" ${s.estado === e ? 'selected' : ''}>${e.replace('_',' ')}</option>`
                        ).join('')}
                    </select>
                </td>
                <td style="max-width:260px;white-space:pre-line;font-size:.875rem">
                    ${s.nota_clinica_compartida
                        ? escapeHtmlV(s.nota_clinica_compartida)
                        : '<span style="color:var(--color-text-muted)">Sin nota</span>'}
                </td>
                <td>
                    <button class="btn-sm" title="Editar nota compartida"
                        onclick="abrirModalEditarNotaGrupo(${s.id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 2l3 3-9 9H2v-3L11 2z"/>
                        </svg>
                    </button>
                </td>
            </tr>`;
        });
    } else {
        sesHtml = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:12px">Sin sesiones grupales registradas</td></tr>';
    }

    const tipoBadge   = TIPO_VINCULO_BADGE[v.tipo_vinculo]  || '';
    const tipoLabel   = TIPO_VINCULO_LABEL[v.tipo_vinculo]  || v.tipo_vinculo;
    const estadoBadge = ESTADO_VG_BADGE[v.estado] || 'badge-confirmada';
    const esActivo    = v.estado === 'activo';

    document.getElementById('view').innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
            <button onclick="goBackFromVinculo()" style="display:flex;align-items:center;gap:6px;font-size:.875rem">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="10 4 6 8 10 12"/></svg>
                Volver
            </button>
            <h2 style="margin:0">${escapeHtmlV(v.nombre_grupo || '—')}</h2>
            <span class="badge ${tipoBadge}">${tipoLabel}</span>
            <span class="badge ${estadoBadge}">${v.estado}</span>
        </div>

        <!-- Info general -->
        <div class="card" style="padding:16px;margin-bottom:16px">
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
                <div>
                    <p style="margin:0;font-size:.75rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Profesional</p>
                    <p style="margin:4px 0 0;font-weight:600">${escapeHtmlV(v.profesional)}</p>
                </div>
                <div>
                    <p style="margin:0;font-size:.75rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Inicio</p>
                    <p style="margin:4px 0 0">${v.fecha_inicio || '-'}</p>
                </div>
                <div>
                    <p style="margin:0;font-size:.75rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Fin</p>
                    <p style="margin:4px 0 0">${v.fecha_fin || '<span style="color:var(--color-text-muted)">En curso</span>'}</p>
                </div>
            </div>
        </div>

        <!-- Participantes -->
        <div class="card" style="padding:16px;margin-bottom:16px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <h4 style="margin:0;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">
                    Participantes (${v.participantes ? v.participantes.length : 0})
                </h4>
                ${esActivo ? `
                <button class="btn-primary" style="font-size:.8rem;padding:4px 12px"
                    onclick="abrirModalAgregarParticipante(${v.id})">+ Agregar participante</button>` : ''}
            </div>
            <table class="table">
                <tr><th>Paciente</th><th>Rol en el proceso</th><th>Servicio</th><th>Estado atención</th><th>Acciones</th></tr>
                ${partHtml}
            </table>
        </div>

        <!-- Sesiones grupales -->
        <div class="card" style="padding:16px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <h4 style="margin:0;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">
                    Sesiones grupales (${v.sesiones_grupo ? v.sesiones_grupo.length : 0})
                </h4>
                ${esActivo ? `
                <button class="btn-primary" style="font-size:.8rem;padding:4px 12px"
                    onclick="abrirModalNuevaSesionGrupo(${v.id})">+ Nueva sesión grupal</button>` : ''}
            </div>
            <table class="table">
                <tr><th>#</th><th>Fecha / Hora</th><th>Duración</th><th>Estado</th><th>Nota compartida</th><th></th></tr>
                ${sesHtml}
            </table>
        </div>
    `;
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
        vinculos();
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
    document.getElementById('vgFechaInicio').value  = new Date().toISOString().slice(0, 10);
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
    });

    if (res.success) {
        showToast('Proceso grupal creado');
        cerrarModal('modalNuevoVinculo');
        vinculos();
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
    document.getElementById('sgFechaHora').value  = new Date().toISOString().slice(0, 16);
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
// Modal: Editar nota compartida de sesión grupal
// ----------------------------------------------------------------

function abrirModalEditarNotaGrupo(sesionId) {
    const nota = _sgNotasMap[sesionId] || '';
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
