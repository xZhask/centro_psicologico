// ============================================================
// Módulo: Planillas y Pagos al Personal
// Solo accesible para administradores.
// ============================================================

// --- estado del módulo ---
let _planillasVista       = 'lista';   // 'lista' | 'detalle'
let _planillaActual       = null;      // objeto planilla completo
let _planillasFiltroProf  = '';

const PL_ESTADO_BADGE = {
    borrador:  '<span class="badge" style="background:#6c757d;color:#fff">Borrador</span>',
    aprobada:  '<span class="badge badge-info">Aprobada</span>',
    pagada:    '<span class="badge badge-success">Pagada</span>',
    anulada:   '<span class="badge badge-danger">Anulada</span>',
};

const PL_METODO_LABEL = {
    transferencia: 'Transferencia',
    efectivo:      'Efectivo',
    cheque:        'Cheque',
    otro:          'Otro',
};

// ----------------------------------------------------------------
// Entrada del módulo
// ----------------------------------------------------------------
function planillas() {
    const user = getUser();
    if (!user || user.rol !== 'administrador') {
        document.getElementById('view').innerHTML = `
            <div class="card" style="padding:2rem;text-align:center;color:var(--color-text-muted)">
                Acceso restringido a administradores.
            </div>`;
        return;
    }
    document.getElementById('view').innerHTML = `<div id="planillasRoot"></div>`;
    _planillasVista = 'lista';
    _cargarPlanillas();
}

// ----------------------------------------------------------------
// VISTA LISTA
// ----------------------------------------------------------------
async function _cargarPlanillas() {
    const url = _planillasFiltroProf
        ? `/api/planillas?profesional_id=${_planillasFiltroProf}`
        : '/api/planillas';
    const res = await api(url);
    if (!res.success) { showToast('Error al cargar planillas'); return; }
    await _renderListaPlanillas(res.data);
}

