
// ---- Helpers de validación inline ----

function setCitaError(fieldId, message) {
    const el    = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (el)    el.classList.toggle('is-invalid', !!message);
    if (errEl) errEl.textContent = message || '';
}

function clearCitaErrors() {
    ['citaPaciente', 'citaProfesional', 'citaSubservicio', 'citaFecha']
        .forEach(id => setCitaError(id, ''));
}

function setReprogError(fieldId, message) {
    const el    = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (el)    el.classList.toggle('is-invalid', !!message);
    if (errEl) errEl.textContent = message || '';
}

// ---- Vista principal ----

async function citas() {
    // Leer filtros del formulario si ya existe en el DOM
    const estadoVal = document.getElementById('filtroEstado')?.value || '';
    const fechaVal  = document.getElementById('filtroFecha')?.value  || '';

    let query = '/api/citas';
    const qs  = [];
    if (estadoVal) qs.push('estado=' + encodeURIComponent(estadoVal));
    if (fechaVal)  qs.push('fecha='  + encodeURIComponent(fechaVal));
    if (qs.length) query += '?' + qs.join('&');

    const res = await api(query);

    const estadoOpciones = `
        <option value="">Todos los estados</option>
        <option value="pendiente"     ${estadoVal === 'pendiente'     ? 'selected' : ''}>Pendiente</option>
        <option value="confirmada"    ${estadoVal === 'confirmada'    ? 'selected' : ''}>Confirmada</option>
        <option value="completada"    ${estadoVal === 'completada'    ? 'selected' : ''}>Completada</option>
        <option value="cancelada"     ${estadoVal === 'cancelada'     ? 'selected' : ''}>Cancelada</option>
        <option value="no_asistio"    ${estadoVal === 'no_asistio'    ? 'selected' : ''}>No asistió</option>
        <option value="reprogramada"  ${estadoVal === 'reprogramada'  ? 'selected' : ''}>Reprogramada</option>
    `;

    const ESTADO_BADGE = {
        pendiente:    'badge-pendiente',
        confirmada:   'badge-confirmada',
        completada:   'badge-success',
        cancelada:    'badge-danger',
        no_asistio:   'badge-warning',
        reprogramada: 'badge-info',
    };

    let rows = '';
    if (res.data && res.data.length > 0) {
        res.data.forEach(c => {
            const id          = c.cita_id || c.id;
            const estado      = c.estado || 'pendiente';
            const badgeClass  = ESTADO_BADGE[estado] || '';
            const duracion    = c.duracion_min ? `${c.duracion_min} min` : '-';
            const reprog      = c.reprogramaciones_count > 0
                ? `<span title="Reprogramada ${c.reprogramaciones_count}x" style="color:var(--color-warning);font-size:.75rem;margin-left:4px">↻${c.reprogramaciones_count}</span>`
                : '';
            const puedeReprog = ['pendiente', 'confirmada'].includes(estado);

            rows += `<tr>
                <td>${c.paciente || 'N/A'}</td>
                <td>${c.profesional || '-'}</td>
                <td>${c.subservicio || '-'}</td>
                <td>${duracion}</td>
                <td>${formatFecha(c.fecha_hora_inicio)}</td>
                <td><span class="badge ${badgeClass}">${estado.replace('_', ' ')}</span>${reprog}</td>
                <td>
                    <button class="btn-sm" title="Confirmar" onclick="cambiarEstadoCita(${id},'confirmada')">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 8 6 12 14 4"/></svg>
                    </button>
                    ${puedeReprog ? `
                    <button class="btn-sm" title="Reprogramar" onclick="abrirModalReprogramar(${id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="1"/><line x1="5" y1="1" x2="5" y2="3"/><line x1="11" y1="1" x2="11" y2="3"/><line x1="2" y1="6" x2="14" y2="6"/><path d="M9 10l1.5 1.5L13 9"/></svg>
                    </button>` : ''}
                    <button class="btn-sm" title="Cancelar" onclick="cambiarEstadoCita(${id},'cancelada')">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
                    </button>
                    <button class="btn-sm" title="Eliminar" onclick="eliminarCita(${id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 4 13 4"/><path d="M5 4V3h6v1"/><path d="M4 4l1 10h6l1-10"/></svg>
                    </button>
                </td>
            </tr>`;
        });
    } else {
        rows = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:24px">No hay citas que coincidan con los filtros</td></tr>';
    }

    document.getElementById('view').innerHTML = `
        <h2>Citas</h2>

        <!-- Barra de filtros -->
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px;padding:16px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius)">
            <div class="form-group" style="margin:0;min-width:160px">
                <label style="font-size:.8rem;margin-bottom:4px;display:block">Estado</label>
                <select id="filtroEstado" style="width:100%">${estadoOpciones}</select>
            </div>
            <div class="form-group" style="margin:0;min-width:160px">
                <label style="font-size:.8rem;margin-bottom:4px;display:block">Fecha</label>
                <input id="filtroFecha" type="date" value="${fechaVal}" style="width:100%">
            </div>
            <button class="btn-primary" onclick="citas()" style="height:36px">Filtrar</button>
            <button onclick="limpiarFiltrosCitas()" style="height:36px">Limpiar</button>
        </div>

        <button class="btn-primary" onclick="abrirModalCita()" style="margin-bottom:12px">+ Nueva Cita</button>

        <table class="table">
            <tr>
                <th>Paciente</th>
                <th>Profesional</th>
                <th>Servicio</th>
                <th>Duración</th>
                <th>Fecha / Hora</th>
                <th>Estado</th>
                <th>Acciones</th>
            </tr>
            ${rows}
        </table>
    `;
}

