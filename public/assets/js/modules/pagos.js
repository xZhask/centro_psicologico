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
let _pagosCitaId             = null;
let _pagosPacientePaqueteId  = null;


const METODO_LABEL = {
    efectivo:        'Efectivo',
    transferencia:   'Transferencia',
    tarjeta_debito:  'T. Débito',
    tarjeta_credito: 'T. Crédito',
    yape:            'Yape',
    plin:            'Plin',
    otro:            'Otro',
};
let _isSavingPago = false;

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
        <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
            <h2 style="margin:0">Pagos de pacientes</h2>
        </div>

        <div class="citas-toolbar" style="margin-bottom:1.25rem;">
            <div style="display:flex;align-items:center;gap:10px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:4px 12px; height: 38px;">
                <label style="font-size:12px;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.02em">Paciente</label>
                <select id="pagosPacienteSelect" class="input" style="border:none;background:transparent;padding:0;width:auto;min-width:280px;font-size:13px;outline:none"
                        onchange="_onPacienteChange(this)">
                    <option value="">— Seleccione un paciente —</option>
                    ${opts}
                </select>
            </div>
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
        _htmlResumenFinanciero(resumen.totales) +
        _htmlSeccionCreditos(resumen.adelantos_activos) +
        _htmlSeccionCitasPendientes(resumen.citas_pendientes) +
        _htmlSeccionAtenciones(resumen.atenciones, resumen.paquetes);
}

