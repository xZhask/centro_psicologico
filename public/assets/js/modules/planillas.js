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
// MODAL — nueva planilla (2 pasos)
// ----------------------------------------------------------------
async function abrirModalPlanilla() {
    const resPro = await api('/api/profesionales');
    const opts = resPro.success
        ? resPro.data.map(p =>
            `<option value="${p.id}">${escapeHtml(p.apellidos + ', ' + p.nombres)}</option>`
          ).join('')
        : '';
    document.getElementById('plProfesionalId').innerHTML =
        `<option value="">— Seleccione —</option>${opts}`;

    document.getElementById('plPeriodoInicio').value  = '';
    document.getElementById('plPeriodoFin').value     = '';
    document.getElementById('plPorcentaje').value     = '';
    document.getElementById('plDescuentos').value     = '0';
    document.getElementById('plObservaciones').value  = '';
    document.getElementById('plPreviewArea').innerHTML = '';

    // Mostrar paso 1
    document.getElementById('plStep1').classList.remove('hidden');
    document.getElementById('plStep2').classList.add('hidden');
    document.getElementById('plModalTitle').textContent = 'Nueva planilla de pago';
    const mc = document.getElementById('plModalContent');
    mc.classList.remove('modal-xl');
    mc.classList.add('modal-lg');

    document.getElementById('modalPlanilla').classList.remove('hidden');
}

async function _calcularPreviewPlanilla() {
    const profId = document.getElementById('plProfesionalId').value;
    const inicio = document.getElementById('plPeriodoInicio').value;
    const fin    = document.getElementById('plPeriodoFin').value;
    const pct    = parseFloat(document.getElementById('plPorcentaje').value);

    if (!profId)               { showToast('Seleccione un profesional'); return; }
    if (!inicio || !fin)       { showToast('Complete el período'); return; }
    if (!pct || pct <= 0 || pct > 100) { showToast('Ingrese un porcentaje válido (1–100)'); return; }

    const btn = document.getElementById('plBtnCalc');
    btn.disabled = true;
    btn.textContent = 'Calculando...';

    const res = await api(
        `/api/planillas/preview?profesional_id=${profId}`
        + `&periodo_inicio=${inicio}&periodo_fin=${fin}&porcentaje=${pct}`
    );

    btn.disabled = false;
    btn.textContent = 'Calcular preview →';

    if (!res.success) { showToast(res.message || 'Error al calcular preview'); return; }

    document.getElementById('plPreviewArea').innerHTML = _renderPreviewPlanilla(res.data);

    document.getElementById('plStep1').classList.add('hidden');
    document.getElementById('plStep2').classList.remove('hidden');
    document.getElementById('plModalTitle').textContent = 'Vista previa de la planilla';
    const mc = document.getElementById('plModalContent');
    mc.classList.remove('modal-lg');
    mc.classList.add('modal-xl');
}

function _volverPaso1Planilla() {
    document.getElementById('plStep2').classList.add('hidden');
    document.getElementById('plStep1').classList.remove('hidden');
    document.getElementById('plModalTitle').textContent = 'Nueva planilla de pago';
    const mc = document.getElementById('plModalContent');
    mc.classList.remove('modal-xl');
    mc.classList.add('modal-lg');
}

