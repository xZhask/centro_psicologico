// ============================================================
// Módulo: Pagos
// Gestión de cuentas de cobro y registro de pagos de pacientes.
// ============================================================

// --- estado del módulo ---
let _pagosVista       = 'lista';   // 'lista' | 'detalle'
let _pagosCuentaId    = null;
let _pagosCuentaInfo  = null;
let _pagosPacienteId  = null;      // para cargar apoderados en modal pago
let _pagosTipoPagador = 'paciente';

const METODO_LABEL = {
    efectivo:        'Efectivo',
    transferencia:   'Transferencia',
    tarjeta_debito:  'T. Débito',
    tarjeta_credito: 'T. Crédito',
    yape:            'Yape',
    plin:            'Plin',
    otro:            'Otro',
};

const ESTADO_BADGE = {
    pendiente:    '<span class="badge badge-warning-solid">Pendiente</span>',
    pago_parcial: '<span class="badge badge-pendiente">Parcial</span>',
    pagado:       '<span class="badge badge-success">Pagado</span>',
    anulado:      '<span class="badge" style="background:#999;color:#fff">Anulado</span>',
};

// ----------------------------------------------------------------
// Entrada del módulo
// ----------------------------------------------------------------
function pagos() {
    document.getElementById('view').innerHTML = `
        <div id="pagosRoot"></div>`;
    _pagosVista = 'lista';
    _cargarCuentas();
}

// ----------------------------------------------------------------
// VISTA LISTA — cuentas de cobro
// ----------------------------------------------------------------
async function _cargarCuentas() {
    const filtro = _pagosFiltroInput();
    const url = filtro ? `/api/cuentas?paciente_id=${filtro}` : '/api/cuentas';
    const res = await api(url);
    if (!res.success) { showToast('Error al cargar cuentas'); return; }
    await _renderListaCuentas(res.data);
}

function _pagosFiltroInput() {
    const el = document.getElementById('pagosFiltroId');
    return el ? el.value.trim() : '';
}

async function _renderListaCuentas(lista) {
    const root = document.getElementById('pagosRoot');
    if (!root) return;

    const resPac = await api('/api/pacientes');
    const optsPac = resPac.success
        ? resPac.data.map(p =>
            `<option value="${p.id}">${escapeHtml(p.apellidos + ', ' + p.nombres)}</option>`
          ).join('')
        : '';

    // Restaurar filtro seleccionado si existe
    const filtroActual = _pagosFiltroInput();

    root.innerHTML = `
        <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;">
            <h2 style="margin:0">Cuentas de cobro</h2>
            <button class="btn btn-primary" onclick="abrirModalCuenta()">+ Nueva cuenta</button>
        </div>

        <div class="card" style="margin-bottom:1rem;padding:.75rem 1rem;display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;">
            <label style="font-size:.85rem;font-weight:500;color:var(--color-text-muted)">Filtrar por paciente</label>
            <select id="pagosFiltroId" class="input" style="width:260px"
                    onchange="_cargarCuentas()">
                <option value="">— Todos los pacientes —</option>
                ${optsPac}
            </select>
        </div>

        ${_tablaCuentas(lista)}`;

    // Restaurar selección del filtro
    if (filtroActual) {
        const sel = document.getElementById('pagosFiltroId');
        if (sel) sel.value = filtroActual;
    }
}

