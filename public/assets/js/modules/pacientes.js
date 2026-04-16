
// ---- Helpers de validación inline ----

function setFieldError(fieldId, message) {
    const el    = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (el)    el.classList.toggle('is-invalid', !!message);
    if (errEl) errEl.textContent = message || '';
}

function clearPacienteErrors() {
    [
        'pacDni','pacNombres','pacApellidos','pacFechaNac','pacSexo',
        'pacTelefono','pacEmail','pacGradoInstruccion','pacOcupacion',
        'pacEstadoCivil','pacContactoEmergencia','pacTelefonoEmergencia',
        'pacAntecedentes'
    ].forEach(id => setFieldError(id, ''));
}

// ---- Vista principal ----

async function pacientes() {
    let res = await api('/api/pacientes');
    let html = `
        <h2>Pacientes</h2>
        <button class="btn-primary" onclick="abrirModalPaciente()">+ Nuevo Paciente</button>
        <table class="table">
            <tr>
                <th>DNI</th>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Acciones</th>
            </tr>
    `;

    if (res.data && res.data.length > 0) {
        res.data.forEach(p => {
            html += `<tr>
                <td>${p.dni || ''}</td>
                <td>${p.apellidos}, ${p.nombres}</td>
                <td>${p.telefono || '-'}</td>
                <td>${p.email || '-'}</td>
                <td>
                    <button class="btn-sm" title="Ver detalle" onclick="verDetallePaciente(${p.id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="8" cy="8" r="3"/><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
                        </svg>
                    </button>
                    <button class="btn-sm" title="Eliminar" onclick="eliminarPaciente(${p.id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 4 13 4"/><path d="M5 4V3h6v1"/><path d="M4 4l1 10h6l1-10"/>
                        </svg>
                    </button>
                </td>
            </tr>`;
        });
    } else {
        html += '<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:24px">No hay pacientes registrados</td></tr>';
    }

    html += '</table>';
    document.getElementById('view').innerHTML = html;
}

// ---- Detalle de paciente ----

// ID del paciente actualmente en vista (para recarga parcial de apoderados)
let _detallePacienteId = null;

