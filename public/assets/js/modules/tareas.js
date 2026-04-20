
// ---- Constantes ----
// TAREA_ESTADO_LABEL está definida en atenciones.js (carga antes)

// ---- Badge unificado de estado de tarea ----

function badgeTarea(estado) {
    const cfg = {
        completada:   { bg: 'rgba(39,174,96,.12)',   color: '#1B6B3A', texto: 'Completada',   icono: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 8 6 12 14 4"/></svg>' },
        en_proceso:   { bg: 'rgba(232,184,75,.12)',  color: '#9A7010', texto: 'En proceso',   icono: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="7"/><polyline points="8 4 8 8 11 10"/></svg>' },
        pendiente:    { bg: 'rgba(42,127,143,.12)',  color: '#1B5C6B', texto: 'Pendiente',    icono: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="7"/></svg>' },
        no_realizada: { bg: 'rgba(231,76,60,.12)',   color: '#C0392B', texto: 'No realizada', icono: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="7"/><line x1="5" y1="5" x2="11" y2="11"/><line x1="11" y1="5" x2="5" y2="11"/></svg>' },
    };
    const c = cfg[estado] || { bg: 'rgba(0,0,0,.06)', color: '#555', texto: estado, icono: '' };
    return `<span class="tarea-badge" style="display:inline-flex;align-items:center;gap:4px;background:${c.bg};color:${c.color};font-size:11px;font-weight:500;padding:3px 10px;border-radius:99px">${c.icono}${c.texto}</span>`;
}

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
                <td>${badgeTarea(t.estado)}</td>
                <td style="max-width:200px">
                    ${tieneRespuesta
                        ? `<span style="white-space:pre-line;font-size:.875rem">${escapeHtml(t.respuesta_paciente)}</span>`
                        : `<span style="color:var(--color-text-muted);font-size:.8rem">Sin respuesta</span>`}
                </td>
                <td>
                    <button class="btn-sm" title="Ver en atención"
                        style="color:#1B6B8A;font-size:.75rem;display:inline-flex;align-items:center;gap:4px"
                        onclick="navigate('atenciones',{atencion_id:${t.atencion_id}})">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 4 10 8 6 12"/></svg>
                        Ver
                    </button>
                </td>
            </tr>`;
        });
    } else {
        rows = '<tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:24px">Este paciente no tiene tareas asignadas</td></tr>';
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
                <th></th>
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

    // Separar activas (incluye no_realizada para que el paciente pueda responder tarde)
    const pendientes  = tareasList.filter(t => t.estado === 'pendiente' || t.estado === 'en_proceso' || t.estado === 'no_realizada');
    const completadas = tareasList.filter(t => t.estado === 'completada');

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
                    <td>${badgeTarea(t.estado)}</td>
                    <td>${t.fecha_limite || '-'}</td>
                    <td style="max-width:220px;white-space:pre-line;font-size:.875rem">
                        ${t.respuesta_paciente
                            ? `<span style="display:block;padding:6px 10px;background:rgba(39,174,96,.06);border-left:3px solid #27AE60;border-radius:4px">${escapeHtml(t.respuesta_paciente)}</span>`
                            : '<span style="color:var(--color-text-muted)">—</span>'}
                    </td>
                </tr>`).join('')}
            </table>
        </div>` : ''}
    `;
}

function _tarjetaTareaPaciente(t) {
    const limite     = t.fecha_limite ? ` — Límite: <strong>${t.fecha_limite}</strong>` : '';
    const borderColor = t.estado === 'no_realizada' ? 'var(--color-danger)' : 'var(--color-primary)';
    const yaRespondio = !!t.respuesta_paciente;

    return `
    <div class="card" style="padding:16px;margin-bottom:12px;border-left:4px solid ${borderColor}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div style="flex:1">
                <p style="margin:0 0 4px;font-weight:600">${escapeHtml(t.titulo)}</p>
                ${t.descripcion ? `<p style="margin:0 0 6px;font-size:.875rem;color:var(--color-text-muted);white-space:pre-line">${escapeHtml(t.descripcion)}</p>` : ''}
                <p style="margin:0;font-size:.8rem;color:var(--color-text-muted)">
                    ${t.profesional} &nbsp;·&nbsp; Sesión ${t.numero_sesion}${limite}
                </p>
            </div>
            ${badgeTarea(t.estado)}
        </div>

        ${yaRespondio
            ? `<div style="margin-top:10px;padding:10px 12px;background:rgba(39,174,96,.06);border-left:3px solid #27AE60;border-radius:var(--radius);font-size:.875rem">
                   <p style="margin:0 0 4px;font-size:.75rem;font-weight:600;color:#1B6B3A;text-transform:uppercase;letter-spacing:.05em">Mi respuesta</p>
                   <p style="margin:0;white-space:pre-line">${escapeHtml(t.respuesta_paciente)}</p>
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
