
// Contexto de la cita seleccionada para gestión de atención
let _citaActiva = null;

// Timer de debounce para el combobox de paciente
let _pacienteBusquedaTimer = null;

// Estado del modal de nueva cita
let _citaModalidad   = 'presencial';
let _citaUsarPaquete = false;
let _citaContexto    = null;
let _contratarPaquete = false;
let _gSesionPrecio   = 0;
let _isSavingCita    = false;

// Callback para refrescar citas tras registrar un pago desde este módulo
let _citasPagoCallback = null;

// Estado CIE-10 en modal "Abrir nueva atención" (desde gestión de cita)
let _gAtDxTimer   = null;
let _gAtDxResults = [];
let _gAtDxList    = [];  // [{ codigo, descripcion, jerarquia, nivel_certeza }]
let _gAtFechaNacimiento = '';  // fecha_nacimiento cacheada del paciente titular

// ---- Toggle readonly para campos del modal de gestión ----

function _gAtToggleReadonly(fieldId, isReadonly, value = '') {
    const input = document.getElementById(fieldId);
    if (!input) return;
    let rd = document.getElementById(fieldId + '-readonly');
    if (isReadonly) {
        input.classList.add('hidden');
        if (!rd) {
            rd = document.createElement('div');
            rd.id = fieldId + '-readonly';
            rd.className = 'readonly-field';
            input.parentNode.insertBefore(rd, input.nextSibling);
        }
        rd.textContent = value;
        rd.classList.remove('hidden');
    } else {
        input.classList.remove('hidden');
        if (rd) rd.classList.add('hidden');
    }
}

// ---- Helpers de validación inline ----

function setCitaError(fieldId, message) {
    const el    = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (el)    el.classList.toggle('is-invalid', !!message);
    if (errEl) errEl.textContent = message || '';
}

function clearCitaErrors() {
    ['citaProfesionalNA', 'citaServicio', 'citaSubservicioNA', 'citaFechaNA',
     'citaProfesionalSE', 'citaAtencionSE', 'citaFechaSE', 'citaPrecio']
        .forEach(id => setCitaError(id, ''));
    const errPac  = document.getElementById('citaPacienteId-error');
    const errTipo = document.getElementById('citaTipo-error');
    const combo   = document.getElementById('citaPacienteCombo');
    if (errPac)  errPac.textContent  = '';
    if (errTipo) errTipo.textContent = '';
    if (combo)   combo.classList.remove('is-invalid');
}

// ---- Habilitación de radio cards según paciente ----

function _deshabilitarRadioCards() {
    ['rcNuevaAtencion', 'rcSesionExistente'].forEach(id => {
        const card = document.getElementById(id);
        if (!card) return;
        card.classList.add('radio-card-disabled');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.disabled = true;
    });
}

async function _actualizarEstadoBotonesTipoCita(pacienteId) {
    const cardNA  = document.getElementById('rcNuevaAtencion');
    const cardSE  = document.getElementById('rcSesionExistente');
    const radioNA = cardNA?.querySelector('input[type="radio"]');
    const radioSE = cardSE?.querySelector('input[type="radio"]');

    // Siempre habilitar "nueva atención" cuando hay paciente
    if (cardNA) cardNA.classList.remove('radio-card-disabled');
    if (radioNA) radioNA.disabled = false;

    const res = await api(`/api/atenciones/paciente?paciente_id=${pacienteId}`);
    const tieneActivas = (res.data || []).some(a => a.estado === 'activa');

    if (tieneActivas) {
        if (cardSE) cardSE.classList.remove('radio-card-disabled');
        if (radioSE) radioSE.disabled = false;
    } else {
        if (cardSE) cardSE.classList.add('radio-card-disabled');
        if (radioSE) radioSE.disabled = true;
        // Si "sesión existente" estaba seleccionada, resetear el tipo
        if (radioSE?.checked) {
            radioSE.checked = false;
            cardSE?.classList.remove('selected');
            document.getElementById('citaCamposSesionExistente')?.classList.remove('visible');
            const hayTipo = document.querySelector('input[name="citaTipo"]:checked');
            if (!hayTipo) {
                ['citaSepCuandoComo','citaCamposFechaModalidad','citaSepContratarPaquete',
                 'citaContratarPaqueteSection','citaSepPrecio','citaCamposPrecio'].forEach(sid => {
                    const el = document.getElementById(sid);
                    if (el) el.style.display = 'none';
                });
            }
        }
    }
}

// ---- Combobox de paciente ----

function limpiarPacienteCita() {
    const input  = document.getElementById('citaPacienteInput');
    const hidden = document.getElementById('citaPacienteId');
    const clear  = document.getElementById('citaPacienteClear');
    const lista  = document.getElementById('citaPacienteLista');
    const combo  = document.getElementById('citaPacienteCombo');
    if (input)  input.value = '';
    if (hidden) hidden.value = '';
    if (clear)  clear.classList.add('hidden');
    if (lista)  { lista.innerHTML = ''; lista.classList.add('hidden'); }
    if (combo)  combo.classList.remove('is-invalid');
    const err = document.getElementById('citaPacienteId-error');
    if (err) err.textContent = '';
    _limpiarSeccionPaquete();

    // Deshabilitar radio cards y resetear tipo de cita
    _deshabilitarRadioCards();
    document.querySelectorAll('input[name="citaTipo"]').forEach(r => r.checked = false);
    document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('citaCamposNuevaAtencion')?.classList.remove('visible');
    document.getElementById('citaCamposSesionExistente')?.classList.remove('visible');
    ['citaSepCuandoComo','citaCamposFechaModalidad','citaSepContratarPaquete',
     'citaContratarPaqueteSection','citaSepPrecio','citaCamposPrecio'].forEach(sid => {
        const el = document.getElementById(sid);
        if (el) el.style.display = 'none';
    });
}

async function buscarPacientesCita(termino) {
    const lista = document.getElementById('citaPacienteLista');
    if (termino.length < 2) {
        lista.classList.add('hidden');
        return;
    }
    lista.innerHTML = '<li class="combobox-item disabled">Buscando…</li>';
    lista.classList.remove('hidden');

    const res       = await api(`/api/pacientes?q=${encodeURIComponent(termino)}`);
    const pacientes = res.data || [];
    lista.innerHTML = '';

    if (pacientes.length === 0) {
        lista.innerHTML = `
            <li class="combobox-item disabled">No se encontraron pacientes</li>
            <li class="combobox-item combobox-new" onclick="irARegistrarPaciente()">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:-1px;margin-right:5px"><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/></svg>Registrar nuevo paciente
            </li>`;
    } else {
        pacientes.forEach(p => {
            const li        = document.createElement('li');
            li.className    = 'combobox-item';
            li.textContent  = `${p.apellidos}, ${p.nombres} — ${p.dni}`;
            li.onclick      = () => seleccionarPacienteCita(p.id, li.textContent);
            lista.appendChild(li);
        });
    }
}

function seleccionarPacienteCita(id, nombre) {
    document.getElementById('citaPacienteId').value    = id;
    document.getElementById('citaPacienteInput').value = nombre;
    document.getElementById('citaPacienteClear').classList.remove('hidden');
    const lista = document.getElementById('citaPacienteLista');
    lista.innerHTML = '';
    lista.classList.add('hidden');
    document.getElementById('citaPacienteCombo').classList.remove('is-invalid');
    document.getElementById('citaPacienteId-error').textContent = '';

    // Para profesional en sesion_existente: cargar atenciones automáticamente
    if (getUser()?.rol === 'profesional') {
        const tipoCita = document.querySelector('input[name="citaTipo"]:checked')?.value;
        if (tipoCita === 'sesion_existente') {
            onProfesionalSesionChange();
        }
    }

    // Habilitar radio cards según si el paciente tiene atenciones activas
    _actualizarEstadoBotonesTipoCita(id);

    // Cargar contexto de paquete para el paciente seleccionado
    const tipo         = document.querySelector('input[name="citaTipo"]:checked')?.value;
    const profesionalId = _getCitaProfesionalIdActual();
    const atencionId   = tipo === 'sesion_existente'
        ? parseInt(document.getElementById('citaAtencionSE').value, 10) || 0
        : 0;
    cargarContextoPaquete(id, profesionalId, atencionId);
}

function irARegistrarPaciente() {
    const input = document.getElementById('citaPacienteInput');
    const dniO  = input ? input.value.trim() : '';
    // Cierra solo la lista, el modal de citas queda abierto detrás
    const lista = document.getElementById('citaPacienteLista');
    if (lista) { lista.innerHTML = ''; lista.classList.add('hidden'); }
    abrirModalPacienteRapido(dniO);
}

// ---- Modal registro rápido de paciente ----

function abrirModalPacienteRapido(dniInicial = '') {
    ['rpDni', 'rpNombres', 'rpApellidos', 'rpTelefono', 'rpEmail'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['rpDni', 'rpNombres', 'rpApellidos'].forEach(id => {
        document.getElementById(id)?.classList.remove('is-invalid');
        const err = document.getElementById(id + '-error');
        if (err) err.textContent = '';
    });
    const btnAnterior = document.getElementById('rpBtnBuscarDni');
    if (btnAnterior) btnAnterior.remove();

    _lockNombresDni('rp', true);
    _resetDniStatus('rp');
    initDniLookup('rp');

    const rpDni = document.getElementById('rpDni');
    if (dniInicial && rpDni) {
        rpDni.value = dniInicial;
        rpDni.dispatchEvent(new Event('input'));
    }

    document.getElementById('modalPacienteRapido').classList.remove('hidden');
    if (rpDni) rpDni.focus();
}

function cancelarPacienteRapido() {
    document.getElementById('modalPacienteRapido').classList.add('hidden');
    document.getElementById('citaPacienteInput')?.focus();
}

function setRpError(fieldId, message) {
    const el  = document.getElementById(fieldId);
    const err = document.getElementById(fieldId + '-error');
    if (el)  el.classList.toggle('is-invalid', !!message);
    if (err) err.textContent = message || '';
}

async function guardarPacienteRapido() {
    ['rpDni', 'rpNombres', 'rpApellidos'].forEach(id => {
        document.getElementById(id)?.classList.remove('is-invalid');
        const err = document.getElementById(id + '-error');
        if (err) err.textContent = '';
    });
    const btnAnterior = document.getElementById('rpBtnBuscarDni');
    if (btnAnterior) btnAnterior.remove();

    const dni       = document.getElementById('rpDni').value.trim();
    const nombres   = document.getElementById('rpNombres').value.trim();
    const apellidos = document.getElementById('rpApellidos').value.trim();
    const telefono  = document.getElementById('rpTelefono').value.trim();
    const email     = document.getElementById('rpEmail').value.trim();

    let valido = true;
    if (!dni)                       { setRpError('rpDni', 'El DNI es requerido');              valido = false; }
    else if (!/^\d{8}$/.test(dni))  { setRpError('rpDni', 'El DNI debe tener exactamente 8 dígitos'); valido = false; }
    if (!nombres)   { setRpError('rpNombres',   'Los nombres son requeridos');   valido = false; }
    if (!apellidos) { setRpError('rpApellidos', 'Los apellidos son requeridos'); valido = false; }
    if (!valido) return;

    const res = await api('/api/pacientes', 'POST', {
        dni,
        nombres,
        apellidos,
        telefono: telefono || null,
        email:    email    || null,
    });

    if (res.success) {
        const label = `${res.data.apellidos}, ${res.data.nombres}`;
        seleccionarPacienteCita(res.data.id, label);
        document.getElementById('modalPacienteRapido').classList.add('hidden');
        showToast('Paciente registrado');
    } else {
        const esDniDuplicado = res.message && res.message.toLowerCase().includes('dni');
        if (esDniDuplicado) {
            setRpError('rpDni', 'Este DNI ya está registrado');
            const errEl = document.getElementById('rpDni-error');
            if (errEl) {
                const btn       = document.createElement('button');
                btn.id          = 'rpBtnBuscarDni';
                btn.type        = 'button';
                btn.className   = 'btn-link';
                btn.textContent = 'Buscar este paciente';
                btn.onclick     = () => buscarPacienteExistente(dni);
                errEl.after(btn);
            }
        } else {
            showToast(res.message || 'Error al registrar paciente');
        }
    }
}

function buscarPacienteExistente(dni) {
    document.getElementById('modalPacienteRapido').classList.add('hidden');
    const input = document.getElementById('citaPacienteInput');
    if (input) {
        input.value = dni;
        buscarPacientesCita(dni);
        input.focus();
    }
}

function setReprogError(fieldId, message) {
    const el    = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (el)    el.classList.toggle('is-invalid', !!message);
    if (errEl) errEl.textContent = message || '';
}

function onCitaSubservicioChange() {
    actualizarPrecioBase();
}

// ---- Helpers del modal de cita ----

function _getCitaProfesionalIdActual() {
    const tipo = document.querySelector('input[name="citaTipo"]:checked')?.value;
    const user = getUser();
    if (user?.rol === 'profesional') return user.profesional_id || 0;
    if (tipo === 'nueva_atencion')   return parseInt(document.getElementById('citaProfesionalNA')?.value, 10) || 0;
    if (tipo === 'sesion_existente') return parseInt(document.getElementById('citaProfesionalSE')?.value, 10) || 0;
    return 0;
}

function _limpiarSeccionPaquete() {
    const sep     = document.getElementById('citaSepPaquete');
    const section = document.getElementById('citaPaqueteSection');
    if (sep)     sep.style.display     = 'none';
    if (section) section.style.display = 'none';

    // Restaurar sección de contratar paquete (solo si tiene sentido)
    const tipo = document.querySelector('input[name="citaTipo"]:checked')?.value;
    const sepContratar = document.getElementById('citaSepContratarPaquete');
    const secContratar = document.getElementById('citaContratarPaqueteSection');
    if (tipo === 'nueva_atencion') {
        // Para nueva atención siempre se puede contratar
        if (sepContratar) sepContratar.style.display = '';
        if (secContratar) secContratar.style.display = '';
    } else if (tipo === 'sesion_existente') {
        // Para sesión existente: mostrar contratar solo si hay una atención seleccionada
        const atencionId = parseInt(document.getElementById('citaAtencionSE')?.value, 10) || 0;
        if (atencionId > 0) {
            if (sepContratar) sepContratar.style.display = '';
            if (secContratar) secContratar.style.display = '';
        }
    }

    // Restaurar readonly de precios
    const citaPrecio = document.getElementById('citaPrecio');
    const citaDescuento = document.getElementById('citaDescuento');
    if (citaPrecio) {
        citaPrecio.readOnly = false;
        citaPrecio.style.backgroundColor = '';
    }
    if (citaDescuento) {
        citaDescuento.readOnly = false;
        citaDescuento.style.backgroundColor = '';
    }

    _citaUsarPaquete = false;
    _citaContexto    = null;
}

function setModalidadCita(m) {
    _citaModalidad = m;
    document.getElementById('btnModalidadPresencial')?.classList.toggle('active', m === 'presencial');
    document.getElementById('btnModalidadVirtual')?.classList.toggle('active', m === 'virtual');
    const hint = document.getElementById('citaVirtualHint');
    if (hint) hint.style.display = m === 'virtual' ? 'flex' : 'none';
    actualizarPrecioBase();
}

// toggleUsarPaquete removido (el paquete siempre se aplica)

function actualizarPrecioBase() {
    const tipo = document.querySelector('input[name="citaTipo"]:checked')?.value;
    let precioBase  = 0;
    let descVirtual = 10;

    if (tipo === 'nueva_atencion') {
        const sel = document.getElementById('citaSubservicioNA');
        const opt = sel?.options[sel.selectedIndex];
        if (opt && sel?.value) {
            precioBase  = parseFloat(opt.dataset.precio)           || 0;
            descVirtual = parseFloat(opt.dataset.descuentoVirtual) || 10;
        }
    } else if (tipo === 'sesion_existente') {
        const selAt = document.getElementById('citaAtencionSE');
        const optAt = selAt?.options[selAt.selectedIndex];
        if (optAt && selAt?.value) {
            precioBase  = parseFloat(optAt.dataset.precioBase)      || 0;
            descVirtual = parseFloat(optAt.dataset.descuentoVirtual) || 10;
        }
    }

    const precioVirtual = Math.max(0, precioBase - descVirtual);

    const refEl = document.getElementById('citaPrecioRefTexto');
    if (refEl) {
        refEl.innerHTML = `Precio base: <strong>S/ ${precioBase.toFixed(2)} presencial · S/ ${precioVirtual.toFixed(2)} virtual</strong>`;
    }

    const descText = document.getElementById('citaVirtualDescText');
    if (descText) descText.textContent = `S/${descVirtual.toFixed(0)}`;

    // Pre-llenar el precio acordado según la modalidad activa
    // Solo si no hay paquete controlando el precio
    const paqueteControla = _citaUsarPaquete
        || (_contratarPaquete && document.getElementById('paqueteContratarId')?.value);
    const precioActual = _citaModalidad === 'virtual' ? precioVirtual : precioBase;
    const inputPrecio  = document.getElementById('citaPrecio');
    if (inputPrecio && precioActual > 0 && !paqueteControla) {
        inputPrecio.value = precioActual.toFixed(2);
    }
    calcularPrecioFinal();
}

function calcularPrecioFinal() {
    const precio = parseFloat(document.getElementById('citaPrecio')?.value)    || 0;
    const desc   = parseFloat(document.getElementById('citaDescuento')?.value) || 0;
    const final  = Math.max(0, precio - desc);
    const el     = document.getElementById('citaPrecioFinalValor');
    const row    = document.getElementById('citaPrecioFinalPreview');
    const wrap   = document.getElementById('motivoDescWrap');
    if (el)   el.textContent    = `S/ ${final.toFixed(2)}`;
    if (row)  row.style.display = desc > 0 ? 'flex' : 'none';
    if (wrap) wrap.style.display = desc > 0 ? 'block' : 'none';
}

async function cargarContextoPaquete(pacienteId, profesionalId, atencionId) {
    if (!pacienteId || pacienteId <= 0 || !atencionId || atencionId <= 0) {
        _limpiarSeccionPaquete();
        return;
    }
    try {
        const qs  = `paciente_id=${pacienteId}`
            + (profesionalId ? `&profesional_id=${profesionalId}` : '')
            + (atencionId    ? `&atencion_id=${atencionId}`       : '');
        const res = await api(`/api/sesiones/contexto?${qs}`);
        _citaContexto = res.success ? (res.data || null) : null;

        const paquete = _citaContexto?.paquete_activo;
        // Usar sesiones_disponibles (descuenta citas ya agendadas) para decidir si mostrar el paquete
        const sesionesDisponibles = paquete?.sesiones_disponibles ?? paquete?.sesiones_restantes ?? 0;
        if (paquete && sesionesDisponibles > 0) {
            document.getElementById('citaSepPaquete').style.display     = '';
            document.getElementById('citaPaqueteSection').style.display = '';

            // Ocultar sección de contratar paquete
            const sepContratar = document.getElementById('citaSepContratarPaquete');
            const secContratar = document.getElementById('citaContratarPaqueteSection');
            if (sepContratar) sepContratar.style.display = 'none';
            if (secContratar) secContratar.style.display = 'none';

            _citaUsarPaquete = true;

            const badge = document.getElementById('citaPaqueteBadge');
            if (badge) {
                const nombre = paquete.nombre || 'Paquete';
                badge.textContent = `Paquete: ${nombre} · ${sesionesDisponibles} sesiones disponibles`;
            }

            // Precio = precio del paquete / sesiones incluidas
            const precioPorSesion = paquete.precio_por_sesion ?? 0;
            const citaPrecio = document.getElementById('citaPrecio');
            const citaDescuento = document.getElementById('citaDescuento');
            if (citaPrecio) {
                citaPrecio.value = precioPorSesion.toFixed(2);
                citaPrecio.readOnly = true;
                citaPrecio.style.backgroundColor = 'var(--color-bg)';
            }
            if (citaDescuento) {
                citaDescuento.value = '0.00';
                citaDescuento.readOnly = true;
                citaDescuento.style.backgroundColor = 'var(--color-bg)';
            }
            calcularPrecioFinal();
        } else {
            _limpiarSeccionPaquete();
        }
    } catch {
        _limpiarSeccionPaquete();
    }
}

async function onAtencionSEChange() {
    const atencionId = parseInt(document.getElementById('citaAtencionSE').value, 10) || 0;

    if (!atencionId) {
        // No hay atención seleccionada: ocultar secciones de paquete y precio
        document.getElementById('citaSepContratarPaquete').style.display     = 'none';
        document.getElementById('citaContratarPaqueteSection').style.display = 'none';
        document.getElementById('citaSepPrecio').style.display               = 'none';
        document.getElementById('citaCamposPrecio').style.display            = 'none';
        document.getElementById('citaSepPaquete').style.display              = 'none';
        document.getElementById('citaPaqueteSection').style.display          = 'none';
        _citaUsarPaquete = false;
        _citaContexto    = null;
        return;
    }

    // Atención seleccionada: mostrar precio y cargar contexto de paquete
    document.getElementById('citaSepPrecio').style.display    = '';
    document.getElementById('citaCamposPrecio').style.display = '';
    actualizarPrecioBase();

    const pacienteId    = parseInt(document.getElementById('citaPacienteId').value, 10) || 0;
    const profesionalId = _getCitaProfesionalIdActual();
    await cargarContextoPaquete(pacienteId, profesionalId, atencionId);
}

// ---- Vista principal — estado de filtros ----

const _citasFiltros = {
    q:            '',
    fecha_desde:  '',
    fecha_hasta:  '',
    estado:       '',
    profesional_id: '',
    modalidad:    '',
    tipo:         '',
    chip:         'semana',
    panelOpen:    false,
    rangoOpen:    false,
};

let _citasTodas = [];   // cache del último resultado para paginación cliente

let _citasBusquedaTimer = null;
let _citasProfesionales = [];

function _hoyISO() {
    const d = new Date();
    return d.toLocaleDateString('en-CA');  // YYYY-MM-DD
}

function _addDias(iso, n) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString('en-CA');
}

