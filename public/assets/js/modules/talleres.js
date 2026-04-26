// ============================================================
// Módulo: Talleres Institucionales
// Accesible para administrador y profesional.
// ============================================================

let _talleresVista   = 'lista';
let _tallerActual    = null;
let _tallerEditandoId = null;
let _tallerFechaContador = 0;

const TI_ESTADO_BADGE = {
    programado: '<span class="badge badge-info">Programado</span>',
    realizado:  '<span class="badge badge-success">Realizado</span>',
    cancelado:  '<span class="badge badge-danger">Cancelado</span>',
};

const TF_ESTADO_BADGE = {
    programada: '<span class="badge badge-info">Programada</span>',
    realizada:  '<span class="badge badge-success">Realizada</span>',
    cancelada:  '<span class="badge badge-danger">Cancelada</span>',
};

// ----------------------------------------------------------------
// Entrada del módulo
// ----------------------------------------------------------------
function talleres() {
    document.getElementById('view').innerHTML = `<div id="talleresRoot"></div>`;
    _talleresVista     = 'lista';
    _tallerActual      = null;
    _tallerEditandoId  = null;
    _cargarTalleres();
}

// ----------------------------------------------------------------
// VISTA LISTA
// ----------------------------------------------------------------
async function _cargarTalleres() {
    const res = await api('/api/talleres');
    if (!res.success) { showToast('Error al cargar talleres'); return; }
    _renderListaTalleres(res.data);
}

function _renderListaTalleres(lista) {
    const root = document.getElementById('talleresRoot');
    if (!root) return;

    const user    = getUser();
    const esAdmin = user?.rol === 'administrador';

    const btnNuevo = esAdmin
        ? `<button class="btn btn-primary" onclick="abrirModalTaller()">+ Nuevo taller</button>`
        : '';

    root.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;flex-wrap:wrap;gap:.75rem">
            <h2 style="margin:0">Talleres institucionales</h2>
            ${btnNuevo}
        </div>
        ${_tablaTalleres(lista, esAdmin)}`;
}

function _tablaTalleres(lista, esAdmin) {
    if (!lista.length) {
        return `<div class="card" style="padding:2rem;text-align:center;color:var(--color-text-muted)">
                    No hay talleres registrados.
                </div>`;
    }

    const filas = lista.map(t => {
        const btnCancelar = esAdmin && t.estado !== 'cancelado'
            ? `<button class="btn" style="padding:.3rem .6rem;font-size:.78rem;color:var(--color-danger)"
                       onclick="cancelarTaller(${t.id})">Cancelar</button>`
            : '';

        const fechaResumen = t.primera_fecha
            ? `${formatFecha(t.primera_fecha)}${parseInt(t.total_fechas) > 1 ? ' +' + (parseInt(t.total_fechas) - 1) + ' más' : ''}`
            : '—';

        return `
            <tr>
                <td><strong>${escapeHtml(t.tema)}</strong></td>
                <td>${t.institucion ? escapeHtml(t.institucion) : '<span style="color:var(--color-text-muted)">—</span>'}</td>
                <td>${escapeHtml(t.profesional)}</td>
                <td style="font-size:.85rem">${fechaResumen}</td>
                <td style="text-align:center">${t.total_asistentes ?? '—'}</td>
                <td style="text-align:right">S/ ${parseFloat(t.precio_acordado).toFixed(2)}</td>
                <td>${TI_ESTADO_BADGE[t.estado] ?? t.estado}</td>
                <td>
                    <div style="display:flex;gap:.4rem;flex-wrap:wrap">
                        <button class="btn btn-primary" style="padding:.3rem .6rem;font-size:.78rem"
                                onclick="verDetalleTaller(${t.id})">Ver</button>
                        ${btnCancelar}
                    </div>
                </td>
            </tr>`;
    }).join('');

    return `
        <div class="card" style="padding:0;overflow-x:auto">
            <table class="table" style="min-width:860px">
                <thead>
                    <tr>
                        <th>Tema</th>
                        <th>Institución</th>
                        <th>Profesional</th>
                        <th>Fechas</th>
                        <th style="text-align:center">Asistentes</th>
                        <th style="text-align:right">Precio</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
}