async function verDetallePaciente(id) {
    _detallePacienteId = id;

    const [resPac, resAt, resApo] = await Promise.all([
        api('/api/paciente?id=' + id),
        api('/api/atenciones/paciente?paciente_id=' + id),
        api('/api/apoderados?paciente_id=' + id),
    ]);

    if (!resPac.success) { showToast('Error al cargar paciente'); return; }
    const p = resPac.data;

    const nombreCompleto = `${p.apellidos}, ${p.nombres}`;
    const edad = p.fecha_nacimiento
        ? Math.floor((new Date() - new Date(p.fecha_nacimiento)) / (365.25 * 24 * 3600 * 1000)) + ' años'
        : '-';

    const GRADO = {
        sin_instruccion:'Sin instrucción', primaria_incompleta:'Primaria incompleta',
        primaria_completa:'Primaria completa', secundaria_incompleta:'Secundaria incompleta',
        secundaria_completa:'Secundaria completa', tecnico_incompleto:'Técnico incompleto',
        tecnico_completo:'Técnico completo', superior_incompleto:'Superior incompleto',
        superior_completo:'Superior completo', posgrado:'Posgrado', no_especificado:'No especificado',
    };
    const CIVIL = {
        soltero:'Soltero/a', casado:'Casado/a', conviviente:'Conviviente',
        divorciado:'Divorciado/a', separado:'Separado/a', viudo:'Viudo/a', no_especificado:'No especificado',
    };
    const SEXO = { masculino:'Masculino', femenino:'Femenino', no_especificado:'No especificado' };
    const AT_BADGE = { activa:'badge-confirmada', pausada:'badge-warning', completada:'badge-success', cancelada:'badge-danger' };

    // Atenciones del paciente
    let atRows = '';
    if (resAt.data && resAt.data.length > 0) {
        resAt.data.forEach(a => {
            const badgeClass = AT_BADGE[a.estado] || '';
            atRows += `<tr>
                <td>${a.fecha_inicio || '-'}</td>
                <td>${a.servicio} — ${a.subservicio}</td>
                <td>${a.profesional}</td>
                <td><span class="badge ${badgeClass}">${a.estado}</span></td>
                <td style="text-align:center">${a.sesiones_realizadas} ${a.numero_sesiones_plan ? '/ ' + a.numero_sesiones_plan : ''}</td>
                <td>
                    <button class="btn-sm" title="Ver detalle" onclick="verDetalleAtencion(${a.id}, () => verDetallePaciente(${id}))">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="8" cy="8" r="3"/><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
                        </svg>
                    </button>
                </td>
            </tr>`;
        });
    } else {
        atRows = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:12px">Sin atenciones registradas</td></tr>';
    }

    document.getElementById('view').innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
            <button onclick="pacientes()" style="display:flex;align-items:center;gap:6px;font-size:.875rem">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="10 4 6 8 10 12"/></svg>
                Pacientes
            </button>
            <h2 style="margin:0">${nombreCompleto}</h2>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
            <div class="card" style="padding:16px">
                <h4 style="margin:0 0 12px;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Datos personales</h4>
                <p style="margin:0 0 4px;font-size:.875rem">DNI: <strong>${p.dni || '-'}</strong></p>
                <p style="margin:0 0 4px;font-size:.875rem">Sexo: ${SEXO[p.sexo] || p.sexo || '-'}</p>
                <p style="margin:0 0 4px;font-size:.875rem">Edad: ${edad}${p.fecha_nacimiento ? ' ('+p.fecha_nacimiento+')' : ''}</p>
                <p style="margin:0 0 4px;font-size:.875rem">Teléfono: ${p.telefono || '-'}</p>
                <p style="margin:0;font-size:.875rem">Email: ${p.email || '-'}</p>
            </div>
            <div class="card" style="padding:16px">
                <h4 style="margin:0 0 12px;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Datos clínicos</h4>
                <p style="margin:0 0 4px;font-size:.875rem">Estado civil: ${CIVIL[p.estado_civil] || p.estado_civil || '-'}</p>
                <p style="margin:0 0 4px;font-size:.875rem">Grado instrucción: ${GRADO[p.grado_instruccion] || p.grado_instruccion || '-'}</p>
                <p style="margin:0 0 4px;font-size:.875rem">Ocupación: ${p.ocupacion || '-'}</p>
                <p style="margin:0 0 4px;font-size:.875rem">Contacto emergencia: ${p.contacto_emergencia || '-'} ${p.telefono_emergencia ? '('+p.telefono_emergencia+')' : ''}</p>
                ${p.antecedentes ? `<p style="margin:0;font-size:.875rem">Antecedentes: ${p.antecedentes}</p>` : ''}
            </div>
        </div>

        <div class="card" style="padding:16px;margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <h4 style="margin:0;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">
                    Atenciones (${resAt.data ? resAt.data.length : 0})
                </h4>
                <button class="btn-primary" onclick="abrirModalAtencion(${id})">+ Nueva Atención</button>
            </div>
            <table class="table">
                <tr>
                    <th>Fecha inicio</th>
                    <th>Servicio</th>
                    <th>Profesional</th>
                    <th>Estado</th>
                    <th style="text-align:center">Sesiones</th>
                    <th>Detalle</th>
                </tr>
                ${atRows}
            </table>
        </div>

        <!-- Sección apoderados -->
        <div class="card" style="padding:16px" id="cardApoderados">
            ${_renderApoderados(resApo.data || [], id)}
        </div>
    `;
}

// ---- Abrir modal nuevo paciente ----

function abrirModalPaciente() {
    clearPacienteErrors();

    const campos = [
        'pacDni','pacNombres','pacApellidos','pacFechaNac',
        'pacTelefono','pacEmail','pacOcupacion',
        'pacContactoEmergencia','pacTelefonoEmergencia','pacAntecedentes'
    ];
    campos.forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('pacSexo').value            = 'no_especificado';
    document.getElementById('pacGradoInstruccion').value = 'no_especificado';
    document.getElementById('pacEstadoCivil').value      = 'no_especificado';

    document.getElementById('modalPacienteTitle').innerText = 'Nuevo Paciente';
    document.getElementById('modalPaciente').classList.remove('hidden');
}

// ---- Guardar paciente ----

async function guardarPaciente() {
    clearPacienteErrors();

    const dni       = document.getElementById('pacDni').value.trim();
    const nombres   = document.getElementById('pacNombres').value.trim();
    const apellidos = document.getElementById('pacApellidos').value.trim();

    let valido = true;

    if (!dni) {
        setFieldError('pacDni', 'El DNI es obligatorio');
        valido = false;
    } else if (!/^\d{7,15}$/.test(dni)) {
        setFieldError('pacDni', 'Ingrese un DNI válido (7-15 dígitos)');
        valido = false;
    }

    if (!nombres)   { setFieldError('pacNombres',   'Los nombres son obligatorios');   valido = false; }
    if (!apellidos) { setFieldError('pacApellidos', 'Los apellidos son obligatorios'); valido = false; }

    const email = document.getElementById('pacEmail').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setFieldError('pacEmail', 'Formato de email inválido');
        valido = false;
    }

    if (!valido) return;

    const data = {
        dni,
        nombres,
        apellidos,
        fecha_nacimiento:    document.getElementById('pacFechaNac').value             || null,
        sexo:                document.getElementById('pacSexo').value,
        telefono:            document.getElementById('pacTelefono').value.trim()      || null,
        email:               email                                                    || null,
        grado_instruccion:   document.getElementById('pacGradoInstruccion').value,
        ocupacion:           document.getElementById('pacOcupacion').value.trim()     || null,
        estado_civil:        document.getElementById('pacEstadoCivil').value,
        contacto_emergencia: document.getElementById('pacContactoEmergencia').value.trim() || null,
        telefono_emergencia: document.getElementById('pacTelefonoEmergencia').value.trim() || null,
        antecedentes:        document.getElementById('pacAntecedentes').value.trim()  || null,
    };

    const res = await api('/api/pacientes', 'POST', data);

    if (res.success) {
        showToast('Paciente creado');
        cerrarModal('modalPaciente');
        pacientes();
    } else {
        if (res.message && res.message.toLowerCase().includes('dni')) {
            setFieldError('pacDni', res.message);
        } else {
            showToast(res.message || 'Error al crear paciente');
        }
    }
}

// ---- Eliminar ----

async function eliminarPaciente(id) {
    if (!confirm('¿Eliminar este paciente? Esta acción no se puede deshacer.')) return;

    const res = await api('/api/pacientes', 'DELETE', { id });
    if (res.success) {
        showToast('Paciente eliminado');
        pacientes();
    } else {
        showToast(res.message || 'Error al eliminar');
    }
}

// ================================================================
// MÓDULO APODERADOS
// ================================================================

const PARENTESCO_LABEL = {
    padre:       'Padre',
    madre:       'Madre',
    tutor_legal: 'Tutor legal',
    abuelo:      'Abuelo/a',
    hermano:     'Hermano/a',
    otro:        'Otro',
};

// ---- Render de la sección dentro del detalle del paciente ----

function _renderApoderados(lista, pacienteId) {
    const header = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h4 style="margin:0;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">
                Apoderados / Responsables (${lista.length})
            </h4>
            <button class="btn-primary" onclick="abrirModalApoderado(${pacienteId})" style="font-size:.8rem;padding:5px 12px">
                + Agregar apoderado
            </button>
        </div>`;

    if (lista.length === 0) {
        return header + `<p style="color:var(--color-text-muted);font-size:.875rem;margin:0">Sin apoderados registrados.</p>`;
    }

    const filas = lista.map(a => {
        const nombre = escapeHtml(`${a.apellidos}, ${a.nombres}`);
        const parentesco = PARENTESCO_LABEL[a.parentesco] || a.parentesco;

        return `<tr>
            <td>
                <strong>${nombre}</strong>
                <br><span style="font-size:.75rem;color:var(--color-text-muted)">DNI: ${escapeHtml(a.dni || '—')}</span>
            </td>
            <td style="font-size:.875rem">${parentesco}</td>
            <td style="font-size:.875rem">${escapeHtml(a.telefono || '—')}</td>
            <td style="text-align:center">
                ${_toggleApoderado(a.vinculo_id, 'es_contacto_principal', a.es_contacto_principal, pacienteId)}
            </td>
            <td style="text-align:center">
                ${_toggleApoderado(a.vinculo_id, 'es_responsable_pago', a.es_responsable_pago, pacienteId)}
            </td>
            <td style="text-align:center">
                ${_toggleApoderado(a.vinculo_id, 'puede_ver_historial', a.puede_ver_historial, pacienteId)}
            </td>
            <td style="text-align:center">
                <button class="btn-sm" title="Editar datos" onclick="abrirModalEditarApoderado(${a.vinculo_id}, ${pacienteId})">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 2l3 3-9 9H2v-3L11 2z"/>
                    </svg>
                </button>
                <button class="btn-sm" title="Desvincular" onclick="desvincularApoderado(${a.vinculo_id}, ${pacienteId})">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 8h8M2 4l12 8M14 4L2 12"/>
                    </svg>
                </button>
            </td>
        </tr>`;
    }).join('');

    return header + `
        <div style="overflow-x:auto">
            <table class="table">
                <tr>
                    <th>Nombre</th>
                    <th>Parentesco</th>
                    <th>Teléfono</th>
                    <th style="text-align:center;font-size:.75rem">Contacto<br>principal</th>
                    <th style="text-align:center;font-size:.75rem">Responsable<br>de pago</th>
                    <th style="text-align:center;font-size:.75rem">Ve<br>historial</th>
                    <th style="text-align:center">Acciones</th>
                </tr>
                ${filas}
            </table>
        </div>`;
}