function _tablaCuentas(lista) {
    if (!lista.length) {
        return `<div class="card" style="padding:2rem;text-align:center;color:var(--color-text-muted)">
                    No hay cuentas de cobro registradas.
                </div>`;
    }
    const filas = lista.map(c => {
        const saldo     = parseFloat(c.saldo_pendiente);
        const saldoFmt  = saldo > 0
            ? `<span style="color:var(--color-danger);font-weight:600">S/ ${fmt(saldo)}</span>`
            : `<span style="color:var(--color-success)">S/ ${fmt(saldo)}</span>`;
        const descuento = parseFloat(c.descuento_aplicado);
        const descCell  = descuento > 0
            ? `<span style="color:var(--color-text-muted)">-S/ ${fmt(descuento)}</span>`
            : '—';
        return `
            <tr>
                <td>${escapeHtml(c.paciente_nombre || '—')}</td>
                <td>${escapeHtml(c.concepto)}</td>
                <td style="text-align:right">S/ ${fmt(c.monto_total)}</td>
                <td style="text-align:right">${descCell}</td>
                <td style="text-align:right">S/ ${fmt(c.monto_pagado)}</td>
                <td style="text-align:right">${saldoFmt}</td>
                <td>${ESTADO_BADGE[c.estado] ?? c.estado}</td>
                <td>${c.fecha_emision}</td>
                <td>
                    <button class="btn btn-primary" style="padding:.3rem .7rem;font-size:.8rem"
                            onclick="verDetalleCuenta(${c.id})">
                        Ver pagos
                    </button>
                </td>
            </tr>`;
    }).join('');

    return `
        <div class="card" style="padding:0;overflow-x:auto">
            <table class="table" style="min-width:860px">
                <thead>
                    <tr>
                        <th>Paciente</th>
                        <th>Concepto</th>
                        <th style="text-align:right">Total</th>
                        <th style="text-align:right">Descuento</th>
                        <th style="text-align:right">Pagado</th>
                        <th style="text-align:right">Saldo</th>
                        <th>Estado</th>
                        <th>Emisión</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
}

// ----------------------------------------------------------------
// VISTA DETALLE — pagos de una cuenta
// ----------------------------------------------------------------
async function verDetalleCuenta(cuentaId) {
    _pagosCuentaId = cuentaId;
    _pagosVista = 'detalle';

    const [resCuentaAll, resPagos] = await Promise.all([
        api('/api/cuentas'),
        api(`/api/pagos?cuenta_id=${cuentaId}`),
    ]);

    const cuenta = resCuentaAll.data?.find(c => c.id === cuentaId);
    if (!cuenta) { showToast('Cuenta no encontrada'); return; }

    _pagosCuentaInfo = cuenta;
    _pagosPacienteId = cuenta.paciente_id;

    _renderDetalleCuenta(cuenta, resPagos.data ?? []);
}

function _renderDetalleCuenta(cuenta, pagos) {
    const root = document.getElementById('pagosRoot');
    if (!root) return;

    const saldo = parseFloat(cuenta.saldo_pendiente);
    const saldoStyle = saldo > 0 ? 'color:var(--color-danger);font-weight:700' : 'color:var(--color-success);font-weight:700';

    root.innerHTML = `
        <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap;">
            <button class="btn" onclick="_volverListaCuentas()" style="padding:.35rem .8rem;font-size:.85rem">
                ← Volver
            </button>
            <h2 style="margin:0;flex:1">${escapeHtml(cuenta.concepto)}</h2>
            <button class="btn" style="padding:.35rem .9rem;font-size:.85rem;white-space:nowrap"
                    onclick="exportarCuentaPDF(${cuenta.id})">
                ↓ Exportar PDF
            </button>
            ${saldo > 0 ? `<button class="btn btn-primary" onclick="abrirModalPago(${cuenta.id})">+ Registrar pago</button>` : ''}
        </div>

        <div class="card" style="padding:1rem 1.25rem;margin-bottom:1.25rem;display:flex;gap:2rem;flex-wrap:wrap;align-items:flex-start">
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Paciente</div>
                <div style="font-weight:600">${escapeHtml(cuenta.paciente_nombre || '—')}</div>
            </div>
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Estado</div>
                <div>${ESTADO_BADGE[cuenta.estado] ?? cuenta.estado}</div>
            </div>
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Monto total</div>
                <div style="font-weight:600">S/ ${fmt(cuenta.monto_total)}</div>
            </div>
            ${parseFloat(cuenta.descuento_aplicado) > 0 ? `
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Descuento</div>
                <div style="color:var(--color-warning)">-S/ ${fmt(cuenta.descuento_aplicado)}</div>
                ${cuenta.motivo_descuento ? `<div style="font-size:.8rem;color:var(--color-text-muted)">${escapeHtml(cuenta.motivo_descuento)}</div>` : ''}
            </div>` : ''}
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Pagado</div>
                <div>S/ ${fmt(cuenta.monto_pagado)}</div>
            </div>
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Saldo pendiente</div>
                <div style="${saldoStyle}">S/ ${fmt(cuenta.saldo_pendiente)}</div>
            </div>
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Fecha emisión</div>
                <div>${cuenta.fecha_emision}</div>
            </div>
        </div>

        <h3 style="margin:0 0 .75rem">Historial de pagos</h3>
        <div id="pagosListaDetalle">${_renderListaPagos(pagos, cuenta.id)}</div>`;
}

function _renderListaPagos(pagos, cuentaId) {
    if (!pagos.length) {
        return `<div class="card" style="padding:1.5rem;text-align:center;color:var(--color-text-muted)">
                    Aún no se han registrado pagos para esta cuenta.
                </div>`;
    }

    const filas = pagos.map(p => {
        const pagador = p.nombre_paciente
            ? escapeHtml(p.nombre_paciente)
            : p.nombre_apoderado
                ? `${escapeHtml(p.nombre_apoderado)} <span style="font-size:.78rem;color:var(--color-text-muted)">(apoderado)</span>`
                : p.pagado_por_externo
                    ? `${escapeHtml(p.pagado_por_externo)} <span style="font-size:.78rem;color:var(--color-text-muted)">(externo)</span>`
                    : '—';

        return `
            <tr>
                <td>${p.fecha_pago}</td>
                <td style="text-align:right;font-weight:600">S/ ${fmt(p.monto)}</td>
                <td>${escapeHtml(METODO_LABEL[p.metodo_pago] ?? p.metodo_pago)}</td>
                <td>${p.numero_comprobante ? escapeHtml(p.numero_comprobante) : '—'}</td>
                <td>${pagador}</td>
                <td style="color:var(--color-text-muted);font-size:.85rem">${p.registrado_por_nombre ? escapeHtml(p.registrado_por_nombre) : '—'}</td>
                <td style="color:var(--color-text-muted);font-size:.82rem">${p.notas ? escapeHtml(p.notas) : ''}</td>
            </tr>`;
    }).join('');

    return `
        <div class="card" style="padding:0;overflow-x:auto">
            <table class="table" style="min-width:700px">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th style="text-align:right">Monto</th>
                        <th>Método</th>
                        <th>Comprobante</th>
                        <th>Pagado por</th>
                        <th>Registrado por</th>
                        <th>Notas</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
}

