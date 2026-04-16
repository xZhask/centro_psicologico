// ============================================================
// Módulo: Gestión de Usuarios (solo administrador)
// ============================================================

const USR_ROL_BADGE = {
    administrador: '<span class="badge" style="background:#1B4F72;color:#fff">Administrador</span>',
    profesional:   '<span class="badge badge-info">Profesional</span>',
    paciente:      '<span class="badge badge-success">Paciente</span>',
};

const USR_ROLES = ['administrador', 'profesional', 'paciente'];

// ----------------------------------------------------------------
// Entrada del módulo
// ----------------------------------------------------------------
function usuarios() {
    const user = getUser();
    if (!user || user.rol !== 'administrador') {
        document.getElementById('main-content').innerHTML = `
            <div class="card" style="padding:2rem;text-align:center;color:var(--color-text-muted)">
                Acceso restringido a administradores.
            </div>`;
        return;
    }
    document.getElementById('main-content').innerHTML = `<div id="usuariosRoot"></div>`;
    _cargarUsuarios();
}

// ----------------------------------------------------------------
// Listar usuarios
// ----------------------------------------------------------------
async function _cargarUsuarios() {
    const res = await api('/api/usuarios');
    if (!res.success) { showToast('Error al cargar usuarios'); return; }
    _renderTablaUsuarios(res.data);
}

function _renderTablaUsuarios(lista) {
    const root = document.getElementById('usuariosRoot');
    if (!root) return;

    const meId = getUser()?.id;

    const filas = lista.map(u => {
        const esYo   = u.id === meId;
        const nombre = escapeHtml(u.apellidos + ', ' + u.nombres);

        // Toggle activo — deshabilitado para la propia cuenta
        const toggleActivo = esYo
            ? `<span style="color:var(--color-text-muted);font-size:.82rem">—</span>`
            : u.activo
                ? `<button class="btn btn-danger" style="padding:.25rem .6rem;font-size:.78rem"
                           onclick="toggleUsuarioEstado(${u.id})" title="Desactivar">
                       Activo ✓
                   </button>`
                : `<button class="btn" style="padding:.25rem .6rem;font-size:.78rem;border-color:var(--color-success);color:var(--color-success)"
                           onclick="toggleUsuarioEstado(${u.id})" title="Activar">
                       Inactivo
                   </button>`;

        // Selector de rol en línea
        const selectorRol = esYo
            ? USR_ROL_BADGE[u.rol] ?? u.rol
            : `<select class="input" style="padding:.25rem .4rem;font-size:.82rem;width:140px"
                       onchange="cambiarRolUsuario(${u.id}, this.value, this)">
                   ${USR_ROLES.map(r =>
                       `<option value="${r}" ${r === u.rol ? 'selected' : ''}>${r.charAt(0).toUpperCase()+r.slice(1)}</option>`
                   ).join('')}
               </select>`;

        const flagCambio = u.debe_cambiar_password
            ? `<span class="badge badge-warning-solid" title="Debe cambiar contraseña al ingresar">
                   ⚠ Temp
               </span>`
            : '';

        return `
            <tr style="${u.activo ? '' : 'opacity:.55'}">
                <td>
                    ${nombre}
                    ${esYo ? '<span style="font-size:.78rem;color:var(--color-text-muted)">(tú)</span>' : ''}
                </td>
                <td style="font-family:monospace">${escapeHtml(u.dni)}</td>
                <td style="font-size:.88rem">${u.email ? escapeHtml(u.email) : '—'}</td>
                <td>${selectorRol}</td>
                <td>${toggleActivo}</td>
                <td>${flagCambio}</td>
                <td style="font-size:.82rem;color:var(--color-text-muted)">
                    ${u.ultimo_acceso ? u.ultimo_acceso.slice(0,16).replace('T',' ') : 'Nunca'}
                </td>
            </tr>`;
    }).join('');

    root.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;flex-wrap:wrap;gap:.75rem">
            <h2 style="margin:0">Gestión de usuarios</h2>
            <button class="btn btn-primary" onclick="abrirModalNuevoUsuario()">+ Nuevo usuario</button>
        </div>

        <div class="card" style="padding:0;overflow-x:auto">
            <table class="table" style="min-width:800px">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>DNI</th>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th>Contraseña</th>
                        <th>Último acceso</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
}

// ----------------------------------------------------------------
// Cambiar rol (inline select)
// ----------------------------------------------------------------
async function cambiarRolUsuario(usuarioId, nuevoRol, selectEl) {
    const res = await api('/api/usuarios/rol', 'PUT', {
        usuario_id: usuarioId,
        rol:        nuevoRol,
    });
    if (res.success) {
        showToast('Rol actualizado');
    } else {
        showToast(res.message || 'Error al actualizar rol');
        // Recargar para restaurar el valor anterior
        _cargarUsuarios();
    }
}

// ----------------------------------------------------------------
// Toggle activo / inactivo
// ----------------------------------------------------------------
async function toggleUsuarioEstado(usuarioId) {
    const accion = confirm('¿Cambiar el estado de este usuario?');
    if (!accion) return;
    const res = await api('/api/usuarios/estado', 'PUT', { usuario_id: usuarioId });
    if (res.success) {
        showToast('Estado actualizado');
        _cargarUsuarios();
    } else {
        showToast(res.message || 'Error al actualizar estado');
    }
}

// ----------------------------------------------------------------
// MODAL — nuevo usuario
// ----------------------------------------------------------------
function abrirModalNuevoUsuario() {
    document.getElementById('usrDni').value       = '';
    document.getElementById('usrNombres').value   = '';
    document.getElementById('usrApellidos').value = '';
    document.getElementById('usrEmail').value     = '';
    document.getElementById('usrTelefono').value  = '';
    document.getElementById('usrRol').value       = 'profesional';
    document.getElementById('usrPassword').value  = '';
    document.getElementById('usrPassword2').value = '';
    document.getElementById('usrFormError').textContent = '';
    document.getElementById('modalNuevoUsuario').classList.remove('hidden');
    document.getElementById('usrDni').focus();
}

async function guardarNuevoUsuario() {
    const dni       = document.getElementById('usrDni').value.trim();
    const nombres   = document.getElementById('usrNombres').value.trim();
    const apellidos = document.getElementById('usrApellidos').value.trim();
    const email     = document.getElementById('usrEmail').value.trim();
    const telefono  = document.getElementById('usrTelefono').value.trim();
    const rol       = document.getElementById('usrRol').value;
    const pass1     = document.getElementById('usrPassword').value;
    const pass2     = document.getElementById('usrPassword2').value;
    const errEl     = document.getElementById('usrFormError');

    errEl.textContent = '';

    if (!dni || !nombres || !apellidos || !rol || !pass1) {
        errEl.textContent = 'Complete todos los campos obligatorios.';
        return;
    }
    if (pass1.length < 6) {
        errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
        return;
    }
    if (pass1 !== pass2) {
        errEl.textContent = 'Las contraseñas no coinciden.';
        return;
    }

    const res = await api('/api/usuarios', 'POST', {
        dni, nombres, apellidos,
        email:    email    || null,
        telefono: telefono || null,
        rol,
        password: pass1,
    });

    if (res.success) {
        cerrarModal('modalNuevoUsuario');
        showToast(res.message);
        _cargarUsuarios();
    } else {
        errEl.textContent = res.message || 'Error al crear usuario.';
    }
}
