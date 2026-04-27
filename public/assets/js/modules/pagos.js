// ============================================================
// Módulo: Pagos
// Resumen por paciente: créditos disponibles + atenciones con
// detalle expandible de sesiones y cuentas de cobro.
// ============================================================

// --- estado del módulo ---
let _pagosPacienteId     = null;
let _pagosPacienteNombre = '';
let _pagosResumen        = null;
let _pagosCuentaId       = null;
let _pagosTipoPagador    = 'paciente';
let _pagosSesionCtx      = {};   // { cuentaCobroId: { sesionNum, atencionNombre, ... } }

const METODO_LABEL = {
    efectivo:        'Efectivo',
    transferencia:   'Transferencia',
    tarjeta_debito:  'T. Débito',
    tarjeta_credito: 'T. Crédito',
    yape:            'Yape',
    plin:            'Plin',
    otro:            'Otro',
};

// ----------------------------------------------------------------
// Entrada del módulo
// ----------------------------------------------------------------
function pagos() {
    document.getElementById('view').innerHTML = `<div id="pagosRoot"></div>`;
    _renderSelectorPaciente();
}

// ----------------------------------------------------------------
// SELECTOR — elegir paciente
// ----------------------------------------------------------------
async function _renderSelectorPaciente() {
    const root = document.getElementById('pagosRoot');
    if (!root) return;

    const resPac = await api('/api/pacientes');
    const opts = resPac.success
        ? resPac.data.map(p =>
            `<option value="${p.id}">${escapeHtml(p.apellidos + ', ' + p.nombres)}</option>`
          ).join('')
        : '';

    root.innerHTML = `
        <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;">
            <h2 style="margin:0">Pagos de pacientes</h2>
            <button class="btn btn-primary" onclick="abrirModalCuenta()">+ Nueva cuenta</button>
        </div>

        <div class="card" style="padding:.75rem 1rem;margin-bottom:1.25rem;display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;">
            <label style="font-size:.85rem;font-weight:500;color:var(--color-text-muted)">Paciente</label>
            <select id="pagosPacienteSelect" class="input" style="width:300px"
                    onchange="_onPacienteChange(this)">
                <option value="">— Seleccione un paciente —</option>
                ${opts}
            </select>
        </div>

        <div id="pagosResumenContainer"></div>`;

    // Restaurar selección previa
    if (_pagosPacienteId) {
        const sel = document.getElementById('pagosPacienteSelect');
        if (sel) {
            sel.value = String(_pagosPacienteId);
            if (sel.value) {
                _pagosPacienteNombre = sel.options[sel.selectedIndex].textContent.trim();
                _cargarResumen(_pagosPacienteId);
            }
        }
    }
}

function _onPacienteChange(sel) {
    const id             = parseInt(sel.value) || 0;
    _pagosPacienteId     = id || null;
    _pagosPacienteNombre = id ? sel.options[sel.selectedIndex].textContent.trim() : '';

    const container = document.getElementById('pagosResumenContainer');
    if (!id) {
        if (container) container.innerHTML = '';
        return;
    }
    _cargarResumen(id);
}

// ----------------------------------------------------------------
// RESUMEN — fetch y render
// ----------------------------------------------------------------
async function _cargarResumen(pacienteId) {
    const container = document.getElementById('pagosResumenContainer');
    if (!container) return;

    container.innerHTML = `
        <div style="text-align:center;padding:2rem;color:var(--color-text-muted)">
            Cargando información...
        </div>`;

    const res = await api(`/api/pagos/resumen-paciente?paciente_id=${pacienteId}`);
    if (!res.success) {
        container.innerHTML = `
            <div class="card" style="padding:1.5rem;color:var(--color-danger)">
                Error al cargar datos del paciente.
            </div>`;
        return;
    }
    _pagosResumen   = res.data;
    _pagosSesionCtx = {};
    _renderResumen(res.data);
}

function _renderResumen(resumen) {
    const container = document.getElementById('pagosResumenContainer');
    if (!container) return;
    container.innerHTML =
        _htmlSeccionCreditos(resumen.adelantos_activos) +
        _htmlSeccionAtenciones(resumen.atenciones);
}