// Genera un toggle visual on/off para un campo booleano del vínculo
function _toggleApoderado(vinculoId, campo, valorActual, pacienteId) {
    const activo = parseInt(valorActual) === 1;
    const color  = activo ? 'var(--color-success)' : 'var(--color-border)';
    const label  = activo ? 'Sí' : 'No';
    return `<button
        onclick="toggleApoderadoFlag(${vinculoId}, '${campo}', ${activo ? 1 : 0}, ${pacienteId})"
        title="${activo ? 'Desactivar' : 'Activar'}"
        style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border:2px solid ${color};
               border-radius:20px;background:${activo ? color : 'var(--color-surface)'};
               color:${activo ? '#fff' : 'var(--color-text-muted)'};
               font-size:.75rem;font-weight:600;cursor:pointer;transition:var(--transition)">
        ${label}
    </button>`;
}

// ---- Recargar solo la sección de apoderados ----
async function _recargarApoderados(pacienteId) {
    const res = await api('/api/apoderados?paciente_id=' + pacienteId);
    const card = document.getElementById('cardApoderados');
    if (card) card.innerHTML = _renderApoderados(res.data || [], pacienteId);
}

// ---- Toggle de flag boolean ----
async function toggleApoderadoFlag(vinculoId, campo, valorActual, pacienteId) {
    const nuevoValor = valorActual === 1 ? 0 : 1;
    const res = await api('/api/apoderados', 'PUT', {
        vinculo_id: vinculoId,
        [campo]:    nuevoValor,
    });
    if (res.success) {
        await _recargarApoderados(pacienteId);
    } else {
        showToast(res.message || 'Error al actualizar');
    }
}

