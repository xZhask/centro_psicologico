
// ---- Constantes ----
// TAREA_ESTADO_LABEL está definida en atenciones.js (carga antes)

const TAREA_ESTADO_BADGE = {
    pendiente:    'badge-pendiente',
    en_proceso:   'badge-confirmada',
    completada:   'badge-success',
    no_realizada: 'badge-danger',
};

// Mapa temporal descripción por tarea (evita escaping en onclick)
const _tareaDescMap = {};
const _tareaRespMap = {};

// ---- Punto de entrada del módulo ----

async function tareas() {
    const user = getUser();
    if (user && user.rol === 'paciente') {
        await _tareasPaciente();
    } else {
        await _tareasStaff();
    }
}

// ========================================================
// VISTA PROFESIONAL / ADMIN
// ========================================================

async function _tareasStaff() {
    // Mostrar selector de paciente para cargar sus tareas
    const resPac = await api('/api/pacientes');

    let opciones = '<option value="">Seleccionar paciente…</option>';
    if (resPac.data) {
        resPac.data.forEach(p => {
            opciones += `<option value="${p.id}">${p.apellidos}, ${p.nombres} — ${p.dni}</option>`;
        });
    }

    document.getElementById('view').innerHTML = `
        <h2>Tareas psicológicas</h2>
        <div style="display:flex;align-items:flex-end;gap:12px;margin-bottom:20px">
            <div class="form-group" style="margin:0;min-width:280px">
                <label for="tareaFiltPaciente" style="margin-bottom:4px;display:block">Paciente</label>
                <select id="tareaFiltPaciente" onchange="cargarTareasStaff(this.value)">
                    ${opciones}
                </select>
            </div>
        </div>
        <div id="tareasStaffPanel">
            <p style="color:var(--color-text-muted)">Seleccione un paciente para ver sus tareas.</p>
        </div>
    `;
}

async function cargarTareasStaff(pacienteId) {
    const panel = document.getElementById('tareasStaffPanel');
    if (!pacienteId) {
        panel.innerHTML = '<p style="color:var(--color-text-muted)">Seleccione un paciente para ver sus tareas.</p>';
        return;
    }

    panel.innerHTML = '<p style="color:var(--color-text-muted)">Cargando…</p>';
    const res = await api('/api/tareas?paciente_id=' + pacienteId);

    if (!res.success) {
        panel.innerHTML = '<p style="color:var(--color-danger)">Error al cargar tareas.</p>';
        return;
    }

    const tareasList = res.data || [];
    Object.keys(_tareaDescMap).forEach(k => delete _tareaDescMap[k]);
    Object.keys(_tareaRespMap).forEach(k => delete _tareaRespMap[k]);

    let rows = '';
    if (tareasList.length > 0) {
        tareasList.forEach(t => {
            _tareaDescMap[t.id] = t.descripcion || '';
            _tareaRespMap[t.id] = t.respuesta_paciente || '';
            const badgeClass = TAREA_ESTADO_BADGE[t.estado] || '';
            const tieneRespuesta = !!t.respuesta_paciente;
            rows += `<tr>
                <td style="font-size:.8rem;color:var(--color-text-muted)">${t.servicio}</td>
                <td style="font-size:.8rem">Sesión ${t.numero_sesion}</td>
                <td>
                    <strong>${escapeHtml(t.titulo)}</strong>
                    ${t.descripcion ? `<br><span style="font-size:.8rem;color:var(--color-text-muted)">${escapeHtml(t.descripcion)}</span>` : ''}
                </td>
                <td>${t.fecha_asignacion || '-'}</td>
                <td>${t.fecha_limite || '-'}</td>
                <td>
                    <select class="input" style="font-size:.8rem;padding:4px 8px;min-width:120px"
                        onchange="cambiarEstadoTarea(${t.id}, this.value)">
                        ${['pendiente','en_proceso','completada','no_realizada'].map(e =>
                            `<option value="${e}" ${t.estado === e ? 'selected' : ''}>${TAREA_ESTADO_LABEL[e]}</option>`
                        ).join('')}
                    </select>
                </td>
                <td style="max-width:200px">
                    ${tieneRespuesta
                        ? `<span style="white-space:pre-line;font-size:.875rem">${escapeHtml(t.respuesta_paciente)}</span>`
                        : `<span style="color:var(--color-text-muted);font-size:.8rem">Sin respuesta</span>`}
                </td>
            </tr>`;
        });
    } else {
        rows = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:24px">Este paciente no tiene tareas asignadas</td></tr>';
    }

    panel.innerHTML = `
        <table class="table">
            <tr>
                <th>Servicio</th>
                <th>Sesión</th>
                <th>Tarea</th>
                <th>Asignada</th>
                <th>Límite</th>
                <th>Estado</th>
                <th>Respuesta del paciente</th>
            </tr>
            ${rows}
        </table>
    `;
}

