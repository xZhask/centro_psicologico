
async function navigate(module){
    // Update active button
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    let btn = document.querySelector(`[data-section="${module}"]`);
    if(btn) btn.classList.add('active');

    // Close sidebar on mobile
    if(window.innerWidth <= 768){
        document.getElementById('sidebar').classList.remove('active');
    }

    // Call module function
    if(typeof window[module] === 'function'){
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

    document.getElementById('userName').innerText = user.nombres + ' ' + user.apellidos;
    document.getElementById('userInfo').innerHTML  = '<small>' + (user.rol || 'Usuario') + '</small>';

    // Mostrar el botón "Usuarios" solo para administradores
    if (user.rol === 'administrador') {
        const navUsuarios = document.getElementById('navUsuarios');
        if (navUsuarios) navUsuarios.style.display = '';
    }

    // Si la cuenta tiene contraseña temporal, forzar cambio antes de continuar
    if (user.debe_cambiar_password) {
        document.getElementById('overlayForzarPassword').classList.remove('hidden');
        return; // No navegar hasta que cambie la contraseña
    }

    navigate('dashboard');
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