// ---- Desvincular ----
async function desvincularApoderado(vinculoId, pacienteId) {
    if (!confirm('¿Desvincular este apoderado del paciente? Los datos de la persona no se eliminan.')) return;
    const res = await api('/api/apoderados', 'DELETE', { vinculo_id: vinculoId });
    if (res.success) {
        showToast('Apoderado desvinculado');
        await _recargarApoderados(pacienteId);
    } else {
        showToast(res.message || 'Error al desvincular');
    }
}

// ---- Modal: Agregar apoderado ----
function abrirModalApoderado(pacienteId) {
    document.getElementById('apoPacienteId').value   = pacienteId;
    document.getElementById('apoVinculoId').value    = '';
    document.getElementById('apoModalTitle').textContent = 'Agregar apoderado';

    // Campos persona
    ['apoDni','apoNombres','apoApellidos','apoTelefono','apoEmail'].forEach(id => {
        document.getElementById(id).value = '';
        document.getElementById(id).disabled = false;
    });
    document.getElementById('apoDniInfo').textContent = '';
    document.getElementById('apoParentesco').value    = 'otro';
    document.getElementById('apoContactoPrincipal').checked  = false;
    document.getElementById('apoResponsablePago').checked    = false;
    document.getElementById('apoPuedeVerHistorial').checked  = true;
    document.getElementById('apoNotas').value = '';

    // Limpiar errores
    ['apoDni','apoNombres','apoApellidos'].forEach(id => setFieldError(id, ''));

    document.getElementById('modalApoderado').classList.remove('hidden');
    document.getElementById('apoDni').focus();
}