// ----------------------------------------------------------------
// SECCIÓN 1 — Créditos disponibles (adelantos activos)
// ----------------------------------------------------------------
function _htmlSeccionCreditos(adelantos) {
    if (!adelantos || !adelantos.length) return '';

    const tarjetas = adelantos.map(a => {
        const total    = parseFloat(a.monto_total);
        const aplicado = parseFloat(a.monto_aplicado);
        const saldo    = parseFloat(a.saldo_disponible);
        const pct      = total > 0 ? Math.min(100, Math.round((aplicado / total) * 100)) : 0;
        const sesiones = a.sesiones_acordadas
            ? `<div style="font-size:.8rem;color:#7d6000;margin-top:.25rem">${a.sesiones_acordadas} sesiones acordadas</div>`
            : '';

        return `
            <div style="border:1px solid #dbb84a;border-radius:var(--radius);padding:.9rem 1rem;
                        background:#fffef5;margin-bottom:.5rem">
                <div style="display:flex;justify-content:space-between;margin-bottom:.35rem">
                    <span style="font-size:.85rem;font-weight:500">${escapeHtml(a.concepto)}</span>
                    <span style="font-size:.78rem;color:var(--color-text-muted)">${escapeHtml(a.profesional_nombre || '')}</span>
                </div>
                <div style="font-size:.92rem;margin-bottom:.45rem">
                    <strong>S/ ${fmt(saldo)}</strong>
                    <span style="color:var(--color-text-muted)"> disponibles de S/ ${fmt(total)} pagados</span>
                </div>
                <div style="background:#e8ddb0;border-radius:4px;height:5px">
                    <div style="background:#c9a227;height:5px;border-radius:4px;width:${pct}%"></div>
                </div>
                ${sesiones}
            </div>`;
    }).join('');

    return `
        <div style="border:1px solid #dbb84a;border-radius:var(--radius-lg);
                    padding:1rem 1.25rem;margin-bottom:1.25rem;background:#fffbee">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
                <div style="font-size:.88rem;font-weight:600;color:#7d6000">Créditos disponibles</div>
                <button class="btn" style="font-size:.78rem;padding:.25rem .65rem"
                        onclick="abrirModalAdelanto(${_pagosPacienteId})">
                    + Registrar adelanto
                </button>
            </div>
            ${tarjetas}
        </div>`;
}

// ----------------------------------------------------------------
// SECCIÓN 2 — Atenciones con acordeón de sesiones
// ----------------------------------------------------------------
function _htmlSeccionAtenciones(atenciones) {
    const btnAdelanto = `
        <button class="btn" style="font-size:.83rem"
                onclick="abrirModalAdelanto(${_pagosPacienteId})">
            + Registrar adelanto
        </button>`;

    if (!atenciones || !atenciones.length) {
        return `
            <div style="display:flex;justify-content:flex-end;margin-bottom:.75rem">${btnAdelanto}</div>
            <div class="card" style="padding:2rem;text-align:center;color:var(--color-text-muted)">
                Este paciente no tiene atenciones registradas.
            </div>`;
    }

    const items = atenciones.map(a => _htmlAcordeonAtencion(a)).join('');

    return `
        <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
                <h3 style="margin:0">Atenciones</h3>
                ${btnAdelanto}
            </div>
            ${items}
        </div>`;
}

function _htmlAcordeonAtencion(a) {
    const saldo   = parseFloat(a.saldo_pendiente);
    const factura = parseFloat(a.total_facturado);
    const cobrado = parseFloat(a.total_cobrado);
    const nSes    = parseInt(a.total_sesiones) || 0;

    const badgeSaldo = saldo > 0
        ? `<span class="badge" style="background:var(--color-danger);color:#fff;font-size:.71rem">Pendiente S/ ${fmt(saldo)}</span>`
        : cobrado > 0
            ? `<span class="badge badge-success" style="font-size:.71rem">Al día</span>`
            : '';

    const badgeEstado = a.estado_atencion === 'activa'
        ? `<span class="badge" style="background:#e8f5e9;color:#2e7d32;font-size:.71rem">Activa</span>`
        : `<span class="badge" style="background:#f5f5f5;color:#757575;font-size:.71rem">Cerrada</span>`;

    const tabla = _htmlTablasSesiones(a.sesiones || [], a.subservicio);

    return `
        <div class="card" style="padding:0;margin-bottom:.75rem;overflow:hidden">
            <div style="padding:.85rem 1.1rem;cursor:pointer;display:flex;align-items:center;gap:.75rem;user-select:none"
                 onclick="toggleAcordeonAtencion(${a.atencion_id})">
                <span id="acordeonIcon_${a.atencion_id}"
                      style="font-size:.82rem;color:var(--color-text-muted);min-width:12px;transition:transform .15s">▶</span>
                <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                        <span style="font-weight:600">${escapeHtml(a.subservicio)}</span>
                        ${badgeEstado}
                    </div>
                    <div style="font-size:.82rem;color:var(--color-text-muted);margin-top:.2rem">
                        ${escapeHtml(a.profesional)} · desde ${_fmtFecha(a.fecha_inicio)}
                    </div>
                </div>
                <div style="text-align:right;white-space:nowrap;flex-shrink:0">
                    <div style="font-size:.82rem;color:var(--color-text-muted)">
                        ${nSes} sesión${nSes !== 1 ? 'es' : ''} · S/ ${fmt(factura)} facturado
                    </div>
                    <div style="font-size:.82rem;margin-top:.2rem">
                        Cobrado <strong>S/ ${fmt(cobrado)}</strong>
                        ${badgeSaldo ? ' · ' + badgeSaldo : ''}
                    </div>
                </div>
            </div>
            <div id="acordeonBody_${a.atencion_id}"
                 style="display:none;border-top:1px solid var(--color-border)">
                ${tabla}
                <div style="padding:.65rem 1.1rem;border-top:1px solid var(--color-border);text-align:right">
                    <button class="btn" style="font-size:.8rem"
                            onclick="abrirModalAdelanto(${_pagosPacienteId}, ${a.atencion_id}, ${a.profesional_id})">
                        + Registrar adelanto para esta atención
                    </button>
                </div>
            </div>
        </div>`;
}

