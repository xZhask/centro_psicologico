
const ACCESO_MODULOS = {
    administrador: [
        'dashboard','pacientes','profesionales','servicios',
        'citas','calendario','vinculos','atenciones','tareas','alertas',
        'historia','pagos','planillas','reportes','usuarios','administracion'
    ],
    profesional: [
        'dashboard','pacientes','citas','calendario',
        'atenciones','tareas','alertas','historia','reportes'
    ],
    paciente: [
        'dashboard','citas','checkin','tareas'
    ]
};

function aplicarVisibilidadSidebar(rol) {
    document.querySelectorAll('[data-roles]').forEach(el => {
        const roles = el.dataset.roles.split(',');
        el.style.display = roles.includes(rol) ? '' : 'none';
    });
}

function moduloInicial(rol) {
    if (rol === 'paciente')    return 'dashboard';
    if (rol === 'profesional') return 'dashboard';
    return 'dashboard';
}

async function navigate(module) {
    const user = getUser();
    const rol  = user?.rol || '';
    const permitidos = ACCESO_MODULOS[rol] || [];

    if (!permitidos.includes(module)) {
        const view = document.getElementById('view');
        if (view) {
            view.innerHTML = `<div style="padding:3rem;text-align:center;color:var(--color-text-muted)">
                No tienes acceso a este módulo.
            </div>`;
        }
        return;
    }

    // Marcar botón activo
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`[data-section="${module}"]`);
    if (btn) {
        btn.classList.add('active');
        const svgEl    = btn.querySelector('svg');
        const iconEl   = document.getElementById('topbarModuleIcon');
        const nameEl   = document.getElementById('topbarModuleName');
        if (iconEl) iconEl.innerHTML = svgEl ? svgEl.outerHTML : '';
        if (nameEl) nameEl.textContent = btn.textContent.trim();
    }

    // Cerrar sidebar en móvil
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('active');
    }

    // Ejecutar módulo
    if (typeof window[module] === 'function') {
        try {
            await window[module]();
        } catch (error) {
            console.error(`Error al cargar el módulo "${module}"`, error);
            const view = document.getElementById('view');
            if (view) {
                view.innerHTML = '<div class="card" style="padding:2rem;text-align:center;color:var(--color-danger)">No se pudo cargar este módulo.</div>';
            }
            showToast('Ocurrió un error al abrir el módulo');
        }
    }
}

function toggleSidebar(){
    document.getElementById('sidebar').classList.toggle('active');
}

function showToast(msg){
    let t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3000);
}

function cerrarModal(id){
    document.getElementById(id).classList.add('hidden');
}

window.onload = async function () {
    const user = await initAuth();
    if (!user) return; // initAuth ya redirigió a login.html

    // Sidebar user block
    const sidebarRole = document.getElementById('sidebarRole');
    const sidebarName = document.getElementById('sidebarName');
    if (sidebarRole) sidebarRole.textContent = user.rol || 'usuario';
    if (sidebarName) sidebarName.textContent = (user.nombres || '') + ' ' + (user.apellidos || '');

    // Topbar avatar + username + date
    const initials   = ((user.nombres || '')[0] || '') + ((user.apellidos || '')[0] || '');
    const avatarEl   = document.getElementById('topbarAvatar');
    const usernameEl = document.getElementById('topbarUserName');
    const dateEl     = document.getElementById('topbarDate');
    if (avatarEl)   avatarEl.textContent   = initials.toUpperCase();
    if (usernameEl) usernameEl.textContent = (user.nombres || '') + ' ' + (user.apellidos || '');
    if (dateEl)     dateEl.textContent     = new Date().toLocaleDateString('es-PE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    // Alert badge (non-patient only)
    if (user.rol !== 'paciente') {
        api('/api/alertas/conteo').then(r => {
            const badge = document.getElementById('alertaBadge');
            if (!badge) return;
            const count = parseInt(r?.data?.total ?? r?.data ?? 0);
            badge.textContent = count;
            if (count > 0) badge.classList.remove('hidden');
        }).catch(() => {});
    }

    aplicarVisibilidadSidebar(user.rol);

    // Si la cuenta tiene contraseña temporal, forzar cambio antes de continuar
    if (user.debe_cambiar_password) {
        document.getElementById('overlayForzarPassword').classList.remove('hidden');
        return; // No navegar hasta que cambie la contraseña
    }

    navigate(moduloInicial(user.rol));
};

// ----------------------------------------------------------------
// Cambio forzado de contraseña (overlay bloqueante)
// ----------------------------------------------------------------
async function ejecutarCambioForzado() {
    const actual   = document.getElementById('forzarPassActual').value;
    const nueva    = document.getElementById('forzarPassNueva').value;
    const confirma = document.getElementById('forzarPassConfirm').value;
    const errEl    = document.getElementById('forzarPassError');

    errEl.textContent = '';

    if (!actual || !nueva || !confirma) {
        errEl.textContent = 'Complete todos los campos.';
        return;
    }
    if (nueva.length < 6) {
        errEl.textContent = 'La nueva contraseña debe tener al menos 6 caracteres.';
        return;
    }
    if (nueva !== confirma) {
        errEl.textContent = 'Las contraseñas nuevas no coinciden.';
        return;
    }

    const res = await api('/api/usuarios/cambiar-password', 'PUT', {
        password_actual: actual,
        password_nuevo:  nueva,
    });

    if (res.success) {
        document.getElementById('overlayForzarPassword').classList.add('hidden');
        showToast('Contraseña actualizada. ¡Bienvenido!');
        navigate('dashboard');
    } else {
        errEl.textContent = res.message || 'Error al cambiar la contraseña.';
    }
}
