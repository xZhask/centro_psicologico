// ================================================================
// Módulo: Vínculos Grupales (pareja, familiar, grupal, taller)
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
    taller:   'Taller',
};

const TIPO_VINCULO_BADGE = {
    pareja:   'badge-info',
    familiar: 'badge-warning',
    grupal:   'badge-confirmada',
    taller:   'badge-pendiente',
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

// ----------------------------------------------------------------
// Vista principal: listado de vínculos
// ----------------------------------------------------------------

async function vinculos() {
    const res = await api('/api/vinculos');

    let rows = '';
    if (res.data && res.data.length > 0) {
        res.data.forEach(v => {
            const tipoBadge   = TIPO_VINCULO_BADGE[v.tipo]  || '';
            const tipoLabel   = TIPO_VINCULO_LABEL[v.tipo]  || v.tipo;
            const estadoBadge = v.estado === 'cerrado' ? 'badge-danger' : 'badge-success';
            rows += `<tr>
                <td><strong>${escapeHtmlV(v.nombre)}</strong></td>
                <td><span class="badge ${tipoBadge}">${tipoLabel}</span></td>
                <td>${v.profesional}</td>
                <td>${v.fecha_inicio || '-'}</td>
                <td>${v.total_participantes}</td>
                <td><span class="badge ${estadoBadge}">${v.estado}</span></td>
                <td>
                    <button class="btn-sm" title="Ver detalle" onclick="verDetalleVinculo(${v.id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="8" cy="8" r="3"/><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
                        </svg>
                    </button>
                    ${v.estado === 'activo' ? `
                    <button class="btn-sm" title="Cerrar proceso" onclick="cerrarVinculo(${v.id})">
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
            const atBadge = ESTADO_AT_BADGE_V[p.atencion_estado] || '';
            partHtml += `<tr>
                <td><strong>${escapeHtmlV(p.paciente)}</strong><br><span style="font-size:.78rem;color:var(--color-text-muted)">DNI ${p.paciente_dni || '-'}</span></td>
                <td>${escapeHtmlV(p.rol || '—')}</td>
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
        v.sesiones_grupo.forEach(s => {
            _sgNotasMap[s.id] = s.nota_compartida || '';
            const estadoClass = ESTADO_SG_BADGE[s.estado] || '';
            sesHtml += `<tr>
                <td>${s.numero_sesion}</td>
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
                    ${s.nota_compartida
                        ? escapeHtmlV(s.nota_compartida)
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

    const tipoBadge   = TIPO_VINCULO_BADGE[v.tipo]  || '';
    const tipoLabel   = TIPO_VINCULO_LABEL[v.tipo]  || v.tipo;
    const estadoBadge = v.estado === 'cerrado' ? 'badge-danger' : 'badge-success';
    const nextSesNum  = (v.sesiones_grupo ? v.sesiones_grupo.length : 0) + 1;

    document.getElementById('view').innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
            <button onclick="goBackFromVinculo()" style="display:flex;align-items:center;gap:6px;font-size:.875rem">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="10 4 6 8 10 12"/></svg>
                Volver
            </button>
            <h2 style="margin:0">${escapeHtmlV(v.nombre)}</h2>
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
                    <p style="margin:0;font-size:.75rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Descripción</p>
                    <p style="margin:4px 0 0;font-size:.875rem">${v.descripcion ? escapeHtmlV(v.descripcion) : '<span style="color:var(--color-text-muted)">—</span>'}</p>
                </div>
            </div>
        </div>

        <!-- Participantes -->
        <div class="card" style="padding:16px;margin-bottom:16px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <h4 style="margin:0;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">
                    Participantes (${v.participantes ? v.participantes.length : 0})
                </h4>
                ${v.estado === 'activo' ? `
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
                ${v.estado === 'activo' ? `
                <button class="btn-primary" style="font-size:.8rem;padding:4px 12px"
                    onclick="abrirModalNuevaSesionGrupo(${v.id}, ${nextSesNum})">+ Nueva sesión grupal</button>` : ''}
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
    if (!confirm('¿Cerrar este proceso grupal? Esta acción no se puede deshacer.')) return;
    const res = await api('/api/vinculos/cerrar', 'PUT', { id });
    if (res.success) {
        showToast('Proceso cerrado');
        vinculos();
    } else {
        showToast(res.message || 'Error al cerrar');
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
    const sel    = document.getElementById('vgProfesional');
    sel.innerHTML = '<option value="">Seleccionar profesional…</option>';
    if (resPro.data) {
        resPro.data.forEach(p => {
            const espec = p.especialidad ? ` (${p.especialidad})` : '';
            sel.innerHTML += `<option value="${p.id}">${p.apellidos}, ${p.nombres}${espec}</option>`;
        });
    }

    document.getElementById('vgNombre').value      = '';
    document.getElementById('vgTipo').value         = 'pareja';
    document.getElementById('vgFechaInicio').value  = new Date().toISOString().slice(0, 10);
    document.getElementById('vgDescripcion').value  = '';
    clearVgErrors();
    document.getElementById('modalNuevoVinculo').classList.remove('hidden');
}

function clearVgErrors() {
    ['vgNombre', 'vgProfesional', 'vgFechaInicio'].forEach(id => {
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
    const nombre       = document.getElementById('vgNombre').value.trim();
    const tipo         = document.getElementById('vgTipo').value;
    const profesional  = document.getElementById('vgProfesional').value;
    const fechaInicio  = document.getElementById('vgFechaInicio').value;
    const descripcion  = document.getElementById('vgDescripcion').value.trim();

    let valido = true;
    if (!nombre)      { setVgError('vgNombre',      'El nombre es obligatorio');         valido = false; }
    if (!profesional) { setVgError('vgProfesional', 'Seleccione un profesional');        valido = false; }
    if (!fechaInicio) { setVgError('vgFechaInicio', 'Ingrese la fecha de inicio');       valido = false; }
    if (!valido) return;

    const res = await api('/api/vinculos', 'POST', {
        nombre,
        tipo,
        profesional_id: parseInt(profesional),
        fecha_inicio:   fechaInicio,
        descripcion:    descripcion || null,
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
    document.getElementById('apRol').value        = '';

    // Cargar atenciones activas con modalidad grupal/pareja/familiar
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

    document.getElementById('apAtencionSelect').classList.remove('is-invalid');
    document.getElementById('apAtencion-error').textContent = '';
    document.getElementById('modalAgregarParticipante').classList.remove('hidden');
}

async function guardarParticipante() {
    const vinculoId = parseInt(document.getElementById('apVinculoId').value);
    const atencionId = parseInt(document.getElementById('apAtencionSelect').value);
    const rol        = document.getElementById('apRol').value.trim();

    if (!atencionId) {
        document.getElementById('apAtencionSelect').classList.add('is-invalid');
        document.getElementById('apAtencion-error').textContent = 'Seleccione una atención';
        return;
    }
    document.getElementById('apAtencionSelect').classList.remove('is-invalid');
    document.getElementById('apAtencion-error').textContent = '';

    const res = await api('/api/vinculos/participante', 'POST', {
        vinculo_id:  vinculoId,
        atencion_id: atencionId,
        rol:         rol || null,
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

function abrirModalNuevaSesionGrupo(vinculoId, siguienteNum) {
    document.getElementById('sgVinculoId').value    = vinculoId;
    document.getElementById('sgNumero').value        = siguienteNum;
    document.getElementById('sgFechaHora').value     = new Date().toISOString().slice(0, 16);
    document.getElementById('sgDuracion').value      = '60';
    document.getElementById('sgEstado').value        = 'programada';
    document.getElementById('sgNota').value          = '';
    clearSgErrors();
    document.getElementById('modalSesionGrupo').classList.remove('hidden');
}

function clearSgErrors() {
    ['sgNumero', 'sgFechaHora', 'sgDuracion'].forEach(id => {
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
    const numero    = document.getElementById('sgNumero').value;
    const fecha     = document.getElementById('sgFechaHora').value;
    const duracion  = document.getElementById('sgDuracion').value;
    const estado    = document.getElementById('sgEstado').value;
    const nota      = document.getElementById('sgNota').value.trim();

    let valido = true;
    if (!numero  || parseInt(numero)  < 1) { setSgError('sgNumero',   'Ingrese el número de sesión'); valido = false; }
    if (!fecha)                             { setSgError('sgFechaHora','Ingrese la fecha y hora');     valido = false; }
    if (!duracion || parseInt(duracion) < 1){ setSgError('sgDuracion', 'Ingrese la duración');        valido = false; }
    if (!valido) return;

    const res = await api('/api/sesiones-grupo', 'POST', {
        vinculo_id:     vinculoId,
        numero_sesion:  parseInt(numero),
        fecha_hora:     fecha,
        duracion_min:   parseInt(duracion),
        estado,
        nota_compartida: nota || null,
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

    const res = await api('/api/sesiones-grupo/nota', 'PUT', { id, nota_compartida: nota || null });

    if (res.success) {
        showToast('Nota compartida actualizada');
        cerrarModal('modalEditarNotaGrupo');
        verDetalleVinculo(_currentVinculoId, _vinculoBack);
    } else {
        showToast(res.message || 'Error al actualizar nota');
    }
}

// ----------------------------------------------------------------
// Helper local de escape (mismo patrón que atenciones.js)
// ----------------------------------------------------------------

function escapeHtmlV(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
