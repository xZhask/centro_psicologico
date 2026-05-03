
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

// ---- Helper de fecha corta: "DD mmm YYYY" ----

function _formatFechaCorta(fechaStr) {
    if (!fechaStr) return '—';
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const d = new Date(fechaStr.length === 10 ? fechaStr + 'T00:00:00' : fechaStr);
    return `${String(d.getDate()).padStart(2,'0')} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

// ---- Estado del módulo ----

let _pacientesAllData = [];
let _activeChip       = 'todos';
let _editPacienteId   = null;

// ---- Colores de avatar (4 rotativos) ----

const _PAC_AVATAR_COLORS = [
    { bg: 'rgba(42,127,143,.12)',  color: '#1B5C6B' },
    { bg: 'rgba(155,126,200,.12)', color: '#7B5EA7' },
    { bg: 'rgba(232,131,106,.12)', color: '#C0603A' },
    { bg: 'rgba(232,184,75,.12)',  color: '#9A7010' },
];

// ================================================================
// VISTA PRINCIPAL
// ================================================================

async function pacientes() {
    const res = await api('/api/pacientes');
    _pacientesAllData = res.data || [];
    _activeChip = 'todos';

    document.getElementById('view').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
            <div style="display:flex;align-items:baseline;gap:8px">
                <h2 style="margin:0">Pacientes</h2>
                <span id="pacientesContador" style="font-size:13px;color:var(--color-text-muted)">
                    · ${_pacientesAllData.length} registrado${_pacientesAllData.length !== 1 ? 's' : ''}
                </span>
            </div>
            <button class="btn-primary" onclick="abrirModalPaciente()"
                    style="display:flex;align-items:center;gap:6px">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                     stroke-width="2.2" stroke-linecap="round">
                    <line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/>
                </svg>
                Nuevo paciente
            </button>
        </div>

        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div class="list-search-wrap" style="flex:1;margin:0">
                <span class="list-search-icon">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                         stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="6.5" cy="6.5" r="4.5"/>
                        <line x1="10.5" y1="10.5" x2="14" y2="14"/>
                    </svg>
                </span>
                <input id="searchPacientes" class="list-search-input"
                       placeholder="Buscar por nombre o DNI..." autocomplete="off">
                <span id="searchPacientesCount" class="list-search-count"></span>
            </div>
            <button class="btn" style="display:flex;align-items:center;gap:6px;white-space:nowrap;
                    padding:7px 14px;font-size:13px">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                     stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="2" y1="4" x2="14" y2="4"/>
                    <line x1="4" y1="8" x2="12" y2="8"/>
                    <line x1="6" y1="12" x2="10" y2="12"/>
                </svg>
                Filtrar
            </button>
        </div>

        <div class="pt-filter-chips" id="ptChips"></div>

        <table class="table" id="tablaPacientes">
            <thead>
                <tr>
                    <th>Paciente</th>
                    <th>Teléfono</th>
                    <th>Estado</th>
                    <th>Última sesión</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody id="tbodyPacientes"></tbody>
        </table>
    `;

    _renderChips();
    _applyChipFilter();
    _initBuscadorPacientes();
    _initChips();
}

// ---- Chips ----

const _PAC_CHIPS = [
    { id: 'todos',       label: 'Todos' },
    { id: 'activos',     label: 'Con atención activa' },
    { id: 'menores',     label: 'Menores' },
    { id: 'sin_atencion',label: 'Sin atención' },
    { id: 'alertas',     label: 'Con alertas' },
];

function _renderChips() {
    const container = document.getElementById('ptChips');
    if (!container) return;
    container.innerHTML = _PAC_CHIPS.map(c => `
        <div class="pt-chip${_activeChip === c.id ? ' active' : ''}" data-chip="${c.id}">
            ${c.label}
        </div>
    `).join('');
}

function _initChips() {
    const container = document.getElementById('ptChips');
    if (!container) return;
    container.addEventListener('click', e => {
        const chip = e.target.closest('[data-chip]');
        if (!chip) return;
        _activeChip = chip.dataset.chip;
        _renderChips();
        _applyChipFilter();
    });
}

