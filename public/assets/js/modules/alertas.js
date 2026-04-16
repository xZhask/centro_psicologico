
// ================================================================
// Módulo: Alertas y Seguimiento
// Accesible para: administrador, profesional
// ================================================================

// Etiquetas y colores por nivel de criticidad
const NIVEL_LABEL = {
    informativa: 'Informativa',
    moderada:    'Moderada',
    alta:        'Alta',
    critica:     'Crítica',
};
const NIVEL_BADGE = {
    informativa: 'badge-info',
    moderada:    'badge-pendiente',
    alta:        'badge-warning-solid',
    critica:     'badge-danger',
};

// Icono SVG por nivel (inline para evitar dependencias externas)
const NIVEL_ICON = {
    informativa: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5.5v.5"/></svg>`,
    moderada:    `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l6 12H2L8 2z"/><path d="M8 7v3M8 11.5v.5"/></svg>`,
    alta:        `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l6 12H2L8 2z"/><path d="M8 6v4M8 11.5v.5"/></svg>`,
    critica:     `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v4M8 10.5v.5"/></svg>`,
};

const TIPO_LABEL = {
    sin_respuesta:    'Sin respuesta',
    riesgo_emocional: 'Riesgo emocional',
    tarea_pendiente:  'Tarea pendiente',
    inasistencia:     'Inasistencia',
    escala_critica:   'Escala crítica',
    manual:           'Manual',
};

// Estado actual del filtro y datos en memoria para el modal
let _alertaEstadoFiltro = 'activa';
let _alertaIdModal      = 0;

// ----------------------------------------------------------------
// Punto de entrada del módulo
// ----------------------------------------------------------------

async function alertas() {
    _alertaEstadoFiltro = 'activa';
    await _renderAlertas();
}

// ----------------------------------------------------------------
// Render principal de la bandeja
// ----------------------------------------------------------------