async function cambiarEstadoTarea(tareaId, nuevoEstado) {
    const res = await api('/api/tareas/estado', 'PUT', { id: tareaId, estado: nuevoEstado });
    if (res.success) {
        showToast('Estado actualizado');
    } else {
        showToast(res.message || 'Error al actualizar estado');
        // Recargar para restaurar valor anterior
        const sel = document.getElementById('tareaFiltPaciente');
        if (sel) cargarTareasStaff(sel.value);
    }
}

// ========================================================
// VISTA PACIENTE
// ========================================================

async function _tareasPaciente() {
    const res = await api('/api/tareas');

    const tareasList = res.data || [];
    Object.keys(_tareaDescMap).forEach(k => delete _tareaDescMap[k]);
    Object.keys(_tareaRespMap).forEach(k => delete _tareaRespMap[k]);

    // Separar pendientes/en_proceso de las completadas/no realizadas
    const pendientes  = tareasList.filter(t => t.estado === 'pendiente' || t.estado === 'en_proceso');
    const completadas = tareasList.filter(t => t.estado === 'completada' || t.estado === 'no_realizada');

    tareasList.forEach(t => {
        _tareaDescMap[t.id] = t.descripcion || '';
        _tareaRespMap[t.id] = t.respuesta_paciente || '';
    });

    document.getElementById('view').innerHTML = `
        <h2>Mis tareas</h2>

        ${pendientes.length === 0
            ? `<div class="card" style="padding:24px;text-align:center;color:var(--color-text-muted);margin-bottom:16px">
                   No tienes tareas pendientes. ¡Buen trabajo!
               </div>`
            : `<div class="card" style="padding:16px;margin-bottom:20px">
                   <h4 style="margin:0 0 14px;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">
                       Pendientes (${pendientes.length})
                   </h4>
                   ${pendientes.map(t => _tarjetaTareaPaciente(t)).join('')}
               </div>`}

        ${completadas.length > 0 ? `
        <div class="card" style="padding:16px">
            <h4 style="margin:0 0 14px;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">
                Historial (${completadas.length})
            </h4>
            <table class="table">
                <tr><th>Tarea</th><th>Sesión</th><th>Estado</th><th>Límite</th><th>Mi respuesta</th></tr>
                ${completadas.map(t => `<tr>
                    <td>${escapeHtml(t.titulo)}</td>
                    <td style="font-size:.8rem">Sesión ${t.numero_sesion}</td>
                    <td><span class="badge ${TAREA_ESTADO_BADGE[t.estado] || ''}">${TAREA_ESTADO_LABEL[t.estado] || t.estado}</span></td>
                    <td>${t.fecha_limite || '-'}</td>
                    <td style="max-width:220px;white-space:pre-line;font-size:.875rem">${t.respuesta_paciente ? escapeHtml(t.respuesta_paciente) : '<span style="color:var(--color-text-muted)">—</span>'}</td>
                </tr>`).join('')}
            </table>
        </div>` : ''}
    `;
}

