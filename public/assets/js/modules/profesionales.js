
// ---- Helpers de validación inline ----

function setProfError(fieldId, message) {
    const el    = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (el)    el.classList.toggle('is-invalid', !!message);
    if (errEl) errEl.textContent = message || '';
}

function clearProfErrors() {
    ['profDni','profNombres','profApellidos','profTelefono','profEmail',
     'profColegiatura','profEspecialidad','profTarifaHora']
        .forEach(id => setProfError(id, ''));
}

// ---- Colores de avatar (4 rotativos, compartidos con pacientes) ----

const _PROF_AVATAR_COLORS = [
    { bg: 'rgba(42,127,143,.12)',  color: '#1B5C6B' },
    { bg: 'rgba(155,126,200,.12)', color: '#7B5EA7' },
    { bg: 'rgba(232,131,106,.12)', color: '#C0603A' },
    { bg: 'rgba(232,184,75,.12)',  color: '#9A7010' },
];

// ================================================================
// VISTA PRINCIPAL
// ================================================================

async function profesionales() {
    const res  = await api('/api/profesionales');
    const data = res.data || [];

    document.getElementById('view').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
            <div style="display:flex;align-items:baseline;gap:8px">
                <h2 style="margin:0">Profesionales</h2>
                <span id="profContador" style="font-size:13px;color:var(--color-text-muted)">
                    · ${data.length} registrado${data.length !== 1 ? 's' : ''}
                </span>
            </div>
            <button class="btn-primary" onclick="abrirModalProfesional()"
                    style="display:flex;align-items:center;gap:6px">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                     stroke-width="2.2" stroke-linecap="round">
                    <line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/>
                </svg>
                Nuevo profesional
            </button>
        </div>

        <div style="margin-bottom:16px">
            <div class="list-search-wrap" style="margin:0">
                <span class="list-search-icon">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                         stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="6.5" cy="6.5" r="4.5"/>
                        <line x1="10.5" y1="10.5" x2="14" y2="14"/>
                    </svg>
                </span>
                <input id="searchProfesionales" class="list-search-input"
                       placeholder="Buscar por nombre, colegiatura o especialidad..." autocomplete="off">
                <span id="searchProfesionalesCount" class="list-search-count">
                    ${data.length} resultado${data.length !== 1 ? 's' : ''}
                </span>
            </div>
        </div>

        <table class="table" id="tablaProfesionales">
            <thead>
                <tr>
                    <th>Profesional</th>
                    <th>Especialidad</th>
                    <th>Colegiatura</th>
                    <th>Pacientes activos</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>${_renderProfesionalRows(data)}</tbody>
        </table>
    `;

    _initBuscadorProfesionales();
}

// ---- Render de filas ----

function _renderProfesionalRows(data) {
    if (!data || data.length === 0) {
        return '<tr><td colspan="5" class="table-empty">No hay profesionales registrados</td></tr>';
    }

    return data.map((p, i) => {
        const ac   = _PROF_AVATAR_COLORS[i % 4];
        const ini1 = (p.nombres   || '').charAt(0).toUpperCase();
        const ini2 = (p.apellidos || '').charAt(0).toUpperCase();

        const pactivos = parseInt(p.pacientes_activos) || 0;
        const pactivosTxt = pactivos > 0
            ? `<span style="font-size:13px;font-weight:500">${pactivos}</span>
               <span class="pt-nombre-sub"> paciente${pactivos !== 1 ? 's' : ''}</span>`
            : `<span style="opacity:.5;color:var(--color-text-muted)">—</span>`;

        const btnEliminar = pactivos === 0
            ? `<button class="btn-icon btn-icon-danger" title="Eliminar"
                   onclick="event.stopPropagation();eliminarProfesional(${p.id})">
                   <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                        stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                       <polyline points="3 4 13 4"/>
                       <path d="M5 4V3h6v1"/>
                       <path d="M4 4l1 10h6l1-10"/>
                   </svg>
               </button>`
            : '';

        return `<tr onclick="abrirModalProfesional(${p.id})">
            <td>
                <div style="display:flex;align-items:center;gap:9px">
                    <div class="pt-avatar" style="background:${ac.bg};color:${ac.color}">${ini1}${ini2}</div>
                    <div>
                        <div class="pt-nombre-main">${escapeHtml(p.apellidos)}, ${escapeHtml(p.nombres)}</div>
                        <div class="pt-nombre-sub">${escapeHtml(p.email || '')}</div>
                    </div>
                </div>
            </td>
            <td style="font-size:13px">${escapeHtml(p.especialidad || '—')}</td>
            <td class="pt-nombre-sub">${escapeHtml(p.colegiatura || '—')}</td>
            <td>${pactivosTxt}</td>
            <td>
                <div class="pt-actions" style="display:flex;gap:3px">
                    <button class="btn-icon" title="Ver detalle"
                        onclick="event.stopPropagation();abrirModalProfesional(${p.id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="8" cy="5" r="3"/>
                            <path d="M1 14c0-3.866 3.134-7 7-7s7 3.134 7 7"/>
                        </svg>
                    </button>
                    <button class="btn-icon" title="Editar"
                        onclick="event.stopPropagation();abrirModalProfesional(${p.id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 2l3 3-9 9H2v-3L11 2z"/>
                        </svg>
                    </button>
                    ${btnEliminar}
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ---- Buscador con debounce ----

function _initBuscadorProfesionales() {
    const input = document.getElementById('searchProfesionales');
    if (!input) return;
    let timer;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            const q     = input.value.trim();
            const res   = await api('/api/profesionales' + (q ? '?q=' + encodeURIComponent(q) : ''));
            const tbody = document.querySelector('#tablaProfesionales tbody');
            const count = document.getElementById('searchProfesionalesCount');
            const data  = res.data || [];
            if (tbody) {
                tbody.innerHTML = (!data.length && q)
                    ? `<tr><td colspan="5" class="table-empty">No se encontraron profesionales para "${escapeHtml(q)}"</td></tr>`
                    : _renderProfesionalRows(data);
            }
            if (count) count.textContent = data.length + ' resultado' + (data.length !== 1 ? 's' : '');
        }, 300);
    });
}