async function _renderAlertas() {
    const view = document.getElementById('view');
    view.innerHTML = `<p style="color:var(--color-text-muted)">Cargando alertas…</p>`;

    const res = await api(`/api/alertas?estado=${_alertaEstadoFiltro}`);

    const lista = res.data || [];

    // Conteos rápidos para las pestañas (sólo pedimos todos si no lo tenemos)
    const conteoRes = await api('/api/alertas/conteo');
    const totalActivas = conteoRes.data ? conteoRes.data.total : '?';

    view.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
            <h2 style="margin:0">Alertas y Seguimiento</h2>
            <button class="btn-primary" onclick="abrirModalNuevaAlerta()" style="font-size:.875rem">
                + Nueva alerta manual
            </button>
        </div>

        <!-- Tabs de filtro -->
        <div style="display:flex;gap:4px;margin-bottom:20px;border-bottom:2px solid var(--color-border);padding-bottom:0">
            ${_tabBtn('activa',      `Activas <span class="badge badge-danger" style="font-size:.7rem;padding:1px 6px;margin-left:4px">${totalActivas}</span>`)}
            ${_tabBtn('atendida',    'Atendidas')}
            ${_tabBtn('descartada',  'Descartadas')}
            ${_tabBtn('todas',       'Todas')}
        </div>

        <!-- Bandeja -->
        <div id="alertasBandeja">
            ${_renderBandeja(lista)}
        </div>
    `;
}

function _tabBtn(estado, label) {
    const activo = estado === _alertaEstadoFiltro;
    return `<button onclick="cambiarFiltroAlertas('${estado}')"
        style="padding:8px 16px;border:none;background:none;cursor:pointer;font-size:.875rem;font-weight:${activo ? '600' : '400'};
               color:${activo ? 'var(--color-primary)' : 'var(--color-text-muted)'};
               border-bottom:2px solid ${activo ? 'var(--color-primary)' : 'transparent'};
               margin-bottom:-2px;transition:var(--transition)">
        ${label}
    </button>`;
}

async function cambiarFiltroAlertas(estado) {
    _alertaEstadoFiltro = estado;
    const res  = await api(`/api/alertas?estado=${estado}`);
    const lista = res.data || [];

    // Re-renderizar solo bandeja + tabs sin recargar todo
    document.getElementById('alertasBandeja').innerHTML = _renderBandeja(lista);

    // Actualizar estilos de tabs
    document.querySelectorAll('[data-tab-alerta]').forEach(btn => {
        const esActivo = btn.dataset.tabAlerta === estado;
        btn.style.fontWeight   = esActivo ? '600' : '400';
        btn.style.color        = esActivo ? 'var(--color-primary)' : 'var(--color-text-muted)';
        btn.style.borderBottom = esActivo ? '2px solid var(--color-primary)' : '2px solid transparent';
    });

    await _renderAlertas(); // Re-render completo para actualizar tabs correctamente
}

// ----------------------------------------------------------------
// Render de la bandeja de alertas
// ----------------------------------------------------------------

function _renderBandeja(lista) {
    if (!lista || lista.length === 0) {
        const mensajes = {
            activa:     'No hay alertas activas. ¡Todo en orden!',
            atendida:   'No hay alertas atendidas registradas.',
            descartada: 'No hay alertas descartadas.',
            todas:      'No hay alertas registradas.',
        };
        return `<div class="card" style="padding:32px;text-align:center;color:var(--color-text-muted)">
                    <p style="margin:0;font-size:1rem">${mensajes[_alertaEstadoFiltro] || 'Sin alertas.'}</p>
                </div>`;
    }

    return lista.map(a => _tarjetaAlerta(a)).join('');
}

function _tarjetaAlerta(a) {
    const nivelBadge = NIVEL_BADGE[a.nivel] || '';
    const nivelLabel = NIVEL_LABEL[a.nivel] || a.nivel;
    const tipoLabel  = TIPO_LABEL[a.tipo]   || a.tipo;
    const icon       = NIVEL_ICON[a.nivel]  || '';
    const fecha      = (a.created_at || '').substring(0, 16).replace('T', ' ');
    const esActiva   = a.estado === 'activa';

    // Borde lateral de color por criticidad
    const borderColor = {
        critica:    'var(--color-danger)',
        alta:       'var(--color-warning)',
        moderada:   'var(--color-info)',
        informativa:'var(--color-success)',
    }[a.nivel] || 'var(--color-border)';

    const accionTomada = a.accion_tomada
        ? `<div style="margin-top:10px;padding:8px 12px;background:var(--color-bg);border-radius:var(--radius);font-size:.8rem">
               <span style="font-weight:600;color:var(--color-text-muted)">Acción registrada: </span>
               <span style="white-space:pre-line">${escapeHtml(a.accion_tomada)}</span>
           </div>`
        : '';

    const botonesAccion = esActiva
        ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
               <button class="btn-primary" style="font-size:.8rem;padding:5px 14px"
                   onclick="abrirModalAtender(${a.id})">
                   Atender
               </button>
               <button style="font-size:.8rem;padding:5px 14px;border:1px solid var(--color-border);background:var(--color-surface);border-radius:var(--radius);cursor:pointer"
                   onclick="descartarAlerta(${a.id})">
                   Descartar
               </button>
           </div>`
        : `<p style="margin:6px 0 0;font-size:.75rem;color:var(--color-text-muted)">
               ${a.estado === 'atendida' ? 'Atendida' : 'Descartada'}
               ${a.atendida_at ? ' el ' + a.atendida_at.substring(0, 16).replace('T', ' ') : ''}
           </p>`;

    return `
    <div class="card" style="padding:16px 18px;margin-bottom:12px;border-left:4px solid ${borderColor}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <!-- Columna principal -->
            <div style="flex:1;min-width:200px">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
                    <span class="badge ${nivelBadge}" style="display:inline-flex;align-items:center;gap:4px">
                        ${icon}${nivelLabel}
                    </span>
                    <span class="badge" style="background:var(--color-bg);color:var(--color-text-muted);border:1px solid var(--color-border);font-size:.72rem">
                        ${tipoLabel}
                    </span>
                </div>
                <p style="margin:0 0 4px;font-weight:600;font-size:.95rem">${escapeHtml(a.paciente)}</p>
                <p style="margin:0 0 2px;font-size:.82rem;color:var(--color-text-muted)">${escapeHtml(a.subservicio || '—')}</p>
                ${a.descripcion
                    ? `<p style="margin:8px 0 0;font-size:.875rem;white-space:pre-line">${escapeHtml(a.descripcion)}</p>`
                    : ''}
                ${accionTomada}
                ${botonesAccion}
            </div>
            <!-- Fecha -->
            <div style="text-align:right;flex-shrink:0">
                <p style="margin:0;font-size:.75rem;color:var(--color-text-muted)">${fecha}</p>
            </div>
        </div>
    </div>`;
}

