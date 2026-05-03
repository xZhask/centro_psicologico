
const ACCESO_MODULOS = {
    administrador: [
        'dashboard','pacientes','profesionales','servicios',
        'citas','calendario','vinculos','atenciones','tareas','alertas',
        'historia','pagos','paquetes','talleres','planillas','reportes','usuarios','administracion'
    ],
    profesional: [
        'dashboard','pacientes','citas','calendario',
        'atenciones','tareas','alertas','historia','reportes','talleres'
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
// DNI Lookup — helpers compartidos (pacientes y profesionales)
// Uso: llamar initDniLookup('pac') o initDniLookup('prof') al abrir
// el modal de alta nueva. Los campos {pfx}Nombres y {pfx}Apellidos
// arrancan en solo-lectura y se desbloquean sólo si no hay resultados.
// ----------------------------------------------------------------
function _lockNombresDni(pfx, lock) {
    [pfx + 'Nombres', pfx + 'Apellidos'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.readOnly = lock;
        el.style.background = lock ? 'var(--color-bg)' : '';
        el.style.cursor     = lock ? 'not-allowed' : '';
    });
}

function _resetDniStatus(pfx) {
    const status = document.getElementById(pfx + 'DniStatus');
    const unlock = document.getElementById(pfx + 'DniUnlockRow');
    if (status) { status.style.display = 'none'; status.innerHTML = ''; }
    if (unlock) unlock.style.display = 'none';
}

function _setDniStatus(pfx, html, color) {
    const el = document.getElementById(pfx + 'DniStatus');
    if (!el) return;
    el.style.display = 'block';
    el.innerHTML = '<span style="color:' + color + '">' + html + '</span>';
}

function initDniLookup(pfx) {
    const dniEl = document.getElementById(pfx + 'Dni');
    if (!dniEl) return;

    // Limpiar listeners previos para evitar duplicados al reabrir el modal
    if (dniEl._dniHandler) {
        dniEl.removeEventListener('input', dniEl._dniHandler);
        delete dniEl._dniTimer;
    }
    if (dniEl._dniKeyHandler) {
        dniEl.removeEventListener('keydown', dniEl._dniKeyHandler);
        dniEl.removeEventListener('paste',   dniEl._dniPasteHandler);
    }

    // Validación de teclado: solo dígitos, max 8 caracteres
    dniEl._dniKeyHandler = e => {
        const allowed = ['Backspace','Delete','Tab','Escape','Enter',
                         'ArrowLeft','ArrowRight','Home','End'];
        if (allowed.includes(e.key)) return;
        if ((e.ctrlKey || e.metaKey) && ['a','c','v','x'].includes(e.key.toLowerCase())) return;
        if (!/^\d$/.test(e.key)) e.preventDefault();
        if (dniEl.value.length >= 8 && !e.ctrlKey && !e.metaKey &&
            dniEl.selectionStart === dniEl.selectionEnd) {
            e.preventDefault();
        }
    };
    dniEl._dniPasteHandler = e => {
        e.preventDefault();
        const text   = (e.clipboardData || window.clipboardData).getData('text');
        const digits = text.replace(/\D/g, '').slice(0, 8);
        const start  = dniEl.selectionStart;
        const end    = dniEl.selectionEnd;
        const newVal = (dniEl.value.slice(0, start) + digits + dniEl.value.slice(end)).slice(0, 8);
        dniEl.value  = newVal;
        dniEl.dispatchEvent(new Event('input'));
    };
    dniEl.addEventListener('keydown', dniEl._dniKeyHandler);
    dniEl.addEventListener('paste',   dniEl._dniPasteHandler);

    let timer;
    dniEl._dniHandler = async () => {
        clearTimeout(timer);
        const dni = dniEl.value.trim();

        // Resetear si el DNI no tiene 8 dígitos exactos (formato peruano)
        if (!/^\d{8}$/.test(dni)) {
            _resetDniStatus(pfx);
            _lockNombresDni(pfx, true);
            document.getElementById(pfx + 'Nombres').value   = '';
            document.getElementById(pfx + 'Apellidos').value = '';
            return;
        }

        timer = setTimeout(async () => {
            _setDniStatus(pfx, 'Consultando…', 'var(--color-text-muted)');

            const res = await api('/api/personas/buscar-dni?dni=' + encodeURIComponent(dni));

            if (res.success && res.data) {
                document.getElementById(pfx + 'Nombres').value   = res.data.nombres   || '';
                document.getElementById(pfx + 'Apellidos').value = res.data.apellidos || '';

                // Si viene de la BD local, rellenar también los campos adicionales del paciente
                if (res.source === 'local' && pfx === 'pac') {
                    const setIfValue = (id, val) => { if (val) { const el = document.getElementById(id); if (el) el.value = val; } };
                    setIfValue('pacFechaNac',  res.data.fecha_nacimiento);
                    setIfValue('pacTelefono',  res.data.telefono);
                    setIfValue('pacEmail',     res.data.email);
                    if (res.data.sexo && res.data.sexo !== 'no_especificado') {
                        const sexoEl = document.getElementById('pacSexo');
                        if (sexoEl) sexoEl.value = res.data.sexo;
                    }
                }

                _lockNombresDni(pfx, true);
                const unlockRow = document.getElementById(pfx + 'DniUnlockRow');
                if (unlockRow) unlockRow.style.display = 'none';

                if (res.source === 'local') {
                    _setDniStatus(pfx,
                        '⚠ Esta persona ya está registrada en el sistema. Los datos que ingrese no serán guardados — se usarán los datos existentes. Verifique que el DNI sea correcto.',
                        'var(--color-warning)');
                } else {
                    _setDniStatus(pfx,
                        '✓ Datos obtenidos correctamente.',
                        'var(--color-success)');
                }
            } else {
                // No encontrado en BD ni en API → posible menor de edad
                document.getElementById(pfx + 'Nombres').value   = '';
                document.getElementById(pfx + 'Apellidos').value = '';
                _lockNombresDni(pfx, true);
                _setDniStatus(pfx,
                    'No se encontraron datos para este DNI.',
                    'var(--color-text-muted)');
                const unlockRow = document.getElementById(pfx + 'DniUnlockRow');
                if (unlockRow) unlockRow.style.display = 'block';
            }
        }, 500);
    };

    dniEl.addEventListener('input', dniEl._dniHandler);

    // Botón de ingreso manual (para menores de edad u otros casos)
    const unlockBtn = document.getElementById(pfx + 'DniUnlock');
    if (unlockBtn) {
        unlockBtn.onclick = () => {
            _lockNombresDni(pfx, false);
            _setDniStatus(pfx, '✏ Ingresando datos manualmente.', 'var(--color-info)');
            const unlockRow = document.getElementById(pfx + 'DniUnlockRow');
            if (unlockRow) unlockRow.style.display = 'none';
            const nombresEl = document.getElementById(pfx + 'Nombres');
            if (nombresEl) nombresEl.focus();
        };
    }
}

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