function _tarjetaTareaPaciente(t) {
    const limite    = t.fecha_limite ? ` — Límite: <strong>${t.fecha_limite}</strong>` : '';
    const badgeClass = TAREA_ESTADO_BADGE[t.estado] || '';
    const yaRespondio = !!t.respuesta_paciente;

    return `
    <div class="card" style="padding:16px;margin-bottom:12px;border-left:4px solid var(--color-primary)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div style="flex:1">
                <p style="margin:0 0 4px;font-weight:600">${escapeHtml(t.titulo)}</p>
                ${t.descripcion ? `<p style="margin:0 0 6px;font-size:.875rem;color:var(--color-text-muted);white-space:pre-line">${escapeHtml(t.descripcion)}</p>` : ''}
                <p style="margin:0;font-size:.8rem;color:var(--color-text-muted)">
                    ${t.profesional} &nbsp;·&nbsp; Sesión ${t.numero_sesion}${limite}
                </p>
            </div>
            <span class="badge ${badgeClass}">${TAREA_ESTADO_LABEL[t.estado] || t.estado}</span>
        </div>

        ${yaRespondio
            ? `<div style="margin-top:10px;padding:10px 12px;background:var(--color-bg);border-radius:var(--radius);font-size:.875rem">
                   <p style="margin:0 0 4px;font-size:.75rem;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Mi respuesta</p>
                   <p style="margin:0;white-space:pre-line">${escapeHtml(t.respuesta_paciente)}</p>
                   <button style="margin-top:8px;font-size:.8rem;padding:3px 10px"
                       onclick="abrirModalResponder(${t.id})">Editar respuesta</button>
               </div>`
            : `<button class="btn-primary" style="margin-top:12px;font-size:.875rem"
                   onclick="abrirModalResponder(${t.id})">Responder tarea</button>`}
    </div>`;
}

// ---- Modal responder tarea (paciente) ----

function abrirModalResponder(tareaId) {
    document.getElementById('responderTareaId').value     = tareaId;
    document.getElementById('responderContenido').value   = _tareaRespMap[tareaId] || '';
    document.getElementById('responderContenido').classList.remove('is-invalid');
    document.getElementById('responderError').textContent = '';
    document.getElementById('modalResponderTarea').classList.remove('hidden');
}

async function guardarRespuestaTarea() {
    const id       = parseInt(document.getElementById('responderTareaId').value);
    const respuesta = document.getElementById('responderContenido').value.trim();

    if (!respuesta) {
        document.getElementById('responderContenido').classList.add('is-invalid');
        document.getElementById('responderError').textContent = 'La respuesta no puede estar vacía';
        return;
    }

    const res = await api('/api/tareas/respuesta', 'PUT', { id, respuesta_paciente: respuesta });

    if (res.success) {
        showToast('Respuesta registrada');
        cerrarModal('modalResponderTarea');
        await _tareasPaciente();
    } else {
        showToast(res.message || 'Error al guardar respuesta');
    }
}

// ---- Modal nueva tarea (abrirModalTareaDesdeAtencion está en atenciones.js) ----

async function guardarTarea() {
    const sesionId = parseInt(document.getElementById('tareaSesionSelect').value);
    const titulo   = document.getElementById('tareaTitulo').value.trim();

    document.getElementById('tareaTitulo').classList.remove('is-invalid');
    document.getElementById('tareaTituloError').textContent = '';

    if (!sesionId) {
        showToast('Seleccione una sesión');
        return;
    }
    if (!titulo) {
        document.getElementById('tareaTitulo').classList.add('is-invalid');
        document.getElementById('tareaTituloError').textContent = 'El título es obligatorio';
        return;
    }

    const res = await api('/api/tareas', 'POST', {
        sesion_id:    sesionId,
        titulo,
        descripcion:  document.getElementById('tareaDescripcion').value.trim() || null,
        fecha_limite: document.getElementById('tareaFechaLimite').value || null,
        estado:       document.getElementById('tareaEstadoInicial').value,
    });

    if (res.success) {
        showToast('Tarea creada');
        cerrarModal('modalTarea');
        // Refrescar el detalle de atención si estamos en él
        if (_currentAtencionId) {
            verDetalleAtencion(_currentAtencionId, _atencionBack);
        }
    } else {
        showToast(res.message || 'Error al crear tarea');
    }
}

// escapeHtml está definida en atenciones.js (carga antes)