// Buscar persona por DNI al salir del campo (para pre-rellenar si ya existe)
async function buscarApoderadoPorDni() {
    const dni = document.getElementById('apoDni').value.trim();
    const info = document.getElementById('apoDniInfo');
    if (!dni || dni.length < 7) { info.textContent = ''; return; }

    const res = await api('/api/apoderados/buscar-dni?dni=' + encodeURIComponent(dni));
    if (res.success && res.data) {
        document.getElementById('apoNombres').value   = res.data.nombres   || '';
        document.getElementById('apoApellidos').value = res.data.apellidos || '';
        document.getElementById('apoTelefono').value  = res.data.telefono  || '';
        document.getElementById('apoEmail').value     = res.data.email     || '';
        // Si ya es apoderado, bloquear los campos de persona (ya existen)
        if (res.data.apoderado_id) {
            ['apoNombres','apoApellidos','apoTelefono','apoEmail'].forEach(id => {
                document.getElementById(id).disabled = true;
            });
            info.textContent = 'Persona encontrada — se vinculará al paciente.';
            info.style.color = 'var(--color-success)';
        } else {
            info.textContent = 'DNI encontrado en personas — se creará el apoderado.';
            info.style.color = 'var(--color-warning)';
        }
    } else {
        ['apoNombres','apoApellidos','apoTelefono','apoEmail'].forEach(id => {
            document.getElementById(id).disabled = false;
        });
        info.textContent = '';
    }
}