// ----------------------------------------------------------------
// CANCELAR TALLER
// ----------------------------------------------------------------
async function cancelarTaller(id) {
    if (!confirm('¿Cancelar este taller? Esta acción no se puede deshacer.')) return;
    const res = await api('/api/talleres/estado', 'PUT', { id, estado: 'cancelado' });
    if (res.success) {
        showToast('Taller cancelado');
        if (_talleresVista === 'detalle') {
            verDetalleTaller(id);
        } else {
            _cargarTalleres();
        }
    } else {
        showToast(res.message || 'Error al cancelar');
    }
}

// ----------------------------------------------------------------
// VISTA DETALLE
// ----------------------------------------------------------------
async function verDetalleTaller(id) {
    _talleresVista = 'detalle';

    // Asegurarse de que el contenedor exista (puede llamarse desde el calendario)
    if (!document.getElementById('talleresRoot')) {
        document.getElementById('view').innerHTML = `<div id="talleresRoot"></div>`;
    }

    const res = await api('/api/taller?id=' + id);
    if (!res.success) { showToast('Error al cargar el taller'); return; }

    _tallerActual = res.data;
    _renderDetalleTaller(res.data);
}

function _renderDetalleTaller(t) {
    const root = document.getElementById('talleresRoot');
    if (!root) return;

    const user    = getUser();
    const esAdmin = user?.rol === 'administrador';

    const btnCancelar = esAdmin && t.estado !== 'cancelado'
        ? `<button class="btn" style="color:var(--color-danger)" onclick="cancelarTaller(${t.id})">Cancelar taller</button>`
        : '';

    root.innerHTML = `
        <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap">
            <button class="btn" onclick="${_talleresVista === 'detalle' ? '_volverListaTalleres()' : "navigate('talleres')"}" style="padding:.35rem .8rem;font-size:.85rem">← Volver</button>
            <h2 style="margin:0;flex:1">${escapeHtml(t.tema)}</h2>
            ${btnCancelar}
        </div>

        <!-- Resumen superior -->
        <div class="card" style="padding:1rem 1.25rem;margin-bottom:1.25rem;display:flex;gap:2rem;flex-wrap:wrap">
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Profesional</div>
                <div style="font-weight:600">${escapeHtml(t.profesional)}</div>
            </div>
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Institución</div>
                <div>${t.institucion ? escapeHtml(t.institucion) : '<span style="color:var(--color-text-muted)">—</span>'}</div>
            </div>
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Servicio</div>
                <div>${escapeHtml(t.subservicio)}</div>
            </div>
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Estado</div>
                <div>${TI_ESTADO_BADGE[t.estado] ?? t.estado}</div>
            </div>
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Precio acordado</div>
                <div style="font-weight:700;font-size:1.05rem">S/ ${parseFloat(t.precio_acordado).toFixed(2)}</div>
            </div>
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">% profesional</div>
                <div>${parseFloat(t.porcentaje_prof).toFixed(1)}%</div>
            </div>
            <div>
                <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Asistentes esperados</div>
                <div>${t.total_asistentes ?? '—'}</div>
            </div>
            ${t.descripcion ? `<div style="flex-basis:100%"><div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Descripción</div><div>${escapeHtml(t.descripcion)}</div></div>` : ''}
            ${t.notas ? `<div style="flex-basis:100%"><div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.2rem">Notas</div><div>${escapeHtml(t.notas)}</div></div>` : ''}
        </div>

        <!-- Tabla de fechas -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:.5rem">
            <h3 style="margin:0">Fechas del taller</h3>
            ${esAdmin && t.estado !== 'cancelado' ? `<button class="btn btn-primary" style="padding:.35rem .8rem;font-size:.85rem" onclick="abrirModalAgregarFecha(${t.id})">+ Agregar fecha</button>` : ''}
        </div>
        <div id="tallerFechasList">${_renderTablaFechas(t.fechas, t.id, esAdmin, t.estado)}</div>`;
}

function _renderTablaFechas(fechas, tallerId, esAdmin, tallerEstado) {
    if (!fechas || !fechas.length) {
        return `<div class="card" style="padding:1.5rem;text-align:center;color:var(--color-text-muted)">No hay fechas registradas.</div>`;
    }

    const filas = fechas.map((f, i) => {
        const dtStr = f.fecha_hora ? formatFecha(f.fecha_hora) : '—';
        const asis  = f.asistentes != null ? f.asistentes : '—';

        const acciones = esAdmin && tallerEstado !== 'cancelado'
            ? `
                ${f.estado === 'programada' ? `<button class="btn btn-primary" style="padding:.25rem .55rem;font-size:.77rem" onclick="abrirMarcarRealizada(${f.id},${tallerId})">Marcar realizada</button>` : ''}
                ${f.estado !== 'realizada' ? `<button class="btn" style="padding:.25rem .55rem;font-size:.77rem;color:var(--color-danger)" onclick="eliminarFechaTaller(${f.id},${tallerId})">Eliminar</button>` : ''}
              `
            : '';

        return `
            <tr>
                <td style="text-align:center;color:var(--color-text-muted)">${i + 1}</td>
                <td>${dtStr}</td>
                <td style="text-align:center">${f.duracion_min} min</td>
                <td style="text-align:center">${asis}</td>
                <td>${TF_ESTADO_BADGE[f.estado] ?? f.estado}</td>
                <td>
                    <div style="display:flex;gap:.4rem;flex-wrap:wrap">${acciones}</div>
                </td>
            </tr>`;
    }).join('');

    return `
        <div class="card" style="padding:0;overflow-x:auto">
            <table class="table" style="min-width:560px">
                <thead>
                    <tr>
                        <th style="text-align:center">#</th>
                        <th>Fecha / Hora</th>
                        <th style="text-align:center">Duración</th>
                        <th style="text-align:center">Asistentes</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
}