async function _renderListaPlanillas(lista) {
    const root = document.getElementById('planillasRoot');
    if (!root) return;

    // Cargar profesionales para el filtro
    const resPro = await api('/api/profesionales');
    const optsPro = resPro.success
        ? resPro.data.map(p =>
            `<option value="${p.id}">${escapeHtml(p.apellidos + ', ' + p.nombres)}</option>`
          ).join('')
        : '';

    root.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;flex-wrap:wrap;gap:.75rem">
            <h2 style="margin:0">Planillas de pago al personal</h2>
            <button class="btn btn-primary" onclick="abrirModalPlanilla()">+ Nueva planilla</button>
        </div>

        <div class="card" style="margin-bottom:1rem;padding:.75rem 1rem;display:flex;gap:.75rem;align-items:center;flex-wrap:wrap">
            <label style="font-size:.85rem;font-weight:500;color:var(--color-text-muted)">Filtrar por profesional</label>
            <select id="planillasFiltroProf" class="input" style="width:260px"
                    onchange="_planillasFiltroProf=this.value;_cargarPlanillas()">
                <option value="">— Todos los profesionales —</option>
                ${optsPro}
            </select>
        </div>

        ${_tablaPlanillas(lista)}`;

    // Restaurar filtro si existe
    if (_planillasFiltroProf) {
        const sel = document.getElementById('planillasFiltroProf');
        if (sel) sel.value = _planillasFiltroProf;
    }
}

function _tablaPlanillas(lista) {
    if (!lista.length) {
        return `<div class="card" style="padding:2rem;text-align:center;color:var(--color-text-muted)">
                    No hay planillas registradas.
                </div>`;
    }

    const filas = lista.map(pl => {
        const montoNeto  = parseFloat(pl.monto_neto);
        const pagado     = parseFloat(pl.monto_pagado);
        const saldo      = Math.max(0, montoNeto - pagado);
        const saldoHtml  = saldo > 0
            ? `<span style="color:var(--color-danger);font-weight:600">S/ ${fmtPl(saldo)}</span>`
            : `<span style="color:var(--color-success)">—</span>`;

        const periodo = `${pl.periodo_inicio} → ${pl.periodo_fin}`;

        const btnAprobar = pl.estado === 'borrador'
            ? `<button class="btn" style="padding:.3rem .6rem;font-size:.78rem"
                       onclick="aprobarPlanilla(${pl.id})">Aprobar</button>`
            : '';
        const btnPago = pl.estado === 'aprobada'
            ? `<button class="btn btn-primary" style="padding:.3rem .6rem;font-size:.78rem"
                       onclick="abrirModalPagoPlanilla(${pl.id})">Registrar pago</button>`
            : '';

        return `
            <tr>
                <td><strong>${escapeHtml(pl.profesional_nombre)}</strong></td>
                <td style="font-size:.85rem">${periodo}</td>
                <td style="text-align:center">${pl.sesiones_realizadas}</td>
                <td style="text-align:right">S/ ${fmtPl(pl.monto_bruto)}</td>
                <td style="text-align:right;color:var(--color-warning)">
                    ${parseFloat(pl.descuentos) > 0 ? '-S/ ' + fmtPl(pl.descuentos) : '—'}
                </td>
                <td style="text-align:right;font-weight:600">S/ ${fmtPl(pl.monto_neto)}</td>
                <td style="text-align:right">S/ ${fmtPl(pagado)}</td>
                <td style="text-align:right">${saldoHtml}</td>
                <td>${PL_ESTADO_BADGE[pl.estado] ?? pl.estado}</td>
                <td>
                    <div style="display:flex;gap:.4rem;flex-wrap:wrap">
                        <button class="btn" style="padding:.3rem .6rem;font-size:.78rem"
                                onclick="verDetallePlanilla(${pl.id})">Detalle</button>
                        ${btnAprobar}
                        ${btnPago}
                    </div>
                </td>
            </tr>`;
    }).join('');

    return `
        <div class="card" style="padding:0;overflow-x:auto">
            <table class="table" style="min-width:980px">
                <thead>
                    <tr>
                        <th>Profesional</th>
                        <th>Período</th>
                        <th style="text-align:center">Sesiones</th>
                        <th style="text-align:right">Bruto</th>
                        <th style="text-align:right">Descuentos</th>
                        <th style="text-align:right">Neto</th>
                        <th style="text-align:right">Pagado</th>
                        <th style="text-align:right">Saldo</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
}

// ----------------------------------------------------------------
// APROBAR planilla (desde la lista, sin modal)
// ----------------------------------------------------------------
async function aprobarPlanilla(planillaId) {
    if (!confirm('¿Confirmar la aprobación de esta planilla? Una vez aprobada puede recibir pagos.')) return;
    const res = await api('/api/planillas/aprobar', 'PUT', { planilla_id: planillaId });
    if (res.success) {
        showToast('Planilla aprobada');
        if (_planillasVista === 'detalle') {
            verDetallePlanilla(planillaId);
        } else {
            _cargarPlanillas();
        }
    } else {
        showToast(res.message || 'No se pudo aprobar');
    }
}

// ----------------------------------------------------------------
// VISTA DETALLE — planilla + historial de pagos
// ----------------------------------------------------------------
async function verDetallePlanilla(planillaId) {
    _planillasVista = 'detalle';

    const [resPlanillas, resPagos, resConceptos] = await Promise.all([
        api('/api/planillas'),
        api(`/api/pagos-personal?planilla_id=${planillaId}`),
        api(`/api/planillas/conceptos?planilla_id=${planillaId}`),
    ]);

    const pl = resPlanillas.data?.find(p => p.id === planillaId);
    if (!pl) { showToast('Planilla no encontrada'); return; }

    _planillaActual = pl;
    _renderDetallePlanilla(pl, resPagos.data ?? [], resConceptos.data ?? []);
}

