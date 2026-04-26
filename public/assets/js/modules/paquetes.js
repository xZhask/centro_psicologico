
// ---- Módulo de catálogo de paquetes (solo admin) ----

async function paquetes() {
    const res = await api('/api/paquetes');

    let rows = '';
    if (res.data && res.data.length > 0) {
        res.data.forEach(p => {
            const pxSes = p.sesiones_incluidas > 0
                ? (parseFloat(p.precio_paquete) / parseInt(p.sesiones_incluidas)).toFixed(2)
                : '—';
            const activoBadge = p.activo
                ? '<span class="badge badge-success">Activo</span>'
                : '<span class="badge badge-danger">Inactivo</span>';
            rows += `<tr>
                <td><strong>${escapeHtml(p.nombre)}</strong>${p.descripcion ? `<br><span style="font-size:.8rem;color:var(--color-text-muted)">${escapeHtml(p.descripcion)}</span>` : ''}</td>
                <td style="text-align:center">${p.sesiones_incluidas}</td>
                <td>S/ ${parseFloat(p.precio_paquete).toFixed(2)}</td>
                <td>S/ ${pxSes}</td>
                <td>${activoBadge}</td>
                <td>
                    <button class="btn-sm" title="Editar" onclick="abrirModalEditarPaquete(${p.id}, ${_pqEscAttr(p.nombre)}, ${_pqEscAttr(p.descripcion || '')}, ${p.sesiones_incluidas}, ${p.precio_paquete})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2l3 3-9 9H2v-3L11 2z"/></svg>
                    </button>
                    <button class="btn-sm" title="${p.activo ? 'Desactivar' : 'Activar'}" onclick="togglePaqueteActivo(${p.id})">
                        ${p.activo
                            ? '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>'
                            : '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 8 6 12 14 4"/></svg>'
                        }
                    </button>
                </td>
            </tr>`;
        });
    } else {
        rows = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:24px">No hay paquetes definidos. Crea el primero con "+ Nuevo paquete".</td></tr>';
    }

    document.getElementById('view').innerHTML = `
        <h2>Paquetes de sesiones</h2>
        <button class="btn-primary" onclick="abrirModalNuevoPaquete()" style="margin-bottom:12px">+ Nuevo paquete</button>
        <table class="table">
            <tr>
                <th>Nombre</th>
                <th style="text-align:center">Sesiones</th>
                <th>Precio</th>
                <th>Precio / sesión</th>
                <th>Estado</th>
                <th>Acciones</th>
            </tr>
            ${rows}
        </table>
    `;
}

function _pqEscAttr(str) {
    return JSON.stringify(String(str ?? ''));
}

// ---- Modal nuevo paquete ----

function abrirModalNuevoPaquete() {
    document.getElementById('pqModalTitle').textContent = 'Nuevo paquete';
    document.getElementById('pqId').value         = '';
    document.getElementById('pqNombre').value     = '';
    document.getElementById('pqDesc').value       = '';
    document.getElementById('pqSesiones').value   = '';
    document.getElementById('pqPrecio').value     = '';
    document.getElementById('pqPreview').textContent = '';
    _pqLimpiarErrores();
    document.getElementById('modalPaquete').classList.remove('hidden');
    document.getElementById('pqNombre').focus();
}

function abrirModalEditarPaquete(id, nombre, desc, sesiones, precio) {
    document.getElementById('pqModalTitle').textContent = 'Editar paquete';
    document.getElementById('pqId').value       = id;
    document.getElementById('pqNombre').value   = nombre;
    document.getElementById('pqDesc').value     = desc;
    document.getElementById('pqSesiones').value = sesiones;
    document.getElementById('pqPrecio').value   = parseFloat(precio).toFixed(2);
    _pqActualizarPreview();
    _pqLimpiarErrores();
    document.getElementById('modalPaquete').classList.remove('hidden');
}

function _pqActualizarPreview() {
    const ses    = parseInt(document.getElementById('pqSesiones').value);
    const precio = parseFloat(document.getElementById('pqPrecio').value);
    const prev   = document.getElementById('pqPreview');
    if (ses > 0 && precio > 0) {
        prev.textContent = `Equivale a S/ ${(precio / ses).toFixed(2)} por sesión`;
        prev.style.color = 'var(--color-primary)';
    } else {
        prev.textContent = '';
    }
}

function _pqLimpiarErrores() {
    ['pqNombre','pqSesiones','pqPrecio'].forEach(id => {
        const el  = document.getElementById(id);
        const err = document.getElementById(id + '-error');
        if (el)  el.classList.remove('is-invalid');
        if (err) err.textContent = '';
    });
}

async function guardarPaquete() {
    _pqLimpiarErrores();

    const id       = document.getElementById('pqId').value;
    const nombre   = document.getElementById('pqNombre').value.trim();
    const desc     = document.getElementById('pqDesc').value.trim();
    const sesiones = parseInt(document.getElementById('pqSesiones').value);
    const precio   = parseFloat(document.getElementById('pqPrecio').value);

    let valido = true;
    if (!nombre)           { _pqError('pqNombre',   'El nombre es obligatorio'); valido = false; }
    if (!sesiones || sesiones < 1) { _pqError('pqSesiones', 'Debe ser ≥ 1'); valido = false; }
    if (!precio   || precio <= 0)  { _pqError('pqPrecio',   'Debe ser mayor que 0'); valido = false; }
    if (!valido) return;

    const payload = { nombre, descripcion: desc || null, sesiones_incluidas: sesiones, precio_paquete: precio };

    let res;
    if (id) {
        res = await api('/api/paquetes', 'PUT', { id: parseInt(id), ...payload });
    } else {
        res = await api('/api/paquetes', 'POST', payload);
    }

    if (res.success) {
        showToast(id ? 'Paquete actualizado' : 'Paquete creado');
        cerrarModal('modalPaquete');
        paquetes();
    } else {
        showToast(res.message || 'Error al guardar');
    }
}

function _pqError(fieldId, msg) {
    const el  = document.getElementById(fieldId);
    const err = document.getElementById(fieldId + '-error');
    if (el)  el.classList.add('is-invalid');
    if (err) err.textContent = msg;
}

async function togglePaqueteActivo(id) {
    const res = await api('/api/paquetes/toggle-activo', 'DELETE', { id });
    if (res.success) {
        showToast('Estado actualizado');
        paquetes();
    } else {
        showToast(res.message || 'Error al cambiar estado');
    }
}
