
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

// Callback para refrescar citas tras registrar un pago desde este módulo
let _citasPagoCallback = null;

// Estado CIE-10 en modal "Abrir nueva atención" (desde gestión de cita)
let _gAtDxTimer   = null;
let _gAtDxResults = [];
let _gAtDxList    = [];  // [{ codigo, descripcion, jerarquia, nivel_certeza }]

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

function toggleUsarPaquete() {
    _citaUsarPaquete = !_citaUsarPaquete;
    document.getElementById('citaPaqueteToggle')?.classList.toggle('active', _citaUsarPaquete);
}

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
    const precioActual = _citaModalidad === 'virtual' ? precioVirtual : precioBase;
    const inputPrecio  = document.getElementById('citaPrecio');
    if (inputPrecio && precioActual > 0) {
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
    if (!pacienteId || pacienteId <= 0) {
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
        if (paquete) {
            document.getElementById('citaSepPaquete').style.display     = '';
            document.getElementById('citaPaqueteSection').style.display = '';
            _citaUsarPaquete = true;
            document.getElementById('citaPaqueteToggle')?.classList.add('active');
            const badge = document.getElementById('citaPaqueteBadge');
            if (badge) {
                const nombre    = paquete.nombre || 'Paquete';
                const restantes = paquete.sesiones_restantes ?? '?';
                badge.textContent = `${nombre} · ${restantes} sesiones restantes`;
            }
        } else {
            _limpiarSeccionPaquete();
        }
    } catch {
        _limpiarSeccionPaquete();
    }
}

