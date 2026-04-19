
// Contexto de la cita seleccionada para gestión de atención
let _citaActiva = null;

// Timer de debounce para el combobox de paciente
let _pacienteBusquedaTimer = null;

// ---- Helpers de validación inline ----

function setCitaError(fieldId, message) {
    const el    = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (el)    el.classList.toggle('is-invalid', !!message);
    if (errEl) errEl.textContent = message || '';
}

function clearCitaErrors() {
    ['citaProfesionalNA', 'citaServicio', 'citaSubservicioNA', 'citaFechaNA',
     'citaProfesionalSE', 'citaAtencionSE', 'citaFechaSE']
        .forEach(id => setCitaError(id, ''));
    const errPac  = document.getElementById('citaPacienteId-error');
    const errTipo = document.getElementById('citaTipo-error');
    const combo   = document.getElementById('citaPacienteCombo');
    if (errPac)  errPac.textContent  = '';
    if (errTipo) errTipo.textContent = '';
    if (combo)   combo.classList.remove('is-invalid');
}

// ---- Combobox de paciente ----

function limpiarPacienteCita() {
    const input  = document.getElementById('citaPacienteInput');
    const hidden = document.getElementById('citaPacienteId');
    const clear  = document.getElementById('citaPacienteClear');
    const lista  = document.getElementById('citaPacienteLista');
    const combo  = document.getElementById('citaPacienteCombo');
    if (input)  input.value = '';
    if (hidden) hidden.value = '';
    if (clear)  clear.classList.add('hidden');
    if (lista)  { lista.innerHTML = ''; lista.classList.add('hidden'); }
    if (combo)  combo.classList.remove('is-invalid');
    const err = document.getElementById('citaPacienteId-error');
    if (err) err.textContent = '';
}

async function buscarPacientesCita(termino) {
    const lista = document.getElementById('citaPacienteLista');
    if (termino.length < 2) {
        lista.classList.add('hidden');
        return;
    }
    lista.innerHTML = '<li class="combobox-item disabled">Buscando…</li>';
    lista.classList.remove('hidden');

    const res       = await api(`/api/pacientes?q=${encodeURIComponent(termino)}`);
    const pacientes = res.data || [];
    lista.innerHTML = '';

    if (pacientes.length === 0) {
        lista.innerHTML = `
            <li class="combobox-item disabled">No se encontraron pacientes</li>
            <li class="combobox-item combobox-new" onclick="irARegistrarPaciente()">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:-1px;margin-right:5px"><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/></svg>Registrar nuevo paciente
            </li>`;
    } else {
        pacientes.forEach(p => {
            const li        = document.createElement('li');
            li.className    = 'combobox-item';
            li.textContent  = `${p.apellidos}, ${p.nombres} — ${p.dni}`;
            li.onclick      = () => seleccionarPacienteCita(p.id, li.textContent);
            lista.appendChild(li);
        });
    }
}

function seleccionarPacienteCita(id, nombre) {
    document.getElementById('citaPacienteId').value    = id;
    document.getElementById('citaPacienteInput').value = nombre;
    document.getElementById('citaPacienteClear').classList.remove('hidden');
    const lista = document.getElementById('citaPacienteLista');
    lista.innerHTML = '';
    lista.classList.add('hidden');
    document.getElementById('citaPacienteCombo').classList.remove('is-invalid');
    document.getElementById('citaPacienteId-error').textContent = '';

    // Para profesional en sesion_existente: cargar atenciones automáticamente
    if (getUser()?.rol === 'profesional') {
        const tipoCita = document.querySelector('input[name="citaTipo"]:checked')?.value;
        if (tipoCita === 'sesion_existente') {
            onProfesionalSesionChange();
        }
    }
}

function irARegistrarPaciente() {
    const input = document.getElementById('citaPacienteInput');
    const dniO  = input ? input.value.trim() : '';
    // Cierra solo la lista, el modal de citas queda abierto detrás
    const lista = document.getElementById('citaPacienteLista');
    if (lista) { lista.innerHTML = ''; lista.classList.add('hidden'); }
    abrirModalPacienteRapido(dniO);
}

// ---- Modal registro rápido de paciente ----