function _volverListaCuentas() {
    _pagosVista = 'lista';
    _pagosCuentaId = null;
    _pagosCuentaInfo = null;
    _cargarCuentas();
}

// ----------------------------------------------------------------
// MODAL — nueva cuenta
// ----------------------------------------------------------------
async function abrirModalCuenta() {
    // Resetear campos manuales antes de cargar datos
    document.getElementById('cuentaConcepto').value      = '';
    document.getElementById('cuentaMonto').value         = '';
    document.getElementById('cuentaDescuento').value     = '0';
    document.getElementById('cuentaMotivoDescuento').value = '';
    document.getElementById('cuentaFechaVence').value    = '';
    document.getElementById('cuentaMotivoDescuento').closest('.form-group').style.display = 'none';
    document.getElementById('cuentaFechaEmision').value  = new Date().toISOString().slice(0,10);

    // Cargar pacientes
    const res = await api('/api/pacientes');
    const opts = res.success
        ? res.data.map(p => `<option value="${p.id}">${escapeHtml(p.apellidos + ', ' + p.nombres)}</option>`).join('')
        : '';
    document.getElementById('cuentaPacienteId').innerHTML = `<option value="">— Seleccione —</option>${opts}`;

    document.getElementById('modalCuenta').classList.remove('hidden');
}

function _toggleMotivoDescuento() {
    const val = parseFloat(document.getElementById('cuentaDescuento').value) || 0;
    const row = document.getElementById('cuentaMotivoDescuento').closest('.form-group');
    row.style.display = val > 0 ? '' : 'none';
}

async function guardarCuenta() {
    const pacienteId = document.getElementById('cuentaPacienteId').value;
    const concepto   = document.getElementById('cuentaConcepto').value.trim();
    const monto      = parseFloat(document.getElementById('cuentaMonto').value);
    const descuento  = parseFloat(document.getElementById('cuentaDescuento').value) || 0;
    const motivo     = document.getElementById('cuentaMotivoDescuento').value.trim();
    const emision    = document.getElementById('cuentaFechaEmision').value;
    const vence      = document.getElementById('cuentaFechaVence').value;

    if (!pacienteId) { showToast('Seleccione un paciente'); return; }
    if (!concepto)   { showToast('Ingrese el concepto'); return; }
    if (!monto || monto <= 0) { showToast('Ingrese un monto válido'); return; }
    if (!emision)    { showToast('Ingrese la fecha de emisión'); return; }

    const payload = {
        paciente_id:        parseInt(pacienteId),
        concepto,
        monto_total:        monto,
        descuento_aplicado: descuento,
        motivo_descuento:   motivo || null,
        fecha_emision:      emision,
        fecha_vencimiento:  vence || null,
    };

    const res = await api('/api/cuentas', 'POST', payload);
    if (res.success) {
        cerrarModal('modalCuenta');
        showToast('Cuenta creada');
        _cargarCuentas();
    } else {
        showToast(res.message || 'Error al crear cuenta');
    }
}