function _htmlTablasSesiones(sesiones, atencionNombre) {
    if (!sesiones.length) {
        return `
            <div style="padding:1.25rem;text-align:center;color:var(--color-text-muted);font-size:.87rem">
                Sin sesiones registradas.
            </div>`;
    }

    const filas = sesiones.map(s => {
        const cob      = s.tipo_cobertura;
        const cubierto = cob === 'paquete' || cob === 'adelanto';
        const saldaSes = parseFloat(s.saldo_cuenta  ?? 0);
        const cobSes   = parseFloat(s.monto_cobrado ?? 0);

        // Badge modalidad
        const badgeMod = (s.modalidad_sesion || '').includes('virtual')
            ? `<span class="badge" style="background:#e8f5e9;color:#2e7d32;font-size:.72rem">Virtual</span>`
            : `<span class="badge" style="background:#e3f0ff;color:#1a6ab1;font-size:.72rem">Presencial</span>`;

        // Badge cobertura
        let badgeCob;
        switch (cob) {
            case 'paquete':
                badgeCob = `<span class="badge" style="background:#f3e5f5;color:#6a1b9a;font-size:.72rem">Paquete</span>`; break;
            case 'adelanto':
                badgeCob = `<span class="badge" style="background:#fff8e1;color:#f57f17;font-size:.72rem">Crédito</span>`; break;
            case 'adelanto_parcial':
                badgeCob = `<span class="badge" style="background:#fff3e0;color:#e65100;font-size:.72rem">Crédito parcial</span>`; break;
            default:
                badgeCob = `<span class="badge" style="background:#e3f2fd;color:#0d47a1;font-size:.72rem">Directo</span>`;
        }

        // Celda acción
        let accion;
        if (cubierto && !s.cuenta_cobro_id) {
            accion = `<span style="color:var(--color-success);font-size:.82rem;font-weight:500">Cubierto</span>`;
        } else if (s.estado_cuenta === 'pagado') {
            accion = `<span class="badge badge-success" style="font-size:.72rem">Pagado</span>`;
        } else if (s.cuenta_cobro_id && (s.estado_cuenta === 'pendiente' || s.estado_cuenta === 'pago_parcial')) {
            _pagosSesionCtx[s.cuenta_cobro_id] = {
                sesionNum:      s.numero_sesion,
                atencionNombre,
                montoTotal:     parseFloat(s.monto_facturado ?? 0),
                yaCobrado:      cobSes,
                saldo:          saldaSes,
            };
            accion = `<button class="btn btn-primary" style="padding:.25rem .65rem;font-size:.78rem"
                              onclick="abrirModalPago(${s.cuenta_cobro_id})">
                          Registrar pago
                      </button>`;
        } else {
            accion = '—';
        }

        const pendCell = s.cuenta_cobro_id && saldaSes > 0
            ? `<span style="color:var(--color-danger);font-weight:600">S/ ${fmt(saldaSes)}</span>`
            : cubierto
                ? `<span style="color:var(--color-success);font-size:.82rem">—</span>`
                : '—';

        return `
            <tr>
                <td style="font-weight:600">#${s.numero_sesion}</td>
                <td>${s.fecha_hora ? s.fecha_hora.slice(0, 10) : '—'}</td>
                <td>${badgeMod}</td>
                <td>${s.precio_sesion ? `S/ ${fmt(s.precio_sesion)}` : '—'}</td>
                <td>${badgeCob}</td>
                <td>${cobSes > 0 ? `S/ ${fmt(cobSes)}` : '—'}</td>
                <td>${pendCell}</td>
                <td>${accion}</td>
            </tr>`;
    }).join('');

    return `
        <div style="overflow-x:auto">
            <table class="table" style="min-width:700px">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Fecha</th>
                        <th>Modalidad</th>
                        <th>Precio</th>
                        <th>Cobertura</th>
                        <th>Cobrado</th>
                        <th>Pendiente</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
}

function toggleAcordeonAtencion(atencionId) {
    const body = document.getElementById(`acordeonBody_${atencionId}`);
    const icon = document.getElementById(`acordeonIcon_${atencionId}`);
    if (!body) return;
    const abierto = body.style.display !== 'none';
    body.style.display = abierto ? 'none' : 'block';
    if (icon) icon.textContent = abierto ? '▶' : '▼';
}

function _fmtFecha(fecha) {
    if (!fecha) return '—';
    const d = new Date(fecha + 'T00:00:00');
    return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ----------------------------------------------------------------
// MODAL — registrar pago
// ----------------------------------------------------------------
async function abrirModalPago(cuentaCobroId) {
    _pagosCuentaId = cuentaCobroId;
    const ctx = _pagosSesionCtx[cuentaCobroId] || null;

    // Resetear formulario
    document.getElementById('pagoTipoPagador').value = 'paciente';
    _cambiarTipoPagador('paciente');
    document.getElementById('pagoMonto').value       = ctx ? fmt(ctx.saldo) : '';
    document.getElementById('pagoFecha').value       = new Date().toISOString().slice(0, 10);
    document.getElementById('pagoMetodo').value      = 'efectivo';
    document.getElementById('pagoComprobante').value = '';
    document.getElementById('pagoNotas').value       = '';

    // Contexto en cabecera del modal
    const ctxDiv = document.getElementById('pagoContextoInfo');
    if (ctxDiv) {
        if (ctx) {
            ctxDiv.style.display = 'block';
            ctxDiv.innerHTML = `
                <div style="font-weight:600;margin-bottom:.3rem">
                    Sesión #${ctx.sesionNum} — ${escapeHtml(ctx.atencionNombre)}
                </div>
                <div style="color:var(--color-text-muted);font-size:.85rem">
                    Paciente: ${escapeHtml(_pagosPacienteNombre)}
                </div>
                <div style="display:flex;gap:1.5rem;margin-top:.4rem;font-size:.87rem;flex-wrap:wrap">
                    <span>Total: <strong>S/ ${fmt(ctx.montoTotal)}</strong></span>
                    <span>Cobrado: <strong>S/ ${fmt(ctx.yaCobrado)}</strong></span>
                    <span>Pendiente: <strong style="color:var(--color-danger)">S/ ${fmt(ctx.saldo)}</strong></span>
                </div>`;
        } else {
            ctxDiv.style.display = 'none';
            ctxDiv.innerHTML = '';
        }
    }

    // Cargar apoderados
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
        cuenta_cobro_id:    _pagosCuentaId,
        monto,
        fecha_pago:         fecha,
        metodo_pago:        metodo,
        numero_comprobante: document.getElementById('pagoComprobante').value.trim() || null,
        notas:              document.getElementById('pagoNotas').value.trim() || null,
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
        if (_pagosPacienteId) await _cargarResumen(_pagosPacienteId);
    } else {
        showToast(res.message || 'Error al registrar pago');
    }
}

// ----------------------------------------------------------------
// MODAL — nueva cuenta manual
// ----------------------------------------------------------------
async function abrirModalCuenta() {
    document.getElementById('cuentaConcepto').value        = '';
    document.getElementById('cuentaMonto').value           = '';
    document.getElementById('cuentaDescuento').value       = '0';
    document.getElementById('cuentaMotivoDescuento').value = '';
    document.getElementById('cuentaFechaVence').value      = '';
    document.getElementById('cuentaMotivoDescuento').closest('.form-group').style.display = 'none';
    document.getElementById('cuentaFechaEmision').value    = new Date().toISOString().slice(0, 10);

    const res = await api('/api/pacientes');
    const opts = res.success
        ? res.data.map(p => `<option value="${p.id}">${escapeHtml(p.apellidos + ', ' + p.nombres)}</option>`).join('')
        : '';
    const sel = document.getElementById('cuentaPacienteId');
    sel.innerHTML = `<option value="">— Seleccione —</option>${opts}`;
    if (_pagosPacienteId) sel.value = String(_pagosPacienteId);

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

    if (!pacienteId)              { showToast('Seleccione un paciente'); return; }
    if (!concepto)                { showToast('Ingrese el concepto'); return; }
    if (!monto || monto <= 0)     { showToast('Ingrese un monto válido'); return; }
    if (!emision)                 { showToast('Ingrese la fecha de emisión'); return; }

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
        if (_pagosPacienteId) await _cargarResumen(_pagosPacienteId);
    } else {
        showToast(res.message || 'Error al crear cuenta');
    }
}

// ----------------------------------------------------------------
// ADELANTOS — modal registro
// ----------------------------------------------------------------
async function abrirModalAdelanto(pacienteId, atencionId = null, profesionalId = null) {
    _pagosPacienteId = pacienteId;

    document.getElementById('adelConcepto').value = '';
    document.getElementById('adelMonto').value    = '';
    document.getElementById('adelSesiones').value = '';

    const res = await api('/api/profesionales');
    const opts = res.success
        ? res.data.map(p =>
            `<option value="${p.id}">${escapeHtml(p.apellidos + ', ' + p.nombres)}</option>`
          ).join('')
        : '';
    document.getElementById('adelProfesionalId').innerHTML =
        `<option value="">— Seleccione —</option>${opts}`;

    if (profesionalId) {
        document.getElementById('adelProfesionalId').value = String(profesionalId);
        await _cargarAtencionesPorProfesional();
        if (atencionId) {
            document.getElementById('adelAtencionId').value = String(atencionId);
        }
    } else {
        document.getElementById('adelAtencionId').innerHTML =
            '<option value="">— Seleccione profesional primero —</option>';
    }

    document.getElementById('modalAdelanto').classList.remove('hidden');
}

async function _cargarAtencionesPorProfesional() {
    const profId = document.getElementById('adelProfesionalId').value;
    const selAt  = document.getElementById('adelAtencionId');

    if (!profId || !_pagosPacienteId) {
        selAt.innerHTML = '<option value="">— Seleccione profesional primero —</option>';
        return;
    }

    const res = await api(`/api/atenciones/paciente?paciente_id=${_pagosPacienteId}`);
    if (!res.success) { selAt.innerHTML = '<option value="">Error al cargar</option>'; return; }

    const activas = (res.data || []).filter(
        a => parseInt(a.profesional_id) === parseInt(profId) && a.estado === 'activa'
    );
    const opts = activas.map(a =>
        `<option value="${a.id}">${escapeHtml(a.subservicio || 'Atención')} — ${a.fecha_inicio || ''}</option>`
    ).join('');

    selAt.innerHTML = `<option value="">— Sin atención específica —</option>${opts}`;
}

async function guardarAdelanto() {
    const concepto   = document.getElementById('adelConcepto').value.trim();
    const monto      = parseFloat(document.getElementById('adelMonto').value);
    const sesiones   = parseInt(document.getElementById('adelSesiones').value) || null;
    const profId     = parseInt(document.getElementById('adelProfesionalId').value) || 0;
    const atencionId = parseInt(document.getElementById('adelAtencionId').value) || null;

    if (!concepto)            { showToast('Ingrese el concepto'); return; }
    if (!monto || monto <= 0) { showToast('Ingrese un monto válido'); return; }
    if (!profId)              { showToast('Seleccione un profesional'); return; }

    const payload = {
        paciente_id:        _pagosPacienteId,
        profesional_id:     profId,
        concepto,
        monto_total:        monto,
        sesiones_acordadas: sesiones,
        atencion_id:        atencionId,
    };

    const res = await api('/api/adelantos', 'POST', payload);
    if (res.success) {
        cerrarModal('modalAdelanto');
        showToast('Adelanto registrado. Registre el pago recibido.');
        await _abrirCuentaDesdeAdelanto(concepto, monto);
    } else {
        showToast(res.message || 'Error al registrar adelanto');
    }
}

async function _abrirCuentaDesdeAdelanto(concepto, monto) {
    await abrirModalCuenta();
    const sel = document.getElementById('cuentaPacienteId');
    if (sel && _pagosPacienteId) sel.value = String(_pagosPacienteId);
    document.getElementById('cuentaConcepto').value = `Pago adelantado — ${concepto}`;
    document.getElementById('cuentaMonto').value    = monto.toFixed(2);
}

// ----------------------------------------------------------------
// Utilidades
// ----------------------------------------------------------------
function fmt(val) {
    return parseFloat(val).toFixed(2);
}
