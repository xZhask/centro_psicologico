
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

// Mapa temporal nota actual por sesión (evita problemas de escaping en onclick)
const _sesionNotasMap = {};

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

    // Sesiones
    let sesionesHtml = '';
    // Limpiar y poblar el mapa de notas para evitar problemas de escaping en onclick
    Object.keys(_sesionNotasMap).forEach(k => delete _sesionNotasMap[k]);
    if (a.sesiones && a.sesiones.length > 0) {
        a.sesiones.forEach(s => {
            _sesionNotasMap[s.id] = s.nota_clinica || '';
            const estadoClass = {
                realizada: 'badge-success',
                programada: 'badge-confirmada',
                cancelada:  'badge-danger',
                no_asistio: 'badge-warning',
            }[s.estado] || '';
            sesionesHtml += `<tr>
                <td>${s.numero_sesion}</td>
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
        });
    } else {
        sesionesHtml = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:12px">Sin sesiones registradas</td></tr>';
    }

    // Diagnósticos
    let dxHtml = '';
    if (a.diagnosticos && a.diagnosticos.length > 0) {
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
    if (a.sesiones) a.sesiones.forEach(s => { _sesionNumMap[s.id] = s.numero_sesion; });

    let tareasHtml = '';
    if (a.tareas && a.tareas.length > 0) {
        a.tareas.forEach(t => {
            const estadoClass = {
                completada:   'badge-success',
                en_proceso:   'badge-confirmada',
                pendiente:    'badge-pendiente',
                no_realizada: 'badge-danger',
            }[t.estado] || '';
            const tieneResp = !!t.respuesta_paciente;
            tareasHtml += `<tr>
                <td style="font-size:.8rem">Sesión ${t.numero_sesion}</td>
                <td>
                    <strong>${escapeHtml(t.titulo)}</strong>
                    ${t.descripcion ? `<br><span style="font-size:.8rem;color:var(--color-text-muted)">${escapeHtml(t.descripcion)}</span>` : ''}
                </td>
                <td>
                    <select class="input" style="font-size:.8rem;padding:4px 8px;min-width:120px"
                        onchange="cambiarEstadoTarea(${t.id}, this.value)">
                        ${['pendiente','en_proceso','completada','no_realizada'].map(e =>
                            `<option value="${e}" ${t.estado === e ? 'selected' : ''}>${TAREA_ESTADO_LABEL[e]}</option>`
                        ).join('')}
                    </select>
                </td>
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
                    onclick="abrirModalSesion(${a.id}, ${a.sesiones.length + 1})">+ Nueva sesión</button>
            </div>
            <table class="table">
                <tr><th>#</th><th>Fecha / Hora</th><th>Duración</th><th>Estado</th><th>Nota clínica</th><th></th></tr>
                ${sesionesHtml}
            </table>
        </div>

        <!-- Diagnósticos -->
        <div class="card" style="padding:16px;margin-bottom:16px">
            <h4 style="margin:0 0 12px;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Diagnósticos CIE-10 (${a.diagnosticos.length})</h4>
            <table class="table">
                <tr><th>Código</th><th>Diagnóstico</th><th>Tipo</th><th>Fecha</th><th>Observación</th></tr>
                ${dxHtml}
            </table>
        </div>

        <!-- Tareas -->
        <div class="card" style="padding:16px">
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
    `;
}

function goBackFromAtencion() {
    if (_atencionBack) _atencionBack();
    else atenciones();
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

    // Cargar profesionales
    const resPro = await api('/api/profesionales');
    const selPro = document.getElementById('atProfesional');
    selPro.innerHTML = '<option value="">Seleccionar profesional…</option>';
    if (resPro.data) {
        resPro.data.forEach(p => {
            const espec = p.especialidad ? ` (${p.especialidad})` : '';
            selPro.innerHTML += `<option value="${p.id}">${p.apellidos}, ${p.nombres}${espec}</option>`;
        });
    }

    // Cargar subservicios
    const resSub = await api('/api/subservicios');
    const selSub = document.getElementById('atSubservicio');
    selSub.innerHTML = '<option value="">Seleccionar servicio…</option>';
    if (resSub.data) {
        resSub.data.forEach(s => {
            selSub.innerHTML += `<option value="${s.id}" data-precio="${s.precio_base}">${s.servicio} — ${s.nombre} (${s.modalidad})</option>`;
        });
    }

    // Pre-seleccionar paciente y cargar sus datos si se indica
    if (pacienteIdPreset) {
        selPac.value = pacienteIdPreset;
        await cargarDatosPacienteEnModal(pacienteIdPreset);
    }

    // Precio base automático al cambiar subservicio
    selSub.onchange = function () {
        const opt = this.options[this.selectedIndex];
        const precio = opt ? opt.dataset.precio : '';
        if (precio && !document.getElementById('atPrecioAcordado').value) {
            document.getElementById('atPrecioAcordado').value = parseFloat(precio).toFixed(2);
        }
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
    ['sesionNumero', 'sesionFechaHora', 'sesionDuracion'].forEach(id => setSesError(id, ''));
}

// ---- Modal nueva sesión ----

function abrirModalSesion(atencionId, siguienteNum) {
    clearSesErrors();
    document.getElementById('sesionAtencionId').value   = atencionId;
    document.getElementById('sesionNumero').value       = siguienteNum;
    document.getElementById('sesionFechaHora').value    = new Date().toISOString().slice(0, 16);
    document.getElementById('sesionDuracion').value     = '50';
    document.getElementById('sesionEstado').value       = 'programada';
    document.getElementById('sesionNota').value         = '';
    document.getElementById('modalSesion').classList.remove('hidden');
}

async function guardarSesion() {
    clearSesErrors();

    const atencionId = parseInt(document.getElementById('sesionAtencionId').value);
    const numero     = document.getElementById('sesionNumero').value;
    const fecha      = document.getElementById('sesionFechaHora').value;
    const duracion   = document.getElementById('sesionDuracion').value;
    const estado     = document.getElementById('sesionEstado').value;
    const nota       = document.getElementById('sesionNota').value.trim();

    let valido = true;
    if (!numero || parseInt(numero) < 1) { setSesError('sesionNumero',   'Ingrese el número de sesión'); valido = false; }
    if (!fecha)                          { setSesError('sesionFechaHora', 'Ingrese la fecha y hora');    valido = false; }
    if (!duracion || parseInt(duracion) < 1) { setSesError('sesionDuracion', 'Ingrese la duración');    valido = false; }
    if (!valido) return;

    const res = await api('/api/sesiones', 'POST', {
        atencion_id:   atencionId,
        numero_sesion: parseInt(numero),
        fecha_hora:    fecha,
        duracion_min:  parseInt(duracion),
        estado,
        nota_clinica:  nota || null,
    });

    if (res.success) {
        showToast('Sesión registrada');
        cerrarModal('modalSesion');
        verDetalleAtencion(atencionId, _atencionBack);
    } else {
        showToast(res.message || 'Error al guardar sesión');
    }
}

// ---- Modal editar nota clínica ----

function abrirModalEditarNota(sesionId) {
    const nota = _sesionNotasMap[sesionId] || '';
    document.getElementById('editNotaSesionId').value    = sesionId;
    document.getElementById('editNotaContenido').value   = nota;
    document.getElementById('editNotaContenido').classList.remove('is-invalid');
    document.getElementById('editNota-error').textContent = '';
    document.getElementById('modalEditarNota').classList.remove('hidden');
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

// Llamado inline desde la tabla de tareas en el detalle de atención
async function cambiarEstadoTarea(tareaId, nuevoEstado) {
    const res = await api('/api/tareas/estado', 'PUT', { id: tareaId, estado: nuevoEstado });
    if (res.success) {
        showToast('Estado actualizado');
    } else {
        showToast(res.message || 'Error al actualizar estado');
        if (_currentAtencionId) verDetalleAtencion(_currentAtencionId, _atencionBack);
    }
}

// ---- Modal nueva atención ----

async function guardarAtencion() {
    clearAtErrors();

    const pacienteId    = document.getElementById('atPaciente').value;
    const profesionalId = document.getElementById('atProfesional').value;
    const subservicioId = document.getElementById('atSubservicio').value;
    const fechaInicio   = document.getElementById('atFechaInicio').value;
    const precio        = document.getElementById('atPrecioAcordado').value;
    const motivo        = document.getElementById('atMotivoConsulta').value.trim();

    let valido = true;

    if (!pacienteId)    { setAtError('atPaciente',         'Seleccione un paciente');    valido = false; }
    if (!profesionalId) { setAtError('atProfesional',      'Seleccione un profesional'); valido = false; }
    if (!subservicioId) { setAtError('atSubservicio',      'Seleccione un servicio');    valido = false; }
    if (!fechaInicio)   { setAtError('atFechaInicio',      'Ingrese la fecha de inicio'); valido = false; }
    if (!precio || isNaN(parseFloat(precio))) {
        setAtError('atPrecioAcordado', 'Ingrese el precio acordado');
        valido = false;
    }
    if (!motivo)        { setAtError('atMotivoConsulta',   'El motivo es obligatorio');  valido = false; }

    if (!valido) return;

    const data = {
        paciente_id:            parseInt(pacienteId),
        profesional_id:         parseInt(profesionalId),
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
        showToast('Atención creada');
        cerrarModal('modalAtencion');
        atenciones();
    } else {
        showToast(res.message || 'Error al guardar');
    }
}