function _applyChipFilter() {
    let filtered = _pacientesAllData;
    switch (_activeChip) {
        case 'activos':
            filtered = _pacientesAllData.filter(p => parseInt(p.atenciones_activas) > 0);
            break;
        case 'menores':
            filtered = _pacientesAllData.filter(p => parseInt(p.es_menor) === 1);
            break;
        case 'sin_atencion':
            filtered = _pacientesAllData.filter(p => parseInt(p.atenciones_activas) === 0);
            break;
        case 'alertas':
            filtered = _pacientesAllData.filter(p => parseInt(p.alertas_activas) > 0);
            break;
    }
    const tbody = document.getElementById('tbodyPacientes');
    if (tbody) tbody.innerHTML = _renderPacienteRows(filtered);
    _updateContador(filtered.length);
}

function _updateContador(n) {
    const el = document.getElementById('pacientesContador');
    if (el) el.textContent = `· ${n} registrado${n !== 1 ? 's' : ''}`;
    const cnt = document.getElementById('searchPacientesCount');
    if (cnt) cnt.textContent = `${n} resultado${n !== 1 ? 's' : ''}`;
}

// ---- Render de filas ----

function _renderPacienteRows(data) {
    if (!data || data.length === 0) {
        return '<tr><td colspan="5" class="table-empty">No hay pacientes registrados</td></tr>';
    }

    return data.map((p, i) => {
        const ac   = _PAC_AVATAR_COLORS[i % 4];
        const ini1 = (p.nombres   || '').charAt(0).toUpperCase();
        const ini2 = (p.apellidos || '').charAt(0).toUpperCase();

        // Columna Paciente
        const menorBadge = parseInt(p.es_menor) === 1
            ? `<span class="pt-badge" style="background:rgba(155,126,200,.1);color:#7B5EA7;margin-left:5px">Menor</span>`
            : '';
        const apoderadoLine = (parseInt(p.es_menor) === 1 && p.apoderado_nombre)
            ? `<div class="pt-nombre-sub" style="margin-top:2px">Apod: ${escapeHtml(p.apoderado_nombre)}</div>`
            : '';

        // Columna Estado
        let estadoBadge;
        if (parseInt(p.atenciones_activas) > 0) {
            estadoBadge = `<span class="pt-badge" style="background:rgba(39,174,96,.1);color:#1B6B3A">Atención activa</span>`;
        } else if (!p.ultima_sesion) {
            estadoBadge = `<span class="pt-badge" style="background:rgba(232,184,75,.1);color:#9A7010">Sin atención</span>`;
        } else {
            estadoBadge = `<span class="pt-badge" style="background:rgba(108,117,125,.1);color:#495057">Proceso completado</span>`;
        }
        const alertaLine = parseInt(p.alertas_activas) > 0
            ? `<div class="pt-alerta-inline">
                   <div class="pt-alerta-dot"></div>
                   ${p.alertas_activas} alerta${parseInt(p.alertas_activas) !== 1 ? 's' : ''}
               </div>`
            : '';

        // Columna Última sesión
        let sesionTxt = `<span style="opacity:.5;color:var(--color-text-muted)">—</span>`;
        if (p.ultima_sesion) {
            const numSes = p.numero_ultima_sesion ? ` · sesión #${p.numero_ultima_sesion}` : '';
            sesionTxt = `<span class="pt-sesion-info">${_formatFechaCorta(p.ultima_sesion)}${numSes}</span>`;
        }

        return `<tr onclick="verDetallePaciente(${p.id})">
            <td>
                <div style="display:flex;align-items:center;gap:9px">
                    <div class="pt-avatar" style="background:${ac.bg};color:${ac.color}">${ini1}${ini2}</div>
                    <div>
                        <div class="pt-nombre-main">${escapeHtml(p.apellidos)}, ${escapeHtml(p.nombres)}</div>
                        <div style="display:flex;align-items:center;flex-wrap:wrap">
                            <span class="pt-nombre-sub">${escapeHtml(p.dni || '')}</span>
                            ${menorBadge}
                        </div>
                        ${apoderadoLine}
                    </div>
                </div>
            </td>
            <td class="pt-nombre-sub">${escapeHtml(p.telefono || '—')}</td>
            <td>${estadoBadge}${alertaLine}</td>
            <td>${sesionTxt}</td>
            <td>
                <div class="pt-actions" style="display:flex;gap:3px">
                    <button class="btn-icon" title="Ver perfil"
                        onclick="event.stopPropagation();verDetallePaciente(${p.id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="8" cy="5" r="3"/>
                            <path d="M1 14c0-3.866 3.134-7 7-7s7 3.134 7 7"/>
                        </svg>
                    </button>
                    <button class="btn-icon" title="Editar"
                        onclick="event.stopPropagation();abrirModalPaciente(${p.id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 2l3 3-9 9H2v-3L11 2z"/>
                        </svg>
                    </button>
                    <button class="btn-icon btn-icon-danger" title="Eliminar"
                        onclick="event.stopPropagation();eliminarPaciente(${p.id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 4 13 4"/>
                            <path d="M5 4V3h6v1"/>
                            <path d="M4 4l1 10h6l1-10"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ---- Buscador con debounce ----

function _initBuscadorPacientes() {
    const input = document.getElementById('searchPacientes');
    if (!input) return;
    let timer;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            const q   = input.value.trim();
            const res = await api('/api/pacientes' + (q ? '?q=' + encodeURIComponent(q) : ''));
            _pacientesAllData = res.data || [];
            _activeChip = 'todos';
            _renderChips();
            _applyChipFilter();
        }, 300);
    });
}

// ================================================================
// DETALLE DE PACIENTE
// ================================================================

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

        <div class="card" style="padding:16px" id="cardApoderados">
            ${_renderApoderados(resApo.data || [], id)}
        </div>
    `;
}

// ================================================================
// MODAL NUEVO / EDITAR PACIENTE
// ================================================================

async function abrirModalPaciente(id = null) {
    clearPacienteErrors();
    _editPacienteId = null;

    const campos = [
        'pacDni','pacNombres','pacApellidos','pacFechaNac',
        'pacTelefono','pacEmail','pacOcupacion',
        'pacContactoEmergencia','pacTelefonoEmergencia','pacAntecedentes'
    ];
    campos.forEach(fid => {
        const el = document.getElementById(fid);
        if (el) el.value = '';
    });
    const sexoEl = document.getElementById('pacSexo');
    const gradoEl = document.getElementById('pacGradoInstruccion');
    const civilEl = document.getElementById('pacEstadoCivil');
    if (sexoEl)  sexoEl.value  = 'no_especificado';
    if (gradoEl) gradoEl.value = 'no_especificado';
    if (civilEl) civilEl.value = 'no_especificado';

    const dniEl = document.getElementById('pacDni');

    if (id) {
        const res = await api('/api/paciente?id=' + id);
        if (res.data) {
            const p = res.data;
            _editPacienteId = id;
            if (dniEl) { dniEl.value = p.dni || ''; dniEl.readOnly = true; dniEl.style.opacity = '0.6'; }
            const setVal = (fid, val) => { const el = document.getElementById(fid); if (el) el.value = val || ''; };
            setVal('pacNombres',   p.nombres);
            setVal('pacApellidos', p.apellidos);
            setVal('pacFechaNac',  p.fecha_nacimiento);
            if (sexoEl)  sexoEl.value  = p.sexo             || 'no_especificado';
            setVal('pacTelefono',  p.telefono);
            setVal('pacEmail',     p.email);
            if (gradoEl) gradoEl.value = p.grado_instruccion || 'no_especificado';
            setVal('pacOcupacion', p.ocupacion);
            if (civilEl) civilEl.value = p.estado_civil      || 'no_especificado';
            setVal('pacContactoEmergencia',  p.contacto_emergencia);
            setVal('pacTelefonoEmergencia',  p.telefono_emergencia);
            setVal('pacAntecedentes', p.antecedentes);
        }
        document.getElementById('modalPacienteTitle').innerText = 'Editar Paciente';
        // En edición los nombres son editables directamente
        _lockNombresDni('pac', false);
        _resetDniStatus('pac');
    } else {
        if (dniEl) { dniEl.readOnly = false; dniEl.style.opacity = ''; }
        document.getElementById('modalPacienteTitle').innerText = 'Nuevo Paciente';
        // Nombres bloqueados hasta completar la consulta de DNI
        _lockNombresDni('pac', true);
        _resetDniStatus('pac');
        initDniLookup('pac');
    }

    document.getElementById('modalPaciente').classList.remove('hidden');
}

// ---- Guardar paciente (crear o editar) ----

async function guardarPaciente() {
    clearPacienteErrors();

    const nombres   = document.getElementById('pacNombres').value.trim();
    const apellidos = document.getElementById('pacApellidos').value.trim();
    const dni       = document.getElementById('pacDni').value.trim();

    let valido = true;

    if (!_editPacienteId) {
        if (!dni) {
            setFieldError('pacDni', 'El DNI es obligatorio');
            valido = false;
        } else if (!/^\d{7,15}$/.test(dni)) {
            setFieldError('pacDni', 'Ingrese un DNI válido (7-15 dígitos)');
            valido = false;
        }
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

    let res;
    if (_editPacienteId) {
        data.id = _editPacienteId;
        res = await api('/api/pacientes', 'PUT', data);
    } else {
        data.dni = dni;
        res = await api('/api/pacientes', 'POST', data);
    }

    if (res.success) {
        showToast(_editPacienteId ? 'Paciente actualizado' : 'Paciente creado');
        cerrarModal('modalPaciente');
        pacientes();
    } else {
        if (res.message && res.message.toLowerCase().includes('dni')) {
            setFieldError('pacDni', res.message);
        } else {
            showToast(res.message || 'Error al guardar paciente');
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
        const nombre     = escapeHtml(`${a.apellidos}, ${a.nombres}`);
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

async function _recargarApoderados(pacienteId) {
    const res  = await api('/api/apoderados?paciente_id=' + pacienteId);
    const card = document.getElementById('cardApoderados');
    if (card) card.innerHTML = _renderApoderados(res.data || [], pacienteId);
}

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

    ['apoDni','apoNombres','apoApellidos','apoTelefono','apoEmail'].forEach(id => {
        document.getElementById(id).value    = '';
        document.getElementById(id).disabled = false;
    });
    document.getElementById('apoDniInfo').textContent = '';
    document.getElementById('apoParentesco').value    = 'otro';
    document.getElementById('apoContactoPrincipal').checked  = false;
    document.getElementById('apoResponsablePago').checked    = false;
    document.getElementById('apoPuedeVerHistorial').checked  = true;
    document.getElementById('apoNotas').value = '';

    ['apoDni','apoNombres','apoApellidos'].forEach(id => setFieldError(id, ''));

    document.getElementById('modalApoderado').classList.remove('hidden');
    document.getElementById('apoDni').focus();
}

async function buscarApoderadoPorDni() {
    const dni  = document.getElementById('apoDni').value.trim();
    const info = document.getElementById('apoDniInfo');
    if (!dni || dni.length < 7) { info.textContent = ''; return; }

    const res = await api('/api/apoderados/buscar-dni?dni=' + encodeURIComponent(dni));
    if (res.success && res.data) {
        document.getElementById('apoNombres').value   = res.data.nombres   || '';
        document.getElementById('apoApellidos').value = res.data.apellidos || '';
        document.getElementById('apoTelefono').value  = res.data.telefono  || '';
        document.getElementById('apoEmail').value     = res.data.email     || '';
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

    let valido = true;
    if (!vinculoId) {
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

async function abrirModalEditarApoderado(vinculoId, pacienteId) {
    const res = await api('/api/apoderados?paciente_id=' + pacienteId);
    const apo = (res.data || []).find(a => a.vinculo_id == vinculoId);
    if (!apo) { showToast('Apoderado no encontrado'); return; }

    document.getElementById('apoVinculoId').value   = vinculoId;
    document.getElementById('apoPacienteId').value  = pacienteId;
    document.getElementById('apoModalTitle').textContent = 'Editar apoderado';

    document.getElementById('apoDni').value          = apo.dni       || '';
    document.getElementById('apoDni').disabled       = true;
    document.getElementById('apoNombres').value      = apo.nombres   || '';
    document.getElementById('apoNombres').disabled   = false;
    document.getElementById('apoApellidos').value    = apo.apellidos || '';
    document.getElementById('apoApellidos').disabled = false;
    document.getElementById('apoTelefono').value     = apo.telefono  || '';
    document.getElementById('apoTelefono').disabled  = false;
    document.getElementById('apoEmail').value        = apo.email     || '';
    document.getElementById('apoEmail').disabled     = false;
    document.getElementById('apoDniInfo').textContent = '';

    document.getElementById('apoParentesco').value            = apo.parentesco || 'otro';
    document.getElementById('apoContactoPrincipal').checked   = parseInt(apo.es_contacto_principal) === 1;
    document.getElementById('apoResponsablePago').checked     = parseInt(apo.es_responsable_pago)   === 1;
    document.getElementById('apoPuedeVerHistorial').checked   = parseInt(apo.puede_ver_historial)   === 1;
    document.getElementById('apoNotas').value = apo.notas || '';

    ['apoDni','apoNombres','apoApellidos'].forEach(id => setFieldError(id, ''));
    document.getElementById('modalApoderado').classList.remove('hidden');
}