function _domingoSemana(iso) {
    const d = new Date(iso + 'T00:00:00');
    const dia = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const diasHastaDomingo = dia === 0 ? 0 : 7 - dia;
    d.setDate(d.getDate() + diasHastaDomingo);
    return d.toLocaleDateString('en-CA');
}

function _primerDiaMes(iso) {
    return iso.slice(0, 7) + '-01';
}

function _ultimoDiaMes(iso) {
    const [y, m] = iso.slice(0, 7).split('-').map(Number);
    return new Date(y, m, 0).toLocaleDateString('en-CA');
}

function _aplicarChip(chip) {
    const hoy = _hoyISO();
    _citasFiltros.chip = chip;
    switch (chip) {
        case 'hoy':
            _citasFiltros.fecha_desde = hoy;
            _citasFiltros.fecha_hasta = hoy;
            break;
        case 'manana': {
            const m = _addDias(hoy, 1);
            _citasFiltros.fecha_desde = m;
            _citasFiltros.fecha_hasta = m;
            break;
        }
        case 'semana':
            _citasFiltros.fecha_desde = hoy;
            _citasFiltros.fecha_hasta = _domingoSemana(hoy) || _addDias(hoy, 6);
            break;
        case '7dias':
            _citasFiltros.fecha_desde = hoy;
            _citasFiltros.fecha_hasta = _addDias(hoy, 7);
            break;
        case 'mes':
            _citasFiltros.fecha_desde = _primerDiaMes(hoy);
            _citasFiltros.fecha_hasta = _ultimoDiaMes(hoy);
            break;
        case 'custom':
            break;
    }
}

function _contarFiltrosActivos() {
    let n = 0;
    if (_citasFiltros.estado)       n++;
    if (_citasFiltros.profesional_id) n++;
    if (_citasFiltros.modalidad && _citasFiltros.modalidad !== 'todas') n++;
    if (_citasFiltros.tipo     && _citasFiltros.tipo     !== 'todas') n++;
    return n;
}