function abrirModalPacienteRapido(dniInicial = '') {
    ['rpDni', 'rpNombres', 'rpApellidos', 'rpTelefono', 'rpEmail'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['rpDni', 'rpNombres', 'rpApellidos'].forEach(id => {
        document.getElementById(id)?.classList.remove('is-invalid');
        const err = document.getElementById(id + '-error');
        if (err) err.textContent = '';
    });
    const btnAnterior = document.getElementById('rpBtnBuscarDni');
    if (btnAnterior) btnAnterior.remove();

    if (dniInicial) {
        const rpDni = document.getElementById('rpDni');
        if (rpDni) rpDni.value = dniInicial;
    }
    document.getElementById('modalPacienteRapido').classList.remove('hidden');
    document.getElementById('rpNombres').focus();
}

function cancelarPacienteRapido() {
    document.getElementById('modalPacienteRapido').classList.add('hidden');
    document.getElementById('citaPacienteInput')?.focus();
}

function setRpError(fieldId, message) {
    const el  = document.getElementById(fieldId);
    const err = document.getElementById(fieldId + '-error');
    if (el)  el.classList.toggle('is-invalid', !!message);
    if (err) err.textContent = message || '';
}

async function guardarPacienteRapido() {
    ['rpDni', 'rpNombres', 'rpApellidos'].forEach(id => {
        document.getElementById(id)?.classList.remove('is-invalid');
        const err = document.getElementById(id + '-error');
        if (err) err.textContent = '';
    });
    const btnAnterior = document.getElementById('rpBtnBuscarDni');
    if (btnAnterior) btnAnterior.remove();

    const dni       = document.getElementById('rpDni').value.trim();
    const nombres   = document.getElementById('rpNombres').value.trim();
    const apellidos = document.getElementById('rpApellidos').value.trim();
    const telefono  = document.getElementById('rpTelefono').value.trim();
    const email     = document.getElementById('rpEmail').value.trim();

    let valido = true;
    if (!dni)       { setRpError('rpDni',       'El DNI es requerido');          valido = false; }
    if (!nombres)   { setRpError('rpNombres',   'Los nombres son requeridos');   valido = false; }
    if (!apellidos) { setRpError('rpApellidos', 'Los apellidos son requeridos'); valido = false; }
    if (!valido) return;

    const res = await api('/api/pacientes', 'POST', {
        dni,
        nombres,
        apellidos,
        telefono: telefono || null,
        email:    email    || null,
    });

    if (res.success) {
        const label = `${res.data.apellidos}, ${res.data.nombres}`;
        seleccionarPacienteCita(res.data.id, label);
        document.getElementById('modalPacienteRapido').classList.add('hidden');
        showToast('Paciente registrado');
    } else {
        const esDniDuplicado = res.message && res.message.toLowerCase().includes('dni');
        if (esDniDuplicado) {
            setRpError('rpDni', 'Este DNI ya está registrado');
            const errEl = document.getElementById('rpDni-error');
            if (errEl) {
                const btn       = document.createElement('button');
                btn.id          = 'rpBtnBuscarDni';
                btn.type        = 'button';
                btn.className   = 'btn-link';
                btn.textContent = 'Buscar este paciente';
                btn.onclick     = () => buscarPacienteExistente(dni);
                errEl.after(btn);
            }
        } else {
            showToast(res.message || 'Error al registrar paciente');
        }
    }
}

function buscarPacienteExistente(dni) {
    document.getElementById('modalPacienteRapido').classList.add('hidden');
    const input = document.getElementById('citaPacienteInput');
    if (input) {
        input.value = dni;
        buscarPacientesCita(dni);
        input.focus();
    }
}

function setReprogError(fieldId, message) {
    const el    = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (el)    el.classList.toggle('is-invalid', !!message);
    if (errEl) errEl.textContent = message || '';
}

// ---- Vista principal ----

function _hoyISO() {
    const d = new Date();
    return d.getFullYear() + '-'
        + String(d.getMonth() + 1).padStart(2, '0') + '-'
        + String(d.getDate()).padStart(2, '0');
}

async function citas() {
    // Leer filtros del formulario si ya existe en el DOM; por defecto: hoy
    const estadoVal = document.getElementById('filtroEstado')?.value || '';
    const fechaVal  = document.getElementById('filtroFecha')?.value  || _hoyISO();

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

    const userRol = getUser()?.rol;
    const esPaciente   = userRol === 'paciente';
    const esProfOAdmin = userRol === 'profesional' || userRol === 'administrador';

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
            const fechaEsc    = (c.fecha_hora_inicio || '').replace(/'/g, '');

            const sesionBadge = c.tipo_cita === 'sesion_existente'
                ? `<span style="display:inline-block;font-size:.6rem;font-weight:600;padding:1px 5px;border-radius:3px;background:var(--color-secondary,#17a589);color:#fff;vertical-align:middle;margin-right:4px;letter-spacing:.03em">SESIÓN</span>`
                : '';

            const tipoCitaEsc  = (c.tipo_cita    || '').replace(/'/g, '');
            const pacienteEsc2 = (c.paciente     || '').replace(/'/g, '');
            const profEsc      = (c.profesional  || '').replace(/'/g, '');
            const subservEsc   = (c.subservicio  || '').replace(/'/g, '');

            const accionesCell = esPaciente ? '' : `
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
                    ${esProfOAdmin ? `
                    <button class="btn-sm" title="Gestionar atención" style="color:var(--color-primary)"
                            onclick="abrirModalGestionAtencion(${id},${c.paciente_id||0},${c.profesional_id||0},'${fechaEsc}','${tipoCitaEsc}',${c.atencion_id||0},${c.subservicio_id||0},${c.duracion_min||50},${parseFloat(c.precio_base)||0},'${pacienteEsc2}','${profEsc}','${subservEsc}')">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="1" width="10" height="14" rx="1"/>
                            <path d="M6 1v1a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V1"/>
                            <line x1="8" y1="6" x2="8" y2="10"/>
                            <line x1="6" y1="8" x2="10" y2="8"/>
                        </svg>
                    </button>` : ''}
                </td>`;

            rows += `<tr>
                ${esPaciente ? '' : `<td>${c.paciente || 'N/A'}</td>`}
                <td>${c.profesional || '-'}</td>
                <td>${sesionBadge}${c.subservicio || '-'}</td>
                <td>${duracion}</td>
                <td>${formatFecha(c.fecha_hora_inicio)}</td>
                <td><span class="badge ${badgeClass}">${estado.replace('_', ' ')}</span>${reprog}</td>
                ${accionesCell}
            </tr>`;
        });
    } else {
        const colspan = esPaciente ? '5' : '7';
        rows = `<tr><td colspan="${colspan}" style="text-align:center;color:var(--color-text-muted);padding:24px">No hay citas que coincidan con los filtros</td></tr>`;
    }

    const titulo       = esPaciente ? 'Mis Citas' : 'Citas';
    const btnNuevaCita = esPaciente ? '' : `<button class="btn-primary" onclick="abrirModalCita()" style="margin-bottom:12px">+ Nueva Cita</button>`;
    const thPaciente   = esPaciente ? '' : '<th>Paciente</th>';
    const thAcciones   = esPaciente ? '' : '<th>Acciones</th>';

    document.getElementById('view').innerHTML = `
        <h2>${titulo}</h2>

        <!-- Barra de filtros -->
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px;padding:16px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius)">
            <div class="form-group" style="margin:0;min-width:160px">
                <label style="font-size:.8rem;margin-bottom:4px;display:block">Estado</label>
                <select id="filtroEstado" style="width:100%">${estadoOpciones}</select>
            </div>
            <div class="form-group" style="margin:0;min-width:160px">
                <label style="font-size:.8rem;margin-bottom:4px;display:block">Fecha</label>
                <input id="filtroFecha" type="date" value="${fechaVal || _hoyISO()}" style="width:100%">
            </div>
            <button class="btn-primary" onclick="citas()" style="height:36px">Filtrar</button>
            <button onclick="limpiarFiltrosCitas()" style="height:36px">Limpiar</button>
        </div>

        ${btnNuevaCita}

        <table class="table">
            <tr>
                ${thPaciente}
                <th>Profesional</th>
                <th>Servicio</th>
                <th>Duración</th>
                <th>Fecha / Hora</th>
                <th>Estado</th>
                ${thAcciones}
            </tr>
            ${rows}
        </table>
    `;
}

function limpiarFiltrosCitas() {
    const se = document.getElementById('filtroEstado');
    const sf = document.getElementById('filtroFecha');
    if (se) se.value = '';
    if (sf) sf.value = _hoyISO();
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
    limpiarPacienteCita();

    // Resetear tipo de cita
    document.querySelectorAll('input[name="citaTipo"]').forEach(r => r.checked = false);
    document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('citaCamposNuevaAtencion').classList.remove('visible');
    document.getElementById('citaCamposSesionExistente').classList.remove('visible');

    // Debounce del combobox
    const inputPac = document.getElementById('citaPacienteInput');
    inputPac.oninput = () => {
        clearTimeout(_pacienteBusquedaTimer);
        _pacienteBusquedaTimer = setTimeout(() => buscarPacientesCita(inputPac.value.trim()), 350);
    };

    const userRolModal = getUser()?.rol;

    // Cargar profesionales solo para administrador; el profesional usa su propia identidad
    const [resPro, resSrv] = userRolModal === 'profesional'
        ? [null, await api('/api/servicios')]
        : await Promise.all([api('/api/profesionales'), api('/api/servicios')]);

    if (userRolModal === 'profesional') {
        // Mostrar campo de solo lectura en lugar del select de profesional
        const user = getUser();
        const nombreProfesional = `${user.nombres} ${user.apellidos}`;
        ['citaProfesionalNA', 'citaProfesionalSE'].forEach(selectId => {
            const sel = document.getElementById(selectId);
            sel.style.display = 'none';
            let rdField = document.getElementById(selectId + '-readonly');
            if (!rdField) {
                rdField = document.createElement('div');
                rdField.id = selectId + '-readonly';
                rdField.className = 'readonly-field';
                sel.parentNode.insertBefore(rdField, sel.nextSibling);
            }
            rdField.textContent = nombreProfesional;
            rdField.style.display = '';
        });
    } else {
        // Restaurar selects si estaban ocultos por cambio de sesión
        ['citaProfesionalNA', 'citaProfesionalSE'].forEach(selectId => {
            const sel = document.getElementById(selectId);
            sel.style.display = '';
            const rdField = document.getElementById(selectId + '-readonly');
            if (rdField) rdField.style.display = 'none';
        });

        // Poblar selects de profesional (ambas secciones)
        const opcionesPro = resPro?.data
            ? resPro.data.map(p => {
                const espec = p.especialidad ? ` (${p.especialidad})` : '';
                return `<option value="${p.id}">${p.apellidos}, ${p.nombres}${espec}</option>`;
              }).join('')
            : '';
        ['citaProfesionalNA', 'citaProfesionalSE'].forEach(id => {
            const sel = document.getElementById(id);
            sel.innerHTML = '<option value="">Seleccionar profesional…</option>' + opcionesPro;
        });
    }

    // Poblar select de servicios (solo sección nueva atención)
    const selSrv = document.getElementById('citaServicio');
    selSrv.innerHTML = '<option value="">Seleccionar servicio…</option>';
    if (resSrv.data) {
        resSrv.data.forEach(s => {
            selSrv.innerHTML += `<option value="${s.id}">${s.nombre}</option>`;
        });
    }
    document.getElementById('citaSubservicioNA').innerHTML = '<option value="">Seleccionar servicio primero…</option>';

    // Preseleccionar fecha actual (hora en punto más próxima)
    const _ahora    = new Date();
    _ahora.setMinutes(0, 0, 0);
    const _hoyLocal = _ahora.getFullYear() + '-'
        + String(_ahora.getMonth() + 1).padStart(2, '0') + '-'
        + String(_ahora.getDate()).padStart(2, '0') + 'T'
        + String(_ahora.getHours()).padStart(2, '0') + ':00';
    document.getElementById('citaFechaNA').value = _hoyLocal;
    document.getElementById('citaFechaSE').value = _hoyLocal;
    document.getElementById('citaAtencionSE').innerHTML = '<option value="">Seleccione profesional primero…</option>';

    document.getElementById('modalCita').classList.remove('hidden');
    document.getElementById('citaPacienteInput').focus();
}

// ---- Tipo de cita: radio cards ----

function onTipoCitaChange(tipo) {
    const seccNA = document.getElementById('citaCamposNuevaAtencion');
    const seccSE = document.getElementById('citaCamposSesionExistente');

    if (tipo === 'nueva_atencion') {
        seccNA.classList.add('visible');
        seccSE.classList.remove('visible');
        document.getElementById('rcNuevaAtencion').classList.add('selected');
        document.getElementById('rcSesionExistente').classList.remove('selected');
    } else {
        seccSE.classList.add('visible');
        seccNA.classList.remove('visible');
        document.getElementById('rcSesionExistente').classList.add('selected');
        document.getElementById('rcNuevaAtencion').classList.remove('selected');

        // Para profesional: cargar atenciones del paciente ya seleccionado
        if (getUser()?.rol === 'profesional') {
            onProfesionalSesionChange();
        }
    }
    const err = document.getElementById('citaTipo-error');
    if (err) err.textContent = '';
}

// ---- Cargar subservicios al cambiar servicio (nueva atención) ----

async function onServicioChange() {
    const servicioId = document.getElementById('citaServicio').value;
    const sel        = document.getElementById('citaSubservicioNA');
    sel.innerHTML = '<option value="">Cargando…</option>';
    if (!servicioId) {
        sel.innerHTML = '<option value="">Seleccionar servicio primero…</option>';
        return;
    }
    const res = await api(`/api/subservicios/por-servicio?servicio_id=${servicioId}`);
    sel.innerHTML = '<option value="">Seleccionar modalidad…</option>';
    (res.data || []).forEach(s => {
        sel.innerHTML += `<option value="${s.id}">${s.nombre} (${s.modalidad}, S/ ${parseFloat(s.precio_base).toFixed(2)})</option>`;
    });
    if (!res.data || res.data.length === 0) {
        sel.innerHTML += '<option value="" disabled>Sin subservicios disponibles</option>';
    }
}

// ---- Cargar atenciones activas al cambiar profesional (sesión existente) ----

async function onProfesionalSesionChange() {
    const user = getUser();
    const esProfesional = user?.rol === 'profesional';
    const profesionalId = esProfesional
        ? (user.profesional_id || 0)
        : parseInt(document.getElementById('citaProfesionalSE').value, 10);
    const pacienteId    = parseInt(document.getElementById('citaPacienteId').value, 10);
    const sel           = document.getElementById('citaAtencionSE');

    if (!pacienteId || pacienteId <= 0) {
        sel.innerHTML = '<option value="">Seleccione un paciente primero…</option>';
        return;
    }
    if (!esProfesional && !profesionalId) {
        sel.innerHTML = '<option value="">Seleccione profesional primero…</option>';
        return;
    }

    sel.innerHTML = '<option value="">Cargando…</option>';
    const res    = await api(`/api/atenciones/paciente?paciente_id=${pacienteId}`);
    const activas = (res.data || []).filter(
        a => a.estado === 'activa' && (!profesionalId || parseInt(a.profesional_id, 10) === profesionalId)
    );

    sel.innerHTML = '<option value="">— Seleccionar atención —</option>';
    if (activas.length === 0) {
        sel.innerHTML += '<option value="" disabled>Sin atenciones activas con este profesional</option>';
        return;
    }
    activas.forEach(a => {
        const proxSesion = (parseInt(a.total_sesiones) || 0) + 1;
        const opt        = document.createElement('option');
        opt.value              = a.id;
        opt.dataset.subservicioId = a.subservicio_id;
        opt.textContent        = `${a.subservicio} — desde ${a.fecha_inicio} · sesión #${proxSesion}`;
        sel.appendChild(opt);
    });
}

// ---- Guardar nueva cita ----

async function guardarCita() {
    clearCitaErrors();

    const pacienteId = parseInt(document.getElementById('citaPacienteId').value, 10);
    const tipo       = document.querySelector('input[name="citaTipo"]:checked')?.value;

    let valido = true;

    if (!pacienteId || pacienteId <= 0) {
        const combo  = document.getElementById('citaPacienteCombo');
        const errPac = document.getElementById('citaPacienteId-error');
        if (combo)  combo.classList.add('is-invalid');
        if (errPac) errPac.textContent = 'Seleccione un paciente';
        valido = false;
    }
    if (!tipo) {
        const errTipo = document.getElementById('citaTipo-error');
        if (errTipo) errTipo.textContent = 'Seleccione el tipo de cita';
        valido = false;
    }
    if (!valido) return;

    let payload;

    const esProfesional = getUser()?.rol === 'profesional';

    if (tipo === 'nueva_atencion') {
        const profesionalId = document.getElementById('citaProfesionalNA').value;
        const subservicioId = document.getElementById('citaSubservicioNA').value;
        const fecha         = document.getElementById('citaFechaNA').value;

        if (!esProfesional && !profesionalId) { setCitaError('citaProfesionalNA', 'Seleccione un profesional'); valido = false; }
        if (!subservicioId) { setCitaError('citaSubservicioNA', 'Seleccione una modalidad');  valido = false; }
        if (!fecha)         { setCitaError('citaFechaNA',       'Seleccione fecha y hora');   valido = false; }
        if (!valido) return;

        payload = {
            paciente_id:       pacienteId,
            subservicio_id:    parseInt(subservicioId, 10),
            fecha_hora_inicio: fecha,
        };
        if (!esProfesional) {
            payload.profesional_id = parseInt(profesionalId, 10);
        }
    } else {
        const profesionalId = document.getElementById('citaProfesionalSE').value;
        const atencionSel   = document.getElementById('citaAtencionSE');
        const atencionId    = atencionSel.value;
        const fecha         = document.getElementById('citaFechaSE').value;
        const subservicioId = atencionSel.options[atencionSel.selectedIndex]?.dataset.subservicioId;

        if (!esProfesional && !profesionalId) { setCitaError('citaProfesionalSE', 'Seleccione un profesional'); valido = false; }
        if (!atencionId)    { setCitaError('citaAtencionSE',    'Seleccione una atención');   valido = false; }
        if (!fecha)         { setCitaError('citaFechaSE',       'Seleccione fecha y hora');   valido = false; }
        if (!valido) return;

        payload = {
            tipo_cita:         'sesion_existente',
            paciente_id:       pacienteId,
            atencion_id:       parseInt(atencionId, 10),
            fecha_hora_inicio: fecha,
        };
        if (!esProfesional) {
            payload.profesional_id = parseInt(profesionalId, 10);
        }
    }

    const res = await api('/api/citas', 'POST', payload);

    if (res.success) {
        showToast('Cita creada');
        cerrarModal('modalCita');
        citas();
    } else {
        const fechaField = tipo === 'nueva_atencion' ? 'citaFechaNA' : 'citaFechaSE';
        if (res.message && res.message.toLowerCase().includes('horario')) {
            setCitaError(fechaField, res.message);
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

// ---- Modal gestión de atención desde cita ----

async function abrirModalGestionAtencion(citaId, pacienteId, profesionalId, fechaHora,
        tipoCita, atencionId, subservicioId, duracionMin, precioBase,
        nombrePaciente, nombreProfesional, nombreSubservicio) {

    _citaActiva = { id: citaId, paciente_id: pacienteId, profesional_id: profesionalId, fecha_hora: fechaHora };

    const tabsBar = document.getElementById('gestionTabsBar');
    const titulo  = document.getElementById('gestionModalTitle');

    // Reset estado visual
    document.getElementById('gSesionInfoFija').style.display        = 'none';
    document.getElementById('gestionAtencionSelectWrap').style.display = '';
    document.getElementById('gAtInfoFija').style.display             = 'none';
    document.getElementById('gAtSubservicioSelectWrap').style.display = '';

    if (tipoCita === 'nueva_atencion') {
        tabsBar.style.display = 'none';
        titulo.textContent    = 'Abrir nueva atención';

        document.getElementById('tabSesion').style.display   = 'none';
        document.getElementById('tabAtencion').style.display = '';

        document.getElementById('gAtPacienteId').value    = pacienteId;
        document.getElementById('gAtProfesionalId').value = profesionalId;
        document.getElementById('gAtCitaId').value        = citaId;

        // Info no editable
        document.getElementById('gAtInfoPaciente').textContent    = nombrePaciente    || '';
        document.getElementById('gAtInfoProfesional').textContent = nombreProfesional || '';
        document.getElementById('gAtInfoSubservicio').textContent = nombreSubservicio || '';
        document.getElementById('gAtInfoFija').style.display      = '';

        if (fechaHora) {
            const f = (fechaHora.split('T')[0] || fechaHora.split(' ')[0] || '').substring(0, 10);
            document.getElementById('gAtFechaInicio').value = f;
        }

        ['gAtDescuento','gAtMotivoDescuento','gAtNumSesiones','gAtMotivoConsulta',
         'gAtObsGeneral','gAtObsConducta','gAtAntecedentes'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('gAtDescuento').value = '0';

        await Promise.all([
            cargarSubserviciosParaGestion(),
            cargarDatosPacienteParaGestion(pacienteId),
        ]);

        if (subservicioId) {
            document.getElementById('gAtSubservicio').value = subservicioId;
            document.getElementById('gAtSubservicioSelectWrap').style.display = 'none';
        }
        if (precioBase) {
            document.getElementById('gAtPrecio').value = parseFloat(precioBase).toFixed(2);
        }

    } else if (tipoCita === 'sesion_existente') {
        tabsBar.style.display = 'none';
        titulo.textContent    = 'Registrar sesión';

        document.getElementById('tabSesion').style.display   = '';
        document.getElementById('tabAtencion').style.display = 'none';

        // Info no editable
        document.getElementById('gSesionInfoPaciente').textContent    = nombrePaciente    || '';
        document.getElementById('gSesionInfoProfesional').textContent = nombreProfesional || '';
        document.getElementById('gSesionInfoSubservicio').textContent = nombreSubservicio || '';
        document.getElementById('gSesionInfoFija').style.display      = '';

        // Ocultar select; configurarlo con atencion_id fijo para que registrarSesionDesdeCita lo lea
        document.getElementById('gestionAtencionSelectWrap').style.display = 'none';
        const selFijo = document.getElementById('gestionAtencionSelect');
        selFijo.innerHTML = `<option value="${atencionId}">${nombreSubservicio || ''}</option>`;
        selFijo.value = String(atencionId);

        // Mostrar formulario de sesión directamente (sin selección manual de atención)
        const formSesion = document.getElementById('gestionSesionForm');
        formSesion.style.display = '';
        document.getElementById('gSesionNota').value                 = '';
        document.getElementById('gSesionDuracion-error').textContent = '';
        document.getElementById('gSesionNumero').textContent         = '…';
        document.getElementById('gSesionDuracion').value             = duracionMin || 50;

        // Consultar número de sesión siguiente
        if (atencionId) {
            const rNum = await api(`/api/atenciones/sesion-siguiente?atencion_id=${atencionId}`);
            document.getElementById('gSesionNumero').textContent = rNum.data?.numero_siguiente ?? 1;
        }

    } else {
        // Comportamiento original: ambas pestañas disponibles
        tabsBar.style.display = 'flex';
        titulo.textContent    = 'Gestionar atención';

        cambiarTabGestion('sesion');

        document.getElementById('gAtPacienteId').value    = pacienteId;
        document.getElementById('gAtProfesionalId').value = profesionalId;
        document.getElementById('gAtCitaId').value        = citaId;

        if (fechaHora) {
            const f = (fechaHora.split('T')[0] || fechaHora.split(' ')[0] || '').substring(0, 10);
            document.getElementById('gAtFechaInicio').value = f;
        }

        ['gAtSubservicio','gAtPrecio','gAtDescuento','gAtMotivoDescuento',
         'gAtNumSesiones','gAtMotivoConsulta','gAtObsGeneral','gAtObsConducta','gAtAntecedentes'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = el.tagName === 'SELECT' ? el.options[0]?.value || '' : '';
        });
        document.getElementById('gAtDescuento').value = '0';

        await Promise.all([
            cargarAtencionesParaGestion(pacienteId, citaId),
            cargarSubserviciosParaGestion(),
            cargarDatosPacienteParaGestion(pacienteId),
        ]);
    }

    document.getElementById('modalGestionAtencion').classList.remove('hidden');
}

function cambiarTabGestion(tab) {
    const ACTIVO   = 'padding:8px 20px;border:none;background:none;cursor:pointer;font-weight:600;color:var(--color-primary);border-bottom:2px solid var(--color-primary);margin-bottom:-2px';
    const INACTIVO = 'padding:8px 20px;border:none;background:none;cursor:pointer;color:var(--color-text-muted)';

    document.getElementById('tabSesion').style.display   = tab === 'sesion'   ? '' : 'none';
    document.getElementById('tabAtencion').style.display = tab === 'atencion' ? '' : 'none';
    document.getElementById('tabSesionBtn').style.cssText   = tab === 'sesion'   ? ACTIVO : INACTIVO;
    document.getElementById('tabAtencionBtn').style.cssText = tab === 'atencion' ? ACTIVO : INACTIVO;
}

async function cargarAtencionesParaGestion(pacienteId, citaId) {
    const sel  = document.getElementById('gestionAtencionSelect');
    const form = document.getElementById('gestionSesionForm');

    sel.innerHTML = '<option value="">Cargando…</option>';
    form.style.display = 'none';

    if (!pacienteId) {
        sel.innerHTML = '<option value="">Sin paciente</option>';
        return;
    }

    const res = await api(`/api/atenciones/paciente?paciente_id=${pacienteId}`);
    sel.innerHTML = '<option value="">— Seleccionar atención activa —</option>';

    const activas = (res.data || []).filter(a => a.estado === 'activa');

    if (activas.length === 0) {
        sel.innerHTML += '<option value="" disabled>No hay atenciones activas para este paciente</option>';
        return;
    }

    let vinculadaId = null;

    activas.forEach(a => {
        const esCitaVinculada = String(a.cita_id) === String(citaId);
        if (esCitaVinculada) vinculadaId = a.id;

        const proxSesion = (parseInt(a.total_sesiones) || 0) + 1;
        const etiqueta   = esCitaVinculada ? ' ⭐ relacionada a esta cita' : '';
        const opt        = document.createElement('option');

        opt.value                = a.id;
        opt.dataset.duracion     = a.duracion_min || 50;
        opt.dataset.proxSesion   = proxSesion;
        opt.textContent          = `${a.subservicio} — desde ${a.fecha_inicio} (sesión #${proxSesion})${etiqueta}`;

        if (esCitaVinculada) opt.style.fontWeight = '600';
        sel.appendChild(opt);
    });

    if (vinculadaId) {
        sel.value = vinculadaId;
        onSeleccionarAtencionGestion();
    }
}

async function onSeleccionarAtencionGestion() {
    const sel    = document.getElementById('gestionAtencionSelect');
    const form   = document.getElementById('gestionSesionForm');
    const selOpt = sel.options[sel.selectedIndex];

    if (!sel.value) { form.style.display = 'none'; return; }

    form.style.display = '';

    document.getElementById('gSesionDuracion').value            = selOpt.dataset.duracion || 50;
    document.getElementById('gSesionNota').value                = '';
    document.getElementById('gSesionDuracion-error').textContent = '';
    document.getElementById('gSesionNumero').textContent        = '…';

    const res = await api(`/api/atenciones/sesion-siguiente?atencion_id=${sel.value}`);
    const num = res.data?.numero_siguiente ?? 1;
    document.getElementById('gSesionNumero').textContent = num;
}

async function registrarSesionDesdeCita() {
    const atencionId = document.getElementById('gestionAtencionSelect').value;
    const duracion   = document.getElementById('gSesionDuracion').value;
    const nota       = document.getElementById('gSesionNota').value.trim();

    document.getElementById('gSesionDuracion-error').textContent = '';

    if (!atencionId) { showToast('Seleccione una atención'); return; }
    if (!duracion)   { document.getElementById('gSesionDuracion-error').textContent = 'Requerido'; return; }

    const res = await api('/api/sesiones', 'POST', {
        atencion_id:  parseInt(atencionId),
        duracion_min: parseInt(duracion),
        nota_clinica: nota || null,
    });

    if (res.success) {
        showToast('Sesión registrada');
        cerrarModal('modalGestionAtencion');
        citas();
    } else {
        showToast(res.message || 'Error al registrar sesión');
    }
}

async function cargarSubserviciosParaGestion() {
    const sel = document.getElementById('gAtSubservicio');
    sel.innerHTML = '<option value="">Seleccionar…</option>';
    const res = await api('/api/subservicios');
    if (res.data) {
        res.data.forEach(s => {
            const opt        = document.createElement('option');
            opt.value        = s.id;
            opt.dataset.precio   = s.precio_base;
            opt.dataset.duracion = s.duracion_min || 50;
            opt.textContent  = `${s.servicio} — ${s.nombre} (${s.modalidad}, S/ ${parseFloat(s.precio_base).toFixed(2)})`;
            sel.appendChild(opt);
        });
    }
}

function onSubservicioGestionChange() {
    const sel    = document.getElementById('gAtSubservicio');
    const selOpt = sel.options[sel.selectedIndex];
    if (sel.value && selOpt.dataset.precio) {
        document.getElementById('gAtPrecio').value = parseFloat(selOpt.dataset.precio).toFixed(2);
    }
}

async function cargarDatosPacienteParaGestion(pacienteId) {
    if (!pacienteId) return;
    const res = await api(`/api/paciente?id=${pacienteId}`);
    if (res.data) {
        const p = res.data;
        if (p.grado_instruccion) document.getElementById('gAtGradoInstruccion').value = p.grado_instruccion;
        if (p.ocupacion)         document.getElementById('gAtOcupacion').value         = p.ocupacion;
        if (p.estado_civil)      document.getElementById('gAtEstadoCivil').value        = p.estado_civil;
    }
}

async function abrirNuevaAtencionDesdeCita() {
    const pacienteId    = document.getElementById('gAtPacienteId').value;
    const profesionalId = document.getElementById('gAtProfesionalId').value;
    const citaId        = document.getElementById('gAtCitaId').value;
    const subservicioId = document.getElementById('gAtSubservicio').value;
    const precio        = document.getElementById('gAtPrecio').value;
    const descuento     = document.getElementById('gAtDescuento').value || 0;
    const motiDesc      = document.getElementById('gAtMotivoDescuento').value.trim();
    const motivo        = document.getElementById('gAtMotivoConsulta').value.trim();
    const obsGen        = document.getElementById('gAtObsGeneral').value.trim();
    const obsCon        = document.getElementById('gAtObsConducta').value.trim();
    const antec         = document.getElementById('gAtAntecedentes').value.trim();
    const numSes        = document.getElementById('gAtNumSesiones').value;
    const fechaInicio   = document.getElementById('gAtFechaInicio').value;
    const grado         = document.getElementById('gAtGradoInstruccion').value;
    const ocupacion     = document.getElementById('gAtOcupacion').value.trim();
    const estadoCivil   = document.getElementById('gAtEstadoCivil').value;

    const errIds = ['gAtSubservicio', 'gAtPrecio', 'gAtFechaInicio', 'gAtMotivoConsulta'];
    errIds.forEach(id => {
        const err = document.getElementById(id + '-error');
        if (err) err.textContent = '';
        const inp = document.getElementById(id);
        if (inp) inp.classList.remove('is-invalid');
    });

    let valido = true;
    const setErr = (id, msg) => {
        const err = document.getElementById(id + '-error');
        const inp = document.getElementById(id);
        if (err) err.textContent = msg;
        if (inp) inp.classList.add('is-invalid');
        valido = false;
    };

    if (!subservicioId) setErr('gAtSubservicio', 'Seleccione un servicio');
    if (!precio)        setErr('gAtPrecio', 'Requerido');
    if (!fechaInicio)   setErr('gAtFechaInicio', 'Requerido');
    if (!motivo)        setErr('gAtMotivoConsulta', 'El motivo es obligatorio');
    if (!valido) return;

    const esProfGestion = getUser()?.rol === 'profesional';
    const res = await api('/api/atenciones', 'POST', {
        paciente_id:             parseInt(pacienteId),
        ...(esProfGestion ? {} : { profesional_id: parseInt(profesionalId) }),
        cita_id:                 parseInt(citaId),
        subservicio_id:          parseInt(subservicioId),
        precio_acordado:         parseFloat(precio),
        descuento_monto:         parseFloat(descuento) || 0,
        motivo_descuento:        motiDesc   || null,
        motivo_consulta:         motivo,
        observacion_general:     obsGen     || null,
        observacion_conducta:    obsCon     || null,
        antecedentes_relevantes: antec      || null,
        numero_sesiones_plan:    numSes     ? parseInt(numSes) : null,
        fecha_inicio:            fechaInicio,
        grado_instruccion:       grado,
        ocupacion:               ocupacion  || null,
        estado_civil:            estadoCivil,
    });

    if (res.success) {
        showToast('Atención abierta correctamente');
        cerrarModal('modalGestionAtencion');
        citas();
    } else {
        showToast(res.message || 'Error al abrir atención');
    }
}