// ----------------------------------------------------------------
// RESUMEN FINANCIERO — tarjetas de totales
// ----------------------------------------------------------------
function _htmlResumenFinanciero(totales) {
    if (!totales) return '';
    const facturado = parseFloat(totales.total_facturado);
    const cobrado   = parseFloat(totales.total_cobrado);
    const pendiente = parseFloat(totales.total_pendiente);

    return `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1.25rem">
            <div class="card" style="padding:1rem 1.1rem;border-left:3px solid var(--color-primary)">
                <div style="font-size:.78rem;color:var(--color-text-muted);margin-bottom:.35rem">Total facturado</div>
                <div style="font-size:1.25rem;font-weight:700;color:var(--color-text)">S/ ${fmt(facturado)}</div>
            </div>
            <div class="card" style="padding:1rem 1.1rem;border-left:3px solid var(--color-success)">
                <div style="font-size:.78rem;color:var(--color-text-muted);margin-bottom:.35rem">Total cobrado</div>
                <div style="font-size:1.25rem;font-weight:700;color:var(--color-success)">S/ ${fmt(cobrado)}</div>
            </div>
            <div class="card" style="padding:1rem 1.1rem;border-left:3px solid ${pendiente > 0 ? 'var(--color-danger)' : 'var(--color-success)'}">
                <div style="font-size:.78rem;color:var(--color-text-muted);margin-bottom:.35rem">Saldo pendiente</div>
                <div style="font-size:1.25rem;font-weight:700;color:${pendiente > 0 ? 'var(--color-danger)' : 'var(--color-success)'}">S/ ${fmt(pendiente)}</div>
            </div>
        </div>`;
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
            <div style="margin-bottom:.75rem">
                <div style="font-size:.88rem;font-weight:600;color:#7d6000">Créditos disponibles</div>
            </div>
            ${tarjetas}
        </div>`;
}

// ----------------------------------------------------------------
// SECCIÓN 1.5 — Citas pendientes de atención
// ----------------------------------------------------------------
function _htmlSeccionCitasPendientes(citas) {
    if (!citas || !citas.length) return '';

    const filas = citas.map(c => {
        const saldo = parseFloat(c.saldo_pendiente);
        const pagado = parseFloat(c.monto_pagado);
        
        let accion = '';
        if (saldo > 0) {
            _pagosSesionCtx[c.cuenta_cobro_id] = {
                sesionNum: null,
                atencionNombre: `Cita: ${c.subservicio}`,
                montoTotal: parseFloat(c.monto_total),
                yaCobrado: pagado,
                saldo: saldo
            };
            accion = `<button class="btn btn-primary" style="padding:.25rem .65rem;font-size:.78rem"
                               onclick="abrirModalPago(${c.cuenta_cobro_id})">
                          Registrar pago
                      </button>`;
        } else {
            accion = `<span class="badge badge-success" style="font-size:.72rem">Pagado</span>`;
        }

        return `
            <tr>
                <td style="font-weight:600">${_fmtFecha(c.fecha_cita)}</td>
                <td>${escapeHtml(c.subservicio)}</td>
                <td>S/ ${fmt(c.monto_total)}</td>
                <td>S/ ${fmt(pagado)}</td>
                <td><span style="color:${saldo > 0 ? 'var(--color-danger)' : 'var(--color-success)'};font-weight:600">S/ ${fmt(saldo)}</span></td>
                <td>${accion}</td>
            </tr>`;
    }).join('');

    return `
        <div style="border:1px solid var(--color-border);border-radius:var(--radius-lg);
                    padding:1rem 1.25rem;margin-bottom:1.25rem;background:rgba(var(--color-primary-rgb), .03)">
            <div style="margin-bottom:.75rem">
                <div style="font-size:.88rem;font-weight:600;color:var(--color-primary)">Citas pendientes de atención</div>
            </div>
            <div class="table-responsive">
                <table class="table" style="min-width:600px;background:transparent">
                    <thead>
                        <tr>
                            <th>Fecha Cita</th>
                            <th>Servicio</th>
                            <th>Total</th>
                            <th>Cobrado</th>
                            <th>Pendiente</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
        </div>`;
}

// ----------------------------------------------------------------
// SECCIÓN 1.7 — Sesiones grupales (cuentas con vinculo_id)
// ----------------------------------------------------------------
function _htmlSeccionSesionesGrupales(sesiones) {
    if (!sesiones || !sesiones.length) return '';

    const typeLabel = {pareja:'Pareja', familiar:'Familiar', grupal:'Grupal'};
    const badgeColor = {pareja:'#3498DB', familiar:'#27AE60', grupal:'#8E44AD'};

    const filas = sesiones.map(s => {
        const saldo  = parseFloat(s.saldo_pendiente);
        const pagado = parseFloat(s.monto_pagado);
        const tipo   = (s.tipo_vinculo || '').toLowerCase();

        let accion = '';
        if (saldo > 0) {
            _pagosSesionCtx[s.cuenta_cobro_id] = {
                sesionNum:      null,
                atencionNombre: s.concepto || 'Sesión grupal',
                montoTotal:     parseFloat(s.monto_total),
                yaCobrado:      pagado,
                saldo:          saldo
            };
            accion = `<button class="btn btn-primary" style="padding:.25rem .65rem;font-size:.78rem"
                               onclick="abrirModalPago(${s.cuenta_cobro_id})">
                          Registrar pago
                      </button>`;
        } else {
            accion = `<span class="badge badge-success" style="font-size:.72rem">Pagado</span>`;
        }

        const tipoBadge = tipo && typeLabel[tipo]
            ? `<span style="display:inline-block;margin-left:5px;padding:1px 7px;border-radius:9px;font-size:11px;font-weight:600;color:#fff;background:${badgeColor[tipo]}">${typeLabel[tipo]}</span>`
            : '';

        return `
            <tr>
                <td style="font-weight:600">${_fmtFecha(s.fecha_emision)}</td>
                <td>${escapeHtml(s.nombre_grupo || '—')} ${tipoBadge}</td>
                <td style="font-size:0.82rem;color:var(--color-text-muted)">${escapeHtml(s.concepto)}</td>
                <td>S/ ${fmt(s.monto_total)}</td>
                <td>S/ ${fmt(pagado)}</td>
                <td><span style="color:${saldo > 0 ? 'var(--color-danger)' : 'var(--color-success)'};font-weight:600">S/ ${fmt(saldo)}</span></td>
                <td>${accion}</td>
            </tr>`;
    }).join('');

    return `
        <div style="border:1px solid var(--color-border);border-radius:var(--radius-lg);
                    padding:1rem 1.25rem;margin-bottom:1.25rem;background:rgba(var(--color-primary-rgb), .03)">
            <div style="margin-bottom:.75rem">
                <div style="font-size:.88rem;font-weight:600;color:var(--color-primary)">Sesiones grupales / pareja / familia</div>
            </div>
            <div class="table-responsive">
                <table class="table" style="min-width:650px;background:transparent">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Proceso</th>
                            <th>Concepto</th>
                            <th>Total</th>
                            <th>Cobrado</th>
                            <th>Pendiente</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
        </div>`;
}

// ----------------------------------------------------------------
// SECCIÓN 2 — Atenciones con acordeón de sesiones
// ----------------------------------------------------------------
function _htmlSeccionAtenciones(atenciones, paquetes) {

    if (!atenciones || !atenciones.length) {
        return `
            <div class="card" style="padding:2rem;text-align:center;color:var(--color-text-muted)">
                Este paciente no tiene atenciones registradas.
            </div>`;
    }

    // Mapear paquetes por profesional_id para mostrarlos dentro de las atenciones
    const paquetesPorProf = {};
    (paquetes || []).forEach(p => {
        const profId = parseInt(p.profesional_id);
        if (!paquetesPorProf[profId]) paquetesPorProf[profId] = [];
        paquetesPorProf[profId].push(p);
    });

    // Marcar paquetes ya asignados para evitar duplicados
    const paquetesUsados = new Set();

    const items = atenciones.map(a => {
        // Buscar paquetes del mismo profesional
        const profId = parseInt(a.profesional_id);
        const paqsDeEstaAtencion = (paquetesPorProf[profId] || []).filter(p => !paquetesUsados.has(p.id));
        // Marcar como usados
        paqsDeEstaAtencion.forEach(p => paquetesUsados.add(p.id));
        return _htmlAcordeonAtencion(a, paqsDeEstaAtencion);
    }).join('');

    return `
        <div>
            <div style="margin-bottom:.75rem">
                <h3 style="margin:0">Atenciones</h3>
            </div>
            ${items}
        </div>`;
}

function _htmlAcordeonAtencion(a, paquetesAtencion = []) {
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
    const paquetesHtml = _htmlPaquetesEnAtencion(paquetesAtencion);

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
                ${paquetesHtml}
                ${tabla}
            </div>
        </div>`;
}