function _formatHora(dt) {
    if (!dt) return '';
    const d = new Date(dt.replace(' ', 'T'));
    return isNaN(d) ? '' : d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function _formatFechaGrupo(isoDate) {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function _textoRelativo(dt) {
    if (!dt) return '';
    const d    = new Date(dt.replace(' ', 'T'));
    if (isNaN(d)) return '';
    const hoy  = new Date(); hoy.setHours(0, 0, 0, 0);
    const man  = new Date(hoy); man.setDate(man.getDate() + 1);
    const msEn = d - new Date();
    const dayD = new Date(d); dayD.setHours(0, 0, 0, 0);

    if (dayD.getTime() === hoy.getTime()) {
        if (msEn < 0) return '';
        const mins = Math.floor(msEn / 60000);
        if (mins < 60) return `en ${mins} min`;
        return `en ${Math.floor(mins / 60)} h`;
    }
    if (dayD.getTime() === man.getTime()) return 'mañana';
    const dias = Math.round((dayD - hoy) / 86400000);
    if (dias > 0 && dias <= 7) return `en ${dias} días`;
    return '';
}

function _iniciales(nombre) {
    return (nombre || '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function _nombreCorto(nombreCompleto) {
    const partes = (nombreCompleto || '').trim().split(/\s+/);
    if (partes.length < 2) return nombreCompleto;
    const primerNombre    = partes[0];
    const inicialSegundo  = partes[1] ? partes[1][0] + '.' : '';
    const primerApellido  = partes[2] || partes[1];
    return inicialSegundo && partes.length > 2
        ? `${primerNombre} ${inicialSegundo} ${primerApellido}`
        : `${primerNombre} ${primerApellido}`;
}

function _truncar(str, max) {
    return str && str.length > max ? str.slice(0, max) + '…' : (str || '');
}

const ESTADO_BADGE = {
    pendiente:    'badge-pendiente',
    confirmada:   'badge-confirmada',
    completada:   'badge-completada',
    cancelada:    'badge-cancelada',
    no_asistio:   'badge-warning',
    reprogramada: 'badge-reprogramada',
};
const ESTADO_LABEL = {
    pendiente: 'Pendiente', confirmada: 'Confirmada', completada: 'Completada',
    cancelada: 'Cancelada', no_asistio: 'No asistió', reprogramada: 'Reprogramada',
};

function _renderBtnPrimario(c, esProfOAdmin) {
    const id = c.cita_id || c.id;
    const estado = c.estado || 'pendiente';
    const cob = typeof c.cobertura === 'string' ? JSON.parse(c.cobertura) : (c.cobertura || {});
    const hoy = _hoyISO();
    const fechaDt = (c.fecha_hora_inicio || '').slice(0, 10);
    const esHoyOAntes = fechaDt <= hoy;

    if (!esProfOAdmin) return '';
    if (['cancelada', 'reprogramada'].includes(estado)) return '';

    // 1. Completada -> Ver atención
    if (estado === 'completada') {
        return `<button class="cita-btn-primary" title="Ver atención registrada"
                    onclick="event.stopPropagation();navegarAtencion(${c.atencion_id||0})">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>
                    Ver
                </button>`;
    }

    // 2. Pendiente -> SIEMPRE Confirmar (paso administrativo inicial)
    if (estado === 'pendiente') {
        return `<button class="cita-btn-primary" title="Confirmar cita"
                    onclick="event.stopPropagation();cambiarEstadoCita(${id},'confirmada')">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 8 6 12 14 4"/></svg>
                    Confirmar
                </button>`;
    }

    // 3. Confirmada -> Evaluar Cobro o Atención
    if (estado === 'confirmada') {
        const pId  = c.paciente_id || 0;
        const pNom = (c.paciente || '').replace(/'/g, "\\'");
        const sub  = (c.subservicio || '').replace(/'/g, "\\'");
        const prec = parseFloat(c.precio_acordado || 0);

        // A. Si NO tiene cobertura -> Botón Pagar (Reemplaza a Confirmar)
        if (!cob.habilitada_para_registro) {
            if (cob.cuenta_id) {
                return `<button class="cita-btn-pay" title="Registrar pago para habilitar atención"
                            onclick="event.stopPropagation();abrirPagoCita(${id},${cob.cuenta_id},${pId},'${pNom}',${prec},${parseFloat(cob.cuenta_saldo)},'${sub}')">
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="14" height="9" rx="1.5"/><line x1="1" y1="8" x2="15" y2="8"/></svg>
                            Pagar
                        </button>`;
            } else {
                return `<button class="cita-btn-pay" title="Registrar pago para habilitar atención"
                            onclick="event.stopPropagation();abrirPagoDirectoCita(${id},${pId},'${pNom}',${prec},'${sub}')">
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="14" height="9" rx="1.5"/><line x1="1" y1="8" x2="15" y2="8"/></svg>
                            Pagar
                        </button>`;
            }
        }

        // B. SI tiene cobertura y es hoy/antes -> Botón Atención/Sesión
        if (esHoyOAntes) {
            const tipoCitaEsc  = (c.tipo_cita        || '').replace(/'/g, '');
            const subservEsc   = (c.subservicio      || '').replace(/'/g, '');
            const motivoEsc    = (c.motivo_descuento || '').replace(/'/g, '');
            const modalidadEsc = (c.modalidad_sesion || 'presencial').replace(/'/g, '');
            const fechaEsc     = (c.fecha_hora_inicio|| '').replace(/'/g, '');
            const profEsc      = (c.profesional      || '').replace(/'/g, '');
            const label        = c.tipo_cita === 'sesion_existente' ? 'Sesión' : 'Atención';

            return `<button class="cita-btn-primary" title="Registrar ${label}"
                        onclick="event.stopPropagation();abrirModalGestionAtencion(${id},${pId},${c.profesional_id||0},'${fechaEsc}','${tipoCitaEsc}',${c.atencion_id||0},${c.subservicio_id||0},${c.duracion_min||50},${parseFloat(c.precio_base)||0},'${pNom}','${profEsc}','${subservEsc}',${prec},${parseFloat(c.descuento_monto)||0},'${motivoEsc}','${modalidadEsc}','${c.subservicio_modalidad||'individual'}')">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M5 4a3 3 0 1 1 6 0 3 3 0 0 1-6 0z"/><path d="M2 14c0-3 2-5 5-5"/><path d="M9 12l2 2 4-4"/>
                        </svg>
                        ${label}
                    </button>`;
        }
    }

    return '';
}



function _renderDropdown(c, esProfOAdmin, esAdmin) {
    const id         = c.cita_id || c.id;
    const estado     = c.estado  || 'pendiente';
    const cuentaId   = c.cuenta_cobro_id ? parseInt(c.cuenta_cobro_id) : null;
    const estadoCobro= c.estado_cobro || 'sin_cobro';
    const tieneCobro = (estadoCobro === 'pendiente' || estadoCobro === 'parcial') && cuentaId;

    const tipoCitaEsc  = (c.tipo_cita        || '').replace(/'/g, '');
    const pacienteEsc2 = (c.paciente         || '').replace(/'/g, '');
    const profEsc      = (c.profesional      || '').replace(/'/g, '');
    const subservEsc   = (c.subservicio      || '').replace(/'/g, '');
    const motivoEsc    = (c.motivo_descuento || '').replace(/'/g, '');
    const modalidadEsc = (c.modalidad_sesion || 'presencial').replace(/'/g, '');
    const fechaEsc     = (c.fecha_hora_inicio|| '').replace(/'/g, '');
    const precioCita   = c.precio_acordado != null ? parseFloat(c.precio_acordado) : 'null';

    let items = '';

    if (estado === 'pendiente') {
        if (esProfOAdmin) items += `<button class="menu-item" onclick="cambiarEstadoCita(${id},'confirmada')">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 8 6 12 14 4"/></svg>Confirmar cita</button>`;
        items += `<button class="menu-item" onclick="abrirModalReprogramar(${id})">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="1"/><line x1="5" y1="1" x2="5" y2="3"/><line x1="11" y1="1" x2="11" y2="3"/><line x1="2" y1="6" x2="14" y2="6"/><path d="M9 10l1.5 1.5L13 9"/></svg>Reprogramar</button>`;
        items += `<div class="menu-divider"></div>`;
        items += `<button class="menu-item danger" onclick="cambiarEstadoCita(${id},'cancelada')">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>Cancelar</button>`;
    }

    if (estado === 'confirmada') {
        items += `<button class="menu-item" onclick="abrirModalReprogramar(${id})">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="1"/><line x1="5" y1="1" x2="5" y2="3"/><line x1="11" y1="1" x2="11" y2="3"/><line x1="2" y1="6" x2="14" y2="6"/><path d="M9 10l1.5 1.5L13 9"/></svg>Reprogramar</button>`;
        items += `<button class="menu-item" onclick="cambiarEstadoCita(${id},'no_asistio')">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2-5 6-5"/><line x1="11" y1="11" x2="15" y2="15"/><line x1="15" y1="11" x2="11" y2="15"/></svg>No asistió</button>`;
        
        items += `<div class="menu-divider"></div>`;
        items += `<button class="menu-item danger" onclick="cambiarEstadoCita(${id},'cancelada')">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>Cancelar</button>`;
    }


    if (estado === 'completada') {
        if (c.atencion_id) {
            items += `<button class="menu-item" onclick="navegarAtencion(${c.atencion_id})">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>Ver atención</button>`;
        }
    }



    if (estado === 'reprogramada') {
        items += `<button class="menu-item" onclick="verHistorialCita(${id})">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><polyline points="8 5 8 8 10 10"/></svg>Ver historial</button>`;
    }

    items += `<div class="menu-divider"></div>`;
    items += `<button class="menu-item" onclick="verHistorialPaciente(${c.paciente_id},'${pacienteEsc2}')">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2-5 6-5s6 2 6 5"/></svg>Ver paciente</button>`;

    if (!items.trim()) return '';

    return `<div class="menu-dropdown" id="dd-${id}">${items}</div>`;
}

function _cerrarDropdowns(excluirId) {
    document.querySelectorAll('.menu-dropdown').forEach(dd => {
        if (!excluirId || dd.id !== `dd-${excluirId}`) dd.remove();
    });
}

function toggleMenuCita(event, citaId) {
    event.stopPropagation();
    const existente = document.getElementById(`dd-${citaId}`);
    if (existente) { existente.remove(); return; }
    _cerrarDropdowns(citaId);

    const btn = event.currentTarget;
    const wrap = btn.closest('.cita-acciones');
    if (!wrap) return;

    const cRow = btn.closest('tr');
    const citaData = cRow ? JSON.parse(cRow.dataset.cita || '{}') : {};
    const userRol  = getUser()?.rol;
    const esProfOAdmin = ['profesional','administrador'].includes(userRol);
    const esAdmin      = userRol === 'administrador';

    wrap.insertAdjacentHTML('beforeend', _renderDropdown(citaData, esProfOAdmin, esAdmin));
}

async function navegarAtencion(atencionId) {
    if (!atencionId) return;
    await navigate('atenciones');
    verDetalleAtencion(atencionId, () => citas());
}

function verHistorialCita(citaId) {
    showToast('Próximamente: historial de reprogramaciones');
}

function _renderCobroCell(c) {
    const cob = typeof c.cobertura === 'string' ? JSON.parse(c.cobertura) : (c.cobertura || {});
    const precio = c.precio_acordado != null ? parseFloat(c.precio_acordado) : 0;

    let html = `<div class="cobro-precio">S/ ${precio.toFixed(2)}</div>`;

    // 1. Paquete (Lila)
    if (cob.paquete_id) {
        html += `<div><span class="badge-coverage package" title="${cob.paquete_nombre}">Paquete</span></div>`;
    } 
    // 2. Adelanto/Crédito (Dorado)
    else if (cob.adelanto_id) {
        html += `<div><span class="badge-coverage credit" title="${cob.adelanto_concepto}">Crédito</span></div>`;
    }
    // 3. Cuenta de cobro
    else if (cob.cuenta_id) {
        const saldo = parseFloat(cob.cuenta_saldo || 0);
        const estado = cob.cuenta_estado;
        
        if (estado === 'pagado') {
            html += `<div><span class="badge-coverage paid">Pagado</span></div>`;
        } else if (saldo < cob.cuenta_monto && saldo > 0) {
            html += `<div class="cobro-pendiente">Saldo S/ ${saldo.toFixed(2)}</div>`;
            html += `<div><span class="badge-coverage partial">Parcial</span></div>`;
        } else {
            html += `<div class="cobro-pendiente">S/ ${saldo.toFixed(2)} por cobrar</div>`;
            html += `<div><span class="badge-coverage unpaid">Pendiente</span></div>`;
        }
    }
    // 4. Pendiente (Rojo)
    else {
        html += `<div><span class="badge-coverage unpaid">Pendiente</span></div>`;
    }

    return html;
}


function _renderGrupo(fechaKey, citas, esHoy, esManana, mostrarCabecera, userRol) {
    const esPaciente   = userRol === 'paciente';
    const esProfOAdmin = ['profesional','administrador'].includes(userRol);
    const esAdmin      = userRol === 'administrador';
    const hoyISO       = _hoyISO();

    const labelFecha = _formatFechaGrupo(fechaKey);
    const pillHoy    = esHoy   ? `<span class="day-pill">Hoy</span>` : '';
    const pillMan    = esManana ? `<span class="day-pill manana">Mañana</span>` : '';
    const headerClass = esHoy  ? 'day-header today' : 'day-header';

    let html = `<div class="day-group">
        <div class="${headerClass}">
            ${labelFecha}${pillHoy}${pillMan}
            <span class="day-count">${citas.length} cita${citas.length !== 1 ? 's' : ''}</span>
        </div>
        <table class="citas-table">
        <colgroup>
            <col style="width:90px">
            ${esPaciente ? '' : '<col style="width:24%">'}
            <col style="width:18%">
            <col style="width:23%">
            <col style="width:11%">
            ${esPaciente ? '' : '<col style="width:11%">'}
            ${esPaciente ? '' : '<col style="width:90px">'}
        </colgroup>`;

    if (mostrarCabecera) {
        html += `<thead><tr>
            <th>Hora</th>
            ${esPaciente ? '' : '<th>Paciente</th>'}
            <th>Profesional</th>
            <th>Servicio</th>
            <th>Estado</th>
            ${esPaciente ? '' : '<th>Cobro</th>'}
            ${esPaciente ? '' : '<th>Acciones</th>'}
        </tr></thead>`;
    }

    html += '<tbody>';
    citas.forEach(c => {
        const id    = c.cita_id || c.id;
        const estado= c.estado  || 'pendiente';
        const esHoyRow = (c.fecha_hora_inicio || '').slice(0, 10) === hoyISO;
        const rowClass = esHoyRow ? 'today-row' : '';
        const dataCita = JSON.stringify(c).replace(/"/g, '&quot;');

        // Hora
        const hora    = _formatHora(c.fecha_hora_inicio);
        const relText = _textoRelativo(c.fecha_hora_inicio);

        // Paciente
        const iniciales = _iniciales(c.paciente);
        const avIdx     = ((c.paciente_id || 0) % 4);
        const esMenor   = parseInt(c.paciente_es_menor) === 1;
        const alertas   = parseInt(c.alertas_activas_paciente) || 0;
        let pacMeta = '';
        if (esMenor)  pacMeta += `<span class="mini-badge mb-menor">Menor</span>`;
        if (alertas > 0) pacMeta += `<span class="mini-badge mb-alerta">${alertas} alerta${alertas !== 1 ? 's' : ''}</span>`;
        if (!esMenor && !alertas && c.paciente_dni) pacMeta += `<span>DNI ${c.paciente_dni}</span>`;

        // Profesional
        const profCorto = _nombreCorto(c.profesional);

        // Servicio
        const esSesion = c.tipo_cita === 'sesion_existente';
        const badgeSes = esSesion ? `<span class="svc-sesion-badge">Sesión</span>` : '';
        const svNombre = _truncar(c.subservicio || '-', 32);
        const esVirtual= c.modalidad_sesion === 'virtual';
        const svgCam   = `<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="10" height="8" rx="1.5"/><path d="M11 7l4-2v6l-4-2"/></svg>`;
        const modalBadge = esVirtual
            ? `<span class="svc-modalidad virtual">${svgCam}Virtual</span>`
            : `<span class="svc-modalidad">Presencial</span>`;

        // Estado badge
        const badgeClass = ESTADO_BADGE[estado] || '';
        const badgeLabel = ESTADO_LABEL[estado]  || estado;

        // Botones
        const btnPrimario = esPaciente ? '' : _renderBtnPrimario(c, esProfOAdmin);

        html += `<tr class="${rowClass}" data-cita="${dataCita}">` + `
            <td>
                <div class="td-hora">${hora}</div>
                ${relText ? `<div class="td-hora-rel">${relText}</div>` : ''}
            </td>
            ${esPaciente ? '' : `<td>
                <div style="display:flex;align-items:center">
                    <span class="pac-avatar pac-av-${avIdx}">${iniciales}</span>
                    <div>
                        <div class="pac-name">${c.paciente || 'N/A'}</div>
                        <div class="pac-meta">${pacMeta}</div>
                    </div>
                </div>
            </td>`}
            <td style="font-size:12.5px">${profCorto}</td>
            <td>
                <div class="svc-name">${badgeSes}${svNombre}</div>
                <div>${modalBadge}</div>
            </td>
            <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
            ${esPaciente ? '' : `<td>${_renderCobroCell(c)}</td>`}
            ${esPaciente ? '' : `<td onclick="event.stopPropagation()">
                <div class="cita-acciones">
                    ${btnPrimario}
                    <button class="cita-btn-menu" title="Más opciones"
                            onclick="toggleMenuCita(event,${id})">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="8" cy="3" r="1" fill="currentColor" stroke="none"/>
                            <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/>
                            <circle cx="8" cy="13" r="1" fill="currentColor" stroke="none"/>
                        </svg>
                    </button>
                </div>
            </td>`}
        </tr>`;
    });

    html += '</tbody></table></div>';
    return html;
}

function _citaRowClick(event) {
    // Sin acción al hacer click en la fila
}

async function citas() {
    const userRol    = getUser()?.rol;
    const esPaciente = userRol === 'paciente';

    // Aplicar chip por defecto la primera vez si no hay rango explícito
    if (!esPaciente && !_citasFiltros.fecha_desde && !_citasFiltros.fecha_hasta) {
        _aplicarChip(_citasFiltros.chip || 'semana');
    }

    if (esPaciente) {
        const res = await api('/api/citas');
        _renderCitasPaciente(res.data || []);
        return;
    }

    const esAdmin = userRol === 'administrador';
    if (esAdmin && _citasProfesionales.length === 0) {
        const rProf = await api('/api/profesionales');
        _citasProfesionales = rProf.data || [];
    }

    const qs = [];
    if (_citasFiltros.q)             qs.push('q='             + encodeURIComponent(_citasFiltros.q));
    if (_citasFiltros.fecha_desde)   qs.push('fecha_desde='   + _citasFiltros.fecha_desde);
    if (_citasFiltros.fecha_hasta)   qs.push('fecha_hasta='   + _citasFiltros.fecha_hasta);
    if (_citasFiltros.estado)        qs.push('estado='        + encodeURIComponent(_citasFiltros.estado));
    if (_citasFiltros.profesional_id) qs.push('profesional_id=' + _citasFiltros.profesional_id);
    if (_citasFiltros.modalidad && _citasFiltros.modalidad !== 'todas')
        qs.push('modalidad_sesion=' + encodeURIComponent(_citasFiltros.modalidad));

    const query = '/api/citas' + (qs.length ? '?' + qs.join('&') : '');
    const res   = await api(query);
    _citasTodas = res.data || [];
    _renderCitasLista(_citasTodas, 0, userRol);
}

function _renderCitasPaciente(data) {
    const rows = data.map(c => {
        const badgeClass = ESTADO_BADGE[c.estado] || '';
        return `<tr>
            <td>${c.profesional || '-'}</td>
            <td>${c.subservicio || '-'}</td>
            <td>${formatFecha(c.fecha_hora_inicio)}</td>
            <td><span class="badge ${badgeClass}">${ESTADO_LABEL[c.estado] || c.estado}</span></td>
        </tr>`;
    }).join('');

    document.getElementById('view').innerHTML = `
        <h2>Mis Citas</h2>
        <table class="table">
            <thead><tr><th>Profesional</th><th>Servicio</th><th>Fecha / Hora</th><th>Estado</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--color-text-muted)">Sin citas registradas</td></tr>'}</tbody>
        </table>`;
}

function _agruparPorDia(citas) {
    const grupos = {};
    citas.forEach(c => {
        const key = (c.fecha_hora_inicio || '').slice(0, 10);
        if (!grupos[key]) grupos[key] = [];
        grupos[key].push(c);
    });
    return grupos;
}

function _renderCitasLista(todas, offset, userRol) {
    const hoyISO  = _hoyISO();
    const manISO  = _addDias(hoyISO, 1);
    const LIMITE  = 50;
    const visibles = todas.slice(offset, offset + LIMITE);
    const total    = todas.length;

    const grupos     = _agruparPorDia(visibles);
    const fechaKeys  = Object.keys(grupos).sort();
    const filtActivos = _contarFiltrosActivos();

    // Rango visible para el botón de fecha
    const desde = _citasFiltros.fecha_desde || '';
    const hasta = _citasFiltros.fecha_hasta || '';
    const rangoLabel = desde && hasta
        ? `${_fmtDDMMYYYY(desde)} → ${_fmtDDMMYYYY(hasta)}`
        : 'Rango de fechas';

    // Opciones de profesional (solo admin)
    const esAdmin  = userRol === 'administrador';
    let profOpts = '<option value="">Todos</option>';
    (_citasProfesionales || []).forEach(p => {
        const sel = String(_citasFiltros.profesional_id) === String(p.id) ? 'selected' : '';
        profOpts += `<option value="${p.id}" ${sel}>${p.apellidos}, ${p.nombres}</option>`;
    });

    const chips = ['hoy','manana','semana','7dias','mes','custom'];
    const chipLabels = {hoy:'Hoy', manana:'Mañana', semana:'Esta semana', '7dias':'Próx. 7 días', mes:'Este mes', custom:'Personalizado'};
    const chipsHTML = chips.map(ch =>
        `<button class="chip${_citasFiltros.chip === ch ? ' chip-active' : ''}" onclick="_selChip('${ch}')">${chipLabels[ch]}</button>`
    ).join('');

    let gruposHTML = '';
    if (fechaKeys.length === 0) {
        gruposHTML = `<div class="citas-empty">
            <svg class="citas-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <p class="citas-empty-title">Sin citas en este período</p>
            <p class="citas-empty-sub">Ajusta los filtros o crea una nueva cita</p>
        </div>`;
    } else {
        fechaKeys.forEach((key, idx) => {
            gruposHTML += _renderGrupo(key, grupos[key], key === hoyISO, key === manISO, idx === 0, userRol);
        });
    }

    const mostrados = offset + visibles.length;
    const pagHTML = total > mostrados ? `
        <div class="citas-paginacion">
            <span id="citasOffset" data-offset="${mostrados}"></span>
            Mostrando 1–${mostrados} de ${total} &nbsp;·&nbsp;
            <button class="btn-primary" style="padding:5px 14px;font-size:12.5px"
                    onclick="_cargarMasCitas(${mostrados})">Cargar más</button>
        </div>` : '';

    // Helper: chips de modalidad
    const modalidadChips = [
        { value: 'todas',      label: 'Todas' },
        { value: 'presencial', label: 'Presencial' },
        { value: 'virtual',    label: 'Virtual' },
    ].map(o => {
        const activo = (_citasFiltros.modalidad || 'todas') === o.value;
        return `<button class="fc-chip${activo ? ' fc-chip-active' : ''}" onclick="_citasFiltros.modalidad='${o.value}';citas()">${o.label}</button>`;
    }).join('');

    // Helper: chips de tipo
    const tipoChips = [
        { value: 'todas',            label: 'Todas' },
        { value: 'nueva_atencion',   label: 'Nueva atención' },
        { value: 'sesion_existente', label: 'Sesión existente' },
    ].map(o => {
        const activo = (_citasFiltros.tipo || 'todas') === o.value;
        return `<button class="fc-chip${activo ? ' fc-chip-active' : ''}" onclick="_citasFiltros.tipo='${o.value}';citas()">${o.label}</button>`;
    }).join('');

    // Helper: chips de estado
    const estadoChips = [
        { value: '',             label: 'Todos',        color: '' },
        { value: 'pendiente',    label: 'Pendiente',    color: '#E8B84B' },
        { value: 'confirmada',   label: 'Confirmada',   color: '#2A7F8F' },
        { value: 'completada',   label: 'Completada',   color: '#27AE60' },
        { value: 'cancelada',    label: 'Cancelada',    color: '#E74C3C' },
        { value: 'no_asistio',   label: 'No asistió',   color: '#E8836A' },
        { value: 'reprogramada', label: 'Reprogramada', color: '#9B7EC8' },
    ].map(o => {
        const activo = _citasFiltros.estado === o.value;
        const dot = o.color ? `<span class="fc-chip-dot" style="background:${o.color}"></span>` : '';
        return `<button class="fc-chip${activo ? ' fc-chip-active' : ''}" onclick="_citasFiltros.estado='${o.value}';citas()">${dot}${o.label}</button>`;
    }).join('');

    const panelOpenClass = _citasFiltros.panelOpen ? ' open' : '';
    const rangoOpenClass = _citasFiltros.rangoOpen ? '' : ' hidden';

    document.getElementById('view').innerHTML = `
        <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:14px">
            <h2 style="margin:0">Citas</h2>
            <span style="font-size:13px;color:var(--color-text-muted);font-weight:300">· ${total} cita${total !== 1 ? 's' : ''}</span>
            <button class="btn-primary" style="margin-left:auto;padding:7px 14px;font-size:13px"
                    onclick="abrirModalCita()">+ Nueva cita</button>
        </div>

        <div class="citas-toolbar">
            <div class="citas-search-wrap">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="6.5" r="4.5"/><line x1="10" y1="10" x2="14" y2="14"/></svg>
                <input class="citas-search" id="citasQ" type="text" placeholder="Buscar paciente, profesional o servicio…"
                       value="${_citasFiltros.q}"
                       oninput="_onCitasBusqueda(this.value)">
            </div>
            <div class="citas-rango-wrap">
                <button class="citas-btn-toolbar${_citasFiltros.rangoOpen ? ' active' : ''}" id="btnRangoCitas" onclick="_toggleRangoPopover()">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="1"/><line x1="5" y1="1" x2="5" y2="3"/><line x1="11" y1="1" x2="11" y2="3"/><line x1="2" y1="6" x2="14" y2="6"/></svg>
                    ${rangoLabel}
                </button>
                <div class="citas-rango-popover${rangoOpenClass}" id="citasRangoPopover">
                    <div class="crp-header">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="1"/><line x1="5" y1="1" x2="5" y2="3"/><line x1="11" y1="1" x2="11" y2="3"/><line x1="2" y1="6" x2="14" y2="6"/></svg>
                        <span>Rango personalizado</span>
                    </div>
                    <div class="crp-fields">
                        <div class="crp-field">
                            <label for="citaRangoDesde">Desde</label>
                            <input type="date" id="citaRangoDesde" value="${_citasFiltros.fecha_desde || _hoyISO()}">
                        </div>
                        <div class="crp-separator">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="4" y1="8" x2="12" y2="8"/><polyline points="9 5 12 8 9 11"/></svg>
                        </div>
                        <div class="crp-field">
                            <label for="citaRangoHasta">Hasta</label>
                            <input type="date" id="citaRangoHasta" value="${_citasFiltros.fecha_hasta || _hoyISO()}">
                        </div>
                    </div>
                    <div class="crp-actions">
                        <button class="crp-btn-cancel" onclick="_cerrarRangoPopover()">Cancelar</button>
                        <button class="crp-btn-apply" onclick="_aplicarRangoFechas()">Aplicar rango</button>
                    </div>
                </div>
            </div>
            <button class="citas-btn-toolbar${filtActivos > 0 ? ' active' : ''}" onclick="_toggleFilterPanel()">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="5" x2="13" y2="5"/><line x1="5" y1="9" x2="11" y2="9"/><line x1="7" y1="13" x2="9" y2="13"/></svg>
                Más filtros
                ${filtActivos > 0 ? `<span class="citas-filter-badge">${filtActivos}</span>` : ''}
            </button>
        </div>

        <div class="citas-filter-panel${panelOpenClass}" id="citasFilterPanel">
            <div class="cfp-section">
                <div class="cfp-section-header">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1"/></svg>
                    <span class="citas-filter-label">Estado</span>
                </div>
                <div class="fc-chip-group">${estadoChips}</div>
            </div>
            ${esAdmin ? `<div class="cfp-divider"></div>
            <div class="cfp-section">
                <div class="cfp-section-header">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2-5 6-5s6 2 6 5"/></svg>
                    <span class="citas-filter-label">Profesional</span>
                </div>
                <select class="cfp-select" onchange="_citasFiltros.profesional_id=this.value;citas()">${profOpts}</select>
            </div>` : ''}
            <div class="cfp-divider"></div>
            <div class="cfp-section">
                <div class="cfp-section-header">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="10" height="8" rx="1.5"/><path d="M11 7l4-2v6l-4-2"/></svg>
                    <span class="citas-filter-label">Modalidad</span>
                </div>
                <div class="fc-chip-group">${modalidadChips}</div>
            </div>
            <div class="cfp-divider"></div>
            <div class="cfp-section">
                <div class="cfp-section-header">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h8v8H4z"/><path d="M8 4v8"/><path d="M4 8h8"/></svg>
                    <span class="citas-filter-label">Tipo de cita</span>
                </div>
                <div class="fc-chip-group">${tipoChips}</div>
            </div>
            <div class="cfp-footer">
                <button class="cfp-btn-clear" onclick="_limpiarFiltrosAvanzados()">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
                    Limpiar filtros
                </button>
            </div>
        </div>

        <div class="citas-chips">${chipsHTML}</div>

        <div id="citasGrupos">${gruposHTML}</div>
        ${pagHTML}
    `;

    document.addEventListener('click', _cerrarDropdownsGlobal, { once: true });
}

function _fmtDDMMYYYY(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function _cerrarDropdownsGlobal() {
    _cerrarDropdowns(null);
}

function _onCitasBusqueda(val) {
    clearTimeout(_citasBusquedaTimer);
    _citasBusquedaTimer = setTimeout(() => {
        _citasFiltros.q = val;
        citas();
    }, 300);
}

function _selChip(chip) {
    _aplicarChip(chip);
    citas();
}

function _toggleFilterPanel() {
    _citasFiltros.panelOpen = !_citasFiltros.panelOpen;
    const panel = document.getElementById('citasFilterPanel');
    if (panel) panel.classList.toggle('open', _citasFiltros.panelOpen);
}

function _toggleRangoPopover() {
    _citasFiltros.rangoOpen = !_citasFiltros.rangoOpen;
    const popover = document.getElementById('citasRangoPopover');
    if (popover) popover.classList.toggle('hidden', !_citasFiltros.rangoOpen);
    const btn = document.getElementById('btnRangoCitas');
    if (btn) btn.classList.toggle('active', _citasFiltros.rangoOpen);
}

function _cerrarRangoPopover() {
    _citasFiltros.rangoOpen = false;
    const popover = document.getElementById('citasRangoPopover');
    if (popover) popover.classList.add('hidden');
    const btn = document.getElementById('btnRangoCitas');
    if (btn) btn.classList.remove('active');
}

function _aplicarRangoFechas() {
    const desde = document.getElementById('citaRangoDesde')?.value;
    const hasta = document.getElementById('citaRangoHasta')?.value;
    if (!desde || !hasta) { showToast('Selecciona ambas fechas'); return; }
    if (desde > hasta) { showToast('La fecha "desde" no puede ser mayor a "hasta"'); return; }
    _citasFiltros.fecha_desde = desde;
    _citasFiltros.fecha_hasta = hasta;
    _citasFiltros.chip        = 'custom';
    _citasFiltros.rangoOpen   = false;
    citas();
}

function _limpiarFiltrosAvanzados() {
    _citasFiltros.estado         = '';
    _citasFiltros.profesional_id = '';
    _citasFiltros.modalidad      = '';
    _citasFiltros.tipo           = '';
    citas();
}

function _appendCitas(todas, offset, userRol) {
    const LIMITE = 50;
    const hoyISO = _hoyISO();
    const manISO = _addDias(hoyISO, 1);
    const lote   = todas.slice(offset, offset + LIMITE);
    const grupos = _agruparPorDia(lote);
    const keys   = Object.keys(grupos).sort();
    const cont   = document.getElementById('citasGrupos');
    if (!cont) return;
    keys.forEach(key => {
        cont.insertAdjacentHTML('beforeend', _renderGrupo(key, grupos[key], key === hoyISO, key === manISO, false, userRol));
    });

    // Actualizar o eliminar botón paginación
    const pagDiv = document.querySelector('.citas-paginacion');
    if (!pagDiv) return;
    const nuevoOffset = offset + lote.length;
    if (nuevoOffset < todas.length) {
        pagDiv.innerHTML = `<span id="citasOffset" data-offset="${nuevoOffset}"></span>
            Mostrando 1–${nuevoOffset} de ${todas.length} &nbsp;·&nbsp;
            <button class="btn-primary" style="padding:5px 14px;font-size:12.5px"
                    onclick="_cargarMasCitas(${nuevoOffset})">Cargar más</button>`;
    } else {
        pagDiv.remove();
    }
}

function _cargarMasCitas(offset) {
    const userRol = getUser()?.rol;
    _appendCitas(_citasTodas, offset, userRol);
}

function limpiarFiltrosCitas() {
    _citasFiltros.q             = '';
    _citasFiltros.fecha_desde   = '';
    _citasFiltros.fecha_hasta   = '';
    _citasFiltros.estado        = '';
    _citasFiltros.profesional_id= '';
    _citasFiltros.modalidad     = '';
    _citasFiltros.tipo          = '';
    _citasFiltros.chip          = 'semana';
    _aplicarChip('semana');
    citas();
}

function formatFecha(dt) {
    if (!dt) return '-';
    const d = new Date(dt.replace(' ', 'T'));
    if (isNaN(d)) return dt;
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

// ---- Contratar paquete desde modal de cita ----

async function cargarPaquetesParaContratar() {
    const sel = document.getElementById('paqueteContratarId');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Seleccionar paquete —</option>';
    const res = await api('/api/paquetes?activos=1');
    (res.data || []).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.dataset.sesiones = p.sesiones_incluidas;
        opt.dataset.precio   = p.precio_paquete;
        opt.dataset.precioSesion = p.precio_por_sesion;
        opt.textContent = p.nombre;
        sel.appendChild(opt);
    });
}

function toggleContratarPaquete() {
    _contratarPaquete = !_contratarPaquete;
    const check  = document.getElementById('contratarCheck');
    const select = document.getElementById('contratarPaqueteSelect');
    if (check)  check.classList.toggle('active', _contratarPaquete);
    if (select) select.style.display = _contratarPaquete ? 'block' : 'none';

    if (!_contratarPaquete) {
        // Desmarcar: restaurar precio y descuento editables, ocultar dropdown
        const sel = document.getElementById('paqueteContratarId');
        if (sel) sel.value = '';
        document.getElementById('paqueteContratarPreview').style.display = 'none';
        const precioInp = document.getElementById('citaPrecio');
        const descInp   = document.getElementById('citaDescuento');
        if (precioInp) {
            precioInp.readOnly = false;
            precioInp.style.backgroundColor = '';
        }
        if (descInp) {
            descInp.readOnly = false;
            descInp.style.backgroundColor = '';
        }
        actualizarPrecioBase();
    } else if (_citaContexto?.paquete_activo) {
        showToast('Este paciente ya tiene un paquete activo. Si contratas otro, el anterior se cancelará.');
    }
}

function onPaqueteSelected() {
    const sel     = document.getElementById('paqueteContratarId');
    const preview = document.getElementById('paqueteContratarPreview');
    if (!sel.value) {
        preview.style.display = 'none';
        const precioInp = document.getElementById('citaPrecio');
        const descInp   = document.getElementById('citaDescuento');
        if (precioInp) { precioInp.readOnly = false; precioInp.style.backgroundColor = ''; }
        if (descInp)   { descInp.readOnly = false;   descInp.style.backgroundColor = ''; }
        actualizarPrecioBase();
        return;
    }
    const opt      = sel.options[sel.selectedIndex];
    const sesiones = parseInt(opt.dataset.sesiones) || 0;
    const precio   = parseFloat(opt.dataset.precio)  || 0;
    const porSesion = sesiones > 0 ? (precio / sesiones) : 0;

    preview.style.display = 'block';
    preview.innerHTML = `Pack <strong>${opt.textContent}</strong> · ${sesiones} sesiones · S/ ${precio.toFixed(2)} total · S/ ${porSesion.toFixed(2)} por sesión`;

    // Bloquear precio y descuento, pre-llenar con el prorrateo
    const precioInp = document.getElementById('citaPrecio');
    const descInp   = document.getElementById('citaDescuento');
    if (precioInp) {
        precioInp.value    = porSesion.toFixed(2);
        precioInp.readOnly = true;
        precioInp.style.backgroundColor = 'var(--color-bg)';
    }
    if (descInp) {
        descInp.value    = '0.00';
        descInp.readOnly = true;
        descInp.style.backgroundColor = 'var(--color-bg)';
    }
    calcularPrecioFinal();
}

// ---- Abrir modal nueva cita ----

async function abrirModalCita() {
    clearCitaErrors();
    limpiarPacienteCita();

    // Resetear tipo de cita
    document.querySelectorAll('input[name="citaTipo"]').forEach(r => r.checked = false);
    document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('citaCamposNuevaAtencion').classList.remove('visible');
    document.getElementById('citaCamposSesionExistente').classList.remove('visible');

    // Debounce del combobox
    const inputPac = document.getElementById('citaPacienteInput');
    inputPac.oninput = () => {
        clearTimeout(_pacienteBusquedaTimer);
        _pacienteBusquedaTimer = setTimeout(() => buscarPacientesCita(inputPac.value.trim()), 350);
    };

    const userRolModal = getUser()?.rol;

    // Cargar profesionales solo para administrador; el profesional usa su propia identidad
    const [resPro, resSrv] = userRolModal === 'profesional'
        ? [null, await api('/api/servicios')]
        : await Promise.all([api('/api/profesionales'), api('/api/servicios')]);

    if (userRolModal === 'profesional') {
        // Mostrar campo de solo lectura en lugar del select de profesional
        const user = getUser();
        const nombreProfesional = `${user.nombres} ${user.apellidos}`;
        ['citaProfesionalNA', 'citaProfesionalSE'].forEach(selectId => {
            const sel = document.getElementById(selectId);
            sel.style.display = 'none';
            let rdField = document.getElementById(selectId + '-readonly');
            if (!rdField) {
                rdField = document.createElement('div');
                rdField.id = selectId + '-readonly';
                rdField.className = 'readonly-field';
                sel.parentNode.insertBefore(rdField, sel.nextSibling);
            }
            rdField.textContent = nombreProfesional;
            rdField.style.display = '';
        });
    } else {
        // Restaurar selects si estaban ocultos por cambio de sesión
        ['citaProfesionalNA', 'citaProfesionalSE'].forEach(selectId => {
            const sel = document.getElementById(selectId);
            sel.style.display = '';
            const rdField = document.getElementById(selectId + '-readonly');
            if (rdField) rdField.style.display = 'none';
        });

        // Poblar selects de profesional (ambas secciones)
        const opcionesPro = resPro?.data
            ? resPro.data.map(p => {
                const espec = p.especialidad ? ` (${p.especialidad})` : '';
                return `<option value="${p.id}">${p.apellidos}, ${p.nombres}${espec}</option>`;
              }).join('')
            : '';
        ['citaProfesionalNA', 'citaProfesionalSE'].forEach(id => {
            const sel = document.getElementById(id);
            sel.innerHTML = '<option value="">Seleccionar profesional…</option>' + opcionesPro;
        });
    }

    // Poblar select de servicios (solo sección nueva atención)
    const selSrv = document.getElementById('citaServicio');
    selSrv.innerHTML = '<option value="">Seleccionar servicio…</option>';
    if (resSrv.data) {
        resSrv.data.forEach(s => {
            selSrv.innerHTML += `<option value="${s.id}">${s.nombre}</option>`;
        });
    }
    document.getElementById('citaSubservicioNA').innerHTML = '<option value="">Seleccionar servicio primero…</option>';

    // Preseleccionar fecha actual (hora en punto más próxima)
    const _ahora    = new Date();
    _ahora.setMinutes(0, 0, 0);
    const _hoyLocal = _ahora.getFullYear() + '-'
        + String(_ahora.getMonth() + 1).padStart(2, '0') + '-'
        + String(_ahora.getDate()).padStart(2, '0') + 'T'
        + String(_ahora.getHours()).padStart(2, '0') + ':00';
    document.getElementById('citaFechaNA').value = _hoyLocal;
    document.getElementById('citaFechaSE').value = _hoyLocal;
    document.getElementById('citaAtencionSE').innerHTML = '<option value="">Seleccione profesional primero…</option>';

    // Resetear estado modal
    _citaModalidad   = 'presencial';
    _citaUsarPaquete = false;
    _citaContexto    = null;

    // Resetear toggles modalidad
    document.getElementById('btnModalidadPresencial')?.classList.add('active');
    document.getElementById('btnModalidadVirtual')?.classList.remove('active');
    document.getElementById('citaVirtualHint').style.display = 'none';

    // Ocultar secciones que aparecen tras elegir tipo
    document.getElementById('citaSepCuandoComo').style.display          = 'none';
    document.getElementById('citaCamposFechaModalidad').style.display   = 'none';
    document.getElementById('citaSepPaquete').style.display             = 'none';
    document.getElementById('citaPaqueteSection').style.display         = 'none';
    document.getElementById('citaSepContratarPaquete').style.display    = 'none';
    document.getElementById('citaContratarPaqueteSection').style.display = 'none';
    document.getElementById('citaSepPrecio').style.display              = 'none';
    document.getElementById('citaCamposPrecio').style.display           = 'none';

    // Mostrar grupo fecha NA por defecto
    document.getElementById('citaFechaGrupoNA').style.display = '';
    document.getElementById('citaFechaGrupoSE').style.display = 'none';

    // Resetear precio
    document.getElementById('citaPrecio').value          = '';
    document.getElementById('citaDescuento').value       = '0';
    document.getElementById('citaMotivoDescuento').value = '';
    document.getElementById('citaPrecioFinalPreview').style.display = 'none';
    document.getElementById('motivoDescWrap').style.display         = 'none';
    document.getElementById('citaPrecioRefTexto').innerHTML =
        'Precio base: <strong>S/ — presencial · S/ — virtual</strong>';

    // Resetear contratar paquete
    _contratarPaquete = false;
    document.getElementById('contratarCheck')?.classList.remove('active');
    document.getElementById('contratarPaqueteSelect').style.display     = 'none';
    document.getElementById('paqueteContratarPreview').style.display    = 'none';
    document.getElementById('paqueteContratarId').value                 = '';
    const precioInp = document.getElementById('citaPrecio');
    if (precioInp) precioInp.readOnly = false;

    // Deshabilitar radio cards hasta que se seleccione un paciente
    _deshabilitarRadioCards();

    document.getElementById('modalCita').classList.remove('hidden');
    document.getElementById('citaPacienteInput').focus();
}

// ---- Tipo de cita: radio cards ----

function onTipoCitaChange(tipo) {
    const seccNA = document.getElementById('citaCamposNuevaAtencion');
    const seccSE = document.getElementById('citaCamposSesionExistente');

    if (tipo === 'nueva_atencion') {
        seccNA.classList.add('visible');
        seccSE.classList.remove('visible');
        document.getElementById('rcNuevaAtencion').classList.add('selected');
        document.getElementById('rcSesionExistente').classList.remove('selected');
        document.getElementById('citaFechaGrupoNA').style.display = '';
        document.getElementById('citaFechaGrupoSE').style.display = 'none';
    } else {
        seccSE.classList.add('visible');
        seccNA.classList.remove('visible');
        document.getElementById('rcSesionExistente').classList.add('selected');
        document.getElementById('rcNuevaAtencion').classList.remove('selected');
        document.getElementById('citaFechaGrupoNA').style.display = 'none';
        document.getElementById('citaFechaGrupoSE').style.display = '';

        // Para profesional: cargar atenciones del paciente ya seleccionado
        if (getUser()?.rol === 'profesional') {
            onProfesionalSesionChange();
        }
    }
    const err = document.getElementById('citaTipo-error');
    if (err) err.textContent = '';

    // Mostrar secciones comunes: cuándo/cómo
    document.getElementById('citaSepCuandoComo').style.display           = '';
    document.getElementById('citaCamposFechaModalidad').style.display    = '';

    if (tipo === 'nueva_atencion') {
        // Nueva atención: mostrar todas las secciones de paquete y precio
        document.getElementById('citaSepContratarPaquete').style.display     = '';
        document.getElementById('citaContratarPaqueteSection').style.display = '';
        document.getElementById('citaSepPrecio').style.display               = '';
        document.getElementById('citaCamposPrecio').style.display            = '';
        cargarPaquetesParaContratar();
        actualizarPrecioBase();

        // Recargar paquete si ya hay paciente seleccionado
        const pacienteId = parseInt(document.getElementById('citaPacienteId').value, 10) || 0;
        if (pacienteId) {
            const profesionalId = _getCitaProfesionalIdActual();
            cargarContextoPaquete(pacienteId, profesionalId, 0);
        }
    } else {
        // Sesión existente: ocultar paquete y precio hasta que se seleccione una atención
        document.getElementById('citaSepContratarPaquete').style.display     = 'none';
        document.getElementById('citaContratarPaqueteSection').style.display = 'none';
        document.getElementById('citaSepPrecio').style.display               = 'none';
        document.getElementById('citaCamposPrecio').style.display            = 'none';
        document.getElementById('citaSepPaquete').style.display              = 'none';
        document.getElementById('citaPaqueteSection').style.display          = 'none';
        cargarPaquetesParaContratar();
    }
}

// ---- Cargar subservicios al cambiar servicio (nueva atención) ----

async function onServicioChange() {
    const servicioId = document.getElementById('citaServicio').value;
    const sel        = document.getElementById('citaSubservicioNA');
    sel.innerHTML = '<option value="">Cargando…</option>';
    if (!servicioId) {
        sel.innerHTML = '<option value="">Seleccionar servicio primero…</option>';
        return;
    }
    const res = await api(`/api/subservicios/por-servicio?servicio_id=${servicioId}`);
    sel.innerHTML = '<option value="">Seleccionar modalidad…</option>';
    (res.data || []).forEach(s => {
        sel.innerHTML += `<option value="${s.id}" data-precio="${s.precio_base}" data-descuento-virtual="${s.descuento_virtual ?? 10}">${s.nombre} (${s.modalidad}, S/ ${parseFloat(s.precio_base).toFixed(2)})</option>`;
    });
    if (!res.data || res.data.length === 0) {
        sel.innerHTML += '<option value="" disabled>Sin subservicios disponibles</option>';
    }
}

// ---- Cargar atenciones activas al cambiar profesional (sesión existente) ----

async function onProfesionalSesionChange() {
    const user = getUser();
    const esProfesional = user?.rol === 'profesional';
    const profesionalId = esProfesional
        ? (user.profesional_id || 0)
        : parseInt(document.getElementById('citaProfesionalSE').value, 10);
    const pacienteId    = parseInt(document.getElementById('citaPacienteId').value, 10);
    const sel           = document.getElementById('citaAtencionSE');

    if (!pacienteId || pacienteId <= 0) {
        sel.innerHTML = '<option value="">Seleccione un paciente primero…</option>';
        return;
    }
    if (!esProfesional && !profesionalId) {
        sel.innerHTML = '<option value="">Seleccione profesional primero…</option>';
        return;
    }

    sel.innerHTML = '<option value="">Cargando…</option>';
    const res    = await api(`/api/atenciones/paciente?paciente_id=${pacienteId}`);
    const activas = (res.data || []).filter(
        a => a.estado === 'activa' && (!profesionalId || parseInt(a.profesional_id, 10) === profesionalId)
    );

    sel.innerHTML = '<option value="">— Seleccionar atención —</option>';
    if (activas.length === 0) {
        sel.innerHTML += '<option value="" disabled>Sin atenciones activas con este profesional</option>';
        return;
    }
    activas.forEach(a => {
        const proxSesion = (parseInt(a.total_sesiones) || 0) + 1;
        const opt        = document.createElement('option');
        opt.value                    = a.id;
        opt.dataset.subservicioId    = a.subservicio_id;
        opt.dataset.precioBase       = a.precio_base       ?? 0;
        opt.dataset.descuentoVirtual = a.descuento_virtual ?? 10;
        opt.textContent = `${a.subservicio} — desde ${a.fecha_inicio} · sesión #${proxSesion}`;
        sel.appendChild(opt);
    });

    // Actualizar precio base y paquete según nuevo profesional
    actualizarPrecioBase();
    cargarContextoPaquete(pacienteId, profesionalId, 0);
}

// ---- Guardar nueva cita ----

async function guardarCita() {
    if (_isSavingCita) return;
    _isSavingCita = true;

    try {
        clearCitaErrors();

        const pacienteId = parseInt(document.getElementById('citaPacienteId').value, 10);
        const tipo       = document.querySelector('input[name="citaTipo"]:checked')?.value;

        let valido = true;

        if (!pacienteId || pacienteId <= 0) {
            const combo  = document.getElementById('citaPacienteCombo');
            const errPac = document.getElementById('citaPacienteId-error');
            if (combo)  combo.classList.add('is-invalid');
            if (errPac) errPac.textContent = 'Seleccione un paciente';
            valido = false;
        }
        if (!tipo) {
            const errTipo = document.getElementById('citaTipo-error');
            if (errTipo) errTipo.textContent = 'Seleccione el tipo de cita';
            valido = false;
        }
        if (!valido) return;

        let payload;

        const esProfesional = getUser()?.rol === 'profesional';

        if (tipo === 'nueva_atencion') {
            const profesionalId = document.getElementById('citaProfesionalNA').value;
            const subservicioId = document.getElementById('citaSubservicioNA').value;
            const fecha         = document.getElementById('citaFechaNA').value;

            if (!esProfesional && !profesionalId) { setCitaError('citaProfesionalNA', 'Seleccione un profesional'); valido = false; }
            if (!subservicioId) { setCitaError('citaSubservicioNA', 'Seleccione una modalidad');  valido = false; }
            if (!fecha)         { setCitaError('citaFechaNA',       'Seleccione fecha y hora');   valido = false; }
            if (!valido) return;

            const _precioCita = parseFloat(document.getElementById('citaPrecio').value) || 0;
            if (_precioCita <= 0) {
                setCitaError('citaPrecio', 'El precio de la cita es requerido');
                return;
            }
            const _descCita   = parseFloat(document.getElementById('citaDescuento').value) || 0;
            const _motivoCita = (_descCita > 0) ? (document.getElementById('citaMotivoDescuento').value.trim() || null) : null;
            const _paqContratar = parseInt(document.getElementById('paqueteContratarId')?.value, 10) || null;

            payload = {
                tipo_cita:            'nueva_atencion',
                paciente_id:          pacienteId,
                subservicio_id:       parseInt(subservicioId, 10),
                fecha_hora_inicio:    fecha,
                modalidad_sesion:     _citaModalidad,
                usar_paquete:         _citaUsarPaquete,
                precio_acordado:      _precioCita,
                descuento_monto:      _descCita,
                motivo_descuento:     _motivoCita,
                contratar_paquete_id: _paqContratar,
            };
            if (!esProfesional) {
                payload.profesional_id = parseInt(profesionalId, 10);
            }
        } else {
            const profesionalId = document.getElementById('citaProfesionalSE').value;
            const atencionSel   = document.getElementById('citaAtencionSE');
            const atencionId    = atencionSel.value;
            const fecha         = document.getElementById('citaFechaSE').value;
            const subservicioId = atencionSel.options[atencionSel.selectedIndex]?.dataset.subservicioId;

            if (!esProfesional && !profesionalId) { setCitaError('citaProfesionalSE', 'Seleccione un profesional'); valido = false; }
            if (!atencionId)    { setCitaError('citaAtencionSE',    'Seleccione una atención');   valido = false; }
            if (!fecha)         { setCitaError('citaFechaSE',       'Seleccione fecha y hora');   valido = false; }
            if (!valido) return;

            const _precioCitaSE = parseFloat(document.getElementById('citaPrecio').value) || 0;
            if (_precioCitaSE <= 0) {
                setCitaError('citaPrecio', 'El precio de la cita es requerido');
                return;
            }
            const _descCitaSE   = parseFloat(document.getElementById('citaDescuento').value) || 0;
            const _motivoCitaSE = (_descCitaSE > 0) ? (document.getElementById('citaMotivoDescuento').value.trim() || null) : null;

            payload = {
                tipo_cita:         'sesion_existente',
                paciente_id:       pacienteId,
                atencion_id:       parseInt(atencionId, 10),
                fecha_hora_inicio: fecha,
                modalidad_sesion:  _citaModalidad,
                usar_paquete:      _citaUsarPaquete,
                precio_acordado:   _precioCitaSE,
                descuento_monto:   _descCitaSE,
                motivo_descuento:  _motivoCitaSE,
            };
            if (!esProfesional) {
                payload.profesional_id = parseInt(profesionalId, 10);
            }
        }

        const res = await api('/api/citas', 'POST', payload);

        if (res.success) {
            showToast('Cita creada');
            cerrarModal('modalCita');
            citas();
        } else {
            const fechaField = tipo === 'nueva_atencion' ? 'citaFechaNA' : 'citaFechaSE';
            if (res.message && res.message.toLowerCase().includes('horario')) {
                setCitaError(fechaField, res.message);
            } else {
                showToast(res.message || 'Error al crear cita');
            }
        }
    } finally {
        _isSavingCita = false;
    }
}

// ---- Registrar pago desde listado de citas ----

function abrirPagoCita(citaId, cuentaCobroId, pacienteId, pacienteNombre, montoTotal, saldo, subservicio) {
    if (!cuentaCobroId) { showToast('No hay cuenta de cobro asociada'); return; }

    _pagosPacienteId     = pacienteId     || null;
    _pagosPacienteNombre = pacienteNombre || '';

    const yaCobrado = Math.max(0, (montoTotal || 0) - (saldo || 0));
    _pagosSesionCtx[cuentaCobroId] = {
        sesionNum:      null,
        atencionNombre: subservicio || 'Atención',
        montoTotal:     montoTotal  || 0,
        yaCobrado,
        saldo:          saldo || 0,
    };

    _citasPagoCallback = () => citas();
    abrirModalPago(cuentaCobroId, citaId);
}

function abrirPagoDirectoCita(citaId, pacienteId, pacienteNombre, montoTotal, subservicio) {
    _pagosPacienteId     = pacienteId     || null;
    _pagosPacienteNombre = pacienteNombre || '';

    _pagosSesionCtx['cita_' + citaId] = {
        sesionNum:      null,
        atencionNombre: subservicio || 'Atención',
        montoTotal:     montoTotal  || 0,
        yaCobrado:      0,
        saldo:          montoTotal  || 0,
    };

    _citasPagoCallback = () => citas();
    abrirModalPago(null, citaId);
}


// ---- Reprogramar ----

function abrirModalReprogramar(citaId) {
    document.getElementById('citaReprogramarId').value   = citaId;
    document.getElementById('citaNuevaFecha').value      = '';
    document.getElementById('citaMotivoReprog').value    = '';
    setReprogError('citaNuevaFecha',   '');
    setReprogError('citaMotivoReprog', '');
    document.getElementById('modalReprogramar').classList.remove('hidden');
}

async function guardarReprogramacion() {
    const id         = document.getElementById('citaReprogramarId').value;
    const nuevaFecha = document.getElementById('citaNuevaFecha').value;
    const motivo     = document.getElementById('citaMotivoReprog').value.trim();

    let valido = true;

    setReprogError('citaNuevaFecha',   '');
    setReprogError('citaMotivoReprog', '');

    if (!nuevaFecha) {
        setReprogError('citaNuevaFecha', 'Seleccione la nueva fecha y hora');
        valido = false;
    }
    if (!motivo) {
        setReprogError('citaMotivoReprog', 'El motivo es obligatorio');
        valido = false;
    }

    if (!valido) return;

    const res = await api('/api/citas/reprogramar', 'POST', {
        id:          parseInt(id),
        nueva_fecha: nuevaFecha,
        motivo,
    });

    if (res.success) {
        showToast('Cita reprogramada correctamente');
        cerrarModal('modalReprogramar');
        citas();
    } else {
        if (res.message && res.message.toLowerCase().includes('horario')) {
            setReprogError('citaNuevaFecha', res.message);
        } else {
            showToast(res.message || 'Error al reprogramar');
        }
    }
}

// ---- Cambiar estado ----

async function cambiarEstadoCita(id, estado) {
    if (estado === 'cancelada') {
        if (!confirm('¿Realmente desea cancelar esta cita? Esta acción no se puede deshacer.')) {
            return;
        }
    }

    const res = await api('/api/citas/estado', 'PUT', { id, estado });
    if (res.success) {
        showToast('Estado actualizado');
        citas();
    } else {
        showToast(res.message || 'Error');
    }
}



// ---- Modal gestión de atención desde cita ----

async function abrirModalGestionAtencion(citaId, pacienteId, profesionalId, fechaHora,
        tipoCita, atencionId, subservicioId, duracionMin, precioBase,
        nombrePaciente, nombreProfesional, nombreSubservicio,
        precioCita, descuentoCita, motivoDescCita, modalidadSesion = 'presencial',
        subservicioModalidad = 'individual') {

    _citaActiva = { id: citaId, paciente_id: pacienteId, profesional_id: profesionalId, fecha_hora: fechaHora, subservicio_modalidad: subservicioModalidad };

    const titulo  = document.getElementById('gestionModalTitle');

    // Reset estado visual
    document.getElementById('gAtInfoFija').style.display             = 'none';
    document.getElementById('gAtSubservicioSelectWrap').style.display = '';

    if (tipoCita !== 'sesion_existente') {
        titulo.textContent    = 'Abrir nueva atención';
        document.getElementById('gestionTabsBar').style.display = 'none';
        document.getElementById('tabSesion').style.display = 'none';
        document.getElementById('tabAtencion').style.display = '';

        document.getElementById('gAtPacienteId').value    = pacienteId;
        document.getElementById('gAtProfesionalId').value = profesionalId;
        document.getElementById('gAtCitaId').value        = citaId;

        // Contexto de cita (solo lectura)
        document.getElementById('gAtInfoPaciente').textContent    = nombrePaciente    || '';
        document.getElementById('gAtInfoProfesional').textContent = nombreProfesional || '';
        document.getElementById('gAtInfoSubservicio').textContent =
            (nombreSubservicio || '') + (modalidadSesion ? ` · ${modalidadSesion}` : '');
        document.getElementById('gAtInfoFecha').textContent = fechaHora ? formatFecha(fechaHora) : '';

        if (precioCita != null && precioCita > 0) {
            const descNum = parseFloat(descuentoCita || 0);
            const final   = Math.max(0, precioCita - descNum);
            let txt = `S/ ${parseFloat(precioCita).toFixed(2)}`;
            if (descNum > 0) {
                txt = `S/ ${precioCita.toFixed(2)} → <strong>S/ ${final.toFixed(2)}</strong> <span class="ctx-mini">(con descuento de S/ ${descNum.toFixed(2)})</span>`;
            }
            document.getElementById('gAtInfoPrecio').innerHTML = txt;
        } else {
            document.getElementById('gAtInfoPrecio').textContent = 'No especificado';
        }
        document.getElementById('gAtInfoFija').style.display = '';

        // Ocultar campos que vienen de la cita; mostrar primera sesión
        document.getElementById('gAtSubservicioSelectWrap').style.display = 'none';
        document.getElementById('gAtCamposPrecioFecha').style.display     = 'none';
        document.getElementById('gAt1raSesionSection').style.display      = '';

        // Reset campos clínicos y primera sesión
        ['gAtNumSesiones','gAtMotivoConsulta','gAtObsGeneral','gAtObsConducta',
         'gAtAntecedentes','gAtRecomendaciones','gAt1raSesionNota',
         'gAt1raSesionNotaCompartida','gAt1raSesionNotaPrivadaP1',
         'gAt1raSesionNotaPrivadaP2','gAt1raSesionNotaPrivadaP3'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        _gAtFechaNacimiento = '';
        const gAtFechaNacIndRow = document.getElementById('gAtFechaNacIndRow');
        if (gAtFechaNacIndRow) gAtFechaNacIndRow.style.display = '';

        // Reset sección de tareas inline
        const _gAtTareasSection = document.getElementById('gAtTareasWrapper');
        if (typeof _resetTareasInline === 'function') _resetTareasInline(_gAtTareasSection);

        const isGrupal = ['pareja', 'familiar', 'grupal'].includes((subservicioModalidad || '').toLowerCase());
        
        // Mostrar/Ocultar secciones según modalidad
        const gAtDatosEditablesInd = document.getElementById('gAtDatosEditablesIndividual');
        const gAtPartSection       = document.getElementById('gAtParticipantesSection');
        const gAtNotaWrap          = document.getElementById('gAt1raSesionNotaWrap');
        
        if (gAtDatosEditablesInd) gAtDatosEditablesInd.style.display = isGrupal ? 'none' : '';
        if (gAtPartSection)       gAtPartSection.style.display       = isGrupal ? '' : 'none';
        if (gAtNotaWrap)          gAtNotaWrap.style.display          = isGrupal ? 'none' : '';

        document.getElementById('gAtSharedNoteWrap').style.display = isGrupal ? '' : 'none';
        document.getElementById('btnGAtAddPart').style.display     = isGrupal ? 'inline-flex' : 'none';
        
        // Cargar datos sociodemográficos del titular antes de inicializar cards
        let titularExtra = { grado_instruccion: 'no_especificado', ocupacion: '', estado_civil: 'no_especificado', sexo: 'no_especificado', fecha_nacimiento: '' };
        try {
            const pRes = await api(`/api/paciente?id=${pacienteId}`);
            if (pRes.success && pRes.data) {
                const p = pRes.data;
                titularExtra.grado_instruccion = p.grado_instruccion || 'no_especificado';
                titularExtra.ocupacion         = p.ocupacion         || '';
                titularExtra.estado_civil      = p.estado_civil      || 'no_especificado';
                titularExtra.sexo              = p.sexo              || 'no_especificado';
                titularExtra.fecha_nacimiento  = p.fecha_nacimiento  || '';
 
                // Pre-llenar campos si es individual
                if (!isGrupal && gAtDatosEditablesInd) {
                    document.getElementById('gAtGradoInstruccionInd').value = titularExtra.grado_instruccion;
                    document.getElementById('gAtOcupacionInd').value        = titularExtra.ocupacion;
                    document.getElementById('gAtEstadoCivilInd').value      = titularExtra.estado_civil;

                    const sVal    = titularExtra.sexo || 'no_especificado';
                    const fVal    = titularExtra.fecha_nacimiento || '';
                    const fechaRef = (_citaActiva?.fecha_hora || '').slice(0, 10);

                    document.getElementById('gAtSexoInd').value     = sVal;
                    document.getElementById('gAtFechaNacInd').value  = fVal;

                    const gAtFNRow = document.getElementById('gAtFechaNacIndRow');
                    const labels   = { masculino: 'Masculino', femenino: 'Femenino', otro: 'Otro' };

                    if (sVal !== 'no_especificado' && fVal) {
                        // Ambos presentes: display compacto "Femenino · 28 años"
                        _gAtFechaNacimiento = fVal;
                        const edad    = _calcEdad(fVal, fechaRef);
                        const edadStr = edad !== null ? `${edad} años` : 'edad desconocida';
                        _gAtToggleReadonly('gAtSexoInd', true, `${labels[sVal] || sVal} · ${edadStr}`);
                        _gAtToggleReadonly('gAtFechaNacInd', false);
                        if (gAtFNRow) gAtFNRow.style.display = 'none';
                    } else if (sVal !== 'no_especificado') {
                        // Solo sexo: sexo readonly, fecha editable
                        _gAtFechaNacimiento = '';
                        _gAtToggleReadonly('gAtSexoInd', true, labels[sVal] || sVal);
                        _gAtToggleReadonly('gAtFechaNacInd', false);
                        if (gAtFNRow) gAtFNRow.style.display = '';
                    } else {
                        // Ninguno: ambos editables
                        _gAtFechaNacimiento = '';
                        _gAtToggleReadonly('gAtSexoInd', false);
                        _gAtToggleReadonly('gAtFechaNacInd', false);
                        if (gAtFNRow) gAtFNRow.style.display = '';
                    }
                }
            }
        } catch(e) { console.error("Error cargando perfil titular", e); }

        if (isGrupal) {
            _gAtParticipantes = [];
            _gAtAgregarParticipante({ 
                paciente_id: pacienteId, 
                nombre: nombrePaciente, 
                nota_privada: '', 
                dx: null,
                relacion: 'Titular',
                ...titularExtra
            });
            _gAtRedrawParticipantes();
        }

        document.getElementById('gAt1raSesionDuracion').value = duracionMin || 50;
        document.getElementById('gAt1raSesionDuracion-error').textContent = '';

        _gAtDxReset();

        // Reset tareas inline
        const gAtTareasWrapper = document.getElementById('gAtTareasWrapper');
        if (typeof _resetTareasInline === 'function') _resetTareasInline(gAtTareasWrapper);

        // Reiniciar adjuntos de primera sesión y activar drop zone
        if (typeof _adjPendientes !== 'undefined') {
            _adjPendientes = [];
            if (typeof _adjRenderPendientes === 'function') _adjRenderPendientes('gAtAdjPendientes');
            requestAnimationFrame(() => {
                if (typeof _adjIniciarDropZone === 'function')
                    _adjIniciarDropZone('gAtAdjDrop', 'gAtAdjInput', 'gAtAdjPendientes');
            });
        }

        // (Datos ya cargados arriba antes de inicializar _gAtParticipantes)

    } else {
        // FLUJO: sesion_existente -> Redirigir al modal enriquecido de sesión
        if (atencionId) {
            // Pre-llenar modalidad y precio de la cita para herencia
            _citaModalidad = modalidadSesion || 'presencial';
            _gSesionPrecio = precioCita != null ? parseFloat(precioCita) : 0;

            const [rNum, aRes] = await Promise.all([
                api(`/api/atenciones/sesion-siguiente?atencion_id=${atencionId}`),
                api(`/api/atencion?id=${atencionId}`)
            ]);

            const atencion  = aRes.success ? aRes.data : null;
            if (atencion) {
                const modalidad = (atencion.subservicio_modalidad || 'individual').toLowerCase();
                const esGrupal  = ['pareja', 'familiar', 'grupal'].includes(modalidad);

                // Estado global de atención
                _currentAtencion = atencion;
                _atencionBack    = () => citas();

                const citaContext = {
                    id: citaId,
                    precio: _gSesionPrecio,
                    modalidad: _citaModalidad
                };

                let siguienteNum = 1;
                if (esGrupal) {
                    siguienteNum = (atencion.sesiones_grupo?.length ?? 0) + 1;
                } else {
                    siguienteNum = rNum.data?.numero_siguiente ?? 1;
                }

                await abrirModalSesion(parseInt(atencionId), siguienteNum, citaContext);
                return; // Importante: salir para no mostrar modalGestionAtencion
            }
        }
    }

    document.getElementById('modalGestionAtencion').classList.remove('hidden');
}


// ---- Gestión de participantes dinámicos en Nueva Atención Grupal ----

let _gAtParticipantes = []; // [{paciente_id, nombre, nota_privada, dx, grado_instruccion, ocupacion, estado_civil, sexo, fecha_nacimiento, relacion}]

function _gAtAgregarParticipante(datos = null) {
    const index = _gAtParticipantes.length;
    _gAtParticipantes.push(datos || { 
        paciente_id: '', 
        nombre: '', 
        nota_privada: '', 
        dx: null,
        grado_instruccion: 'no_especificado',
        ocupacion: '',
        estado_civil: 'no_especificado',
        sexo: 'no_especificado',
        fecha_nacimiento: '',
        relacion: index === 0 ? 'Titular' : ''
    });
    _gAtRenderParticipanteCard(index);
}

function _gAtEliminarParticipante(index) {
    if (index === 0) return; // No eliminar al titular
    _gAtParticipantes.splice(index, 1);
    _gAtRedrawParticipantes();
}

function _gAtRedrawParticipantes() {
    const container = document.getElementById('gAtParticipantesList');
    if (!container) return;
    container.innerHTML = '';
    const temp = [..._gAtParticipantes];
    _gAtParticipantes = [];
    temp.forEach(p => _gAtAgregarParticipante(p));
}

function _gAtRenderParticipanteCard(index) {
    const container = document.getElementById('gAtParticipantesList');
    const p = _gAtParticipantes[index];
    const isTitular = (index === 0);

    const hasSexo  = !!(p.sexo && p.sexo !== 'no_especificado');
    const hasFecha = !!p.fecha_nacimiento;
    const _fechaRefPart = (_citaActiva?.fecha_hora || new Date().toISOString()).slice(0, 10);
    const _edadCalcPart = (hasSexo && hasFecha && typeof _calcEdad === 'function')
        ? _calcEdad(p.fecha_nacimiento, _fechaRefPart) : null;
    const _edadStrPart  = _edadCalcPart !== null ? `${_edadCalcPart} años` : 'edad desconocida';
    const _sxLblsPart   = { masculino: 'Masculino', femenino: 'Femenino', otro: 'Otro' };

    const card = document.createElement('div');
    card.className = 'form-group';
    card.style = `border: 1px dashed var(--color-border); padding: 14px; border-radius: var(--radius); background: var(--color-surface); position: relative;`;
    
    let headerHtml = '';
    if (isTitular) {
        headerHtml = `
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <label style="margin:0; font-weight:700; color:var(--color-primary); font-size: 11px; text-transform: uppercase;">Participante Titular</label>
                <span class="badge badge-info" style="font-size:10px">Principal</span>
            </div>
            <div class="readonly-field" style="margin-bottom:10px">${p.nombre || 'Cargando...'}</div>
            <input type="hidden" id="gAtPartId_${index}" value="${p.paciente_id}">
        `;
    } else {
        headerHtml = `
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <label style="margin:0; font-weight:700; color:var(--color-primary); font-size: 11px; text-transform: uppercase;">Integrante #${index + 1}</label>
                <button type="button" onclick="_gAtEliminarParticipante(${index})" style="background:none; border:none; color:var(--color-danger); cursor:pointer; font-size:18px; line-height: 1;">&times;</button>
            </div>
            <div class="combobox" id="gAtPartCombo_${index}" style="margin-bottom: 10px;">
                <div class="combobox-input-wrap">
                    <input type="text" id="gAtPartInput_${index}" placeholder="Buscar paciente..." autocomplete="off" value="${p.nombre}" oninput="_gAtBuscarPacientePart(${index}, this.value)">
                    <button type="button" class="combobox-clear ${p.paciente_id ? '' : 'hidden'}" id="gAtPartClear_${index}" onclick="_gAtLimpiarPart(${index})">×</button>
                </div>
                <ul class="combobox-list hidden" id="gAtPartLista_${index}"></ul>
            </div>
            <input type="hidden" id="gAtPartId_${index}" value="${p.paciente_id}">
        `;
    }

    card.innerHTML = `
        ${headerHtml}
        
        <div class="form-row" style="margin-bottom: 10px; gap: 8px;">
            <div class="form-group" style="flex:1; margin:0">
                <label style="font-size:10px">Grado Instrucción</label>
                <select id="gAtPartGrado_${index}" style="padding:4px 6px; font-size:11px" onchange="_gAtUpdatePartData(${index}, 'grado_instruccion', this.value)">
                    <option value="no_especificado" ${p.grado_instruccion === 'no_especificado' ? 'selected' : ''}>No especificado</option>
                    <option value="primaria_incompleta" ${p.grado_instruccion === 'primaria_incompleta' ? 'selected' : ''}>Primaria incompleta</option>
                    <option value="primaria_completa" ${p.grado_instruccion === 'primaria_completa' ? 'selected' : ''}>Primaria completa</option>
                    <option value="secundaria_incompleta" ${p.grado_instruccion === 'secundaria_incompleta' ? 'selected' : ''}>Secundaria incompleta</option>
                    <option value="secundaria_completa" ${p.grado_instruccion === 'secundaria_completa' ? 'selected' : ''}>Secundaria completa</option>
                    <option value="superior_incompleto" ${p.grado_instruccion === 'superior_incompleto' ? 'selected' : ''}>Superior incompleto</option>
                    <option value="superior_completo" ${p.grado_instruccion === 'superior_completo' ? 'selected' : ''}>Superior completo</option>
                    <option value="posgrado" ${p.grado_instruccion === 'posgrado' ? 'selected' : ''}>Posgrado</option>
                </select>
            </div>
            <div class="form-group" style="flex:1; margin:0">
                <label style="font-size:10px">Ocupación</label>
                <input type="text" id="gAtPartOcupacion_${index}" value="${p.ocupacion || ''}" placeholder="Ej: Docente" style="padding:4px 6px; font-size:11px" oninput="_gAtUpdatePartData(${index}, 'ocupacion', this.value)">
            </div>
        </div>

        <div class="form-row" style="margin-bottom: 12px; gap: 8px;">
            <div class="form-group" style="flex:1; margin:0">
                <label style="font-size:10px">Estado Civil</label>
                <select id="gAtPartEstado_${index}" style="padding:4px 6px; font-size:11px" onchange="_gAtUpdatePartData(${index}, 'estado_civil', this.value)">
                    <option value="no_especificado" ${p.estado_civil === 'no_especificado' ? 'selected' : ''}>No especificado</option>
                    <option value="soltero" ${p.estado_civil === 'soltero' ? 'selected' : ''}>Soltero/a</option>
                    <option value="casado" ${p.estado_civil === 'casado' ? 'selected' : ''}>Casado/a</option>
                    <option value="conviviente" ${p.estado_civil === 'conviviente' ? 'selected' : ''}>Conviviente</option>
                    <option value="divorciado" ${p.estado_civil === 'divorciado' ? 'selected' : ''}>Divorciado/a</option>
                    <option value="separado" ${p.estado_civil === 'separado' ? 'selected' : ''}>Separado/a</option>
                    <option value="viudo" ${p.estado_civil === 'viudo' ? 'selected' : ''}>Viudo/a</option>
                </select>
            </div>
            <div class="form-group" style="flex:1; margin:0">
                <label style="font-size:10px">${hasSexo && hasFecha ? 'Sexo y edad' : 'Sexo'}</label>
                ${hasSexo && hasFecha
                    ? `<div class="readonly-field" style="padding:4px 6px; font-size:11px">${_sxLblsPart[p.sexo] || p.sexo} · ${_edadStrPart}</div>`
                    : hasSexo
                        ? `<div class="readonly-field" style="padding:4px 6px; font-size:11px">${_sxLblsPart[p.sexo] || p.sexo}</div>`
                        : `<select id="gAtPartSexo_${index}" style="padding:4px 6px; font-size:11px" onchange="_gAtUpdatePartData(${index}, 'sexo', this.value)">
                            <option value="no_especificado" ${!p.sexo || p.sexo === 'no_especificado' ? 'selected' : ''}>No especificado</option>
                            <option value="masculino" ${p.sexo === 'masculino' ? 'selected' : ''}>Masculino</option>
                            <option value="femenino" ${p.sexo === 'femenino' ? 'selected' : ''}>Femenino</option>
                            <option value="otro" ${p.sexo === 'otro' ? 'selected' : ''}>Otro</option>
                        </select>`}
            </div>
        </div>

        <div class="form-row" style="margin-bottom: 12px; gap: 8px;">
            <div class="form-group" style="flex:1; margin:0${hasSexo && hasFecha ? '; display:none' : ''}">
                <label style="font-size:10px">Fecha Nacimiento</label>
                <input type="date" id="gAtPartFechaNac_${index}" value="${p.fecha_nacimiento || ''}" style="padding:4px 6px; font-size:11px" onchange="_gAtUpdatePartData(${index}, 'fecha_nacimiento', this.value)">
            </div>
            <div class="form-group" style="flex:1; margin:0">
                <label style="font-size:10px">Relación con titular</label>
                <input type="text" id="gAtPartRelacion_${index}" value="${p.relacion || ''}" placeholder="${isTitular ? 'Titular' : 'Ej: Esposo, Hijo'}"
                       ${isTitular ? 'readonly class="readonly-field"' : ''}
                       style="padding:4px 6px; font-size:11px" oninput="_gAtUpdatePartData(${index}, 'relacion', this.value)">
            </div>
        </div>

        <label style="display:flex;align-items:center;gap:4px; font-size: 11px; margin-bottom:4px;">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="8" width="10" height="7" rx="1"/><path d="M5 8V5a3 3 0 0 1 6 0v3"/></svg> 
            Observación clínica privada (Individual)
        </label>
        <textarea id="gAtPartNota_${index}" rows="2" class="textarea-privado" placeholder="Hallazgos específicos de este integrante..." onchange="_gAtUpdatePartData(${index}, 'nota_privada', this.value)">${p.nota_privada || ''}</textarea>

        <div style="margin-top:12px; border-top: 1px solid var(--color-border-tertiary); padding-top:10px;">
            <p style="font-size:10px; font-weight:700; color:var(--color-text-muted); text-transform:uppercase; margin-bottom:6px;">Diagnóstico Individual (Opcional)</p>
            <div style="display:flex; gap:6px; align-items:flex-end; flex-wrap:wrap;">
                <div class="form-group" style="flex:1; min-width:180px; margin:0; position:relative">
                    <input type="text" id="gAtPartDxInput_${index}" placeholder="Buscar CIE-10..." autocomplete="off" oninput="_gAtBuscarDxPart(${index}, this.value)" 
                           style="width:100%; padding:6px 10px; border:1px solid var(--color-border); border-radius:var(--radius); font-size:.8rem">
                    <div id="gAtPartDxLista_${index}" style="display:none; position:absolute; z-index:999; top:100%; left:0; right:0; background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius); box-shadow:var(--shadow); max-height:150px; overflow-y:auto"></div>
                </div>
                <select id="gAtPartDxJerarquia_${index}" style="padding:6px 5px; border:1px solid var(--color-border); border-radius:var(--radius); font-size:.75rem; width:90px">
                    <option value="principal">Principal</option>
                    <option value="secundario" selected>Secundario</option>
                </select>
                <button type="button" class="btn-sm" onclick="_gAtAsignarDxPart(${index})" style="padding:6px 10px; font-size:11px;">Asignar</button>
            </div>
            <div id="gAtPartDxSeleccionado_${index}" style="margin-top:5px; font-size:11px;">
                ${p.dx ? `<span class="badge badge-info">${p.dx.codigo} - ${p.dx.jerarquia} <button onclick="_gAtQuitarDxPart(${index})" style="background:none;border:none;color:white;cursor:pointer;padding-left:4px">&times;</button></span>` : '<span style="color:var(--color-text-muted)">Sin diagnóstico</span>'}
            </div>
        </div>
    `;

    container.appendChild(card);
}

function _gAtUpdatePartData(index, field, value) {
    if (_gAtParticipantes[index]) {
        _gAtParticipantes[index][field] = value;
    }
}

async function _gAtBuscarPacientePart(index, termino) {
    const lista = document.getElementById(`gAtPartLista_${index}`);
    if (termino.length < 2) { lista.classList.add('hidden'); return; }
    
    const res = await api(`/api/pacientes?q=${encodeURIComponent(termino)}`);
    const pacientes = res.data || [];
    lista.innerHTML = '';
    lista.classList.remove('hidden');

    if (pacientes.length === 0) {
        lista.innerHTML = '<li class="combobox-item disabled">Sin resultados</li>';
    } else {
        pacientes.forEach(p => {
            const li = document.createElement('li');
            li.className = 'combobox-item';
            const nom = `${p.apellidos}, ${p.nombres} — ${p.dni}`;
            li.textContent = nom;
            li.onclick = async () => {
                const pFull = await api(`/api/paciente?id=${p.id}`);
                const pf = pFull.data || {};
                
                _gAtParticipantes[index].paciente_id      = p.id;
                _gAtParticipantes[index].nombre           = nom;
                _gAtParticipantes[index].grado_instruccion = pf.grado_instruccion || 'no_especificado';
                _gAtParticipantes[index].ocupacion         = pf.ocupacion         || '';
                _gAtParticipantes[index].estado_civil      = pf.estado_civil      || 'no_especificado';
                _gAtParticipantes[index].sexo              = pf.sexo              || 'no_especificado';
                _gAtParticipantes[index].fecha_nacimiento  = pf.fecha_nacimiento  || '';
                _gAtParticipantes[index].edad              = pf.edad;

                _gAtRedrawParticipantes();
            };
            lista.appendChild(li);
        });
    }
}

function _gAtLimpiarPart(index) {
    _gAtParticipantes[index].paciente_id = '';
    _gAtParticipantes[index].nombre = '';
    document.getElementById(`gAtPartId_${index}`).value = '';
    document.getElementById(`gAtPartInput_${index}`).value = '';
    document.getElementById(`gAtPartClear_${index}`).classList.add('hidden');
}

// --- Diagnósticos individuales ---
async function _gAtBuscarDxPart(index, termino) {
    const lista = document.getElementById(`gAtPartDxLista_${index}`);
    if (termino.length < 2) { lista.style.display = 'none'; return; }
    
    const res = await api(`/api/cie10/buscar?q=${encodeURIComponent(termino)}`);
    const dxs = res.data || [];
    lista.innerHTML = '';
    lista.style.display = 'block';

    dxs.forEach(d => {
        const div = document.createElement('div');
        div.className = 'combobox-item';
        div.style = 'padding:6px 10px; font-size:12px; cursor:pointer';
        div.textContent = `${d.codigo} - ${d.descripcion}`;
        div.onclick = () => {
            document.getElementById(`gAtPartDxInput_${index}`).value = d.codigo;
            document.getElementById(`gAtPartDxInput_${index}`).dataset.desc = d.descripcion;
            lista.style.display = 'none';
        };
        lista.appendChild(div);
    });
}

function _gAtAsignarDxPart(index) {
    const codigo = document.getElementById(`gAtPartDxInput_${index}`).value;
    if (!codigo) return;
    const jerarquia = document.getElementById(`gAtPartDxJerarquia_${index}`).value;
    
    _gAtParticipantes[index].dx = { codigo, jerarquia, nivel_certeza: 'presuntivo' };
    
    document.getElementById(`gAtPartDxSeleccionado_${index}`).innerHTML = `
        <span class="badge badge-info">${codigo} - ${jerarquia} 
        <button type="button" onclick="_gAtQuitarDxPart(${index})" style="background:none;border:none;color:white;cursor:pointer;padding-left:4px">&times;</button></span>
    `;
    document.getElementById(`gAtPartDxInput_${index}`).value = '';
}

function _gAtQuitarDxPart(index) {
    _gAtParticipantes[index].dx = null;
    document.getElementById(`gAtPartDxSeleccionado_${index}`).innerHTML = '<span style="color:var(--color-text-muted)">Sin diagnóstico</span>';
}

async function cargarSubserviciosParaGestion() {
    const sel = document.getElementById('gAtSubservicio');
    sel.innerHTML = '<option value="">Seleccionar…</option>';
    const res = await api('/api/subservicios');
    if (res.data) {
        res.data.forEach(s => {
            const opt        = document.createElement('option');
            opt.value                    = s.id;
            opt.dataset.precio           = s.precio_base;
            opt.dataset.descuentoVirtual = s.descuento_virtual ?? 10;
            opt.dataset.duracion         = s.duracion_min || 50;
            opt.dataset.modalidad        = s.modalidad;
            opt.textContent  = `${s.servicio} — ${s.nombre} (${s.modalidad}, S/ ${parseFloat(s.precio_base).toFixed(2)})`;
            sel.appendChild(opt);
        });
    }
}

function onSubservicioGestionChange() {
    const sel    = document.getElementById('gAtSubservicio');
    const selOpt = sel.options[sel.selectedIndex];
    if (sel.value && selOpt.dataset.precio) {
        document.getElementById('gAtPrecio').value = parseFloat(selOpt.dataset.precio).toFixed(2);
        
        if (_citaActiva) {
            _citaActiva.subservicio_modalidad = selOpt.dataset.modalidad;
            const isGrupal = ['pareja', 'familiar', 'grupal'].includes((selOpt.dataset.modalidad || '').toLowerCase());
            document.getElementById('gAt1raSesionNotaWrap').style.display = isGrupal ? 'none' : '';
            document.getElementById('gAt1raSesionGrupalWrap').style.display = isGrupal ? '' : 'none';
        }
    }
}

async function cargarDatosPacienteParaGestion(pacienteId) {
    // Deprecated: Los datos ahora se cargan inline en abrirModalGestionAtencion
    // para evitar colisiones con el sistema de cards dinámicas.
    return null;
}

// ---- CIE-10 en modal "Abrir nueva atención" desde citas ----

function _gAtDxOnInput() {
    clearTimeout(_gAtDxTimer);
    const q = (document.getElementById('gAtDxSearchInput')?.value || '').trim();
    if (q.length < 2) { _gAtDxOcultarDropdown(); return; }
    _gAtDxTimer = setTimeout(() => _gAtDxFetch(q), 280);
}

async function _gAtDxFetch(q) {
    const res = await api(`/api/cie10/buscar?q=${encodeURIComponent(q)}`);
    _gAtDxResults = res.data || [];
    const dd = document.getElementById('gAtDxDropdown');
    if (!dd) return;
    if (!_gAtDxResults.length) { dd.style.display = 'none'; return; }
    dd.innerHTML = _gAtDxResults.map((r, i) => `
        <div onclick="_gAtDxSelect(${i})"
             style="padding:7px 10px;cursor:pointer;font-size:.82rem;border-bottom:1px solid var(--color-border)"
             onmouseover="this.style.background='var(--color-bg)'"
             onmouseout="this.style.background=''">
            <strong>${r.codigo}</strong> — ${r.descripcion_corta || r.descripcion}
        </div>`).join('');
    dd.style.display = '';
}

function _gAtDxSelect(idx) {
    const r = _gAtDxResults[idx];
    if (!r) return;
    document.getElementById('gAtDxSelectedCode').value     = r.codigo;
    document.getElementById('gAtDxSelectedInfo').textContent = `${r.codigo} — ${r.descripcion_corta || r.descripcion}`;
    document.getElementById('gAtDxSearchInput').value       = `${r.codigo} — ${r.descripcion_corta || r.descripcion}`;
    _gAtDxOcultarDropdown();
    _gAtDxOcultarError();
}

function _gAtDxOcultarDropdown() {
    const dd = document.getElementById('gAtDxDropdown');
    if (dd) dd.style.display = 'none';
}

function _gAtDxMostrarError(msg) {
    const el = document.getElementById('gAtDxErrorMsg');
    if (el) { el.textContent = msg; el.style.display = ''; }
}

function _gAtDxOcultarError() {
    const el = document.getElementById('gAtDxErrorMsg');
    if (el) el.style.display = 'none';
}

function _gAtDxAgregar() {
    _gAtDxOcultarError();
    const codigo      = (document.getElementById('gAtDxSelectedCode')?.value || '').trim();
    const descripcion = document.getElementById('gAtDxSelectedInfo')?.textContent || '';
    const jerarquia   = document.getElementById('gAtDxJerarquia')?.value    || 'principal';
    const nivelCerteza = document.getElementById('gAtDxNivelCerteza')?.value || 'presuntivo';
    if (!codigo) { _gAtDxMostrarError('Seleccione un diagnóstico de la lista.'); return; }
    if (_gAtDxList.some(d => d.codigo === codigo)) { _gAtDxMostrarError('Este código ya fue agregado.'); return; }
    if (jerarquia === 'principal' && _gAtDxList.some(d => d.jerarquia === 'principal')) {
        _gAtDxMostrarError('Ya hay un diagnóstico principal. Cambie la jerarquía o retire el anterior.');
        return;
    }
    _gAtDxList.push({ codigo, descripcion, jerarquia, nivel_certeza: nivelCerteza });
    _gAtDxRenderList();
    document.getElementById('gAtDxSearchInput').value   = '';
    document.getElementById('gAtDxSelectedCode').value  = '';
    document.getElementById('gAtDxSelectedInfo').textContent = 'Ningún código seleccionado';
    document.getElementById('gAtDxJerarquia').value     = 'principal';
    document.getElementById('gAtDxNivelCerteza').value  = 'presuntivo';
}

function _gAtDxQuitar(idx) {
    _gAtDxList.splice(idx, 1);
    _gAtDxRenderList();
}

function _gAtDxRenderList() {
    const container = document.getElementById('gAtDxList');
    if (!container) return;
    const JERARQUIA_LABEL = { principal: 'Principal', secundario: 'Secundario' };
    const CERTEZA_LABEL   = { definitivo: 'Definitivo', presuntivo: 'Presuntivo', descartado: 'Descartado' };
    const JERARQUIA_COLOR = { principal: 'var(--color-primary)', secundario: 'var(--color-text-muted)' };
    const CERTEZA_COLOR   = { definitivo: 'var(--color-success)', presuntivo: 'var(--color-warning)', descartado: 'var(--color-danger)' };
    if (!_gAtDxList.length) { container.innerHTML = ''; return; }
    container.innerHTML = _gAtDxList.map((d, i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--color-bg);border-radius:var(--radius);border:1px solid var(--color-border);font-size:.82rem">
            <span style="flex:1"><strong>${d.codigo}</strong> — ${d.descripcion}</span>
            <span style="padding:2px 7px;border-radius:20px;font-size:.72rem;font-weight:600;background:${JERARQUIA_COLOR[d.jerarquia]}22;color:${JERARQUIA_COLOR[d.jerarquia]}">${JERARQUIA_LABEL[d.jerarquia]||d.jerarquia}</span>
            <span style="padding:2px 7px;border-radius:20px;font-size:.72rem;font-weight:600;background:${CERTEZA_COLOR[d.nivel_certeza]}22;color:${CERTEZA_COLOR[d.nivel_certeza]}">${CERTEZA_LABEL[d.nivel_certeza]||d.nivel_certeza}</span>
            <button onclick="_gAtDxQuitar(${i})" style="background:none;border:none;cursor:pointer;color:var(--color-danger);font-size:1rem;line-height:1;padding:0 2px" title="Quitar">×</button>
        </div>`).join('');
}

function _gAtDxReset() {
    _gAtDxList    = [];
    _gAtDxResults = [];
    clearTimeout(_gAtDxTimer);
    const ids = ['gAtDxSearchInput', 'gAtDxSelectedCode'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const info = document.getElementById('gAtDxSelectedInfo');
    if (info) info.textContent = 'Ningún código seleccionado';
    _gAtDxOcultarDropdown();
    _gAtDxOcultarError();
    const list = document.getElementById('gAtDxList');
    if (list) list.innerHTML = '';
    const jer = document.getElementById('gAtDxJerarquia');
    if (jer) jer.value = 'principal';
    const niv = document.getElementById('gAtDxNivelCerteza');
    if (niv) niv.value = 'presuntivo';
}

// Cerrar dropdown al hacer clic fuera
document.addEventListener('click', e => {
    const input = document.getElementById('gAtDxSearchInput');
    const dd    = document.getElementById('gAtDxDropdown');
    if (dd && input && !input.contains(e.target) && !dd.contains(e.target)) {
        dd.style.display = 'none';
    }
});

async function abrirNuevaAtencionDesdeCita() {
    if (_isSavingCita) return;
    _isSavingCita = true;

    try {
        const pacienteId    = document.getElementById('gAtPacienteId').value;
    const profesionalId = document.getElementById('gAtProfesionalId').value;
    const citaId        = document.getElementById('gAtCitaId').value;
    const motivo        = document.getElementById('gAtMotivoConsulta').value.trim();
    const obsGen        = document.getElementById('gAtObsGeneral').value.trim();
    const obsCon        = document.getElementById('gAtObsConducta').value.trim();
    const antec         = document.getElementById('gAtAntecedentes').value.trim();
    const numSes        = document.getElementById('gAtNumSesiones').value;
    const recomend      = document.getElementById('gAtRecomendaciones').value.trim();
    
    // Detectar si estamos en el flujo nueva_atencion (con primera sesión)
    const is1raSesion = document.getElementById('gAt1raSesionSection')?.style.display !== 'none';
    const duracion1ra = is1raSesion ? document.getElementById('gAt1raSesionDuracion').value : null;

    // 1. Limpiar errores
    ['gAtMotivoConsulta', 'gAt1raSesionDuracion'].forEach(id => {
        const err = document.getElementById(id + '-error');
        const inp = document.getElementById(id);
        if (err) err.textContent = '';
        if (inp) inp.classList.remove('is-invalid');
    });

    // 2. Validación básica
    let valido = true;
    const setErr = (id, msg) => {
        const err = document.getElementById(id + '-error');
        const inp = document.getElementById(id);
        if (err) err.textContent = msg;
        if (inp) inp.classList.add('is-invalid');
        valido = false;
    };

    if (!motivo) setErr('gAtMotivoConsulta', 'El motivo es obligatorio');
    if (is1raSesion && (!duracion1ra || parseInt(duracion1ra) <= 0)) {
        setErr('gAt1raSesionDuracion', 'La duración es requerida');
    }

    if (!is1raSesion) {
        // Validación para modo "completar manual"
        const subservicioId = document.getElementById('gAtSubservicio').value;
        const precio        = document.getElementById('gAtPrecio').value;
        const fechaInicio   = document.getElementById('gAtFechaInicio').value;
        ['gAtSubservicio', 'gAtPrecio', 'gAtFechaInicio'].forEach(id => {
            const err = document.getElementById(id + '-error');
            const inp = document.getElementById(id);
            if (err) err.textContent = '';
            if (inp) inp.classList.remove('is-invalid');
        });
        if (!subservicioId) setErr('gAtSubservicio', 'Seleccione un servicio');
        if (!precio)        setErr('gAtPrecio',       'Requerido');
        if (!fechaInicio)   setErr('gAtFechaInicio',  'Requerido');
    }

    if (!valido) return;

    // 3. Recolectar participantes dinámicos
    const isGrupal = document.getElementById('btnGAtAddPart').style.display !== 'none';
    const fullParts = [];
    let p0 = {};

    if (isGrupal) {
        _gAtParticipantes.forEach((p, idx) => {
            const notaInput = document.getElementById(`gAtPartNota_${idx}`);
            const nota = notaInput ? notaInput.value.trim() : '';
            if (p.paciente_id) {
                fullParts.push({
                    paciente_id: parseInt(p.paciente_id),
                    nota_privada: nota || null,
                    dx: p.dx || null,
                    grado_instruccion: p.grado_instruccion,
                    ocupacion: p.ocupacion,
                    estado_civil: p.estado_civil,
                    sexo: p.sexo,
                    fecha_nacimiento: p.fecha_nacimiento,
                    relacion: p.relacion
                });
            }
        });
        p0 = fullParts[0] || {};
    } else {
        p0 = {
            grado_instruccion: document.getElementById('gAtGradoInstruccionInd')?.value || 'no_especificado',
            ocupacion:         document.getElementById('gAtOcupacionInd')?.value.trim() || '',
            estado_civil:      document.getElementById('gAtEstadoCivilInd')?.value      || 'no_especificado',
            sexo:              document.getElementById('gAtSexoInd')?.value             || 'no_especificado',
            fecha_nacimiento:  document.getElementById('gAtFechaNacInd')?.value         || null,
            nota_privada:      document.getElementById('gAt1raSesionNota')?.value.trim() || null
        };
        const _fnac = _gAtFechaNacimiento || p0.fecha_nacimiento || null;
        const _fref = (_citaActiva?.fecha_hora || '').slice(0, 10);
        p0.edad = _fnac ? _calcEdad(_fnac, _fref) : null;
    }

    // 4. Construir Payload
    const payload = {
        cita_id:                 citaId ? parseInt(citaId) : null,
        paciente_id:             parseInt(pacienteId),
        profesional_id:          parseInt(profesionalId),
        motivo_consulta:         motivo,
        observacion_general:     obsGen    || null,
        observacion_conducta:    obsCon    || null,
        antecedentes_relevantes: antec     || null,
        numero_sesiones_plan:    numSes    ? parseInt(numSes) : null,
        recomendaciones:         recomend  || null,
        grado_instruccion:       p0.grado_instruccion || 'no_especificado',
        ocupacion:               p0.ocupacion         || null,
        estado_civil:            p0.estado_civil      || 'no_especificado',
        sexo:                    p0.sexo              || 'no_especificado',
        fecha_nacimiento:        p0.fecha_nacimiento  || null,
        edad:                    p0.edad              ?? null,
        participantes:           isGrupal ? fullParts : []
    };

    if (is1raSesion) {
        payload.primera_sesion_duracion = parseInt(duracion1ra);
        if (isGrupal) {
            const notaCompartida = document.getElementById('gAt1raSesionNotaCompartida').value.trim();
            payload.primera_sesion_nota_compartida = notaCompartida || null;
        } else {
            payload.primera_sesion_nota = p0.nota_privada || null;
        }
    } else {
        // Fallback manual
        payload.subservicio_id   = parseInt(document.getElementById('gAtSubservicio').value);
        payload.precio_acordado  = parseFloat(document.getElementById('gAtPrecio').value);
        payload.descuento_monto  = parseFloat(document.getElementById('gAtDescuento').value) || 0;
        payload.motivo_descuento = document.getElementById('gAtMotivoDescuento').value.trim() || null;
        payload.fecha_inicio     = document.getElementById('gAtFechaInicio').value;
    }

    // 5. Enviar
    const res = await api('/api/atenciones', 'POST', payload);

    if (res.success) {
        const atencionId = res.data?.id;
        const sesionId   = res.data?.sesion_id ?? null;

        // Diagnósticos generales (si los hay en la lista global)
        if (atencionId && _gAtDxList.length > 0) {
            const hoy = new Date().toISOString().slice(0, 10);
            for (const dx of _gAtDxList) {
                await api('/api/atenciones/diagnostico', 'POST', {
                    atencion_id:   atencionId,
                    cie10_codigo:  dx.codigo,
                    jerarquia:     dx.jerarquia,
                    nivel_certeza: dx.nivel_certeza,
                    fecha_dx:      hoy,
                });
            }
        }

        // Adjuntos
        if (sesionId && typeof _adjPendientes !== 'undefined' && _adjPendientes.length) {
            await _adjSubirPendientes(sesionId, null);
        }

        // Tareas inline asignadas junto con la primera sesión
        if (sesionId && typeof _recolectarTareasInline === 'function') {
            const gAtTareasSection = document.getElementById('gAtTareasWrapper');
            const tareasPend = _recolectarTareasInline(gAtTareasSection);
            if (tareasPend.length) await _crearTareasPendientes(sesionId, tareasPend);
        }

        showToast('Atención registrada correctamente');
        cerrarModal('modalGestionAtencion');
        citas();
    } else {
        showToast(res.message || 'Error al registrar atención');
    }
    } finally {
        _isSavingCita = false;
    }
}