function limpiarFiltrosCitas() {
    const se = document.getElementById('filtroEstado');
    const sf = document.getElementById('filtroFecha');
    if (se) se.value = '';
    if (sf) sf.value = '';
    citas();
}

function formatFecha(dt) {
    if (!dt) return '-';
    // dt puede ser "2025-04-15 09:00:00" o ISO
    const d = new Date(dt.replace(' ', 'T'));
    if (isNaN(d)) return dt;
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

// ---- Abrir modal nueva cita ----

async function abrirModalCita() {
    clearCitaErrors();

    const resPac = await api('/api/pacientes');
    const selPac = document.getElementById('citaPaciente');
    selPac.innerHTML = '<option value="">Seleccionar paciente…</option>';
    if (resPac.data) {
        resPac.data.forEach(p => {
            selPac.innerHTML += `<option value="${p.id}">${p.apellidos}, ${p.nombres} — ${p.dni}</option>`;
        });
    }

    const resPro = await api('/api/profesionales');
    const selPro = document.getElementById('citaProfesional');
    selPro.innerHTML = '<option value="">Seleccionar profesional…</option>';
    if (resPro.data) {
        resPro.data.forEach(p => {
            const espec = p.especialidad ? ` (${p.especialidad})` : '';
            selPro.innerHTML += `<option value="${p.id}">${p.apellidos}, ${p.nombres}${espec}</option>`;
        });
    }

    const resSub = await api('/api/subservicios');
    const selSub = document.getElementById('citaSubservicio');
    selSub.innerHTML = '<option value="">Seleccionar servicio…</option>';
    if (resSub.data) {
        resSub.data.forEach(s => {
            selSub.innerHTML += `<option value="${s.id}">${s.servicio} — ${s.nombre} (${s.modalidad}, S/ ${parseFloat(s.precio_base).toFixed(2)})</option>`;
        });
    }

    document.getElementById('citaFecha').value = '';
    document.getElementById('modalCita').classList.remove('hidden');
}

// ---- Guardar nueva cita ----

async function guardarCita() {
    clearCitaErrors();

    const pacienteId    = document.getElementById('citaPaciente').value;
    const profesionalId = document.getElementById('citaProfesional').value;
    const subservicioId = document.getElementById('citaSubservicio').value;
    const fecha         = document.getElementById('citaFecha').value;

    let valido = true;

    if (!pacienteId)    { setCitaError('citaPaciente',    'Seleccione un paciente');    valido = false; }
    if (!profesionalId) { setCitaError('citaProfesional', 'Seleccione un profesional'); valido = false; }
    if (!subservicioId) { setCitaError('citaSubservicio', 'Seleccione un servicio');    valido = false; }
    if (!fecha)         { setCitaError('citaFecha',       'Seleccione fecha y hora');   valido = false; }

    if (!valido) return;

    const res = await api('/api/citas', 'POST', {
        paciente_id:       pacienteId,
        profesional_id:    profesionalId,
        subservicio_id:    subservicioId,
        fecha_hora_inicio: fecha,
    });

    if (res.success) {
        showToast('Cita creada');
        cerrarModal('modalCita');
        citas();
    } else {
        if (res.message && res.message.toLowerCase().includes('horario')) {
            setCitaError('citaFecha', res.message);
        } else {
            showToast(res.message || 'Error al crear cita');
        }
    }
}

// ---- Reprogramar ----

function abrirModalReprogramar(citaId) {
    document.getElementById('citaReprogramarId').value   = citaId;
    document.getElementById('citaNuevaFecha').value      = '';
    document.getElementById('citaMotivoReprog').value    = '';
    setReprogError('citaNuevaFecha',   '');
    setReprogError('citaMotivoReprog', '');
    document.getElementById('modalReprogramar').classList.remove('hidden');
}

async function guardarReprogramacion() {
    const id         = document.getElementById('citaReprogramarId').value;
    const nuevaFecha = document.getElementById('citaNuevaFecha').value;
    const motivo     = document.getElementById('citaMotivoReprog').value.trim();

    let valido = true;

    setReprogError('citaNuevaFecha',   '');
    setReprogError('citaMotivoReprog', '');

    if (!nuevaFecha) {
        setReprogError('citaNuevaFecha', 'Seleccione la nueva fecha y hora');
        valido = false;
    }
    if (!motivo) {
        setReprogError('citaMotivoReprog', 'El motivo es obligatorio');
        valido = false;
    }

    if (!valido) return;

    const res = await api('/api/citas/reprogramar', 'POST', {
        id:          parseInt(id),
        nueva_fecha: nuevaFecha,
        motivo,
    });

    if (res.success) {
        showToast('Cita reprogramada correctamente');
        cerrarModal('modalReprogramar');
        citas();
    } else {
        if (res.message && res.message.toLowerCase().includes('horario')) {
            setReprogError('citaNuevaFecha', res.message);
        } else {
            showToast(res.message || 'Error al reprogramar');
        }
    }
}

// ---- Cambiar estado ----

async function cambiarEstadoCita(id, estado) {
    const res = await api('/api/citas/estado', 'PUT', { id, estado });
    if (res.success) {
        showToast('Estado actualizado');
        citas();
    } else {
        showToast(res.message || 'Error');
    }
}

// ---- Eliminar ----

async function eliminarCita(id) {
    if (!confirm('¿Eliminar esta cita?')) return;
    const res = await api('/api/citas', 'DELETE', { id });
    if (res.success) {
        showToast('Cita eliminada');
        citas();
    } else {
        showToast(res.message || 'Error');
    }
}
