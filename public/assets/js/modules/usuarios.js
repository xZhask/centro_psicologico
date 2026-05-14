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
        document.getElementById('view').innerHTML = `
            <div class="card" style="padding:2rem;text-align:center;color:var(--color-text-muted)">
                Acceso restringido a administradores.
            </div>`;
        return;
    }
    document.getElementById('view').innerHTML = `<div id="usuariosRoot"></div>`;
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

        // Badge de Estado
        const badgeEstado = u.activo
            ? `<span class="badge" style="background:rgba(39,174,96,.1);color:#27AE60;border:1px solid rgba(39,174,96,.2);padding:3px 10px;font-size:11px">ACTIVO</span>`
            : `<span class="badge" style="background:rgba(231,76,60,.1);color:#E74C3C;border:1px solid rgba(231,76,60,.2);padding:3px 10px;font-size:11px">INACTIVO</span>`;

        // Selector de rol en línea (premium)
        const selectorRol = esYo
            ? USR_ROL_BADGE[u.rol] ?? u.rol
            : `<select class="input" style="padding:2px 8px;font-size:12px;width:130px;height:28px;border-radius:6px;background:var(--color-bg);border:1px solid var(--color-border)"
                       onchange="cambiarRolUsuario(${u.id}, this.value, this)">
                   ${USR_ROLES.map(r =>
                       `<option value="${r}" ${r === u.rol ? 'selected' : ''}>${r.charAt(0).toUpperCase()+r.slice(1)}</option>`
                   ).join('')}
               </select>`;

        const flagCambio = u.debe_cambiar_password
            ? `<span style="color:var(--color-warning);cursor:help" title="Debe cambiar contraseña al ingresar">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
               </span>`
            : '';

        // Botón toggle estado
        const btnToggle = esYo ? '' : `
            <button class="btn" style="padding:4px;min-width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center"
                    onclick="toggleUsuarioEstado(${u.id})" title="${u.activo ? 'Desactivar' : 'Activar'}">
                ${u.activo
                    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E74C3C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>'
                    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#27AE60" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>'
                }
            </button>`;

        return `
            <tr style="${u.activo ? '' : 'opacity:.65'}">
                <td>
                    <div style="font-weight:600;display:flex;align-items:center;gap:6px">
                        ${nombre}
                        ${esYo ? '<span style="font-size:10px;background:var(--color-bg);padding:1px 5px;border-radius:4px;color:var(--color-text-muted)">TÚ</span>' : ''}
                        ${flagCambio}
                    </div>
                </td>
                <td style="font-family:monospace;font-size:13px">${escapeHtml(u.dni)}</td>
                <td style="font-size:13px">${u.email ? escapeHtml(u.email) : '<span style="color:var(--color-border)">—</span>'}</td>
                <td>${selectorRol}</td>
                <td>${badgeEstado}</td>
                <td style="font-size:12px;color:var(--color-text-muted)">
                    ${u.ultimo_acceso ? u.ultimo_acceso.slice(0,16).replace('T',' ') : 'Nunca'}
                </td>
                <td>
                    <div style="display:flex;gap:4px">
                        <button class="btn" style="padding:4px;min-width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center"
                                onclick='abrirModalEditarUsuario(${JSON.stringify(u)})' title="Editar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        ${btnToggle}
                    </div>
                </td>
            </tr>`;
    }).join('');

    root.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.75rem">
            <div style="display:flex;align-items:baseline;gap:8px">
                <h2 style="margin:0">Gestión de usuarios</h2>
                <span style="font-size:13px;color:var(--color-text-muted);font-weight:300">· ${lista.length} total</span>
            </div>
            <button class="btn btn-primary" onclick="abrirModalNuevoUsuario()" style="padding:7px 15px;font-size:13px">+ Nuevo usuario</button>
        </div>

        <div class="table-responsive card" style="padding:0">
            <table class="table" style="min-width:900px">
                <thead>
                    <tr>
                        <th>Nombre completo</th>
                        <th>DNI</th>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th>Último acceso</th>
                        <th style="width:100px">Acciones</th>
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
// MODAL — nuevo / editar usuario
// ----------------------------------------------------------------
function abrirModalNuevoUsuario() {
    _resetUserModal();
    document.getElementById('usrId').value = '';
    document.getElementById('usrModalTitle').textContent = 'Nuevo usuario';
    document.getElementById('usrPasswordHint').style.display = 'block';
    document.getElementById('usrPasswordLabel').innerHTML = 'Contraseña temporal <span style="color:var(--color-danger)">*</span>';
    document.getElementById('usrBtnGuardar').textContent = 'Crear usuario';
    
    // Habilitar campos
    document.getElementById('usrDni').readOnly       = false;
    document.getElementById('usrNombres').readOnly   = false;
    document.getElementById('usrApellidos').readOnly = false;

    document.getElementById('modalNuevoUsuario').classList.remove('hidden');
    document.getElementById('usrDni').focus();
}

function abrirModalEditarUsuario(u) {
    _resetUserModal();
    document.getElementById('usrId').value = u.id;
    document.getElementById('usrDni').value = u.dni;
    document.getElementById('usrRol').value = u.rol;
    document.getElementById('usrNombres').value = u.nombres;
    document.getElementById('usrApellidos').value = u.apellidos;
    document.getElementById('usrEmail').value = u.email || '';
    document.getElementById('usrTelefono').value = u.telefono || '';

    document.getElementById('usrModalTitle').textContent = 'Editar usuario';
    document.getElementById('usrPasswordHint').style.display = 'none';
    document.getElementById('usrPasswordLabel').textContent = 'Cambiar contraseña (opcional)';
    document.getElementById('usrBtnGuardar').textContent = 'Guardar cambios';

    // Deshabilitar campos de identidad
    document.getElementById('usrDni').readOnly       = true;
    document.getElementById('usrNombres').readOnly   = true;
    document.getElementById('usrApellidos').readOnly = true;

    document.getElementById('modalNuevoUsuario').classList.remove('hidden');
}


function _resetUserModal() {
    ['usrId','usrDni','usrNombres','usrApellidos','usrEmail','usrTelefono','usrPassword','usrPassword2'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('usrRol').value = 'profesional';
    document.getElementById('usrFormError').textContent = '';
}

async function guardarUsuario() {
    const id        = document.getElementById('usrId').value;
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

    const isEdit = !!id;

    if (!dni || !nombres || !apellidos || !rol) {
        errEl.textContent = 'Complete todos los campos obligatorios.';
        return;
    }
    // Password obligatorio solo en creación
    if (!isEdit && !pass1) {
        errEl.textContent = 'Ingrese una contraseña temporal.';
        return;
    }
    if (pass1 && pass1.length < 6) {
        errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
        return;
    }
    if (pass1 !== pass2) {
        errEl.textContent = 'Las contraseñas no coinciden.';
        return;
    }

    const payload = {
        dni, nombres, apellidos, rol,
        email:    email    || null,
        telefono: telefono || null,
        password: pass1    || null
    };

    let res;
    if (isEdit) {
        payload.usuario_id = parseInt(id);
        res = await api('/api/usuarios', 'PUT', payload);
    } else {
        res = await api('/api/usuarios', 'POST', payload);
    }

    if (res.success) {
        cerrarModal('modalNuevoUsuario');
        showToast(res.message);
        _cargarUsuarios();
    } else {
        errEl.textContent = res.message || 'Error al procesar solicitud.';
    }
}