function _volverListaTalleres() {
    _talleresVista = 'lista';
    _tallerActual  = null;
    _cargarTalleres();
}

// ----------------------------------------------------------------
// MODAL NUEVO / EDITAR TALLER
// ----------------------------------------------------------------
async function abrirModalTaller(taller = null) {
    _tallerEditandoId = taller ? taller.id : null;
    _tallerFechaContador = 0;

    // Cargar profesionales y subservicios en paralelo
    const [resPro, resSub] = await Promise.all([
        api('/api/profesionales'),
        api('/api/subservicios'),
    ]);

    const optsPro = resPro.success
        ? resPro.data.map(p => `<option value="${p.id}">${escapeHtml(p.apellidos + ', ' + p.nombres)}</option>`).join('')
        : '';

    const optsSub = resSub.success
        ? resSub.data.map(s => `<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('')
        : '';

    document.getElementById('tiProfesionalId').innerHTML  = `<option value="">— Seleccione —</option>${optsPro}`;
    document.getElementById('tiSubservicioId').innerHTML  = `<option value="">— Seleccione —</option>${optsSub}`;

    // Pre-llenar si es edición
    document.getElementById('tiTema').value           = taller?.tema           ?? '';
    document.getElementById('tiInstitucion').value    = taller?.institucion     ?? '';
    document.getElementById('tiDescripcion').value    = taller?.descripcion     ?? '';
    document.getElementById('tiAsistentes').value     = taller?.total_asistentes ?? '';
    document.getElementById('tiPrecio').value         = taller?.precio_acordado ?? '0';
    document.getElementById('tiPorcentaje').value     = taller?.porcentaje_prof  ?? '0';
    document.getElementById('tiNotas').value          = taller?.notas           ?? '';

    if (taller?.profesional_id) document.getElementById('tiProfesionalId').value = taller.profesional_id;
    if (taller?.subservicio_id) document.getElementById('tiSubservicioId').value  = taller.subservicio_id;

    // Limpiar errores
    ['tiProfesionalId','tiSubservicioId','tiTema','tiPrecio'].forEach(id => {
        const el = document.getElementById(id + '-error');
        if (el) el.textContent = '';
    });

    // Sección fechas: solo visible en creación
    const secFechas = document.getElementById('tiSeccionFechas');
    const listaFechas = document.getElementById('tiListaFechas');
    if (taller) {
        secFechas.style.display = 'none';
    } else {
        secFechas.style.display = '';
        listaFechas.innerHTML   = '';
        _agregarFilaFecha(); // al menos una fecha
    }

    document.getElementById('modalTaller').querySelector('h3').textContent =
        taller ? 'Editar taller' : 'Nuevo taller';

    document.getElementById('modalTaller').classList.remove('hidden');
}

function _agregarFilaFecha() {
    _tallerFechaContador++;
    const idx = _tallerFechaContador;
    const fila = document.createElement('div');
    fila.id = `tiFilaFecha_${idx}`;
    fila.style.cssText = 'display:flex;gap:.5rem;align-items:flex-end;margin-bottom:.5rem';
    fila.innerHTML = `
        <div class="form-group" style="flex:1;margin:0">
            <label style="font-size:.82rem">Fecha y hora</label>
            <input type="datetime-local" id="tiFechaHora_${idx}" class="input">
        </div>
        <div class="form-group" style="width:110px;margin:0">
            <label style="font-size:.82rem">Duración (min)</label>
            <input type="number" id="tiDuracion_${idx}" class="input" value="90" min="15" max="480">
        </div>
        <button type="button" onclick="document.getElementById('tiFilaFecha_${idx}').remove()"
                style="background:none;border:none;cursor:pointer;color:var(--color-danger);font-size:1.3rem;line-height:1;padding-bottom:.3rem">&times;</button>`;
    document.getElementById('tiListaFechas').appendChild(fila);
}

async function guardarTaller() {
    const profId  = document.getElementById('tiProfesionalId').value;
    const subId   = document.getElementById('tiSubservicioId').value;
    const tema    = document.getElementById('tiTema').value.trim();
    const precio  = document.getElementById('tiPrecio').value;

    let valido = true;
    const errProf = document.getElementById('tiProfesionalId-error');
    const errSub  = document.getElementById('tiSubservicioId-error');
    const errTema = document.getElementById('tiTema-error');
    const errPrecio = document.getElementById('tiPrecio-error');

    if (!profId) { if(errProf) errProf.textContent = 'Requerido'; valido = false; } else { if(errProf) errProf.textContent = ''; }
    if (!subId)  { if(errSub)  errSub.textContent  = 'Requerido'; valido = false; } else { if(errSub)  errSub.textContent  = ''; }
    if (!tema)   { if(errTema) errTema.textContent  = 'Requerido'; valido = false; } else { if(errTema) errTema.textContent  = ''; }
    if (precio === '' || isNaN(parseFloat(precio))) { if(errPrecio) errPrecio.textContent = 'Requerido'; valido = false; } else { if(errPrecio) errPrecio.textContent = ''; }
    if (!valido) return;

    const body = {
        profesional_id:   parseInt(profId),
        subservicio_id:   parseInt(subId),
        tema,
        institucion:      document.getElementById('tiInstitucion').value.trim() || null,
        descripcion:      document.getElementById('tiDescripcion').value.trim() || null,
        total_asistentes: document.getElementById('tiAsistentes').value ? parseInt(document.getElementById('tiAsistentes').value) : null,
        precio_acordado:  parseFloat(precio),
        porcentaje_prof:  parseFloat(document.getElementById('tiPorcentaje').value) || 0,
        notas:            document.getElementById('tiNotas').value.trim() || null,
    };

    if (_tallerEditandoId) {
        // Edición
        body.id = _tallerEditandoId;
        const res = await api('/api/talleres', 'PUT', body);
        if (res.success) {
            cerrarModal('modalTaller');
            showToast('Taller actualizado');
            if (_talleresVista === 'detalle') {
                verDetalleTaller(_tallerEditandoId);
            } else {
                _cargarTalleres();
            }
        } else {
            showToast(res.message || 'Error al actualizar');
        }
        return;
    }

    // Creación — recolectar fechas
    const filas = document.getElementById('tiListaFechas').querySelectorAll('[id^=tiFilaFecha_]');
    if (!filas.length) { showToast('Agrega al menos una fecha'); return; }

    const fechas = [];
    for (const fila of filas) {
        const idx = fila.id.split('_')[1];
        const fh  = document.getElementById('tiFechaHora_' + idx)?.value;
        const dur = parseInt(document.getElementById('tiDuracion_' + idx)?.value) || 90;
        if (!fh) { showToast('Completa todas las fechas antes de guardar'); return; }
        fechas.push({ fecha_hora: fh.replace('T', ' ') + ':00', duracion_min: dur });
    }
    body.fechas = fechas;

    const res = await api('/api/talleres', 'POST', body);
    if (res.success) {
        cerrarModal('modalTaller');
        showToast('Taller creado correctamente');
        _cargarTalleres();
    } else {
        showToast(res.message || 'Error al crear taller');
    }
}

// ----------------------------------------------------------------
// MODAL AGREGAR FECHA A TALLER EXISTENTE
// ----------------------------------------------------------------
function abrirModalAgregarFecha(tallerId) {
    document.getElementById('tiNuevaFechaTallerId').value = tallerId;
    document.getElementById('tiNuevaFechaHora').value     = '';
    document.getElementById('tiNuevaFechaDur').value      = '90';
    document.getElementById('modalAgregarFechaTaller').classList.remove('hidden');
}

async function guardarNuevaFecha() {
    const tallerId = parseInt(document.getElementById('tiNuevaFechaTallerId').value);
    const fh       = document.getElementById('tiNuevaFechaHora').value;
    const dur      = parseInt(document.getElementById('tiNuevaFechaDur').value) || 90;

    if (!fh) { showToast('Ingresa la fecha y hora'); return; }

    const res = await api('/api/talleres/fecha', 'POST', {
        taller_id:    tallerId,
        fecha_hora:   fh.replace('T', ' ') + ':00',
        duracion_min: dur,
    });

    if (res.success) {
        cerrarModal('modalAgregarFechaTaller');
        showToast('Fecha agregada');
        verDetalleTaller(tallerId);
    } else {
        showToast(res.message || 'Error al agregar fecha');
    }
}

// ----------------------------------------------------------------
// MODAL MARCAR FECHA COMO REALIZADA
// ----------------------------------------------------------------
function abrirMarcarRealizada(fechaId, tallerId) {
    document.getElementById('tiRealizadaFechaId').value  = fechaId;
    document.getElementById('tiRealizadaTallerId').value = tallerId;
    document.getElementById('tiRealizadaAsistentes').value = '';
    document.getElementById('tiRealizadaNotas').value      = '';
    document.getElementById('modalMarcarRealizada').classList.remove('hidden');
}

async function guardarMarcarRealizada() {
    const fechaId  = parseInt(document.getElementById('tiRealizadaFechaId').value);
    const tallerId = parseInt(document.getElementById('tiRealizadaTallerId').value);
    const asist    = document.getElementById('tiRealizadaAsistentes').value;
    const notas    = document.getElementById('tiRealizadaNotas').value.trim();

    const body = {
        id:         fechaId,
        estado:     'realizada',
        asistentes: asist !== '' ? parseInt(asist) : null,
        notas:      notas || null,
    };

    const res = await api('/api/talleres/fecha', 'PUT', body);
    if (res.success) {
        cerrarModal('modalMarcarRealizada');
        showToast('Fecha marcada como realizada');
        verDetalleTaller(tallerId);
    } else {
        showToast(res.message || 'Error al actualizar');
    }
}

// ----------------------------------------------------------------
// ELIMINAR FECHA
// ----------------------------------------------------------------
async function eliminarFechaTaller(fechaId, tallerId) {
    if (!confirm('¿Eliminar esta fecha? Esta acción no se puede deshacer.')) return;
    const res = await api('/api/talleres/fecha?id=' + fechaId, 'DELETE');
    if (res.success) {
        showToast('Fecha eliminada');
        verDetalleTaller(tallerId);
    } else {
        showToast(res.message || 'No se pudo eliminar');
    }
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function formatFecha(dt) {
    if (!dt) return '—';
    const d = new Date(dt.replace(' ', 'T'));
    return d.toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' })
        + ' ' + d.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' });
}
