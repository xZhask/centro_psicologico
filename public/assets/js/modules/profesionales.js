
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

// ---- Vista principal ----

async function profesionales() {
    const res = await api('/api/profesionales');
    let html = `
        <h2>Profesionales</h2>
        <button class="btn-primary" onclick="abrirModalProfesional()">+ Nuevo Profesional</button>
        <table class="table">
            <tr>
                <th>DNI</th>
                <th>Nombre</th>
                <th>Especialidad</th>
                <th>Colegiatura</th>
                <th>Tarifa/hora</th>
                <th>Acciones</th>
            </tr>
    `;

    if (res.data && res.data.length > 0) {
        res.data.forEach(p => {
            const tarifa = p.tarifa_hora ? `S/ ${parseFloat(p.tarifa_hora).toFixed(2)}` : '-';
            html += `<tr>
                <td>${p.dni || ''}</td>
                <td>${p.apellidos}, ${p.nombres}</td>
                <td>${p.especialidad || '-'}</td>
                <td>${p.colegiatura || ''}</td>
                <td>${tarifa}</td>
                <td>
                    <button class="btn-sm" title="Editar" onclick="abrirModalProfesional(${p.id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 2l3 3-9 9H2v-3L11 2z"/>
                        </svg>
                    </button>
                    <button class="btn-sm" title="Eliminar" onclick="eliminarProfesional(${p.id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 4 13 4"/><path d="M5 4V3h6v1"/><path d="M4 4l1 10h6l1-10"/>
                        </svg>
                    </button>
                </td>
            </tr>`;
        });
    } else {
        html += '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:24px">No hay profesionales registrados</td></tr>';
    }

    html += '</table>';
    document.getElementById('view').innerHTML = html;
}

// ---- Abrir modal ----

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
        // DNI no es editable en modo edición (está ligado a la persona ya creada)
        document.getElementById('profDni').readOnly = true;
        document.getElementById('profDni').style.opacity = '0.6';
    } else {
        document.getElementById('modalProfesionalTitle').innerText = 'Nuevo Profesional';
        document.getElementById('profDni').readOnly = false;
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
    if (!nombres) {
        setProfError('profNombres', 'Los nombres son obligatorios');
        valido = false;
    }
    if (!apellidos) {
        setProfError('profApellidos', 'Los apellidos son obligatorios');
        valido = false;
    }
    if (!colegiatura) {
        setProfError('profColegiatura', 'El número de colegiatura es obligatorio');
        valido = false;
    }
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
