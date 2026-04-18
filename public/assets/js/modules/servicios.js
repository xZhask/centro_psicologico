
// ---- Helpers de validación inline ----

function setServError(fieldId, message) {
    const el    = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (el)    el.classList.toggle('is-invalid', !!message);
    if (errEl) errEl.textContent = message || '';
}

function clearServErrors() {
    ['servNombre', 'servTipo'].forEach(id => setServError(id, ''));
}

function setSubsError(fieldId, message) {
    const el    = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (el)    el.classList.toggle('is-invalid', !!message);
    if (errEl) errEl.textContent = message || '';
}

function clearSubsErrors() {
    ['subsNombre', 'subsModalidad', 'subsPrecioBase'].forEach(id => setSubsError(id, ''));
}

// ---- Vista principal ----

async function servicios() {
    const res = await api('/api/servicios');

    let serviciosRows = '';
    if (res.data && res.data.length > 0) {
        res.data.forEach(s => {
            const tipo = { individual: 'Individual', grupal: 'Grupal', taller: 'Taller' }[s.tipo] || s.tipo;
            serviciosRows += `<tr>
                <td>${s.nombre}</td>
                <td>${tipo}</td>
                <td style="text-align:center">
                    <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--color-primary);color:#fff;font-size:.75rem;font-weight:600">${s.total_subservicios}</span>
                </td>
                <td>
                    <button class="btn-sm" title="Editar servicio" onclick="abrirModalServicio(${s.id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 2l3 3-9 9H2v-3L11 2z"/>
                        </svg>
                    </button>
                    <button class="btn-sm" title="Ver subservicios" onclick="verSubservicios(${s.id}, '${s.nombre.replace(/'/g, "\\'")}')">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 3 11 8 6 13"/>
                        </svg>
                    </button>
                </td>
            </tr>`;
        });
    } else {
        serviciosRows = '<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted);padding:24px">No hay servicios registrados</td></tr>';
    }

    document.getElementById('view').innerHTML = `
        <h2>Servicios y Subservicios</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start">

            <div class="card" style="padding:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                    <h3 style="margin:0;font-size:1rem;font-weight:600">Servicios</h3>
                    <button class="btn-primary" onclick="abrirModalServicio()">+ Nuevo</button>
                </div>
                <table class="table">
                    <tr>
                        <th>Nombre</th>
                        <th>Tipo</th>
                        <th style="text-align:center">Subserv.</th>
                        <th>Acciones</th>
                    </tr>
                    ${serviciosRows}
                </table>
            </div>

            <div id="subserviciosPanel" class="card" style="padding:20px">
                <p style="color:var(--color-text-muted);margin:0">
                    Seleccione un servicio para ver sus subservicios.
                </p>
            </div>

        </div>
    `;
}

// ---- Panel de subservicios ----