// ----------------------------------------------------------------
// MODAL — registrar pago
// ----------------------------------------------------------------
async function abrirModalPago(cuentaId) {
    _pagosCuentaId = cuentaId;

    // Si no tenemos el pacienteId del contexto, buscarlo
    if (!_pagosPacienteId && _pagosCuentaInfo) {
        _pagosPacienteId = _pagosCuentaInfo.paciente_id;
    }

    // Resetear
    document.getElementById('pagoTipoPagador').value = 'paciente';
    _cambiarTipoPagador('paciente');
    document.getElementById('pagoMonto').value = '';
    document.getElementById('pagoFecha').value = new Date().toISOString().slice(0,10);
    document.getElementById('pagoMetodo').value = 'efectivo';
    document.getElementById('pagoComprobante').value = '';
    document.getElementById('pagoNotas').value = '';

    // Precargar apoderados si hay paciente vinculado
    if (_pagosPacienteId) {
        const res = await api(`/api/apoderados?paciente_id=${_pagosPacienteId}`);
        const sel = document.getElementById('pagoApoderadoId');
        if (res.success && res.data.length) {
            sel.innerHTML = `<option value="">— Seleccione apoderado —</option>` +
                res.data.map(a =>
                    `<option value="${a.apoderado_id}">${escapeHtml(a.nombres + ' ' + a.apellidos)} (${escapeHtml(a.parentesco)})</option>`
                ).join('');
        } else {
            sel.innerHTML = `<option value="">Sin apoderados registrados</option>`;
        }
    }

    document.getElementById('modalPago').classList.remove('hidden');
}

function _cambiarTipoPagador(tipo) {
    _pagosTipoPagador = tipo;
    document.getElementById('pagoGrupoPaciente').style.display  = tipo === 'paciente'  ? '' : 'none';
    document.getElementById('pagoGrupoApoderado').style.display = tipo === 'apoderado' ? '' : 'none';
    document.getElementById('pagoGrupoExterno').style.display   = tipo === 'externo'   ? '' : 'none';
}

async function guardarPago() {
    const tipo   = document.getElementById('pagoTipoPagador').value;
    const monto  = parseFloat(document.getElementById('pagoMonto').value);
    const fecha  = document.getElementById('pagoFecha').value;
    const metodo = document.getElementById('pagoMetodo').value;

    if (!monto || monto <= 0) { showToast('Ingrese un monto válido'); return; }
    if (!fecha)               { showToast('Ingrese la fecha de pago'); return; }

    const payload = {
        cuenta_cobro_id:     _pagosCuentaId,
        monto,
        fecha_pago:          fecha,
        metodo_pago:         metodo,
        numero_comprobante:  document.getElementById('pagoComprobante').value.trim() || null,
        notas:               document.getElementById('pagoNotas').value.trim() || null,
    };

    if (tipo === 'paciente') {
        if (!_pagosPacienteId) { showToast('No se encontró el paciente de esta cuenta'); return; }
        payload.pagado_por_paciente = _pagosPacienteId;
    } else if (tipo === 'apoderado') {
        const apoId = document.getElementById('pagoApoderadoId').value;
        if (!apoId) { showToast('Seleccione un apoderado'); return; }
        payload.pagado_por_apoderado = parseInt(apoId);
    } else {
        const nombre = document.getElementById('pagoExternoNombre').value.trim();
        if (!nombre) { showToast('Ingrese el nombre del pagador'); return; }
        payload.pagado_por_externo = nombre;
    }

    const res = await api('/api/pagos', 'POST', payload);
    if (res.success) {
        cerrarModal('modalPago');
        showToast('Pago registrado');
        // Recargar la vista de detalle si estamos en ella
        if (_pagosVista === 'detalle' && _pagosCuentaId) {
            await verDetalleCuenta(_pagosCuentaId);
        } else {
            _cargarCuentas();
        }
    } else {
        showToast(res.message || 'Error al registrar pago');
    }
}

// ----------------------------------------------------------------
// Exportar PDF
// ----------------------------------------------------------------
function exportarCuentaPDF(cuentaId) {
    window.open('/api/pdf/cuenta?cuenta_id=' + encodeURIComponent(cuentaId), '_blank');
}

// ----------------------------------------------------------------
// Utilidades
// ----------------------------------------------------------------
function fmt(val) {
    return parseFloat(val).toFixed(2);
}