function _renderDetallePlanilla(pl, pagos, conceptos = []) {
    const root = document.getElementById('planillasRoot');
    if (!root) return;

    const montoNeto = parseFloat(pl.monto_neto);
    const pagado    = parseFloat(pl.monto_pagado);
    const saldo     = Math.max(0, montoNeto - pagado);
    const saldoStyle = saldo > 0
        ? 'color:var(--color-danger);font-weight:700'
        : 'color:var(--color-success);font-weight:700';

    const btnAprobar = pl.estado === 'borrador'
        ? `<button class="btn btn-primary" onclick="aprobarPlanilla(${pl.id})">Aprobar planilla</button>`
        : '';
    const btnPago = pl.estado === 'aprobada'
        ? `<button class="btn btn-primary" onclick="abrirModalPagoPlanilla(${pl.id})">+ Registrar pago</button>`
        : '';

    root.innerHTML = `
        <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap">
            <button class="btn" onclick="_volverListaPlanillas()" style="padding:.35rem .8rem;font-size:.85rem">
                ← Volver
            </button>
            <h2 style="margin:0;flex:1">Planilla — ${escapeHtml(pl.profesional_nombre)}</h2>
            ${btnAprobar}
            ${btnPago}
        </div>

        <div class="card" style="padding:1rem 1.25rem;margin-bottom:1.25rem;display:flex;gap:2rem;flex-wrap:wrap;align-items:flex-start">
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Período</div>
                <div style="font-weight:600">${pl.periodo_inicio} → ${pl.periodo_fin}</div>
            </div>
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Estado</div>
                <div>${PL_ESTADO_BADGE[pl.estado] ?? pl.estado}</div>
            </div>
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Sesiones</div>
                <div style="font-weight:600">${pl.sesiones_realizadas}</div>
            </div>
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Monto bruto</div>
                <div>S/ ${fmtPl(pl.monto_bruto)}</div>
            </div>
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Descuentos</div>
                <div style="color:var(--color-warning)">${parseFloat(pl.descuentos) > 0 ? '-S/ ' + fmtPl(pl.descuentos) : '—'}</div>
            </div>
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Monto neto</div>
                <div style="font-weight:700;font-size:1.1rem">S/ ${fmtPl(pl.monto_neto)}</div>
            </div>
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Total pagado</div>
                <div>S/ ${fmtPl(pagado)}</div>
            </div>
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Saldo pendiente</div>
                <div style="${saldoStyle}">S/ ${fmtPl(saldo)}</div>
            </div>
            ${pl.observaciones ? `
            <div style="flex-basis:100%">
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Observaciones</div>
                <div>${escapeHtml(pl.observaciones)}</div>
            </div>` : ''}
        </div>

        ${conceptos.length ? `
        <h3 style="margin:0 0 .75rem">Desglose de conceptos</h3>
        <div style="margin-bottom:1.5rem">${_renderConceptos(conceptos)}</div>` : ''}

        <h3 style="margin:0 0 .75rem">Historial de pagos</h3>
        <div id="planillaPagosLista">${_renderHistorialPagos(pagos)}</div>`;
}