// ----------------------------------------------------------------
// Paquetes dentro del acordeón de atención
// ----------------------------------------------------------------
function _htmlPaquetesEnAtencion(paquetes) {
    if (!paquetes || !paquetes.length) return '';

    const cards = paquetes.map(p => {
        // Si no hay cuenta_cobro usar precio_paquete directamente
        const total     = p.cuenta_cobro_id ? parseFloat(p.monto_total    ?? 0)
                                             : parseFloat(p.precio_paquete ?? 0);
        const pagado    = p.cuenta_cobro_id ? parseFloat(p.monto_pagado   ?? 0) : 0;
        const pendiente = p.cuenta_cobro_id ? parseFloat(p.saldo_pendiente ?? 0) : total;
        const sesInc    = parseInt(p.sesiones_incluidas) || 0;
        const sesRest   = parseInt(p.sesiones_restantes) || 0;
        const sesUsadas = sesInc - sesRest;
        const pctSes    = sesInc > 0 ? Math.round((sesUsadas / sesInc) * 100) : 0;

        // Badge estado del paquete
        let badgeEstado;
        switch (p.estado) {
            case 'activo':
                badgeEstado = `<span class="badge" style="background:#e8f5e9;color:#2e7d32;font-size:.72rem">Activo</span>`; break;
            case 'agotado':
                badgeEstado = `<span class="badge" style="background:#f5f5f5;color:#757575;font-size:.72rem">Agotado</span>`; break;
            case 'vencido':
                badgeEstado = `<span class="badge" style="background:#fff3e0;color:#e65100;font-size:.72rem">Vencido</span>`; break;
            case 'cancelado':
                badgeEstado = `<span class="badge" style="background:#ffebee;color:#c62828;font-size:.72rem">Cancelado</span>`; break;
            default:
                badgeEstado = '';
        }

        // Badge estado de pago
        let badgePago = '';
        if (!p.cuenta_cobro_id && p.estado !== 'cancelado') {
            badgePago = `<span class="badge" style="background:var(--color-warning);color:#fff;font-size:.72rem">Sin pago</span>`;
        } else if (p.cuenta_cobro_id) {
            if (pendiente <= 0) {
                badgePago = `<span class="badge badge-success" style="font-size:.72rem">Pagado</span>`;
            } else if (pagado > 0) {
                badgePago = `<span class="badge" style="background:var(--color-warning);color:#fff;font-size:.72rem">Parcial</span>`;
            } else {
                badgePago = `<span class="badge" style="background:var(--color-danger);color:#fff;font-size:.72rem">Debe S/ ${fmt(pendiente)}</span>`;
            }
        }

        // Acción de pago: mostrar botón si hay saldo pendiente (con o sin cuenta_cobro)
        let accion = '';
        const puedeRegistrar = p.estado !== 'cancelado' && pendiente > 0;
        if (puedeRegistrar) {
            const ctxKey = p.cuenta_cobro_id || `pp_${p.id}`;
            _pagosSesionCtx[ctxKey] = {
                sesionNum:      null,
                atencionNombre: `Paquete: ${p.nombre_paquete}`,
                montoTotal:     total,
                yaCobrado:      pagado,
                saldo:          pendiente,
            };
            accion = `<button class="btn btn-primary" style="padding:.3rem .75rem;font-size:.78rem"
                              onclick="abrirModalPago(${p.cuenta_cobro_id || 0}, null, ${p.id})">
                          Registrar pago
                      </button>`;
        }

        return `
            <div style="display:flex;align-items:center;gap:.75rem;padding:.75rem 1.1rem;
                        background:rgba(42,127,143,.04);border-bottom:1px solid var(--color-border)">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--color-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
                    <rect x="2" y="3" width="12" height="10" rx="2"/><path d="M6 7h4"/><path d="M6 9h2"/>
                </svg>
                <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.25rem">
                        <span style="font-weight:600;font-size:.87rem">${escapeHtml(p.nombre_paquete)}</span>
                        ${badgeEstado}
                        ${badgePago}
                    </div>
                    <div style="font-size:.8rem;color:var(--color-text-muted)">
                        ${sesUsadas}/${sesInc} sesiones usadas · S/ ${fmt(total)} total
                    </div>
                    <div style="background:#e0e0e0;border-radius:3px;height:4px;margin-top:.35rem;max-width:200px">
                        <div style="background:var(--color-primary);height:4px;border-radius:3px;width:${pctSes}%"></div>
                    </div>
                </div>
                <div style="flex-shrink:0">
                    ${accion}
                </div>
            </div>`;
    }).join('');

    return cards;
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
        const estadoEfectivo = (s.estado_cuenta === 'pagado' && saldaSes > 0) ? 'pago_parcial' : s.estado_cuenta;
        let accion;
        if (cubierto && !s.cuenta_cobro_id) {
            accion = `<span style="color:var(--color-success);font-size:.82rem;font-weight:500">Cubierto</span>`;
        } else if (estadoEfectivo === 'pagado') {
            accion = `<span class="badge badge-success" style="font-size:.72rem">Pagado</span>`;
        } else if (s.cuenta_cobro_id && (estadoEfectivo === 'pendiente' || estadoEfectivo === 'pago_parcial')) {
            _pagosSesionCtx[s.cuenta_cobro_id] = {
                sesionNum:      s.numero_sesion,
                atencionNombre,
                montoTotal:     parseFloat(s.monto_facturado ?? 0),
                yaCobrado:      cobSes,
                saldo:          saldaSes,
            };
            const badgeParcial = estadoEfectivo === 'pago_parcial'
                ? `<span class="badge" style="background:var(--color-warning);color:#fff;font-size:.72rem;display:block;margin-bottom:.3rem">Parcial</span>`
                : '';
            accion = badgeParcial + `<button class="btn btn-primary" style="padding:.25rem .65rem;font-size:.78rem"
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
                <td>${_fmtFecha(s.fecha_hora ? s.fecha_hora.slice(0, 10) : null)}</td>
                <td>${badgeMod}</td>
                <td style="font-size:.82rem;color:var(--color-text-muted)">${escapeHtml(s.concepto || '—')}</td>
                <td>${badgeCob}</td>
                <td>${s.monto_facturado ? `S/ ${fmt(s.monto_facturado)}` : '—'}</td>
                <td>${cobSes > 0 ? `S/ ${fmt(cobSes)}` : '—'}</td>
                <td>${pendCell}</td>
                <td>${accion}</td>
            </tr>`;
    }).join('');

    return `
        <div class="table-responsive">
            <table class="table" style="min-width:700px">
                <thead>

                    <tr>
                        <th>Fecha</th>
                        <th>Modalidad</th>
                        <th>Concepto</th>
                        <th>Cobertura</th>
                        <th>Total</th>
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
async function abrirModalPago(cuentaCobroId, citaId = null, pacientePaqueteId = null) {
    _pagosCuentaId          = cuentaCobroId || null;
    _pagosCitaId            = citaId;
    _pagosPacientePaqueteId = pacientePaqueteId || null;
    const ctx = _pagosSesionCtx[cuentaCobroId || `pp_${pacientePaqueteId}`]
             || _pagosSesionCtx['cita_' + citaId]
             || null;


    // Resetear formulario
    document.getElementById('pagoTipoPagador').value = 'paciente';
    _cambiarTipoPagador('paciente');
    document.getElementById('pagoMonto').value            = ctx ? fmt(ctx.saldo) : '';
    document.getElementById('pagoFecha').value            = _localDate();
    document.getElementById('pagoMetodo').value           = 'efectivo';
    document.getElementById('pagoComprobante').value      = '';
    document.getElementById('pagoNotas').value            = '';

    // Contexto en cabecera del modal
    const ctxDiv = document.getElementById('pagoContextoInfo');
    if (ctxDiv) {
        if (ctx) {
            ctxDiv.style.display = 'block';
            ctxDiv.innerHTML = `
                <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                    </svg>
                    <span style="font-weight:700;font-size:.95rem">
                        ${ctx.sesionNum != null ? `Sesión #${ctx.sesionNum} &mdash; ` : ''}${escapeHtml(ctx.atencionNombre)}
                    </span>
                </div>
                <div style="font-size:.83rem;color:var(--color-text-muted);margin-bottom:.65rem">
                    Paciente: <strong>${escapeHtml(_pagosPacienteNombre)}</strong>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem">
                    <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:.5rem .65rem;text-align:center">
                        <div style="font-size:.7rem;color:var(--color-text-muted);margin-bottom:.15rem">Monto acordado</div>
                        <div style="font-size:1rem;font-weight:700">S/ ${fmt(ctx.montoTotal)}</div>
                    </div>
                    <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:.5rem .65rem;text-align:center">
                        <div style="font-size:.7rem;color:var(--color-text-muted);margin-bottom:.15rem">Cobrado</div>
                        <div style="font-size:1rem;font-weight:700;color:var(--color-success)">S/ ${fmt(ctx.yaCobrado)}</div>
                    </div>
                    <div style="background:${ctx.saldo > 0 ? 'rgba(231,76,60,.08)' : 'rgba(39,174,96,.08)'};border:1px solid ${ctx.saldo > 0 ? 'var(--color-danger)' : 'var(--color-success)'};border-radius:var(--radius);padding:.5rem .65rem;text-align:center">
                        <div style="font-size:.7rem;color:var(--color-text-muted);margin-bottom:.15rem">Pendiente</div>
                        <div style="font-size:1rem;font-weight:700;color:${ctx.saldo > 0 ? 'var(--color-danger)' : 'var(--color-success)'}">S/ ${fmt(ctx.saldo)}</div>
                    </div>
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
    if (_isSavingPago) return;
    _isSavingPago = true;

    try {
        const tipo   = document.getElementById('pagoTipoPagador').value;
    const monto  = parseFloat(document.getElementById('pagoMonto').value);
    const fecha  = document.getElementById('pagoFecha').value;
    const metodo = document.getElementById('pagoMetodo').value;

    if (!monto || monto <= 0) { showToast('Ingrese un monto válido'); return; }
    if (!fecha)               { showToast('Ingrese la fecha de pago'); return; }

    const payload = {
        cuenta_cobro_id:     _pagosCuentaId,
        cita_id:             _pagosCitaId,
        paciente_paquete_id: _pagosPacientePaqueteId || null,
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
        
        if (res.data && res.data.cuenta_cobro_id) {
            window.open(`/api/pdf/ticket?cuenta_id=${res.data.cuenta_cobro_id}`, 'TicketPago', 'width=400,height=600,left=200,top=100');
        }

        const container = document.getElementById('pagosResumenContainer');
        if (container && _pagosPacienteId) {
            await _cargarResumen(_pagosPacienteId);
        } else if (typeof _citasPagoCallback === 'function') {
            const cb = _citasPagoCallback;
            _citasPagoCallback = null;
            cb();
        }
    } else {
        showToast(res.message || 'Error al registrar pago');
    }
    } finally {
        _isSavingPago = false;
    }
}