async function guardarApoderado() {
    const vinculoId  = document.getElementById('apoVinculoId').value;
    const pacienteId = parseInt(document.getElementById('apoPacienteId').value);

    // Validar campos obligatorios para nuevo apoderado
    let valido = true;
    if (!vinculoId) { // modo creación
        const dni       = document.getElementById('apoDni').value.trim();
        const nombres   = document.getElementById('apoNombres').value.trim();
        const apellidos = document.getElementById('apoApellidos').value.trim();
        if (!dni)       { setFieldError('apoDni',       'El DNI es obligatorio');       valido = false; }
        if (!nombres)   { setFieldError('apoNombres',   'Los nombres son obligatorios');   valido = false; }
        if (!apellidos) { setFieldError('apoApellidos', 'Los apellidos son obligatorios'); valido = false; }
        if (!valido) return;

        const payload = {
            paciente_id:           pacienteId,
            dni,
            nombres,
            apellidos,
            telefono:              document.getElementById('apoTelefono').value.trim()  || null,
            email:                 document.getElementById('apoEmail').value.trim()     || null,
            parentesco:            document.getElementById('apoParentesco').value,
            es_contacto_principal: document.getElementById('apoContactoPrincipal').checked ? 1 : 0,
            es_responsable_pago:   document.getElementById('apoResponsablePago').checked   ? 1 : 0,
            puede_ver_historial:   document.getElementById('apoPuedeVerHistorial').checked  ? 1 : 0,
            notas:                 document.getElementById('apoNotas').value.trim()     || null,
        };
        const res = await api('/api/apoderados', 'POST', payload);
        if (res.success) {
            showToast(res.message || 'Apoderado agregado');
            cerrarModal('modalApoderado');
            await _recargarApoderados(pacienteId);
        } else {
            showToast(res.message || 'Error al agregar apoderado');
        }
    } else {
        // modo edición
        const payload = {
            vinculo_id:            parseInt(vinculoId),
            nombres:               document.getElementById('apoNombres').value.trim()   || undefined,
            apellidos:             document.getElementById('apoApellidos').value.trim() || undefined,
            telefono:              document.getElementById('apoTelefono').value.trim()  || null,
            email:                 document.getElementById('apoEmail').value.trim()     || null,
            parentesco:            document.getElementById('apoParentesco').value,
            es_contacto_principal: document.getElementById('apoContactoPrincipal').checked ? 1 : 0,
            es_responsable_pago:   document.getElementById('apoResponsablePago').checked   ? 1 : 0,
            puede_ver_historial:   document.getElementById('apoPuedeVerHistorial').checked  ? 1 : 0,
            notas:                 document.getElementById('apoNotas').value.trim()     || null,
        };
        // Eliminar campos undefined
        Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

        const res = await api('/api/apoderados', 'PUT', payload);
        if (res.success) {
            showToast('Apoderado actualizado');
            cerrarModal('modalApoderado');
            await _recargarApoderados(pacienteId);
        } else {
            showToast(res.message || 'Error al actualizar apoderado');
        }
    }
}

// ---- Modal: Editar apoderado (pre-rellena con datos existentes) ----
async function abrirModalEditarApoderado(vinculoId, pacienteId) {
    // Cargar datos del apoderado desde la lista renderizada
    const res = await api('/api/apoderados?paciente_id=' + pacienteId);
    const apo = (res.data || []).find(a => a.vinculo_id == vinculoId);
    if (!apo) { showToast('Apoderado no encontrado'); return; }

    document.getElementById('apoVinculoId').value   = vinculoId;
    document.getElementById('apoPacienteId').value  = pacienteId;
    document.getElementById('apoModalTitle').textContent = 'Editar apoderado';

    document.getElementById('apoDni').value       = apo.dni       || '';
    document.getElementById('apoDni').disabled    = true; // no cambiar DNI en edición
    document.getElementById('apoNombres').value   = apo.nombres   || '';
    document.getElementById('apoNombres').disabled = false;
    document.getElementById('apoApellidos').value = apo.apellidos || '';
    document.getElementById('apoApellidos').disabled = false;
    document.getElementById('apoTelefono').value  = apo.telefono  || '';
    document.getElementById('apoTelefono').disabled = false;
    document.getElementById('apoEmail').value     = apo.email     || '';
    document.getElementById('apoEmail').disabled  = false;
    document.getElementById('apoDniInfo').textContent = '';

    document.getElementById('apoParentesco').value = apo.parentesco || 'otro';
    document.getElementById('apoContactoPrincipal').checked = parseInt(apo.es_contacto_principal) === 1;
    document.getElementById('apoResponsablePago').checked   = parseInt(apo.es_responsable_pago)   === 1;
    document.getElementById('apoPuedeVerHistorial').checked  = parseInt(apo.puede_ver_historial)   === 1;
    document.getElementById('apoNotas').value = apo.notas || '';

    ['apoDni','apoNombres','apoApellidos'].forEach(id => setFieldError(id, ''));
    document.getElementById('modalApoderado').classList.remove('hidden');
}