function _renderConceptos(conceptos) {
    const sesiones = conceptos.filter(c => c.tipo === 'sesion');
    const talleres  = conceptos.filter(c => c.tipo === 'taller');

    const renderGrupo = (titulo, items, colorBadge) => {
        if (!items.length) return '';
        const filas = items.map(c => `
            <tr>
                <td>${escapeHtml(c.descripcion)}</td>
                <td style="text-align:right">S/ ${fmtPl(c.monto_base)}</td>
                <td style="text-align:center">${parseFloat(c.porcentaje).toFixed(1)}%</td>
                <td style="text-align:right;font-weight:600">S/ ${fmtPl(c.monto_profesional)}</td>
            </tr>`).join('');

        const subtotal = items.reduce((s, c) => s + parseFloat(c.monto_profesional), 0);
        return `
            <div style="margin-bottom:1rem">
                <div style="font-size:.8rem;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;display:flex;align-items:center;gap:.5rem">
                    <span style="background:${colorBadge};color:#fff;padding:1px 8px;border-radius:3px;font-size:.72rem">${titulo}</span>
                    <span>Subtotal: S/ ${fmtPl(subtotal)}</span>
                </div>
                <div class="card" style="padding:0;overflow-x:auto">
                    <table class="table" style="min-width:500px">
                        <thead>
                            <tr>
                                <th>Descripción</th>
                                <th style="text-align:right">Monto base</th>
                                <th style="text-align:center">%</th>
                                <th style="text-align:right">Al profesional</th>
                            </tr>
                        </thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>
            </div>`;
    };

    return renderGrupo('Sesiones individuales', sesiones, '#2A7F8F')
         + renderGrupo('Talleres', talleres, '#E8B84B');
}