// ----------------------------------------------------------------
// Modal: Atender alerta
// ----------------------------------------------------------------

function abrirModalAtender(alertaId) {
    _alertaIdModal = alertaId;
    document.getElementById('atenderAlertaId').value       = alertaId;
    document.getElementById('atenderAccion').value          = '';
    document.getElementById('atenderAccion').classList.remove('is-invalid');
    document.getElementById('atenderAccionError').textContent = '';
    document.getElementById('modalAtenderAlerta').classList.remove('hidden');
    document.getElementById('atenderAccion').focus();
}

async function guardarAtencionAlerta() {
    const id     = parseInt(document.getElementById('atenderAlertaId').value);
    const accion = document.getElementById('atenderAccion').value.trim();

    if (!accion) {
        document.getElementById('atenderAccion').classList.add('is-invalid');
        document.getElementById('atenderAccionError').textContent = 'Describe la acción tomada';
        return;
    }

    const res = await api('/api/alertas/atender', 'PUT', { id, accion });

    if (res.success) {
        showToast('Alerta atendida');
        cerrarModal('modalAtenderAlerta');
        await _renderAlertas();
    } else {
        showToast(res.message || 'Error al atender alerta');
    }
}

async function descartarAlerta(alertaId) {
    if (!confirm('¿Descartar esta alerta? Se marcará como descartada sin registrar acción.')) return;

    const res = await api('/api/alertas/descartar', 'PUT', { id: alertaId });
    if (res.success) {
        showToast('Alerta descartada');
        await _renderAlertas();
    } else {
        showToast(res.message || 'Error al descartar alerta');
    }
}

// ----------------------------------------------------------------
// Modal: Nueva alerta manual
// ----------------------------------------------------------------

async function abrirModalNuevaAlerta() {
    // Cargar atenciones activas para el selector
    const resAt = await api('/api/atenciones');
    const activas = (resAt.data || []).filter(a => a.estado === 'activa');

    let opAt = '<option value="">Seleccionar atención activa…</option>';
    activas.forEach(a => {
        opAt += `<option value="${a.id}">${escapeHtml(a.paciente)} — ${escapeHtml(a.subservicio)}</option>`;
    });
    document.getElementById('nuevaAlertaAtencion').innerHTML = opAt;
    document.getElementById('nuevaAlertaTipo').value    = 'manual';
    document.getElementById('nuevaAlertaNivel').value   = 'moderada';
    document.getElementById('nuevaAlertaDesc').value    = '';
    document.getElementById('nuevaAlertaDesc').classList.remove('is-invalid');
    document.getElementById('nuevaAlertaDescError').textContent = '';
    document.getElementById('modalNuevaAlerta').classList.remove('hidden');
}

async function guardarNuevaAlerta() {
    const atencionId  = parseInt(document.getElementById('nuevaAlertaAtencion').value);
    const tipo        = document.getElementById('nuevaAlertaTipo').value;
    const nivel       = document.getElementById('nuevaAlertaNivel').value;
    const descripcion = document.getElementById('nuevaAlertaDesc').value.trim();

    document.getElementById('nuevaAlertaDesc').classList.remove('is-invalid');
    document.getElementById('nuevaAlertaDescError').textContent = '';

    if (!atencionId) { showToast('Seleccione una atención'); return; }
    if (!descripcion) {
        document.getElementById('nuevaAlertaDesc').classList.add('is-invalid');
        document.getElementById('nuevaAlertaDescError').textContent = 'La descripción es obligatoria';
        return;
    }

    const res = await api('/api/alertas', 'POST', { atencion_id: atencionId, tipo, nivel, descripcion });
    if (res.success) {
        showToast('Alerta creada');
        cerrarModal('modalNuevaAlerta');
        await _renderAlertas();
    } else {
        showToast(res.message || 'Error al crear alerta');
    }
}

// ----------------------------------------------------------------
// Función de acceso rápido desde el dashboard
// ----------------------------------------------------------------

function irAAlertasActivas() {
    _alertaEstadoFiltro = 'activa';
    navigate('alertas');
}