async function verSubservicios(servicioId, servicioNombre) {
    const res = await api('/api/subservicios/por-servicio?servicio_id=' + servicioId);

    let rows = '';
    if (res.data && res.data.length > 0) {
        res.data.forEach(s => {
            const modalidadLabel = {
                individual: 'Individual', pareja: 'Pareja',
                familiar: 'Familiar', grupal: 'Grupal'
            }[s.modalidad] || s.modalidad;
            rows += `<tr>
                <td>${s.nombre}</td>
                <td>${modalidadLabel}</td>
                <td>${s.duracion_min ? s.duracion_min + ' min' : '-'}</td>
                <td>S/ ${parseFloat(s.precio_base).toFixed(2)}</td>
                <td>
                    <button class="btn-sm" title="Editar" onclick="abrirModalSubservicio(${servicioId}, ${s.id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 2l3 3-9 9H2v-3L11 2z"/>
                        </svg>
                    </button>
                </td>
            </tr>`;
        });
    } else {
        rows = `<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:16px">Sin subservicios</td></tr>`;
    }

    document.getElementById('subserviciosPanel').innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="margin:0;font-size:1rem;font-weight:600">${servicioNombre}</h3>
            <button class="btn-primary" onclick="abrirModalSubservicio(${servicioId})">+ Nuevo</button>
        </div>
        <table class="table">
            <tr>
                <th>Nombre</th>
                <th>Modalidad</th>
                <th>Duración</th>
                <th>Precio</th>
                <th>Acciones</th>
            </tr>
            ${rows}
        </table>
    `;
}

// ---- Modal Servicio ----

async function abrirModalServicio(id = null) {
    clearServErrors();
    document.getElementById('servId').value        = '';
    document.getElementById('servNombre').value    = '';
    document.getElementById('servTipo').value      = 'individual';
    document.getElementById('servDescripcion').value = '';
    document.getElementById('servOrden').value     = '0';

    if (id) {
        const res = await api('/api/servicio?id=' + id);
        if (res.data) {
            const s = res.data;
            document.getElementById('servId').value          = s.id;
            document.getElementById('servNombre').value      = s.nombre       || '';
            document.getElementById('servTipo').value        = s.tipo         || 'individual';
            document.getElementById('servDescripcion').value = s.descripcion  || '';
            document.getElementById('servOrden').value       = s.orden        ?? 0;
        }
        document.getElementById('modalServicioTitle').innerText = 'Editar Servicio';
    } else {
        document.getElementById('modalServicioTitle').innerText = 'Nuevo Servicio';
    }

    document.getElementById('modalServicio').classList.remove('hidden');
}

async function guardarServicio() {
    clearServErrors();

    const id     = document.getElementById('servId').value;
    const nombre = document.getElementById('servNombre').value.trim();
    const tipo   = document.getElementById('servTipo').value;

    let valido = true;

    if (!nombre) {
        setServError('servNombre', 'El nombre es obligatorio');
        valido = false;
    }
    if (!tipo) {
        setServError('servTipo', 'Seleccione un tipo');
        valido = false;
    }

    if (!valido) return;

    const data = {
        nombre,
        tipo,
        descripcion: document.getElementById('servDescripcion').value.trim() || null,
        orden:       document.getElementById('servOrden').value,
    };

    let res;
    if (id) {
        data.id = parseInt(id);
        res = await api('/api/servicios', 'PUT', data);
    } else {
        res = await api('/api/servicios', 'POST', data);
    }

    if (res.success) {
        showToast(id ? 'Servicio actualizado' : 'Servicio creado');
        cerrarModal('modalServicio');
        servicios();
    } else {
        showToast(res.message || 'Error al guardar');
    }
}

// ---- Modal Subservicio ----

async function abrirModalSubservicio(servicioId, id = null) {
    clearSubsErrors();
    document.getElementById('subsId').value          = '';
    document.getElementById('subsServicioId').value  = servicioId;
    document.getElementById('subsNombre').value      = '';
    document.getElementById('subsModalidad').value   = 'individual';
    document.getElementById('subsDuracion').value    = '50';
    document.getElementById('subsPrecioBase').value  = '';

    if (id) {
        const res = await api('/api/subservicio?id=' + id);
        if (res.data) {
            const s = res.data;
            document.getElementById('subsId').value         = s.id;
            document.getElementById('subsNombre').value     = s.nombre      || '';
            document.getElementById('subsModalidad').value  = s.modalidad   || 'individual';
            document.getElementById('subsDuracion').value   = s.duracion_min ?? 50;
            document.getElementById('subsPrecioBase').value = s.precio_base  || '';
        }
        document.getElementById('modalSubservicioTitle').innerText = 'Editar Subservicio';
    } else {
        document.getElementById('modalSubservicioTitle').innerText = 'Nuevo Subservicio';
    }

    document.getElementById('modalSubservicio').classList.remove('hidden');
}

async function guardarSubservicio() {
    clearSubsErrors();

    const id          = document.getElementById('subsId').value;
    const servicioId  = document.getElementById('subsServicioId').value;
    const nombre      = document.getElementById('subsNombre').value.trim();
    const modalidad   = document.getElementById('subsModalidad').value;
    const precioBase  = document.getElementById('subsPrecioBase').value;

    let valido = true;

    if (!nombre) {
        setSubsError('subsNombre', 'El nombre es obligatorio');
        valido = false;
    }
    if (!modalidad) {
        setSubsError('subsModalidad', 'Seleccione una modalidad');
        valido = false;
    }
    if (!precioBase || isNaN(parseFloat(precioBase))) {
        setSubsError('subsPrecioBase', 'Ingrese un precio válido');
        valido = false;
    }

    if (!valido) return;

    const data = {
        servicio_id:  parseInt(servicioId),
        nombre,
        modalidad,
        duracion_min: document.getElementById('subsDuracion').value || 50,
        precio_base:  parseFloat(precioBase),
    };

    let res;
    if (id) {
        data.id = parseInt(id);
        res = await api('/api/subservicios', 'PUT', data);
    } else {
        res = await api('/api/subservicios', 'POST', data);
    }

    if (res.success) {
        showToast(id ? 'Subservicio actualizado' : 'Subservicio creado');
        cerrarModal('modalSubservicio');
        // Refresca el panel de subservicios del servicio activo
        const nombrePanel = document.querySelector('#subserviciosPanel h3');
        verSubservicios(servicioId, nombrePanel ? nombrePanel.innerText : '');
    } else {
        showToast(res.message || 'Error al guardar');
    }
}