// ----------------------------------------------------------------
// MODAL — nueva cuenta manual
// ----------------------------------------------------------------
// Funciones de cuenta manual eliminadas — las cuentas se crean automáticamente

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

    // Inicializar campos de pago
    document.getElementById('adelTipoPagador').value = 'paciente';
    _cambiarTipoPagadorAdelanto('paciente');
    document.getElementById('adelMetodo').value    = 'efectivo';
    document.getElementById('adelFecha').value     = _localDate();
    document.getElementById('adelComprobante').value = '';
    document.getElementById('adelExternoNombre').value = '';

    // Cargar apoderados
    const selApo = document.getElementById('adelApoderadoId');
    const rApo = await api(`/api/apoderados?paciente_id=${pacienteId}`);
    if (rApo.success && rApo.data.length) {
        selApo.innerHTML = `<option value="">— Seleccione —</option>` +
            rApo.data.map(a => `<option value="${a.apoderado_id}">${escapeHtml(a.nombres + ' ' + a.apellidos)}</option>`).join('');
    } else {
        selApo.innerHTML = `<option value="">Sin apoderados</option>`;
    }

    document.getElementById('modalAdelanto').classList.remove('hidden');
}

function _cambiarTipoPagadorAdelanto(tipo) {
    document.getElementById('adelGrupoApoderado').style.display = tipo === 'apoderado' ? 'block' : 'none';
    document.getElementById('adelGrupoExterno').style.display   = tipo === 'externo'   ? 'block' : 'none';
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
    if (_isSavingPago) return;
    _isSavingPago = true;

    try {
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

        // Campos de pago
        metodo_pago:        document.getElementById('adelMetodo').value,
        fecha_pago:         document.getElementById('adelFecha').value,
        numero_comprobante: document.getElementById('adelComprobante').value.trim() || null,
    };

    const tipo = document.getElementById('adelTipoPagador').value;
    if (tipo === 'paciente') {
        payload.pagado_por_paciente = _pagosPacienteId;
    } else if (tipo === 'apoderado') {
        const apoId = document.getElementById('adelApoderadoId').value;
        if (!apoId) { showToast('Seleccione un apoderado'); return; }
        payload.pagado_por_apoderado = parseInt(apoId);
    } else {
        const nombre = document.getElementById('adelExternoNombre').value.trim();
        if (!nombre) { showToast('Ingrese el nombre del pagador'); return; }
        payload.pagado_por_externo = nombre;
    }


    const res = await api('/api/adelantos', 'POST', payload);
    if (res.success) {
        cerrarModal('modalAdelanto');
        showToast('Adelanto registrado');
        
        if (res.data && res.data.cuenta_id) {
            window.open(`/api/pdf/ticket?cuenta_id=${res.data.cuenta_id}`, 'TicketPago', 'width=400,height=600,left=200,top=100');
        }
        
        if (_pagosPacienteId) await _cargarResumen(_pagosPacienteId);
    } else {
        showToast(res.message || 'Error al registrar adelanto');
    }
    } finally {
        _isSavingPago = false;
    }
}

// ----------------------------------------------------------------
// Utilidades
// ----------------------------------------------------------------
function fmt(val) {
    return parseFloat(val).toFixed(2);
}