// ================================================================
// MODAL NUEVO / EDITAR PROFESIONAL
// ================================================================

async function abrirModalProfesional(id = null) {
    clearProfErrors();

    document.getElementById('profId').value = '';
    ['profDni','profNombres','profApellidos','profTelefono',
     'profEmail','profColegiatura','profEspecialidad','profTarifaHora']
        .forEach(fid => { document.getElementById(fid).value = ''; });

    if (id) {
        const res = await api('/api/profesional?id=' + id);
        if (res.data) {
            const p = res.data;
            document.getElementById('profId').value           = p.id;
            document.getElementById('profDni').value          = p.dni         || '';
            document.getElementById('profNombres').value      = p.nombres     || '';
            document.getElementById('profApellidos').value    = p.apellidos   || '';
            document.getElementById('profTelefono').value     = p.telefono    || '';
            document.getElementById('profEmail').value        = p.email       || '';
            document.getElementById('profColegiatura').value  = p.colegiatura || '';
            document.getElementById('profEspecialidad').value = p.especialidad || '';
            document.getElementById('profTarifaHora').value   = p.tarifa_hora || '';
        }
        document.getElementById('modalProfesionalTitle').innerText = 'Editar Profesional';
        document.getElementById('profDni').readOnly    = true;
        document.getElementById('profDni').style.opacity = '0.6';
    } else {
        document.getElementById('modalProfesionalTitle').innerText = 'Nuevo Profesional';
        document.getElementById('profDni').readOnly    = false;
        document.getElementById('profDni').style.opacity = '';
    }

    document.getElementById('modalProfesional').classList.remove('hidden');
}

// ---- Guardar ----

async function guardarProfesional() {
    clearProfErrors();

    const id          = document.getElementById('profId').value;
    const dni         = document.getElementById('profDni').value.trim();
    const nombres     = document.getElementById('profNombres').value.trim();
    const apellidos   = document.getElementById('profApellidos').value.trim();
    const colegiatura = document.getElementById('profColegiatura').value.trim();
    const email       = document.getElementById('profEmail').value.trim();
    const tarifaHora  = document.getElementById('profTarifaHora').value;

    let valido = true;

    if (!id) {
        if (!dni) {
            setProfError('profDni', 'El DNI es obligatorio');
            valido = false;
        } else if (!/^\d{7,15}$/.test(dni)) {
            setProfError('profDni', 'Ingrese un DNI válido (7-15 dígitos)');
            valido = false;
        }
    }
    if (!nombres)     { setProfError('profNombres',   'Los nombres son obligatorios');               valido = false; }
    if (!apellidos)   { setProfError('profApellidos', 'Los apellidos son obligatorios');             valido = false; }
    if (!colegiatura) { setProfError('profColegiatura', 'El número de colegiatura es obligatorio'); valido = false; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setProfError('profEmail', 'Formato de email inválido');
        valido = false;
    }
    if (tarifaHora && isNaN(parseFloat(tarifaHora))) {
        setProfError('profTarifaHora', 'Ingrese un valor numérico válido');
        valido = false;
    }

    if (!valido) return;

    const data = {
        dni,
        nombres,
        apellidos,
        telefono:     document.getElementById('profTelefono').value.trim() || null,
        email:        email || null,
        colegiatura,
        especialidad: document.getElementById('profEspecialidad').value.trim() || null,
        tarifa_hora:  tarifaHora ? parseFloat(tarifaHora) : null,
    };

    let res;
    if (id) {
        data.id = parseInt(id);
        res = await api('/api/profesionales', 'PUT', data);
    } else {
        res = await api('/api/profesionales', 'POST', data);
    }

    if (res.success) {
        showToast(id ? 'Profesional actualizado' : 'Profesional creado');
        cerrarModal('modalProfesional');
        profesionales();
    } else {
        if (res.message && res.message.toLowerCase().includes('dni')) {
            setProfError('profDni', res.message);
        } else if (res.message && res.message.toLowerCase().includes('colegiatura')) {
            setProfError('profColegiatura', res.message);
        } else {
            showToast(res.message || 'Error al guardar');
        }
    }
}

// ---- Eliminar ----

async function eliminarProfesional(id) {
    if (!confirm('¿Eliminar este profesional? Esta acción no se puede deshacer.')) return;

    const res = await api('/api/profesionales', 'DELETE', { id });
    if (res.success) {
        showToast('Profesional eliminado');
        profesionales();
    } else {
        showToast(res.message || 'Error al eliminar');
    }
}