function _renderPreviewPlanilla(data) {
    const {
        sesiones, total_sesiones, monto_base, porcentaje, monto_profesional,
        por_cobertura, monto_facturado, monto_cobrado, saldo_pacientes, advertencias,
    } = data;

    // Desglose cobertura
    const cobHtml = ['directo', 'paquete', 'adelanto']
        .map(t => _plCobLine(t, por_cobertura[t]))
        .join('');

    const saldoColor = saldo_pacientes > 0 ? 'var(--color-danger)' : 'var(--color-success)';
    const saldoVal   = saldo_pacientes > 0
        ? `<span style="color:${saldoColor};font-weight:700">S/ ${fmtPl(saldo_pacientes)}</span>`
        : `<span style="color:${saldoColor};font-weight:700">S/ 0.00 ✓</span>`;

    const cardsHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
            <div class="card" style="padding:1rem">
                <div style="font-size:.72rem;font-weight:600;color:var(--color-text-muted);
                            text-transform:uppercase;letter-spacing:.06em;margin-bottom:.6rem">Resumen</div>
                <div style="font-size:.87rem;line-height:1.85">
                    <div>Sesiones totales: <strong>${total_sesiones}</strong></div>
                    <div style="margin:.35rem 0;font-size:.82rem;color:var(--color-text-muted)">
                        Desglose por cobertura:</div>
                    ${cobHtml}
                    <div style="border-top:1px solid var(--color-border);margin-top:.5rem;padding-top:.5rem">
                        Monto base total: <strong>S/ ${fmtPl(monto_base)}</strong><br>
                        Porcentaje aplicado: <strong>${porcentaje}%</strong>
                    </div>
                </div>
                <div style="margin-top:.75rem;padding:.55rem .75rem;background:#0E9F8F18;
                            border-radius:var(--radius);text-align:center">
                    <div style="font-size:.7rem;color:#0E6B61;font-weight:600;
                                text-transform:uppercase;letter-spacing:.05em">Monto profesional</div>
                    <div style="font-size:1.45rem;font-weight:700;color:#0E9F8F">
                        S/ ${fmtPl(monto_profesional)}</div>
                </div>
            </div>
            <div class="card" style="padding:1rem">
                <div style="font-size:.72rem;font-weight:600;color:var(--color-text-muted);
                            text-transform:uppercase;letter-spacing:.06em;margin-bottom:.6rem">
                    Comparativo cobros a pacientes</div>
                <div style="font-size:.87rem;line-height:2.1">
                    <div style="display:flex;justify-content:space-between">
                        <span>Total facturado:</span>
                        <strong>S/ ${fmtPl(monto_facturado)}</strong>
                    </div>
                    <div style="display:flex;justify-content:space-between">
                        <span>Cobrado hasta hoy:</span>
                        <strong style="color:var(--color-success)">S/ ${fmtPl(monto_cobrado)}</strong>
                    </div>
                    <div style="display:flex;justify-content:space-between;
                                border-top:1px solid var(--color-border);
                                padding-top:.4rem;margin-top:.2rem">
                        <span>Saldo pendiente:</span>
                        ${saldoVal}
                    </div>
                </div>
            </div>
        </div>`;

    // Advertencias
    let advHtml = '';
    if (advertencias && advertencias.length) {
        const items = advertencias.map(a =>
            `<div>⚠ ${escapeHtml(a)}</div>`).join('');
        advHtml = `
            <div style="background:#FFF3CD;border:1px solid #FFEAA7;border-radius:var(--radius);
                        padding:.7rem 1rem;margin-bottom:1rem;font-size:.84rem;color:#856404">
                ${items}
            </div>`;
    }

    // Tabla colapsable de sesiones
    let tablaHtml = '';
    if (sesiones && sesiones.length) {
        const filas = sesiones.map(s => {
            const montoProf = (parseFloat(s.valor_sesion) * porcentaje / 100).toFixed(2);
            return `
                <tr>
                    <td style="white-space:nowrap">${(s.fecha_hora ?? '').substring(0, 16)}</td>
                    <td>${escapeHtml(s.paciente_nombre)}</td>
                    <td>${escapeHtml(s.modalidad_sesion)}</td>
                    <td>${escapeHtml(s.subservicio)}</td>
                    <td>${_plCobBadge(s.tipo_cobertura)}</td>
                    <td style="text-align:right">S/ ${fmtPl(s.valor_sesion)}</td>
                    <td style="text-align:right">S/ ${montoProf}</td>
                </tr>`;
        }).join('');

        const totalProf = sesiones.reduce(
            (acc, s) => acc + parseFloat(s.valor_sesion) * porcentaje / 100, 0
        );

        tablaHtml = `
            <div>
                <button class="btn"
                        style="padding:.3rem .75rem;font-size:.82rem;margin-bottom:.5rem"
                        onclick="this.nextElementSibling.classList.toggle('hidden');
                                 this.textContent=this.textContent.includes('▼')
                                   ?'▲ Ocultar sesiones'
                                   :'▼ Ver detalle de sesiones (${sesiones.length})'">
                    ▼ Ver detalle de sesiones (${sesiones.length})
                </button>
                <div class="hidden" style="overflow-x:auto">
                    <table class="table" style="min-width:720px;font-size:.83rem">
                        <thead>
                            <tr>
                                <th>Fecha</th><th>Paciente</th><th>Modalidad</th>
                                <th>Servicio</th><th>Cobertura</th>
                                <th style="text-align:right">Precio sesión</th>
                                <th style="text-align:right">Monto prof.</th>
                            </tr>
                        </thead>
                        <tbody>${filas}</tbody>
                        <tfoot>
                            <tr style="font-weight:700;background:var(--color-bg)">
                                <td colspan="5">Total</td>
                                <td style="text-align:right">S/ ${fmtPl(monto_base)}</td>
                                <td style="text-align:right">S/ ${fmtPl(totalProf)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>`;
    } else {
        tablaHtml = `
            <div style="text-align:center;color:var(--color-text-muted);
                        padding:1rem;font-size:.88rem">
                No se encontraron sesiones en este período para el profesional seleccionado.
            </div>`;
    }

    return cardsHtml + advHtml + tablaHtml;
}

function _plCobLine(tipo, data) {
    if (!data || data.count === 0) return '';
    const labels = { directo: 'Cobro directo', paquete: 'Paquetes', adelanto: 'Adelantos' };
    const colors = { directo: '#0E9F8F',       paquete: '#7C5CBF',  adelanto: '#E8B84B' };
    return `
        <div style="display:flex;justify-content:space-between;font-size:.82rem;padding:.05rem 0 .05rem .5rem">
            <span>
                <span style="display:inline-block;width:7px;height:7px;border-radius:50%;
                             background:${colors[tipo]};margin-right:4px;vertical-align:middle"></span>
                ${labels[tipo]}:
            </span>
            <span><strong>${data.count}</strong> ses. — S/ ${fmtPl(data.monto)}</span>
        </div>`;
}

function _plCobBadge(tipo) {
    const map = {
        directo:  { label: 'Directo',  bg: '#0E9F8F' },
        paquete:  { label: 'Paquete',  bg: '#7C5CBF' },
        adelanto: { label: 'Crédito',  bg: '#E8B84B' },
    };
    const b = map[tipo] ?? { label: tipo, bg: '#6c757d' };
    return `<span class="badge" style="background:${b.bg};color:#fff;font-size:.72rem">${b.label}</span>`;
}

async function guardarPlanilla() {
    const profId = document.getElementById('plProfesionalId').value;
    const inicio = document.getElementById('plPeriodoInicio').value;
    const fin    = document.getElementById('plPeriodoFin').value;
    const pct    = parseFloat(document.getElementById('plPorcentaje').value);
    const desc   = parseFloat(document.getElementById('plDescuentos').value) || 0;
    const obs    = document.getElementById('plObservaciones').value.trim();

    const res = await api('/api/planillas', 'POST', {
        profesional_id:         parseInt(profId),
        periodo_inicio:         inicio,
        periodo_fin:            fin,
        porcentaje_profesional: pct,
        descuentos:             desc,
        observaciones:          obs || null,
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