function _renderHistorialPagos(pagos) {
    if (!pagos.length) {
        return `<div class="card" style="padding:1.5rem;text-align:center;color:var(--color-text-muted)">
                    No se han registrado pagos para esta planilla.
                </div>`;
    }

    const filas = pagos.map(p => `
        <tr>
            <td>${p.fecha_pago}</td>
            <td style="text-align:right;font-weight:600">S/ ${fmtPl(p.monto)}</td>
            <td>${escapeHtml(PL_METODO_LABEL[p.metodo_pago] ?? p.metodo_pago)}</td>
            <td>${p.referencia ? escapeHtml(p.referencia) : '—'}</td>
            <td style="color:var(--color-text-muted);font-size:.85rem">
                ${p.registrado_por_nombre ? escapeHtml(p.registrado_por_nombre) : '—'}
            </td>
        </tr>`).join('');

    return `
        <div class="card" style="padding:0;overflow-x:auto">
            <table class="table" style="min-width:520px">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th style="text-align:right">Monto</th>
                        <th>Método</th>
                        <th>Referencia</th>
                        <th>Registrado por</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
}

function _volverListaPlanillas() {
    _planillasVista = 'lista';
    _planillaActual = null;
    _cargarPlanillas();
}

// ----------------------------------------------------------------
// MODAL — nueva planilla
// ----------------------------------------------------------------
async function abrirModalPlanilla() {
    const resPro = await api('/api/profesionales');
    const opts = resPro.success
        ? resPro.data.map(p =>
            `<option value="${p.id}">${escapeHtml(p.apellidos + ', ' + p.nombres)}</option>`
          ).join('')
        : '';
    document.getElementById('plProfesionalId').innerHTML = `<option value="">— Seleccione —</option>${opts}`;

    // Limpiar campos
    document.getElementById('plPeriodoInicio').value   = '';
    document.getElementById('plPeriodoFin').value      = '';
    document.getElementById('plSesiones').value        = '';
    document.getElementById('plMontoBruto').value      = '';
    document.getElementById('plDescuentos').value      = '0';
    document.getElementById('plObservaciones').value  = '';

    document.getElementById('modalPlanilla').classList.remove('hidden');
}

async function guardarPlanilla() {
    const profId  = document.getElementById('plProfesionalId').value;
    const inicio  = document.getElementById('plPeriodoInicio').value;
    const fin     = document.getElementById('plPeriodoFin').value;
    const sesiones = parseInt(document.getElementById('plSesiones').value) || 0;
    const bruto   = parseFloat(document.getElementById('plMontoBruto').value);
    const desc    = parseFloat(document.getElementById('plDescuentos').value) || 0;
    const obs     = document.getElementById('plObservaciones').value.trim();

    if (!profId)        { showToast('Seleccione un profesional'); return; }
    if (!inicio || !fin){ showToast('Complete el período'); return; }
    if (!bruto || bruto <= 0) { showToast('Ingrese el monto bruto'); return; }

    const res = await api('/api/planillas', 'POST', {
        profesional_id:      parseInt(profId),
        periodo_inicio:      inicio,
        periodo_fin:         fin,
        sesiones_realizadas: sesiones,
        monto_bruto:         bruto,
        descuentos:          desc,
        observaciones:       obs || null,
    });

    if (res.success) {
        cerrarModal('modalPlanilla');
        showToast('Planilla creada');
        _cargarPlanillas();
    } else {
        showToast(res.message || 'Error al crear planilla');
    }
}

// ----------------------------------------------------------------
// MODAL — registrar pago a planilla
// ----------------------------------------------------------------
async function abrirModalPagoPlanilla(planillaId) {
    // Obtener datos actualizados de la planilla
    const res = await api('/api/planillas');
    const pl  = res.data?.find(p => p.id === planillaId);
    if (!pl) { showToast('Planilla no encontrada'); return; }

    _planillaActual = pl;

    const montoNeto = parseFloat(pl.monto_neto);
    const pagado    = parseFloat(pl.monto_pagado);
    const saldo     = Math.max(0, montoNeto - pagado);

    document.getElementById('plPagoId').value      = planillaId;
    document.getElementById('plPagoMonto').value   = fmtPl(saldo);
    document.getElementById('plPagoFecha').value   = new Date().toISOString().slice(0, 10);
    document.getElementById('plPagoMetodo').value  = 'transferencia';
    document.getElementById('plPagoRef').value     = '';

    // Mostrar resumen de saldo
    document.getElementById('plPagoSaldoInfo').innerHTML = `
        <div style="background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius);
                    padding:.65rem 1rem;margin-bottom:.75rem;font-size:.88rem;line-height:1.6">
            <strong>${escapeHtml(pl.profesional_nombre)}</strong><br>
            Monto neto: <strong>S/ ${fmtPl(montoNeto)}</strong> &nbsp;|&nbsp;
            Ya pagado: <strong>S/ ${fmtPl(pagado)}</strong> &nbsp;|&nbsp;
            <span style="color:var(--color-danger);font-weight:600">Saldo: S/ ${fmtPl(saldo)}</span>
        </div>`;

    document.getElementById('modalPagoPlanilla').classList.remove('hidden');
}

async function guardarPagoPlanilla() {
    const planillaId = parseInt(document.getElementById('plPagoId').value);
    const monto      = parseFloat(document.getElementById('plPagoMonto').value);
    const fecha      = document.getElementById('plPagoFecha').value;
    const metodo     = document.getElementById('plPagoMetodo').value;
    const ref        = document.getElementById('plPagoRef').value.trim();

    if (!monto || monto <= 0) { showToast('Ingrese un monto válido'); return; }
    if (!fecha)                { showToast('Ingrese la fecha de pago'); return; }

    const res = await api('/api/pagos-personal', 'POST', {
        planilla_id: planillaId,
        monto,
        fecha_pago:  fecha,
        metodo_pago: metodo,
        referencia:  ref || null,
    });

    if (res.success) {
        cerrarModal('modalPagoPlanilla');

        // Mostrar mensaje con saldo restante si es pago parcial
        const saldoRestante = parseFloat(res.saldo_restante ?? 0);
        if (saldoRestante > 0.009) {
            showToast(`Pago registrado — Saldo pendiente: S/ ${fmtPl(saldoRestante)}`);
        } else {
            showToast('Pago registrado — Planilla liquidada');
        }

        // Refrescar la vista actual
        if (_planillasVista === 'detalle') {
            await verDetallePlanilla(planillaId);
        } else {
            _cargarPlanillas();
        }
    } else {
        showToast(res.message || 'Error al registrar pago');
    }
}

// ----------------------------------------------------------------
// Utilidades
// ----------------------------------------------------------------
function fmtPl(val) {
    return parseFloat(val).toFixed(2);
}