function onAtencionSEChange() {
    actualizarPrecioBase();
    const pacienteId   = parseInt(document.getElementById('citaPacienteId').value, 10) || 0;
    const profesionalId = _getCitaProfesionalIdActual();
    const atencionId   = parseInt(document.getElementById('citaAtencionSE').value, 10) || 0;
    cargarContextoPaquete(pacienteId, profesionalId, atencionId);
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
    const id     = c.cita_id || c.id;
    const estado = c.estado  || 'pendiente';
    const hoy    = _hoyISO();
    const fechaDt = (c.fecha_hora_inicio || '').slice(0, 10);
    const esHoyOAntes = fechaDt <= hoy;
    const esFuturo    = fechaDt > hoy;

    if (!esProfOAdmin) return '';

    if (['cancelada', 'reprogramada'].includes(estado)) return '';

    if (estado === 'completada') {
        return `<button class="cita-btn-primary" title="Ver atención registrada"
                    onclick="event.stopPropagation();navegarAtencion(${c.atencion_id||0})">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>
                    Ver
                </button>`;
    }

    if (esFuturo && estado === 'pendiente') {
        return `<button class="cita-btn-primary" title="Confirmar cita"
                    onclick="event.stopPropagation();cambiarEstadoCita(${id},'confirmada')">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 8 6 12 14 4"/></svg>
                    Confirmar
                </button>`;
    }

    if (esHoyOAntes && ['pendiente', 'confirmada'].includes(estado)) {
        const tipoCitaEsc  = (c.tipo_cita        || '').replace(/'/g, '');
        const pacienteEsc2 = (c.paciente         || '').replace(/'/g, '');
        const profEsc      = (c.profesional      || '').replace(/'/g, '');
        const subservEsc   = (c.subservicio      || '').replace(/'/g, '');
        const motivoEsc    = (c.motivo_descuento || '').replace(/'/g, '');
        const modalidadEsc = (c.modalidad_sesion || 'presencial').replace(/'/g, '');
        const fechaEsc     = (c.fecha_hora_inicio|| '').replace(/'/g, '');
        const precioCita   = c.precio_acordado != null ? parseFloat(c.precio_acordado) : 'null';
        const label = c.tipo_cita === 'sesion_existente' ? 'Sesión' : 'Atención';
        return `<button class="cita-btn-primary" title="Registrar ${label}"
                    onclick="event.stopPropagation();abrirModalGestionAtencion(${id},${c.paciente_id||0},${c.profesional_id||0},'${fechaEsc}','${tipoCitaEsc}',${c.atencion_id||0},${c.subservicio_id||0},${c.duracion_min||50},${parseFloat(c.precio_base)||0},'${pacienteEsc2}','${profEsc}','${subservEsc}',${precioCita},${parseFloat(c.descuento_monto)||0},'${motivoEsc}','${modalidadEsc}')">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 4a3 3 0 1 1 6 0 3 3 0 0 1-6 0z"/>
                        <path d="M2 14c0-3 2-5 5-5"/>
                        <path d="M9 12l2 2 4-4"/>
                    </svg>
                    ${label}
                </button>`;
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
        if (tieneCobro) items += `<button class="menu-item" onclick="abrirPagoCita(${id},${cuentaId},${c.paciente_id||0},'${pacienteEsc2}',${parseFloat(c.precio_efectivo)||0},${parseFloat(c.saldo_pendiente_cobro)||0},'${subservEsc}')">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="14" height="9" rx="1.5"/><line x1="1" y1="8" x2="15" y2="8"/></svg>Registrar pago</button>`;
        items += `<div class="menu-divider"></div>`;
        items += `<button class="menu-item danger" onclick="cambiarEstadoCita(${id},'cancelada')">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>Cancelar</button>`;
    }

    if (estado === 'completada') {
        if (c.atencion_id) {
            items += `<button class="menu-item" onclick="navegarAtencion(${c.atencion_id})">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>Ver atención</button>`;
        }
        if (tieneCobro) items += `<button class="menu-item" onclick="abrirPagoCita(${id},${cuentaId},${c.paciente_id||0},'${pacienteEsc2}',${parseFloat(c.precio_efectivo)||0},${parseFloat(c.saldo_pendiente_cobro)||0},'${subservEsc}')">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="14" height="9" rx="1.5"/><line x1="1" y1="8" x2="15" y2="8"/></svg>Registrar pago</button>`;
    }

    if (estado === 'reprogramada') {
        items += `<button class="menu-item" onclick="verHistorialCita(${id})">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><polyline points="8 5 8 8 10 10"/></svg>Ver historial</button>`;
    }

    items += `<div class="menu-divider"></div>`;
    items += `<button class="menu-item" onclick="navigate('pacientes');setTimeout(()=>verDetallePaciente(${c.paciente_id}),200)">
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
    const precio      = c.precio_efectivo != null ? parseFloat(c.precio_efectivo) : null;
    const estadoCobro = c.estado_cobro  || 'sin_cobro';
    const saldo       = c.saldo_pendiente_cobro != null ? parseFloat(c.saldo_pendiente_cobro) : 0;
    const cuentaId    = c.cuenta_cobro_id ? parseInt(c.cuenta_cobro_id) : null;
    const id          = c.cita_id || c.id;

    let html = precio != null
        ? `<div class="cobro-precio">S/ ${precio.toFixed(2)}</div>`
        : '';

    switch (estadoCobro) {
        case 'paquete':  html += `<div><span class="cobro-paquete">Paquete</span></div>`; break;
        case 'pagado':   html += `<div><span class="cobro-pagado">Pagado</span></div>`;   break;
        case 'parcial':  html += `<div><span class="cobro-parcial">Parcial · S/ ${saldo.toFixed(2)}</span></div>`; break;
        case 'pendiente':html += `<div class="cobro-pendiente">S/ ${saldo.toFixed(2)} por cobrar</div>`; break;
        default:         html += precio != null ? '' : `<div class="cobro-sin">—</div>`; break;
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
            <button class="citas-btn-toolbar" id="btnRangoCitas" onclick="_abrirRangoFechas()">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="1"/><line x1="5" y1="1" x2="5" y2="3"/><line x1="11" y1="1" x2="11" y2="3"/><line x1="2" y1="6" x2="14" y2="6"/></svg>
                ${rangoLabel}
            </button>
            <button class="citas-btn-toolbar${filtActivos > 0 ? ' active' : ''}" onclick="_toggleFilterPanel()">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="5" x2="13" y2="5"/><line x1="5" y1="9" x2="11" y2="9"/><line x1="7" y1="13" x2="9" y2="13"/></svg>
                Más filtros
                ${filtActivos > 0 ? `<span class="citas-filter-badge">${filtActivos}</span>` : ''}
            </button>
        </div>

        <div class="citas-filter-panel" id="citasFilterPanel">
            <div class="citas-filter-group">
                <span class="citas-filter-label">Estado</span>
                <select onchange="_citasFiltros.estado=this.value;citas()">
                    <option value="" ${!_citasFiltros.estado ? 'selected' : ''}>Todos</option>
                    <option value="pendiente"    ${_citasFiltros.estado==='pendiente'    ? 'selected' : ''}>Pendiente</option>
                    <option value="confirmada"   ${_citasFiltros.estado==='confirmada'   ? 'selected' : ''}>Confirmada</option>
                    <option value="completada"   ${_citasFiltros.estado==='completada'   ? 'selected' : ''}>Completada</option>
                    <option value="cancelada"    ${_citasFiltros.estado==='cancelada'    ? 'selected' : ''}>Cancelada</option>
                    <option value="no_asistio"   ${_citasFiltros.estado==='no_asistio'   ? 'selected' : ''}>No asistió</option>
                    <option value="reprogramada" ${_citasFiltros.estado==='reprogramada' ? 'selected' : ''}>Reprogramada</option>
                </select>
            </div>
            ${esAdmin ? `<div class="citas-filter-group">
                <span class="citas-filter-label">Profesional</span>
                <select onchange="_citasFiltros.profesional_id=this.value;citas()">${profOpts}</select>
            </div>` : ''}
            <div class="citas-filter-group">
                <span class="citas-filter-label">Modalidad</span>
                <div class="citas-radio-group">
                    <label><input type="radio" name="filtModalidad" value="todas"      ${(!_citasFiltros.modalidad||_citasFiltros.modalidad==='todas') ? 'checked' : ''} onchange="_citasFiltros.modalidad=this.value;citas()"> Todas</label>
                    <label><input type="radio" name="filtModalidad" value="presencial" ${_citasFiltros.modalidad==='presencial' ? 'checked' : ''} onchange="_citasFiltros.modalidad=this.value;citas()"> Presencial</label>
                    <label><input type="radio" name="filtModalidad" value="virtual"    ${_citasFiltros.modalidad==='virtual'    ? 'checked' : ''} onchange="_citasFiltros.modalidad=this.value;citas()"> Virtual</label>
                </div>
            </div>
            <div class="citas-filter-group">
                <span class="citas-filter-label">Tipo</span>
                <div class="citas-radio-group">
                    <label><input type="radio" name="filtTipo" value="todas"            ${(!_citasFiltros.tipo||_citasFiltros.tipo==='todas') ? 'checked' : ''} onchange="_citasFiltros.tipo=this.value;citas()"> Todas</label>
                    <label><input type="radio" name="filtTipo" value="nueva_atencion"   ${_citasFiltros.tipo==='nueva_atencion'   ? 'checked' : ''} onchange="_citasFiltros.tipo=this.value;citas()"> Nueva atención</label>
                    <label><input type="radio" name="filtTipo" value="sesion_existente" ${_citasFiltros.tipo==='sesion_existente' ? 'checked' : ''} onchange="_citasFiltros.tipo=this.value;citas()"> Sesión</label>
                </div>
            </div>
            <button class="citas-btn-toolbar" style="align-self:flex-end" onclick="_limpiarFiltrosAvanzados()">Limpiar</button>
        </div>

        <div class="citas-chips">${chipsHTML}</div>

        <div id="citasGrupos">${gruposHTML}</div>
        ${pagHTML}
    `;

    document.addEventListener('click', _cerrarDropdownsGlobal, { once: true });

    if (esAdmin && _citasProfesionales.length === 0) {
        api('/api/profesionales').then(r => { _citasProfesionales = r.data || []; });
    }
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
    const panel = document.getElementById('citasFilterPanel');
    if (panel) panel.classList.toggle('open');
}

function _abrirRangoFechas() {
    const desde = prompt('Fecha desde (YYYY-MM-DD):', _citasFiltros.fecha_desde || _hoyISO());
    if (desde === null) return;
    const hasta = prompt('Fecha hasta (YYYY-MM-DD):', _citasFiltros.fecha_hasta || _citasFiltros.fecha_desde || _hoyISO());
    if (hasta === null) return;
    _citasFiltros.fecha_desde = desde;
    _citasFiltros.fecha_hasta = hasta;
    _citasFiltros.chip        = 'custom';
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
        // Restaurar precio editable
        const sel = document.getElementById('paqueteContratarId');
        if (sel) sel.value = '';
        document.getElementById('paqueteContratarPreview').style.display = 'none';
        const precioInp = document.getElementById('citaPrecio');
        if (precioInp) { precioInp.readOnly = false; }
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
        if (precioInp) { precioInp.readOnly = false; }
        actualizarPrecioBase();
        return;
    }
    const opt      = sel.options[sel.selectedIndex];
    const sesiones = parseInt(opt.dataset.sesiones) || 0;
    const precio   = parseFloat(opt.dataset.precio)  || 0;
    const porSesion = sesiones > 0 ? (precio / sesiones) : 0;

    preview.style.display = 'block';
    preview.innerHTML = `Pack <strong>${opt.textContent}</strong> · ${sesiones} sesiones · S/ ${precio.toFixed(2)} total · S/ ${porSesion.toFixed(2)} por sesión`;

    // Bloquear precio y pre-llenar con el prorrateo
    const precioInp = document.getElementById('citaPrecio');
    if (precioInp) {
        precioInp.value    = porSesion.toFixed(2);
        precioInp.readOnly = true;
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

    // Mostrar secciones de cuándo/cómo, paquete contratación y precio
    document.getElementById('citaSepCuandoComo').style.display           = '';
    document.getElementById('citaCamposFechaModalidad').style.display    = '';
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
        const atencionId    = tipo === 'sesion_existente'
            ? parseInt(document.getElementById('citaAtencionSE').value, 10) || 0
            : 0;
        cargarContextoPaquete(pacienteId, profesionalId, atencionId);
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

    abrirModalPago(cuentaCobroId);
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
        precioCita, descuentoCita, motivoDescCita, modalidadSesion = 'presencial') {

    _citaActiva = { id: citaId, paciente_id: pacienteId, profesional_id: profesionalId, fecha_hora: fechaHora };

    const tabsBar = document.getElementById('gestionTabsBar');
    const titulo  = document.getElementById('gestionModalTitle');

    // Reset estado visual
    document.getElementById('gSesionInfoFija').style.display        = 'none';
    document.getElementById('gestionAtencionSelectWrap').style.display = '';
    document.getElementById('gAtInfoFija').style.display             = 'none';
    document.getElementById('gAtSubservicioSelectWrap').style.display = '';

    if (tipoCita !== 'sesion_existente') {
        tabsBar.style.display = 'none';
        titulo.textContent    = 'Abrir nueva atención';

        document.getElementById('tabSesion').style.display   = 'none';
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
         'gAtAntecedentes','gAtRecomendaciones','gAt1raSesionNota'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('gAt1raSesionDuracion').value = duracionMin || 50;
        document.getElementById('gAt1raSesionDuracion-error').textContent = '';

        _gAtDxReset();

        // Reiniciar adjuntos de primera sesión y activar drop zone
        if (typeof _adjPendientes !== 'undefined') {
            _adjPendientes = [];
            if (typeof _adjRenderPendientes === 'function') _adjRenderPendientes('gAtAdjPendientes');
            requestAnimationFrame(() => {
                if (typeof _adjIniciarDropZone === 'function')
                    _adjIniciarDropZone('gAtAdjDrop', 'gAtAdjInput', 'gAtAdjPendientes');
            });
        }

        await cargarDatosPacienteParaGestion(pacienteId);

    } else if (tipoCita === 'sesion_existente') {
        tabsBar.style.display = 'none';
        titulo.textContent    = 'Registrar sesión';

        document.getElementById('tabSesion').style.display   = '';
        document.getElementById('tabAtencion').style.display = 'none';

        // Info no editable
        document.getElementById('gSesionInfoPaciente').textContent    = nombrePaciente    || '';
        document.getElementById('gSesionInfoProfesional').textContent = nombreProfesional || '';
        document.getElementById('gSesionInfoSubservicio').textContent = nombreSubservicio || '';
        document.getElementById('gSesionInfoFija').style.display      = '';

        // Ocultar select; configurarlo con atencion_id fijo para que registrarSesionDesdeCita lo lea
        document.getElementById('gestionAtencionSelectWrap').style.display = 'none';
        const selFijo = document.getElementById('gestionAtencionSelect');
        selFijo.innerHTML = `<option value="${atencionId}">${nombreSubservicio || ''}</option>`;
        selFijo.value = String(atencionId);

        // Mostrar formulario de sesión directamente (sin selección manual de atención)
        const formSesion = document.getElementById('gestionSesionForm');
        formSesion.style.display = '';
        document.getElementById('gSesionNota').value                 = '';
        document.getElementById('gSesionDuracion-error').textContent = '';
        document.getElementById('gSesionNumero').textContent         = '…';
        document.getElementById('gSesionDuracion').value             = duracionMin || 50;

        // Pre-llenar modalidad y precio de la cita (para herencia al registrar sesión)
        _citaModalidad = modalidadSesion || 'presencial';
        _gSesionPrecio = precioCita != null ? parseFloat(precioCita) : 0;

        if (atencionId) {
            // Detectar modalidad en paralelo con el número de sesión siguiente
            const [rNum, aRes] = await Promise.all([
                api(`/api/atenciones/sesion-siguiente?atencion_id=${atencionId}`),
                api(`/api/atencion?id=${atencionId}`)
            ]);

            const atencion  = aRes.success ? aRes.data : null;
            const modalidad = atencion ? (atencion.subservicio_modalidad || 'individual').toLowerCase() : 'individual';
            const esGrupal  = ['pareja', 'familiar', 'grupal'].includes(modalidad);

            if (esGrupal && atencion) {
                // Redirigir al modal completo de sesión grupal
                _currentAtencion = atencion;
                _atencionBack    = () => citas();
                const siguienteNum = (atencion.sesiones_grupo?.length ?? 0) + 1;
                await abrirModalSesion(parseInt(atencionId), siguienteNum);
                return;  // No mostrar modalGestionAtencion
            }

            document.getElementById('gSesionNumero').textContent = rNum.data?.numero_siguiente ?? 1;
        }

    }

    document.getElementById('modalGestionAtencion').classList.remove('hidden');
}

function cambiarTabGestion(tab) {
    const ACTIVO   = 'padding:8px 20px;border:none;background:none;cursor:pointer;font-weight:600;color:var(--color-primary);border-bottom:2px solid var(--color-primary);margin-bottom:-2px';
    const INACTIVO = 'padding:8px 20px;border:none;background:none;cursor:pointer;color:var(--color-text-muted)';

    document.getElementById('tabSesion').style.display   = tab === 'sesion'   ? '' : 'none';
    document.getElementById('tabAtencion').style.display = tab === 'atencion' ? '' : 'none';
    document.getElementById('tabSesionBtn').style.cssText   = tab === 'sesion'   ? ACTIVO : INACTIVO;
    document.getElementById('tabAtencionBtn').style.cssText = tab === 'atencion' ? ACTIVO : INACTIVO;
}

async function cargarAtencionesParaGestion(pacienteId, citaId) {
    const sel  = document.getElementById('gestionAtencionSelect');
    const form = document.getElementById('gestionSesionForm');

    sel.innerHTML = '<option value="">Cargando…</option>';
    form.style.display = 'none';

    if (!pacienteId) {
        sel.innerHTML = '<option value="">Sin paciente</option>';
        return;
    }

    const res = await api(`/api/atenciones/paciente?paciente_id=${pacienteId}`);
    sel.innerHTML = '<option value="">— Seleccionar atención activa —</option>';

    const activas = (res.data || []).filter(a => a.estado === 'activa');

    if (activas.length === 0) {
        sel.innerHTML += '<option value="" disabled>No hay atenciones activas para este paciente</option>';
        return;
    }

    let vinculadaId = null;

    activas.forEach(a => {
        const esCitaVinculada = String(a.cita_id) === String(citaId);
        if (esCitaVinculada) vinculadaId = a.id;

        const proxSesion = (parseInt(a.total_sesiones) || 0) + 1;
        const etiqueta   = esCitaVinculada ? ' ⭐ relacionada a esta cita' : '';
        const opt        = document.createElement('option');

        opt.value                = a.id;
        opt.dataset.duracion     = a.duracion_min || 50;
        opt.dataset.proxSesion   = proxSesion;
        opt.dataset.modalidad    = a.subservicio_modalidad || 'individual';
        opt.dataset.vinculoId    = a.vinculo_id || '';
        opt.textContent          = `${a.subservicio} — desde ${a.fecha_inicio} (sesión #${proxSesion})${etiqueta}`;

        if (esCitaVinculada) opt.style.fontWeight = '600';
        sel.appendChild(opt);
    });

    if (vinculadaId) {
        sel.value = vinculadaId;
        onSeleccionarAtencionGestion();
    }
}

async function onSeleccionarAtencionGestion() {
    const sel    = document.getElementById('gestionAtencionSelect');
    const form   = document.getElementById('gestionSesionForm');
    const selOpt = sel.options[sel.selectedIndex];

    if (!sel.value) { form.style.display = 'none'; return; }

    const modalidad = (selOpt.dataset.modalidad || 'individual').toLowerCase();
    const esGrupal  = ['pareja', 'familiar', 'grupal'].includes(modalidad);

    if (esGrupal) {
        form.style.display = 'none';
        const aRes = await api('/api/atencion?id=' + sel.value);
        if (aRes.success && aRes.data) {
            document.getElementById('modalGestionAtencion').classList.add('hidden');
            _currentAtencion = aRes.data;
            _atencionBack    = () => citas();
            const siguienteNum = (aRes.data.sesiones_grupo?.length ?? 0) + 1;
            await abrirModalSesion(parseInt(sel.value), siguienteNum);
        }
        return;
    }

    form.style.display = '';

    document.getElementById('gSesionDuracion').value             = selOpt.dataset.duracion || 50;
    document.getElementById('gSesionNota').value                 = '';
    document.getElementById('gSesionDuracion-error').textContent = '';
    document.getElementById('gSesionNumero').textContent         = '…';

    // Reiniciar adjuntos pendientes y activar la drop zone
    if (typeof _adjPendientes !== 'undefined') {
        _adjPendientes = [];
        if (typeof _adjRenderPendientes === 'function') _adjRenderPendientes('gAdjPendientes');
        if (typeof _adjIniciarDropZone  === 'function') _adjIniciarDropZone('gAdjDrop', 'gAdjInput', 'gAdjPendientes');
    }

    const res = await api(`/api/atenciones/sesion-siguiente?atencion_id=${sel.value}`);
    const num = res.data?.numero_siguiente ?? 1;
    document.getElementById('gSesionNumero').textContent = num;
}

async function registrarSesionDesdeCita() {
    const atencionId = document.getElementById('gestionAtencionSelect').value;
    const duracion   = document.getElementById('gSesionDuracion').value;
    const nota       = document.getElementById('gSesionNota').value.trim();

    document.getElementById('gSesionDuracion-error').textContent = '';

    if (!atencionId) { showToast('Seleccione una atención'); return; }
    if (!duracion)   { document.getElementById('gSesionDuracion-error').textContent = 'Requerido'; return; }

    const res = await api('/api/sesiones', 'POST', {
        atencion_id:      parseInt(atencionId),
        cita_id:          _citaActiva?.id || null,
        duracion_min:     parseInt(duracion),
        nota_clinica:     nota || null,
        precio_sesion:    _gSesionPrecio,
        modalidad_sesion: _citaModalidad,
    });

    if (res.success) {
        if (typeof _adjPendientes !== 'undefined' && _adjPendientes.length) {
            await _adjSubirPendientes(res.data?.id, null);
        }
        showToast('Sesión registrada');
        cerrarModal('modalGestionAtencion');
        citas();
    } else {
        showToast(res.message || 'Error al registrar sesión');
    }
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
    }
}

async function cargarDatosPacienteParaGestion(pacienteId) {
    if (!pacienteId) return;
    const res = await api(`/api/paciente?id=${pacienteId}`);
    if (res.data) {
        const p = res.data;
        if (p.grado_instruccion) document.getElementById('gAtGradoInstruccion').value = p.grado_instruccion;
        if (p.ocupacion)         document.getElementById('gAtOcupacion').value         = p.ocupacion;
        if (p.estado_civil)      document.getElementById('gAtEstadoCivil').value        = p.estado_civil;
    }
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
    const pacienteId    = document.getElementById('gAtPacienteId').value;
    const profesionalId = document.getElementById('gAtProfesionalId').value;
    const citaId        = document.getElementById('gAtCitaId').value;
    const motivo        = document.getElementById('gAtMotivoConsulta').value.trim();
    const obsGen        = document.getElementById('gAtObsGeneral').value.trim();
    const obsCon        = document.getElementById('gAtObsConducta').value.trim();
    const antec         = document.getElementById('gAtAntecedentes').value.trim();
    const numSes        = document.getElementById('gAtNumSesiones').value;
    const recomend      = document.getElementById('gAtRecomendaciones').value.trim();
    const grado         = document.getElementById('gAtGradoInstruccion').value;
    const ocupacion     = document.getElementById('gAtOcupacion').value.trim();
    const estadoCivil   = document.getElementById('gAtEstadoCivil').value;

    // Detectar si estamos en el flujo nueva_atencion (con primera sesión)
    const is1raSesion = document.getElementById('gAt1raSesionSection')?.style.display !== 'none';
    const duracion1ra = is1raSesion ? document.getElementById('gAt1raSesionDuracion').value : null;
    const nota1ra     = is1raSesion ? document.getElementById('gAt1raSesionNota').value.trim() : null;

    // Limpiar errores
    ['gAtMotivoConsulta', 'gAt1raSesionDuracion'].forEach(id => {
        const err = document.getElementById(id + '-error');
        const inp = document.getElementById(id);
        if (err) err.textContent = '';
        if (inp) inp.classList.remove('is-invalid');
    });

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
        // Fallback: validar campos que el usuario ingresó manualmente
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

    const esProfGestion = getUser()?.rol === 'profesional';

    const payload = {
        cita_id:                 parseInt(citaId),
        motivo_consulta:         motivo,
        observacion_general:     obsGen    || null,
        observacion_conducta:    obsCon    || null,
        antecedentes_relevantes: antec     || null,
        numero_sesiones_plan:    numSes    ? parseInt(numSes) : null,
        recomendaciones:         recomend  || null,
        grado_instruccion:       grado,
        ocupacion:               ocupacion || null,
        estado_civil:            estadoCivil,
    };

    if (!esProfGestion) payload.profesional_id = parseInt(profesionalId);

    if (is1raSesion) {
        // El backend lee paciente_id, subservicio_id, precio, fecha de la cita
        payload.primera_sesion_duracion = parseInt(duracion1ra);
        payload.primera_sesion_nota     = nota1ra || null;
    } else {
        // Fallback: el usuario ingresó los datos manualmente
        const subservicioId = document.getElementById('gAtSubservicio').value;
        const precio        = document.getElementById('gAtPrecio').value;
        const descuento     = document.getElementById('gAtDescuento').value || 0;
        const motiDesc      = document.getElementById('gAtMotivoDescuento').value.trim();
        const fechaInicio   = document.getElementById('gAtFechaInicio').value;
        payload.paciente_id          = parseInt(pacienteId);
        payload.subservicio_id       = parseInt(subservicioId);
        payload.precio_acordado      = parseFloat(precio);
        payload.descuento_monto      = parseFloat(descuento) || 0;
        payload.motivo_descuento     = motiDesc || null;
        payload.fecha_inicio         = fechaInicio;
    }

    const res = await api('/api/atenciones', 'POST', payload);

    if (res.success) {
        const atencionId = res.data?.id;
        const sesionId   = res.data?.sesion_id ?? null;
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
        if (sesionId && typeof _adjPendientes !== 'undefined' && _adjPendientes.length) {
            await _adjSubirPendientes(sesionId, null);
        }
        showToast('Atención abierta correctamente');
        cerrarModal('modalGestionAtencion');
        citas();
    } else {
        showToast(res.message || 'Error al abrir atención');
    }
}
