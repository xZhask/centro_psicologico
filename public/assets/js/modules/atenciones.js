
// ---- Helpers ----

function _vinculoNombresHtml(v) {
    if (!v.nombres_participantes) {
        return `<strong>${escapeHtml(v.nombre_grupo || '—')}</strong>`;
    }
    const todos    = v.nombres_participantes.split('||').map(n => n.trim()).filter(Boolean);
    const visibles = todos.slice(0, 2)
        .map(n => `<strong>${escapeHtml(n)}</strong>`)
        .join(' <span style="color:var(--color-border)">·</span> ');
    const resto = todos.length > 2
        ? ` <span style="color:var(--color-text-muted);font-size:.82rem">+${todos.length - 2} más</span>`
        : '';
    return visibles + resto;
}

function setAtError(fieldId, message) {
    const el    = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (el)    el.classList.toggle('is-invalid', !!message);
    if (errEl) errEl.textContent = message || '';
}

function clearAtErrors() {
    ['atPaciente','atProfesional','atSubservicio','atFechaInicio','atMotivoConsulta','atNumeroSesionesPlan']
        .forEach(id => setAtError(id, ''));
}

// Estado para navegación de retorno desde el detalle
let _atencionBack      = null;
let _currentAtencionId = null;
let _currentAtencion   = null;

// ---- Estado modal de sesión ----
let _sesionModo          = 'nueva';       // 'nueva' | 'editar-grupal'
let _sesionModalidad     = 'individual';
let _sesionVinculoId     = null;
let _sesionGrupalId      = null;
let _sesionParticipantes = [];
let _sesionVinculoNombre = '';

// ---- Estado búsqueda CIE-10 (detalle de atención existente) ----
let _cie10Timer   = null;
let _cie10Results = [];

// ---- Estado búsqueda CIE-10 (modal nueva atención) ----
let _atDxTimer   = null;
let _atDxResults = [];
let _atDxList    = [];  // [{ codigo, descripcion, jerarquia, nivel_certeza }]
let _atFechaNacimiento = '';  // fecha_nacimiento cacheada del paciente activo en el modal

// Estado para el filtro de tipo en el listado unificado
let _tipoAtencion = 'individual';

// Estado de filtros de búsqueda
let _filtroSearch        = '';
let _filtroDesde         = '';
let _filtroHasta         = '';
let _filtroProfesionalId = 0;
let _filtroEstado        = '';
let _filtroSearchTimer   = null;
let _filtroRangoOpen     = false;
let _isSavingAtencion    = false;

// Conteos por tab (recargados desde /api/atenciones/conteos)
let _conteos = { individual: 0, pareja: 0, familiar: 0, grupal: 0 };

// Paginación (frontend-only)
const AT_PER_PAGE = 15;
let _atPage    = 1;
let _atAllData = [];

// Cache de profesionales para dropdown de filtro
let _listaProfesionales = null;


// Mapa temporal nota actual por sesión (evita problemas de escaping en onclick)
const _sesionNotasMap = {};
const _sgNotasMap     = {};

// ---- Adjuntos de sesión ----

let _adjPendientes = []; // [{ file: File, uid: string, nombre: string }]

function _adjPdfThumb() {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
                stroke-linecap="round" stroke-linejoin="round" style="color:#E74C3C">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>
            </svg>`;
}

function _adjFormatBytes(bytes) {
    if (bytes < 1024)             return bytes + ' B';
    if (bytes < 1024 * 1024)      return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function _adjRenderPendientes(containerId) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    // Revocar object URLs anteriores para evitar memory leaks
    cont.querySelectorAll('img[data-obj-url]').forEach(img => URL.revokeObjectURL(img.src));
    cont.innerHTML = '';
    _adjPendientes.forEach(({ file, uid, nombre }) => {
        const esImagen = file.type.startsWith('image/');
        const thumbHtml = esImagen
            ? `<img src="${URL.createObjectURL(file)}" data-obj-url="1" alt="">`
            : _adjPdfThumb();

        const chip = document.createElement('div');
        chip.className   = 'adjunto-chip';
        chip.dataset.uid = uid;
        chip.innerHTML   = `
            <div class="adjunto-chip-thumb">${thumbHtml}</div>
            <div class="adjunto-chip-info">
                <span class="adjunto-chip-original" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                <input class="adjunto-chip-nombre-input" type="text"
                       placeholder="Nombre del archivo…"
                       value="${escapeHtml(nombre)}"
                       data-uid="${uid}">
            </div>
            <div class="adjunto-chip-right">
                <span class="adjunto-chip-size">${_adjFormatBytes(file.size)}</span>
                <button class="adjunto-chip-btn" onclick="_adjQuitarPendiente('${uid}','${containerId}')" title="Quitar">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                         stroke-width="2.2" stroke-linecap="round">
                        <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
                    </svg>
                </button>
            </div>`;
        cont.appendChild(chip);

        // Actualizar nombre en el array al escribir
        chip.querySelector('.adjunto-chip-nombre-input').addEventListener('input', e => {
            const item = _adjPendientes.find(a => a.uid === uid);
            if (item) item.nombre = e.target.value;
        });
    });
}

function _adjQuitarPendiente(uid, containerId) {
    _adjPendientes = _adjPendientes.filter(a => a.uid !== uid);
    _adjRenderPendientes(containerId);
}

function _adjAgregarArchivos(files, pendientesId) {
    const MAX       = 5;
    const MAX_BYTES = 10 * 1024 * 1024;
    const TIPOS     = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

    Array.from(files).forEach(file => {
        if (_adjPendientes.length >= MAX)          { showToast('Máximo 5 archivos por sesión'); return; }
        if (!TIPOS.includes(file.type))             { showToast(`Tipo no permitido: ${file.name}`); return; }
        if (file.size > MAX_BYTES)                  { showToast(`${file.name} supera 10 MB`); return; }
        const uid    = Math.random().toString(36).slice(2) + Date.now();
        const nombre = file.name.replace(/\.[^/.]+$/, ''); // nombre sin extensión como sugerencia
        _adjPendientes.push({ file, uid, nombre });
    });
    _adjRenderPendientes(pendientesId);
}

function _adjIniciarDropZone(dropId, inputId, pendientesId) {
    const drop  = document.getElementById(dropId);
    const input = document.getElementById(inputId);
    if (!drop || !input) return;

    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
        _adjAgregarArchivos(input.files, pendientesId);
        input.value = '';
    });
    drop.addEventListener('dragover',  e => { e.preventDefault(); drop.classList.add('drag-over'); });
    drop.addEventListener('dragleave', ()  => drop.classList.remove('drag-over'));
    drop.addEventListener('drop', e => {
        e.preventDefault();
        drop.classList.remove('drag-over');
        _adjAgregarArchivos(e.dataTransfer.files, pendientesId);
    });
}

async function _adjSubirPendientes(sesionId, sesionGrupoId) {
    for (const { file, nombre } of _adjPendientes) {
        const fd = new FormData();
        fd.append('archivo', file);
        if (sesionId)      fd.append('sesion_id',       sesionId);
        if (sesionGrupoId) fd.append('sesion_grupo_id', sesionGrupoId);
        if (nombre && nombre.trim()) fd.append('nombre_display', nombre.trim());
        await apiUpload('/api/sesiones/archivos', fd);
    }
    _adjPendientes = [];
}

function _adjHtmlDropZone(dropId, inputId, pendientesId, existingId = null) {
    const existingSlot = existingId ? `<div id="${existingId}"></div>` : '';
    return `
    <div class="adjuntos-wrap">
        <div class="adjuntos-label">
            Archivos adjuntos
            <span class="adjuntos-hint">PDF, JPG, PNG o WEBP · Máx. 10 MB · Máx. 5 archivos</span>
        </div>
        ${existingSlot}
        <div id="${dropId}" class="adjuntos-drop">
            <input type="file" id="${inputId}" multiple
                   accept=".pdf,.jpg,.jpeg,.png,.webp" style="display:none">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span>Arrastra archivos aquí o <u>selecciona</u></span>
        </div>
        <div id="${pendientesId}"></div>
    </div>`;
}

async function _adjCargarExistentes(sesionId, sesionGrupoId, containerId) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    const qs = sesionId ? `sesion_id=${sesionId}` : `sesion_grupo_id=${sesionGrupoId}`;
    const res = await api(`/api/sesiones/archivos?${qs}`);
    if (!res.success || !res.data || !res.data.length) { cont.innerHTML = ''; return; }

    cont.innerHTML = res.data.map(a => {
        const esImagen  = a.tipo_mime.startsWith('image/');
        const thumbHtml = esImagen
            ? `<img src="/api/archivos/descargar?id=${a.id}&preview=1" alt="">`
            : _adjPdfThumb();
        const nombreMostrado = escapeHtml(a.nombre_display || a.nombre_original);
        const nombreDescarga = escapeHtml(a.nombre_display || a.nombre_original);
        return `
        <div class="adjunto-chip" id="adjChip_${a.id}">
            <div class="adjunto-chip-thumb">${thumbHtml}</div>
            <div class="adjunto-chip-info">
                <span class="adjunto-chip-original" title="${escapeHtml(a.nombre_original)}">${escapeHtml(a.nombre_original)}</span>
                <span class="adjunto-chip-nombre-input" style="padding:3px 0;font-weight:500">${nombreMostrado}</span>
            </div>
            <div class="adjunto-chip-right">
                <span class="adjunto-chip-size">${_adjFormatBytes(parseInt(a.tamano_bytes))}</span>
                <a href="/api/archivos/descargar?id=${a.id}" download="${nombreDescarga}"
                   class="adjunto-chip-btn" title="Descargar">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                         stroke-width="2" stroke-linecap="round">
                        <path d="M8 2v8m0 0l-3-3m3 3l3-3"/><path d="M3 13h10"/>
                    </svg>
                </a>
                <button class="adjunto-chip-btn" title="Eliminar"
                        onclick="_adjEliminarExistente(${a.id},'${containerId}',${sesionId || 'null'},${sesionGrupoId || 'null'})">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                         stroke-width="2.2" stroke-linecap="round">
                        <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
                    </svg>
                </button>
            </div>
        </div>`;
    }).join('');
}

async function _adjEliminarExistente(archivoId, containerId, sesionId, sesionGrupoId) {
    if (!confirm('¿Eliminar este archivo adjunto?')) return;
    const res = await api('/api/sesiones/archivos', 'DELETE', { id: archivoId });
    if (res.success) {
        await _adjCargarExistentes(sesionId, sesionGrupoId, containerId);
    } else {
        showToast(res.message || 'Error al eliminar');
    }
}

// ---- Constantes compartidas con tareas.js ----

const TAREA_ESTADO_LABEL = {
    pendiente:    'Pendiente',
    en_proceso:   'En proceso',
    completada:   'Completada',
    no_realizada: 'No realizada',
};

// ---- Etiquetas legibles ----

const GRADO_LABEL = {
    sin_instruccion:       'Sin instrucción',
    primaria_incompleta:   'Primaria incompleta',
    primaria_completa:     'Primaria completa',
    secundaria_incompleta: 'Secundaria incompleta',
    secundaria_completa:   'Secundaria completa',
    tecnico_incompleto:    'Técnico incompleto',
    tecnico_completo:      'Técnico completo',
    superior_incompleto:   'Superior incompleto',
    superior_completo:     'Superior completo',
    posgrado:              'Posgrado',
    no_especificado:       'No especificado',
};

const CIVIL_LABEL = {
    soltero:        'Soltero/a',
    casado:         'Casado/a',
    conviviente:    'Conviviente',
    divorciado:     'Divorciado/a',
    separado:       'Separado/a',
    viudo:          'Viudo/a',
    no_especificado:'No especificado',
};

const ESTADO_AT_BADGE = {
    activa:     'badge-confirmada',
    pausada:    'badge-warning',
    completada: 'badge-success',
    cancelada:  'badge-danger',
};

// ---- Helpers de avatar ----

function _getInitials(nombre) {
    const parts = (nombre || '').trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function _avatarColor(seed) {
    let h = 0;
    const s = String(seed ?? '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xFFFF;
    return `hsl(${h % 360}, 48%, 40%)`;
}

// ---- Helpers de filtros ----

function _buildFiltroParams() {
    const qp = new URLSearchParams();
    if (_filtroSearch)        qp.set('search',        _filtroSearch);
    if (_filtroDesde)         qp.set('desde',          _filtroDesde);
    if (_filtroHasta)         qp.set('hasta',          _filtroHasta);
    if (_filtroProfesionalId) qp.set('profesional_id', _filtroProfesionalId);
    if (_filtroEstado)        qp.set('estado',         _filtroEstado);
    return qp;
}

async function _cargarConteos() {
    const res = await api('/api/atenciones/conteos?' + _buildFiltroParams().toString());
    if (res.success) {
        _conteos = res.data;
        _actualizarTabsAtencion();
    }
}

// ---- Paginación ----

function _renderAtPagination(total, pagina, perPage) {
    const inicio = total === 0 ? 0 : (pagina - 1) * perPage + 1;
    const fin    = Math.min(pagina * perPage, total);
    const prevDis = pagina <= 1 ? 'disabled' : '';
    const nextDis = fin >= total ? 'disabled' : '';
    return `
        <div class="at-pagination">
            <span>Mostrando ${inicio}–${fin} de ${total} ${_tipoAtencion === 'individual' ? 'atenciones' : 'procesos'}</span>
            <div class="at-pagination-btns">
                <button class="at-page-btn" onclick="_atPrevPage()" ${prevDis} aria-label="Anterior">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="10 4 6 8 10 12"/></svg>
                </button>
                <button class="at-page-btn" onclick="_atNextPage()" ${nextDis} aria-label="Siguiente">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 4 10 8 6 12"/></svg>
                </button>
            </div>
        </div>`;
}

function _atPrevPage() {
    if (_atPage <= 1) return;
    _atPage--;
    _renderPaginaActual();
}

function _atNextPage() {
    if (_atPage * AT_PER_PAGE >= _atAllData.length) return;
    _atPage++;
    _renderPaginaActual();
}

function _renderPaginaActual() {
    if (_tipoAtencion === 'individual') _renderIndividualRows();
    else _renderVinculoRows(_tipoAtencion);
}

// ---- Dropdowns de filtro ----

function _atToggleProfesionalDropdown() {
    const menu = document.getElementById('atProfDropMenu');
    if (!menu) return;
    menu.classList.toggle('open');
}

function _atToggleEstadoDropdown() {
    const menu = document.getElementById('atEstadoDropMenu');
    if (!menu) return;
    menu.classList.toggle('open');
}

function _atSelectProfesional(id, nombre) {
    _filtroProfesionalId = id;
    _atPage = 1;
    const btn = document.getElementById('btnAtProfesional');
    if (btn) btn.querySelector('span').textContent = nombre || 'Profesional';
    if (btn) btn.classList.toggle('active', !!id);
    document.getElementById('atProfDropMenu')?.classList.remove('open');
    _recargarListaActual();
    _cargarConteos();
}

function _atSelectEstado(val, label) {
    _filtroEstado = val;
    _atPage = 1;
    const btn = document.getElementById('btnAtEstado');
    if (btn) btn.querySelector('span').textContent = label || 'Estado';
    if (btn) btn.classList.toggle('active', !!val);
    document.getElementById('atEstadoDropMenu')?.classList.remove('open');
    _recargarListaActual();
    _cargarConteos();
}

async function _renderProfesionalDropdown() {
    if (!_listaProfesionales) {
        const res = await api('/api/profesionales');
        _listaProfesionales = res.data || [];
    }
    const menu = document.getElementById('atProfDropMenu');
    if (!menu) return;
    const items = [{ id: 0, nombre: 'Todos los profesionales' }, ..._listaProfesionales.map(p => ({ id: p.id, nombre: `${p.nombres || ''} ${p.apellidos || ''}`.trim() }))];
    menu.innerHTML = items.map(p => `
        <div class="at-filter-dropdown-item${_filtroProfesionalId === p.id ? ' selected' : ''}"
             onclick="_atSelectProfesional(${p.id}, '${escapeHtml(p.nombre)}')">
            ${escapeHtml(p.nombre)}
        </div>`).join('');
}

// ---- Vista principal unificada ----

async function atenciones() {
    const rangoLabel    = _filtroDesde && _filtroHasta
        ? `${_fmtDDMMYYYY(_filtroDesde)} → ${_fmtDDMMYYYY(_filtroHasta)}`
        : 'Rango de fechas';
    const rangoOpenCls  = _filtroRangoOpen ? '' : ' hidden';
    const userRol       = getUser()?.rol || '';

    const profBtnLabel  = _filtroProfesionalId ? 'Profesional ✓' : 'Profesional';
    const estadoBtnLabel = _filtroEstado
        ? ({ activa:'Activa', completada:'Finalizada', cancelada:'Cancelada' }[_filtroEstado] || 'Estado')
        : 'Estado';

    const svgUser = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>`;
    const svgFilter = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><line x1="8" y1="5" x2="8" y2="8"/><circle cx="8" cy="11" r=".5" fill="currentColor"/></svg>`;
    const svgCal = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="1"/><line x1="5" y1="1" x2="5" y2="3"/><line x1="11" y1="1" x2="11" y2="3"/><line x1="2" y1="6" x2="14" y2="6"/></svg>`;
    const svgLupa = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="6.5" r="4.5"/><line x1="10" y1="10" x2="14" y2="14"/></svg>`;

    document.getElementById('view').innerHTML = `
        <h2 style="margin-bottom:14px">Atenciones</h2>

        <div class="citas-toolbar" style="margin-bottom:16px;flex-wrap:wrap;gap:8px">
            <!-- Tabs -->
            <div style="display:flex;gap:2px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius);padding:3px;">
                <button data-at-tab="individual" onclick="_switchTipoAtencion('individual')">Individual<span class="at-tab-count" id="cnt-individual">${_conteos.individual}</span></button>
                <button data-at-tab="pareja"     onclick="_switchTipoAtencion('pareja')">Pareja<span class="at-tab-count" id="cnt-pareja">${_conteos.pareja}</span></button>
                <button data-at-tab="familiar"   onclick="_switchTipoAtencion('familiar')">Familiar<span class="at-tab-count" id="cnt-familiar">${_conteos.familiar}</span></button>
                <button data-at-tab="grupal"     onclick="_switchTipoAtencion('grupal')">Grupal<span class="at-tab-count" id="cnt-grupal">${_conteos.grupal}</span></button>
            </div>

            <!-- Buscador -->
            <div class="citas-search-wrap" style="flex:1;min-width:180px">
                ${svgLupa}
                <input class="citas-search" id="atFiltroSearch" type="text"
                       placeholder="Buscar por nombre o DNI…"
                       value="${escapeHtml(_filtroSearch)}"
                       oninput="_onFiltroSearchInput(this.value)">
            </div>

            <!-- Filtro Profesional (solo admin) -->
            ${userRol !== 'profesional' ? `
            <div class="at-filter-dropdown">
                <button class="citas-btn-toolbar${_filtroProfesionalId ? ' active' : ''}" id="btnAtProfesional"
                        onclick="_atToggleProfesionalDropdown();_renderProfesionalDropdown()">
                    ${svgUser} <span>${escapeHtml(profBtnLabel)}</span>
                </button>
                <div class="at-filter-dropdown-menu" id="atProfDropMenu">
                    <div class="at-filter-dropdown-item" style="color:var(--color-text-muted);font-size:12px;cursor:default">Cargando…</div>
                </div>
            </div>` : ''}

            <!-- Filtro Estado -->
            <div class="at-filter-dropdown">
                <button class="citas-btn-toolbar${_filtroEstado ? ' active' : ''}" id="btnAtEstado"
                        onclick="_atToggleEstadoDropdown()">
                    ${svgFilter} <span>${escapeHtml(estadoBtnLabel)}</span>
                </button>
                <div class="at-filter-dropdown-menu" id="atEstadoDropMenu">
                    <div class="at-filter-dropdown-item${_filtroEstado==='' ? ' selected':''}"  onclick="_atSelectEstado('','Estado')">Todos</div>
                    <div class="at-filter-dropdown-item${_filtroEstado==='activa' ? ' selected':''}" onclick="_atSelectEstado('activa','Activa')">Activa</div>
                    <div class="at-filter-dropdown-item${_filtroEstado==='completada' ? ' selected':''}" onclick="_atSelectEstado('completada','Finalizada')">Finalizada</div>
                    <div class="at-filter-dropdown-item${_filtroEstado==='cancelada' ? ' selected':''}" onclick="_atSelectEstado('cancelada','Cancelada')">Cancelada</div>
                </div>
            </div>

            <!-- Filtro Rango de fechas -->
            <div class="citas-rango-wrap">
                <button class="citas-btn-toolbar${_filtroRangoOpen ? ' active' : ''}" id="btnRangoAt" onclick="_atToggleRangoPopover()">
                    ${svgCal} ${rangoLabel}
                </button>
                <div class="citas-rango-popover${rangoOpenCls}" id="atRangoPopover">
                    <div class="crp-header">${svgCal} <span>Filtrar por fecha</span></div>
                    <div class="crp-fields">
                        <div class="crp-field">
                            <label for="atRangoDesde">Desde</label>
                            <input type="date" id="atRangoDesde" value="${_filtroDesde || _hoyISO()}">
                        </div>
                        <div class="crp-separator">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="4" y1="8" x2="12" y2="8"/><polyline points="9 5 12 8 9 11"/></svg>
                        </div>
                        <div class="crp-field">
                            <label for="atRangoHasta">Hasta</label>
                            <input type="date" id="atRangoHasta" value="${_filtroHasta || _hoyISO()}">
                        </div>
                    </div>
                    <div class="crp-actions">
                        <button class="crp-btn-cancel" onclick="_atCerrarRangoPopover()">Cancelar</button>
                        <button class="crp-btn-apply" onclick="_atAplicarRangoFechas()">Aplicar</button>
                    </div>
                </div>
            </div>
        </div>

        <div id="atenciones-lista"></div>
    `;

    _actualizarTabsAtencion();

    // Cerrar dropdowns al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.at-filter-dropdown')) {
            document.querySelectorAll('.at-filter-dropdown-menu').forEach(m => m.classList.remove('open'));
        }
        if (!e.target.closest('.citas-rango-wrap')) _atCerrarRangoPopover();
    }, { once: true });

    _cargarConteos();

    if (_tipoAtencion === 'individual') await _cargarListaIndividual();
    else await _cargarListaVinculos(_tipoAtencion);
}


function _actualizarTabsAtencion() {
    document.querySelectorAll('[data-at-tab]').forEach(btn => {
        const activo = btn.dataset.atTab === _tipoAtencion;
        btn.classList.toggle('at-tab-active', activo);
        btn.style.cssText = activo
            ? 'background:var(--color-primary);color:#fff;border:none;border-radius:5px;padding:5px 14px;cursor:pointer;font-size:.875rem;font-weight:500;transition:var(--transition)'
            : 'background:transparent;color:var(--color-text-muted);border:none;border-radius:5px;padding:5px 14px;cursor:pointer;font-size:.875rem;transition:var(--transition)';
        // Actualizar contadores
        const cntEl = document.getElementById(`cnt-${btn.dataset.atTab}`);
        if (cntEl) cntEl.textContent = _conteos[btn.dataset.atTab] ?? 0;
    });
}

async function _switchTipoAtencion(tipo) {
    _tipoAtencion = tipo;
    _atPage = 1;
    _actualizarTabsAtencion();
    if (tipo === 'individual') await _cargarListaIndividual();
    else await _cargarListaVinculos(tipo);
}

function _onFiltroSearchInput(val) {
    _filtroSearch = val;
    _atPage = 1;
    clearTimeout(_filtroSearchTimer);
    _filtroSearchTimer = setTimeout(() => {
        _recargarListaActual();
        _cargarConteos();
    }, 350);
}

function _onFiltroFechaChange() {
    _filtroDesde = document.getElementById('atFiltroDesde')?.value || '';
    _filtroHasta = document.getElementById('atFiltroHasta')?.value || '';
    _atPage = 1;
    _recargarListaActual();
}

function _recargarListaActual() {
    if (_tipoAtencion === 'individual') _cargarListaIndividual();
    else _cargarListaVinculos(_tipoAtencion);
}

// ---- Badge helpers ----

function _atBadgeEstadoIndividual(estado) {
    const map = {
        activa:     `<span class="badge-at-activa">Activa</span>`,
        completada: `<span class="badge-at-finalizada">Finalizada</span>`,
        cancelada:  `<span class="badge-at-cancelada">Cancelada</span>`,
        pausada:    `<span class="badge badge-warning">Pausada</span>`,
    };
    return map[estado] || `<span class="badge">${escapeHtml(estado)}</span>`;
}

function _atBadgeEstadoVinculo(estado) {
    const map = {
        activo:     `<span class="badge-at-activa">Activa</span>`,
        completado: `<span class="badge-at-finalizada">Finalizada</span>`,
        cancelado:  `<span class="badge-at-cancelada">Cancelada</span>`,
    };
    return map[estado] || `<span class="badge">${escapeHtml(estado)}</span>`;
}

// ---- SVG íconos inline reutilizables ----

const _svgOjo = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/></svg>`;
const _svgCheck = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 8 6 12 14 4"/></svg>`;
const _svgKebab = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="8" cy="13" r="1.2"/></svg>`;

// ---- Render de tabla Individual ----

function _renderIndividualRows() {
    const lista = document.getElementById('atenciones-lista');
    if (!lista) return;

    const total = _atAllData.length;
    const pagina = _atPage;
    const slice  = _atAllData.slice((pagina - 1) * AT_PER_PAGE, pagina * AT_PER_PAGE);

    let rows = '';
    if (slice.length > 0) {
        slice.forEach(a => {
            const initials = _getInitials(a.paciente);
            const bgColor  = _avatarColor(a.paciente_id || a.paciente);
            const fechaFmt = a.fecha_inicio ? _fmtDDMMYYYY(a.fecha_inicio) : '—';
            const sesiones = `<span class="at-sesion">${a.sesiones_realizadas ?? 0}<span class="at-sesion-total"> / ${a.numero_sesiones_plan || '—'}</span></span>`;
            const finBtn   = a.estado === 'activa'
                ? `<button class="at-btn-action danger" title="Finalizar atención" aria-label="Finalizar atención" onclick="_confirmarFinalizarAtencion(${a.id})">${_svgCheck}</button>`
                : '';
            rows += `<tr>
                <td>
                    <div class="at-cell-paciente">
                        <span class="at-avatar" style="background:${bgColor}">${escapeHtml(initials)}</span>
                        <div class="at-cell-paciente-info">
                            <span class="at-cell-paciente-name">${escapeHtml(a.paciente)}</span>
                            <span class="at-cell-paciente-sub">DNI ${escapeHtml(a.paciente_dni || '—')}</span>
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(a.profesional)}</td>
                <td>
                    <div class="at-cell-servicio-main">${escapeHtml(a.subservicio)}</div>
                    <div class="at-cell-servicio-sub">${escapeHtml(a.servicio)}</div>
                </td>
                <td>${fechaFmt}</td>
                <td>${sesiones}</td>
                <td>${_atBadgeEstadoIndividual(a.estado)}</td>
                <td style="white-space:nowrap">
                    <div style="display:flex;gap:4px;align-items:center;height:100%">
                        <button class="at-btn-action" title="Ver detalle" aria-label="Ver detalle" onclick="verDetalleAtencion(${a.id})">${_svgOjo}</button>
                        ${finBtn}
                        <button class="at-btn-action" title="Más opciones" aria-label="Más opciones">${_svgKebab}</button>
                    </div>
                </td>
            </tr>`;
        });
    } else {
        rows = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:32px">No hay atenciones individuales registradas</td></tr>';
    }

    lista.innerHTML = `
        <div class="table-responsive">
            <table class="table at-table">
                <thead><tr>
                    <th>Paciente</th>
                    <th>Profesional</th>
                    <th>Servicio</th>
                    <th>Fecha</th>
                    <th>Sesión</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        ${_renderAtPagination(total, pagina, AT_PER_PAGE)}`;
}

async function _cargarListaIndividual() {
    const lista = document.getElementById('atenciones-lista');
    if (lista) lista.innerHTML = '<p style="color:var(--color-text-muted);padding:8px">Cargando...</p>';

    const res = await api('/api/atenciones?' + _buildFiltroParams().toString());
    _atAllData = (res.data || []);
    _renderIndividualRows();
}

// ---- Render de tabla Vínculos ----

function _renderVinculoRows(tipo) {
    const lista = document.getElementById('atenciones-lista');
    if (!lista) return;

    const total = _atAllData.length;
    const pagina = _atPage;
    const slice  = _atAllData.slice((pagina - 1) * AT_PER_PAGE, pagina * AT_PER_PAGE);

    let rows = '';
    if (slice.length > 0) {
        slice.forEach(v => {
            const nombres = v.nombres_participantes
                ? v.nombres_participantes.split('||').map(n => n.trim()).filter(Boolean)
                : [v.nombre_grupo || '—'];
            const integrantesHtml = nombres.map(n => `
                <div class="at-cell-integrante">
                    <span class="at-avatar-sm" style="background:${_avatarColor(n)}">${escapeHtml(_getInitials(n))}</span>
                    <span class="at-cell-paciente-name">${escapeHtml(n)}</span>
                </div>`).join('');
            const fechaFmt = v.fecha_inicio ? _fmtDDMMYYYY(v.fecha_inicio) : '—';
            rows += `<tr>
                <td>${integrantesHtml}</td>
                <td>${escapeHtml(v.profesional)}</td>
                <td>${fechaFmt}</td>
                <td>${_atBadgeEstadoVinculo(v.estado)}</td>
                <td style="white-space:nowrap">
                    <div style="display:flex;gap:4px;align-items:center;height:100%">
                        <button class="at-btn-action" title="Ver detalle" aria-label="Ver detalle"
                                onclick="verDetalleVinculo(${v.id}, function(){ _tipoAtencion='${tipo}'; atenciones(); })">${_svgOjo}</button>
                        <button class="at-btn-action" title="Más opciones" aria-label="Más opciones">${_svgKebab}</button>
                    </div>
                </td>
            </tr>`;
        });
    } else {
        rows = `<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:32px">No hay vínculos de tipo <strong>${escapeHtml(tipo)}</strong> registrados</td></tr>`;
    }

    lista.innerHTML = `
        <div class="table-responsive">
            <table class="table at-table">
                <thead><tr>
                    <th>Integrantes</th>
                    <th>Profesional</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        ${_renderAtPagination(total, pagina, AT_PER_PAGE)}`;
}

async function _cargarListaVinculos(tipo) {
    const lista = document.getElementById('atenciones-lista');
    if (lista) lista.innerHTML = '<p style="color:var(--color-text-muted);padding:8px">Cargando...</p>';

    const qp = _buildFiltroParams();
    qp.set('tipo', tipo);
    const res = await api('/api/vinculos?' + qp.toString());
    _atAllData = (res.data || []);
    _renderVinculoRows(tipo);
}

// ---- Acción Finalizar con confirmación ----

function _confirmarFinalizarAtencion(id) {
    if (!confirm('¿Finalizar esta atención? Esta acción no se puede deshacer.')) return;
    cerrarAtencion(id);
}

function _nuevoVinculoDesdeAtenciones() {
    const tipo = _tipoAtencion;
    _vinculoPostSave = () => { _tipoAtencion = tipo; atenciones(); };
    abrirModalNuevoVinculo();
}

// ---- Detalle de atención (REDISEÑO) ----

async function verDetalleAtencion(id, backFn) {
    _atencionBack      = backFn || (() => atenciones());
    _currentAtencionId = id;

    const res = await api('/api/atencion?id=' + id);
    if (!res.success) { showToast(res.message || 'Error al cargar atención'); return; }
    const a = res.data;

    // Guardar estados globales para modales
    window._atPaqueteActivo   = a.finanzas?.paquete || null;
    window._atPacienteId      = a.paciente_id;
    window._atProfesionalId   = a.profesional_id;
    window._atencionSesiones  = a.sesiones || [];
    _currentAtencion          = a;

    // Limpiar mapas de notas
    Object.keys(_sesionNotasMap).forEach(k => delete _sesionNotasMap[k]);
    Object.keys(_sgNotasMap).forEach(k => delete _sgNotasMap[k]);
    if (a.sesiones_grupo) a.sesiones_grupo.forEach(sg => { _sgNotasMap[sg.id] = sg; });
    if (a.sesiones) a.sesiones.forEach(s => { _sesionNotasMap[s.id] = s.nota_clinica || ''; });

    const view = document.getElementById('view');
    view.innerHTML = `
        ${_renderBreadcrumb(a)}
        ${_renderPatientBanner(a)}
        ${_renderProgressSummary(a)}
        ${_renderGroupMembersPanel(a)}

        <div style="display:grid;grid-template-columns: 1fr 340px; gap: 24px; align-items: start;">
            <div class="at-main-column">
                ${_renderSparklinesSection(a)}
                ${_renderSessionsTimeline(a)}
                ${_renderTasksSection(a)}
                ${_renderDiagnosesSection(a)}
                ${_renderClinicalContext(a)}
                ${_renderRecommendationsSection(a)}
            </div>
            <div class="at-side-column">
                <div class="card" style="padding:16px; position: sticky; top: 10px;">
                    <h4 style="margin:0 0 12px; font-size:.8rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.05em">Acciones</h4>
                    <div style="display:flex; flex-direction:column; gap:8px">
                        <button class="btn-primary" style="width:100%; justify-content:center; display:flex; align-items:center; gap:8px"
                                onclick="abrirModalTareaDesdeAtencion()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Nueva tarea
                        </button>
                        <button class="btn-sm" style="width:100%" onclick="abrirModalEditarAtencion()">
                            Editar atención
                        </button>
                        ${a.estado === 'activa' ? `
                        <button class="btn-sm" style="width:100%; color:var(--color-warning); border-color:var(--color-warning)"
                                onclick="pausarAtencion(${a.id})">
                            Pausar atención
                        </button>
                        <button class="btn-sm" style="width:100%; color:var(--color-danger); border-color:var(--color-danger)"
                                onclick="cerrarAtencion(${a.id})">
                            Cerrar atención
                        </button>` : ''}
                        ${a.estado === 'pausada' ? `
                        <button class="btn-sm" style="width:100%; color:var(--color-success); border-color:var(--color-success)"
                                onclick="reactivarAtencion(${a.id})">
                            Reactivar atención
                        </button>` : ''}
                        ${!window._atPaqueteActivo ? `
                        <button class="btn-sm" style="width:100%" onclick="abrirModalContratarPaquete()">
                            Asignar paquete
                        </button>` : ''}
                        
                        <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--color-border)">
                            <label style="display:flex; align-items:center; gap:8px; font-size:0.8rem; cursor:pointer">
                                <input type="checkbox" id="toggleFinanzas" onchange="_toggleFinanzasAdmin(this.checked)">
                                Ver información financiera
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Inicializar estado de finanzas
    _toggleFinanzasAdmin(document.getElementById('toggleFinanzas')?.checked);
    _cargarAdjuntosSesionesTimeline(_currentAtencion);
}

function _renderBreadcrumb(a) {
    return `
        <div class="at-breadcrumb">
            <a href="#" onclick="atenciones(); return false;">Atenciones</a> 
            <span style="margin:0 4px">›</span> 
            <span style="color:var(--color-text)">${escapeHtml(a.paciente)}</span>
            <span style="margin:0 4px">›</span> 
            <span style="color:var(--color-text-muted)">Atención #${a.id}</span>
        </div>
    `;
}

function _renderPatientBanner(a) {
    const age = _calcEdad(a.fecha_nacimiento, _hoyISO());
    const sexLabel = a.sexo === 'masculino' ? 'M' : a.sexo === 'femenino' ? 'F' : '?';
    const badgeClass = ESTADO_AT_BADGE[a.estado] || '';
    
    // Lógica de Badge Financiero
    let finBadge = '';
    const f = a.finanzas;
    if (f?.paquete) {
        finBadge = `<span class="badge" style="background:#3498DB; color:#fff; cursor:pointer" title="Ver detalle" onclick="_verDetallePaquete()">📦 Paquete: ${f.paquete.sesiones_restantes}/${f.paquete.sesiones_incluidas}</span>`;
    } else if (f?.adelanto?.saldo_disponible > 0) {
        finBadge = `<span class="badge" style="background:var(--color-success); color:#fff">💰 Adelanto: S/ ${parseFloat(f.adelanto.saldo_disponible).toFixed(2)}</span>`;
    } else if (f?.pendiente?.total_pendiente > 0) {
        finBadge = `<span class="badge" style="background:var(--color-warning); color:#fff">⚠ Pendiente: S/ ${parseFloat(f.pendiente.total_pendiente).toFixed(2)}</span>`;
    } else if (a.sesiones.length > 0 || (a.sesiones_grupo?.length || 0) > 0) {
        finBadge = `<span class="badge" style="background:var(--color-text-muted); color:#fff">✓ Al día</span>`;
    }

    const diasTranscurridos = Math.floor((new Date() - new Date(a.fecha_inicio)) / (1000 * 60 * 60 * 24)) + 1;

    return `
        <div class="patient-banner">
            <div class="pb-info">
                <h1 class="pb-name">${escapeHtml(a.paciente)}</h1>
                <div class="pb-meta">
                    <span style="font-weight:600">${age ? age + ' años' : 'Edad desconocida'} · ${sexLabel}</span>
                    <span style="color:var(--color-border); margin:0 4px">|</span>
                    <span>DNI: ${a.paciente_dni || '—'}</span>
                    <span class="badge ${badgeClass}" style="margin-left:8px">${a.estado.toUpperCase()}</span>
                    ${['pareja','familiar','grupal'].includes((a.subservicio_modalidad||'').toLowerCase())
                        ? `<span class="badge" style="margin-left:6px;background:${{pareja:'#3498DB',familiar:'#27AE60',grupal:'#8E44AD'}[a.subservicio_modalidad.toLowerCase()]};color:#fff;font-size:.72rem">${{pareja:'Pareja',familiar:'Familiar',grupal:'Grupal'}[a.subservicio_modalidad.toLowerCase()]}</span>`
                        : ''}
                </div>
            </div>
            <div class="pb-right">
                ${finBadge}
                <div style="text-align:right; font-size:0.8rem">
                    <div style="font-weight:600; color:var(--color-primary)">${escapeHtml(a.profesional)}</div>
                    <div style="color:var(--color-text-muted)">${escapeHtml(a.subservicio)}</div>
                    <div style="color:var(--color-text-muted); font-size:0.75rem">Inicio: ${_fmtDDMMYYYY(a.fecha_inicio)} · día ${diasTranscurridos}</div>
                </div>
            </div>
            <div class="pb-secondary-data">
                Grado instrucción: ${GRADO_LABEL[a.grado_instruccion] || '—'} · 
                Ocupación: ${a.ocupacion || '—'} · 
                Estado civil: ${CIVIL_LABEL[a.estado_civil] || '—'}
            </div>
        </div>
    `;
}

function _renderProgressSummary(a) {
    const esGrupal = ['pareja', 'familiar', 'grupal'].includes((a.subservicio_modalidad || '').toLowerCase());
    const realizadas   = esGrupal ? (a.sesiones_grupo?.length || 0) : a.sesiones.length;
    const planificadas = a.numero_sesiones_plan_efectivo || 0;
    const pct = planificadas > 0 ? Math.min(100, Math.round((realizadas / planificadas) * 100)) : 0;

    let proximaCitaHtml = '<span style="color:var(--color-text-muted)">Sin citas programadas</span>';
    if (a.proxima_cita) {
        const p = a.proxima_cita;
        proximaCitaHtml = `<span style="font-weight:600; color:var(--color-success)">Próxima: ${_fmtFechaHoraCorta(p.fecha_hora_inicio)} (${p.modalidad})</span>`;
    }

    const ultimaSesion = esGrupal
        ? (a.sesiones_grupo?.length > 0 ? a.sesiones_grupo[a.sesiones_grupo.length - 1].fecha_hora : null)
        : (a.sesiones.length > 0 ? a.sesiones[a.sesiones.length - 1].fecha_hora : null);
    const ultimaSesionHtml = ultimaSesion ? `Última sesión: ${_fmtFechaHoraCorta(ultimaSesion)}` : 'Sin sesiones';

    return `
        <div class="at-progress-wrap">
            <div style="width:120px; font-weight:700; font-size:0.9rem">
                Progreso: ${realizadas} ${planificadas ? '/ ' + planificadas : ''}
            </div>
            <div class="at-progress-bar-container">
                <div class="at-progress-bar-fill" style="width:${planificadas ? pct : 0}%"></div>
            </div>
            <div style="text-align:right; font-size:0.75rem">
                <div>${ultimaSesionHtml}</div>
                <div>${proximaCitaHtml}</div>
            </div>
        </div>
    `;
}

function _renderGroupMembersPanel(a) {
    if (!a.vinculo) return '';
    const v = a.vinculo;
    const badgeColor = {pareja:'#3498DB', familiar:'#27AE60', grupal:'#8E44AD'}[v.tipo_vinculo] || '#6C757D';
    const typeLabel  = {pareja:'Pareja', familiar:'Familiar', grupal:'Grupal'}[v.tipo_vinculo] || v.tipo_vinculo;

    const participantRows = (v.participantes || []).map(p => `
        <tr>
            <td>
                <a href="#" onclick="verDetalleAtencion(${p.atencion_id}, () => verDetalleAtencion(${a.id}, _atencionBack)); return false;"
                   style="font-weight:600; color:var(--color-primary); text-decoration:none">
                    ${escapeHtml(p.paciente || '—')}
                </a>
                ${p.paciente_dni ? `<span style="font-size:0.75rem; color:var(--color-text-muted); margin-left:4px">DNI: ${p.paciente_dni}</span>` : ''}
            </td>
            <td style="font-size:0.85rem">${escapeHtml(p.rol_en_grupo || '—')}</td>
            <td>${p.precio_final != null ? 'S/ ' + parseFloat(p.precio_final).toFixed(2) : '—'}</td>
            <td><span class="badge ${ESTADO_AT_BADGE[p.atencion_estado] || ''}">${(p.atencion_estado || '—').toUpperCase()}</span></td>
        </tr>
    `).join('');

    return `
        <div class="card" style="padding:16px; margin-bottom:20px">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px">
                <div style="display:flex; align-items:center; gap:10px">
                    <h4 style="margin:0; font-size:.8rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.05em">Proceso grupal</h4>
                    <span style="padding:2px 8px; border-radius:9px; font-size:11px; font-weight:600; color:#fff; background:${badgeColor}">${typeLabel}</span>
                </div>
            </div>
            <div style="font-size:0.875rem; margin-bottom:12px">
                <strong>${escapeHtml(v.nombre_grupo || typeLabel)}</strong>
                <span style="color:var(--color-text-muted); margin-left:8px">· Rol: ${escapeHtml(v.rol_en_grupo || '—')}</span>
                ${v.precio_final != null ? `<span style="color:var(--color-text-muted); margin-left:8px">· Cuota: S/ ${parseFloat(v.precio_final).toFixed(2)}</span>` : ''}
            </div>
            ${v.motivo_consulta_proceso ? `
            <div style="font-size:0.875rem; margin-bottom:16px; padding:10px; background:rgba(0,0,0,0.02); border-left:3px solid var(--color-primary); border-radius:4px">
                <strong style="display:block; font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); margin-bottom:4px">Motivo de consulta del proceso</strong>
                <span style="font-style:italic">${escapeHtml(v.motivo_consulta_proceso)}</span>
            </div>
            ` : ''}
            ${participantRows
                ? `<table class="table" style="margin:0">
                    <thead><tr><th>Participante</th><th>Rol</th><th>Cuota</th><th>Estado</th></tr></thead>
                    <tbody>${participantRows}</tbody>
                   </table>`
                : '<p style="color:var(--color-text-muted); font-size:0.875rem; margin:0">Sin otros participantes registrados.</p>'}
        </div>
    `;
}

function _renderGroupSessionsTimeline(a) {
    const sgs = a.sesiones_grupo || [];
    if (sgs.length === 0) {
        return `
            <div class="card" style="padding:40px; text-align:center; color:var(--color-text-muted)">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px; opacity:0.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <p style="margin:0">Las sesiones grupales aparecerán aquí cuando se registre la primera desde el módulo de Citas.</p>
            </div>
        `;
    }

    // Mapa de notas privadas de este paciente por numero_sesion (de sus sesiones espejo)
    const espejoNotaMap = {};
    (a.sesiones || []).forEach(s => {
        if (s.numero_sesion != null) espejoNotaMap[s.numero_sesion] = s.nota_clinica || null;
    });

    const lockIcon = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="10" height="7" rx="1"/><path d="M5 8V5a3 3 0 0 1 6 0v3"/></svg>`;

    const items = [...sgs].reverse().map(sg => {
        const estadoBadge = sg.estado === 'realizada'
            ? '<span class="badge badge-success">Realizada</span>'
            : `<span class="badge">${escapeHtml(sg.estado || '')}</span>`;

        const notaPriv = espejoNotaMap[sg.numero_sesion];
        const notaPrivHtml = notaPriv
            ? `<div class="at-nota-privada">
                   <span style="font-size:11px; font-weight:600; color:var(--color-text-muted); display:flex; align-items:center; gap:4px; margin-bottom:4px">${lockIcon} Nota privada</span>
                   ${escapeHtml(notaPriv)}
               </div>`
            : '';

        return `
            <div class="at-timeline-item">
                <div class="at-timeline-dot"></div>
                <div class="at-timeline-card" id="sg-${sg.id}">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px">
                        <div>
                            <span style="font-size:1.1rem; font-weight:800; color:var(--color-primary)">Sesión ${sg.numero_sesion}</span>
                            <span style="margin-left:8px; font-size:0.85rem; color:var(--color-text-muted)">${_fmtFechaLarga(sg.fecha_hora)}${sg.duracion_min ? ' · ' + sg.duracion_min + ' min' : ''}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px">
                            ${estadoBadge}
                            <button class="btn-sm" onclick="abrirModalEditarNotaGrupal(${sg.id})" title="Editar nota">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                        </div>
                    </div>
                    <div style="font-size:0.9rem; line-height:1.6; white-space:pre-wrap">${sg.nota_clinica_compartida || '<span style="color:var(--color-text-muted); font-style:italic">Sin nota compartida registrada</span>'}</div>
                    ${notaPrivHtml}
                    <div id="adjuntos-sg-${sg.id}" class="at-sesion-adjuntos"></div>
                </div>
            </div>
        `;
    }).join('');

    return `<div class="at-timeline">${items}</div>`;
}

function _renderSparklinesSection(a) {
    const checks = a.checkins || [];
    if (checks.length < 2) return '';

    const feelings = checks.map(c => c.como_te_sientes).reverse();
    const stress = checks.map(c => c.nivel_estres).reverse();
    const sleep = checks.map(c => c.dormiste_bien).reverse();

    return `
        <div class="at-sparkline-wrap">
            <div class="at-sparkline-item">
                <div class="at-sparkline-label">😊 Evolución Emocional</div>
                ${_renderSparkline(feelings, '#27AE60')}
            </div>
            <div class="at-sparkline-item">
                <div class="at-sparkline-label">😰 Nivel de Estrés</div>
                ${_renderSparkline(stress, '#E74C3C')}
            </div>
            <div class="at-sparkline-item">
                <div class="at-sparkline-label">😴 Calidad de Sueño</div>
                ${_renderSparkline(sleep, '#3498DB')}
            </div>
        </div>
    `;
}

function _renderSparkline(values, color) {
    const max = 10;
    const width = 160;
    const height = 30;
    if (!values || !values.length) return '';
    const points = values.map((v, i) => {
        const x = (i / (values.length - 1 || 1)) * width;
        const y = height - (v / max) * height;
        return `${x},${y}`;
    }).join(' ');
    
    return `
        <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <polyline fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
        </svg>
    `;
}

function _renderAdjuntoThumb(a) {
    const nombre = escapeHtml(a.nombre_display || a.nombre_original);
    if (a.tipo_mime.startsWith('image/')) {
        return `<button class="at-adj-thumb" title="${nombre}"
                    onclick="abrirLightbox('/api/archivos/descargar?id=${a.id}&preview=1','${nombre}')">
                    <img src="/api/archivos/descargar?id=${a.id}&preview=1" alt="${nombre}" loading="lazy">
                </button>`;
    }
    return `<a class="at-adj-thumb at-adj-pdf"
               href="/api/archivos/descargar?id=${a.id}&preview=1"
               target="_blank" rel="noopener" title="${nombre}">
                ${_adjPdfThumb()}
                <span class="at-adj-pdf-name">${nombre}</span>
            </a>`;
}

async function _cargarAdjuntosSesionesTimeline(a) {
    for (const s of (a.sesiones || [])) {
        const cont = document.getElementById(`adjuntos-sesion-${s.id}`);
        if (!cont) continue;
        const res = await api(`/api/sesiones/archivos?sesion_id=${s.id}`);
        if (!res.success || !res.data?.length) continue;
        cont.innerHTML = res.data.map(ar => _renderAdjuntoThumb(ar)).join('');
    }
    for (const sg of (a.sesiones_grupo || [])) {
        const cont = document.getElementById(`adjuntos-sg-${sg.id}`);
        if (!cont) continue;
        const res = await api(`/api/sesiones/archivos?sesion_grupo_id=${sg.id}`);
        if (!res.success || !res.data?.length) continue;
        cont.innerHTML = res.data.map(ar => _renderAdjuntoThumb(ar)).join('');
    }
}

function abrirLightbox(src, alt) {
    let lb = document.getElementById('at-lightbox');
    if (!lb) {
        lb = document.createElement('div');
        lb.id = 'at-lightbox';
        lb.className = 'at-lightbox';
        lb.innerHTML = `
            <button class="at-lightbox-close" onclick="cerrarLightbox()" title="Cerrar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.5" stroke-linecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            <img class="at-lightbox-img" id="at-lightbox-img" src="" alt="">`;
        lb.addEventListener('click', e => { if (e.target === lb) cerrarLightbox(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarLightbox(); });
        document.body.appendChild(lb);
    }
    document.getElementById('at-lightbox-img').src = src;
    document.getElementById('at-lightbox-img').alt = alt;
    lb.classList.add('is-open');
    document.body.style.overflow = 'hidden';
}

function cerrarLightbox() {
    document.getElementById('at-lightbox')?.classList.remove('is-open');
    document.body.style.overflow = '';
}

function _renderSessionsTimeline(a) {
    const esGrupal = ['pareja', 'familiar', 'grupal'].includes((a.subservicio_modalidad || '').toLowerCase());
    if (esGrupal) return _renderGroupSessionsTimeline(a);
    if (!a.sesiones || a.sesiones.length === 0) {
        return `
            <div class="card" style="padding:40px; text-align:center; color:var(--color-text-muted)">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px; opacity:0.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <p style="margin:0">Las sesiones aparecerán aquí cuando se complete la primera cita.</p>
                <p style="font-size:0.8rem">Las sesiones se registran únicamente desde el módulo de Citas.</p>
            </div>
        `;
    }

    const timelineItems = [...a.sesiones].reverse().map(s => {
        const fechaStr = _fmtFechaLarga(s.fecha_hora);
        const modalidadPill = s.modalidad_sesion === 'virtual' 
            ? '<span class="badge" style="background:rgba(155,126,200,.12); color:#7B5EA7">Virtual</span>'
            : '<span class="badge" style="background:rgba(32,178,170,.12); color:#1A7F79">Presencial</span>';
        
        // Buscar check-in cercano
        const check = a.checkins ? a.checkins.find(c => {
            const diff = Math.abs(new Date(c.fecha_hora) - new Date(s.fecha_hora));
            return diff < (24 * 60 * 60 * 1000); // Mismo día
        }) : null;

        let checkHtml = '';
        if (check) {
            checkHtml = `
                <div class="at-emotional-pills">
                    <span class="at-emotional-pill" title="Sentimiento">😊 ${check.como_te_sientes}/10</span>
                    <span class="at-emotional-pill" title="Estrés">😰 ${check.nivel_estres}/10</span>
                    <span class="at-emotional-pill" title="Sueño">😴 ${check.dormiste_bien}/10</span>
                    <span class="at-emotional-pill">✅ Tarea: ${check.hiciste_tarea === 'si' ? 'Sí' : 'No'}</span>
                </div>
            `;
        }

        return `
            <div class="at-timeline-item">
                <div class="at-timeline-dot"></div>
                <div class="at-timeline-card" id="sesion-${s.id}">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px">
                        <div>
                            <span style="font-size:1.1rem; font-weight:800; color:var(--color-primary)">Sesión ${s.numero_sesion}</span>
                            <span style="margin-left:8px; font-size:0.85rem; color:var(--color-text-muted)">${fechaStr} · ${s.duracion_min} min</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px">
                            ${modalidadPill}
                            <span class="at-fin-info hidden" style="font-weight:600; font-size:0.85rem">S/ ${parseFloat(s.precio_sesion).toFixed(2)}</span>
                            <button class="btn-sm" onclick="abrirModalEditarNota(${s.id})" title="Editar nota">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                        </div>
                    </div>
                    <div style="font-size:0.9rem; line-height:1.6; white-space:pre-wrap">${s.nota_clinica || '<span style="color:var(--color-text-muted); font-style:italic">Sin nota clínica registrada</span>'}</div>
                    ${checkHtml}
                    <div id="adjuntos-sesion-${s.id}" class="at-sesion-adjuntos"></div>
                </div>
            </div>
        `;
    }).join('');

    return `<div class="at-timeline">${timelineItems}</div>`;
}

function _renderTasksSection(a) {
    if (!a.tareas || a.tareas.length === 0) return '';

    const rows = a.tareas.map(t => {
        const esVencida = t.estado === 'pendiente' && new Date(t.fecha_limite) < new Date();
        const rowStyle = esVencida ? 'background:rgba(231,76,60,0.03)' : '';
        const limitStyle = esVencida ? 'color:var(--color-danger); font-weight:700' : '';
        
        return `
            <tr style="${rowStyle}">
                <td style="font-size:0.8rem">
                    <a href="#sesion-${t.sesion_id}" style="color:var(--color-primary); text-decoration:none; font-weight:600">Sesión ${t.numero_sesion}</a>
                </td>
                <td>
                    <div style="font-weight:600">${escapeHtml(t.titulo)}</div>
                    <div style="font-size:0.75rem; color:var(--color-text-muted)">${escapeHtml(t.descripcion || '')}</div>
                </td>
                <td style="${limitStyle}">${_fmtDDMMYYYY(t.fecha_limite) || '—'}</td>
                <td>
                    <select class="input" style="font-size:.75rem; padding:2px 6px" onchange="cambiarEstadoTareaEnAtencion(${t.id}, this.value)">
                        ${['pendiente','en_proceso','completada','no_realizada'].map(e => `
                            <option value="${e}" ${t.estado === e ? 'selected' : ''}>${TAREA_ESTADO_LABEL[e]}</option>
                        `).join('')}
                    </select>
                </td>
                <td style="font-size:0.85rem">
                    ${t.respuesta_paciente 
                        ? `<div>${escapeHtml(t.respuesta_paciente)}</div>`
                        : '<span style="color:var(--color-text-muted)">—</span>'}
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div class="card" style="padding:16px; margin-bottom:20px">
            <h4 style="margin:0 0 12px; font-size:.8rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.05em">Tareas Terapéuticas</h4>
            <table class="table" style="margin-top:0">
                <thead>
                    <tr><th>Sesión</th><th>Tarea</th><th>Límite</th><th>Estado</th><th>Respuesta Paciente</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function _renderDiagnosesSection(a) {
    const dxs = a.diagnosticos || [];
    const rows = dxs.map(d => `
        <tr id="dx-row-${d.id}">
            <td style="font-family:monospace; font-weight:700">${d.cie10_codigo}</td>
            <td style="font-size:0.85rem">${escapeHtml(d.descripcion_corta || d.descripcion_cie10)}</td>
            <td><span class="badge ${d.jerarquia === 'principal' ? 'badge-danger' : 'badge-warning'}">${d.jerarquia.toUpperCase()}</span></td>
            <td><span class="badge ${d.nivel_certeza === 'definitivo' ? 'badge-success' : d.nivel_certeza === 'descartado' ? 'badge-danger' : 'badge-info'}">${d.nivel_certeza.toUpperCase()}</span></td>
            <td style="white-space:nowrap">
                <button class="btn-sm" title="Editar jerarquía / certeza"
                        onclick="_editarDx(${d.id}, '${d.jerarquia}', '${d.nivel_certeza}', ${a.id})"
                        style="margin-right:4px">✏</button>
                <button class="btn-sm" title="Eliminar diagnóstico"
                        onclick="if(confirm('¿Eliminar diagnóstico?')) _eliminarDx(${d.id})">&times;</button>
            </td>
        </tr>
    `).join('');

    return `
        <div class="card" style="padding:16px; margin-bottom:20px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
                <h4 style="margin:0; font-size:.8rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.05em">Diagnósticos CIE-10</h4>
                <button class="btn-primary" style="font-size:0.75rem; padding:4px 10px" onclick="_toggleDxForm()">+ Agregar diagnóstico</button>
            </div>
            
            <div id="dx-form-container" class="hidden" style="background:var(--color-bg); padding:15px; border-radius:var(--radius); margin-bottom:15px; border:1px solid var(--color-border)">
                <div style="display:grid; grid-template-columns: 1fr 150px 150px 100px; gap:10px; align-items: flex-end">
                    <div class="form-group" style="margin:0; position:relative">
                        <label>Buscar diagnóstico</label>
                        <input type="text" id="cie10SearchInput" class="input" placeholder="Código o descripción..." oninput="_cie10OnInput()">
                        <div id="cie10Dropdown" style="display:none; position:absolute; z-index:100; left:0; right:0; top:100%; background:#fff; border:1px solid var(--color-border); box-shadow:var(--shadow); max-height:200px; overflow-y:auto"></div>
                    </div>
                    <div class="form-group" style="margin:0">
                        <label>Jerarquía</label>
                        <select id="cie10JerarquiaSelect" class="input"><option value="principal">Principal</option><option value="secundario">Secundario</option></select>
                    </div>
                    <div class="form-group" style="margin:0">
                        <label>Certeza</label>
                        <select id="cie10NivelCertezaSelect" class="input"><option value="presuntivo">Presuntivo</option><option value="definitivo">Definitivo</option><option value="descartado">Descartado</option></select>
                    </div>
                    <button class="btn-primary" onclick="agregarDiagnostico(${a.id})">Añadir</button>
                </div>
                <input type="hidden" id="cie10SelectedCode">
                <div id="cie10SelectedInfo" style="font-size:0.75rem; color:var(--color-text-muted); margin-top:5px"></div>
                <div id="cie10ErrorMsg" class="error hidden"></div>
            </div>

            <table class="table" style="margin-top:0">
                <thead><tr><th>Cód.</th><th>Descripción</th><th>Jerarquía</th><th>Certeza</th><th></th></tr></thead>
                <tbody>${rows || '<tr><td colspan="5" style="text-align:center; color:var(--color-text-muted)">Sin diagnósticos registrados</td></tr>'}</tbody>
            </table>
        </div>
    `;
}

function _renderClinicalContext(a) {
    const carrySessions = a.sesiones && a.sesiones.length > 1;
    const isCollapsed = carrySessions ? 'collapsed' : '';
    
    return `
        <div class="at-collapsible ${isCollapsed}">
            <div class="at-collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')">
                <span>Contexto clínico inicial</span>
                <svg class="at-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="at-collapsible-content">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px">
                    <div>
                        <h5 style="margin:0 0 5px; font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase">Motivo de consulta</h5>
                        <p style="margin:0; font-size:0.875rem; white-space:pre-wrap">${escapeHtml(a.motivo_consulta || '—')}</p>
                    </div>
                    <div>
                        <h5 style="margin:0 0 5px; font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase">Antecedentes relevantes</h5>
                        <p style="margin:0; font-size:0.875rem; white-space:pre-wrap">${escapeHtml(a.antecedentes_relevantes || '—')}</p>
                    </div>
                    <div>
                        <h5 style="margin:0 0 5px; font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase">Observación general</h5>
                        <p style="margin:0; font-size:0.875rem; white-space:pre-wrap">${escapeHtml(a.observacion_general || '—')}</p>
                    </div>
                    <div>
                        <h5 style="margin:0 0 5px; font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase">Observación de conducta</h5>
                        <p style="margin:0; font-size:0.875rem; white-space:pre-wrap">${escapeHtml(a.observacion_conducta || '—')}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function _renderRecommendationsSection(a) {
    if (a.estado !== 'completada' && !a.fecha_fin) return '';
    
    return `
        <div class="card" style="padding:16px; background:rgba(42,127,143,0.05); border-color:var(--color-primary)">
            <h4 style="margin:0 0 10px; font-size:.8rem; color:var(--color-primary); text-transform:uppercase; letter-spacing:.05em">Recomendaciones de Cierre</h4>
            <p style="margin:0; font-size:0.9rem; white-space:pre-wrap">${escapeHtml(a.recomendaciones || 'Sin recomendaciones registradas al cierre.')}</p>
        </div>
    `;
}

// Helpers adicionales de renderizado

function _fmtFechaHoraCorta(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}

function _fmtFechaLarga(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }).replace(/^\w/, c => c.toUpperCase());
}

function _toggleDxForm() {
    document.getElementById('dx-form-container').classList.toggle('hidden');
}

function _toggleFinanzasAdmin(show) {
    document.querySelectorAll('.at-fin-info').forEach(el => el.classList.toggle('hidden', !show));
}

async function _eliminarDx(dxId) {
    const res = await api('/api/atenciones/diagnostico', 'DELETE', { id: dxId });
    if (res.success) {
        showToast('Diagnóstico eliminado');
        verDetalleAtencion(_currentAtencionId, _atencionBack);
    } else {
        showToast(res.message || 'Error al eliminar');
    }
}

function _verDetallePaquete() {
    const p = window._atPaqueteActivo;
    if (!p) return;
    alert(`Paquete: ${p.nombre_paquete}\nSesiones: ${p.sesiones_restantes} de ${p.sesiones_incluidas} restantes.`);
}


function goBackFromAtencion() {
    if (_atencionBack) _atencionBack();
    else atenciones();
}

// ---- CIE-10: búsqueda con debounce ----

function _cie10OnInput() {
    clearTimeout(_cie10Timer);

    // Limpiar selección previa al escribir de nuevo
    document.getElementById('cie10SelectedCode').value = '';
    document.getElementById('cie10SelectedInfo').textContent = 'Ningún código seleccionado';
    document.getElementById('cie10SelectedInfo').style.color = 'var(--color-text-muted)';
    _ocultarCie10Error();

    const q = document.getElementById('cie10SearchInput').value.trim();
    if (q.length < 2) {
        _ocultarCie10Dropdown();
        return;
    }

    _cie10Timer = setTimeout(() => _cie10Fetch(q), 400);
}

async function _cie10Fetch(q) {
    const res = await api('/api/cie10/buscar?q=' + encodeURIComponent(q));
    _cie10Results = res.data || [];

    const dd = document.getElementById('cie10Dropdown');
    if (!dd) return;

    if (!_cie10Results.length) {
        dd.innerHTML = '<div style="padding:.5rem .8rem;color:var(--color-text-muted);font-size:.85rem">Sin resultados para esta búsqueda</div>';
        dd.style.display = 'block';
        return;
    }

    dd.innerHTML = _cie10Results.map((r, i) => `
        <div role="option"
             style="padding:.45rem .8rem;cursor:pointer;font-size:.85rem;
                    border-bottom:1px solid var(--color-border);transition:background var(--transition)"
             onmouseenter="this.style.background='var(--color-bg)'"
             onmouseleave="this.style.background=''"
             onmousedown="_cie10Select(${i})">
            <strong style="color:var(--color-primary)">${escapeHtml(r.codigo)}</strong>
            <span style="color:var(--color-text-muted)"> — </span>${escapeHtml(r.descripcion_corta || r.descripcion)}
        </div>
    `).join('');
    dd.style.display = 'block';
}

function _cie10Select(idx) {
    const r = _cie10Results[idx];
    if (!r) return;

    document.getElementById('cie10SelectedCode').value = r.codigo;
    document.getElementById('cie10SearchInput').value  = r.codigo;
    document.getElementById('cie10SelectedInfo').textContent =
        r.codigo + ': ' + (r.descripcion_corta || r.descripcion || '');
    document.getElementById('cie10SelectedInfo').style.color = 'var(--color-text)';
    _ocultarCie10Dropdown();
    _ocultarCie10Error();
}

function _ocultarCie10Dropdown() {
    const dd = document.getElementById('cie10Dropdown');
    if (dd) dd.style.display = 'none';
}

function _ocultarCie10Error() {
    const el = document.getElementById('cie10ErrorMsg');
    if (el) el.style.display = 'none';
}

function _mostrarCie10Error(msg) {
    const el = document.getElementById('cie10ErrorMsg');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
}

async function agregarDiagnostico(atencionId) {
    _ocultarCie10Error();

    const codigo       = (document.getElementById('cie10SelectedCode')?.value || '').trim();
    const jerarquia    = document.getElementById('cie10JerarquiaSelect')?.value    || 'principal';
    const nivelCerteza = document.getElementById('cie10NivelCertezaSelect')?.value || 'presuntivo';

    if (!codigo) {
        _mostrarCie10Error('Seleccione un diagnóstico de la lista desplegable.');
        return;
    }

    const hoy = _localDate();
    const res = await api('/api/atenciones/diagnostico', 'POST', {
        atencion_id:   atencionId,
        cie10_codigo:  codigo,
        jerarquia,
        nivel_certeza: nivelCerteza,
        fecha_dx:      hoy,
    });

    if (res.success) {
        showToast('Diagnóstico agregado');
        verDetalleAtencion(atencionId, _atencionBack);
    } else {
        _mostrarCie10Error(res.message || 'Error al agregar el diagnóstico.');
    }
}

// Cierre del dropdown al hacer clic fuera (se registra una sola vez)
if (!window._cie10ClickListenerAdded) {
    window._cie10ClickListenerAdded = true;
    document.addEventListener('mousedown', function (e) {
        const dd    = document.getElementById('cie10Dropdown');
        const input = document.getElementById('cie10SearchInput');
        if (dd && input && !dd.contains(e.target) && e.target !== input) {
            dd.style.display = 'none';
        }
    });
}

async function cerrarAtencion(id) {
    const fecha = prompt('Fecha de cierre (YYYY-MM-DD):');
    if (!fecha) return;
    const res = await api('/api/atenciones/cerrar', 'PUT', { id, fecha_fin: fecha });
    if (res.success) {
        showToast('Atención cerrada');
        atenciones();
    } else {
        showToast(res.message || 'Error al cerrar');
    }
}

async function pausarAtencion(id) {
    if (!confirm('¿Pausar la atención? Podrá reactivarla después.')) return;
    const res = await api('/api/atenciones/pausar', 'PUT', { id, accion: 'pausar' });
    if (res.success) {
        showToast('Atención pausada');
        verDetalleAtencion(_currentAtencionId, _atencionBack);
    } else {
        showToast(res.message || 'Error al pausar');
    }
}

async function reactivarAtencion(id) {
    if (!confirm('¿Reactivar la atención?')) return;
    const res = await api('/api/atenciones/pausar', 'PUT', { id, accion: 'reactivar' });
    if (res.success) {
        showToast('Atención reactivada');
        verDetalleAtencion(_currentAtencionId, _atencionBack);
    } else {
        showToast(res.message || 'Error al reactivar');
    }
}

function abrirModalEditarAtencion() {
    const a = _currentAtencion;
    if (!a) return;
    document.getElementById('editAtSesionesPlan').value  = a.numero_sesiones_plan ?? '';
    document.getElementById('editAtMotivo').value        = a.motivo_consulta        ?? '';
    document.getElementById('editAtAntecedentes').value  = a.antecedentes_relevantes ?? '';
    document.getElementById('editAtObsGeneral').value    = a.observacion_general    ?? '';
    document.getElementById('editAtObsConducta').value   = a.observacion_conducta   ?? '';
    document.getElementById('modalEditarAtencion').classList.remove('hidden');
}

async function guardarEdicionAtencion() {
    const res = await api('/api/atenciones', 'PUT', {
        id:                     _currentAtencionId,
        numero_sesiones_plan:   document.getElementById('editAtSesionesPlan').value.trim(),
        motivo_consulta:        document.getElementById('editAtMotivo').value.trim(),
        antecedentes_relevantes:document.getElementById('editAtAntecedentes').value.trim(),
        observacion_general:    document.getElementById('editAtObsGeneral').value.trim(),
        observacion_conducta:   document.getElementById('editAtObsConducta').value.trim(),
    });
    if (res.success) {
        showToast('Atención actualizada');
        cerrarModal('modalEditarAtencion');
        verDetalleAtencion(_currentAtencionId, _atencionBack);
    } else {
        showToast(res.message || 'Error al guardar');
    }
}

function _editarDx(id, jerarquia, certeza, atencionId) {
    const row = document.getElementById('dx-row-' + id);
    if (!row) return;
    const cells = row.querySelectorAll('td');

    cells[2].innerHTML = `
        <select id="dx-jerarquia-${id}" class="input" style="padding:2px 6px;font-size:.8rem;min-width:110px">
            <option value="principal"  ${jerarquia === 'principal'  ? 'selected' : ''}>Principal</option>
            <option value="secundario" ${jerarquia === 'secundario' ? 'selected' : ''}>Secundario</option>
        </select>`;

    cells[3].innerHTML = `
        <select id="dx-certeza-${id}" class="input" style="padding:2px 6px;font-size:.8rem;min-width:110px">
            <option value="presuntivo"  ${certeza === 'presuntivo'  ? 'selected' : ''}>Presuntivo</option>
            <option value="definitivo"  ${certeza === 'definitivo'  ? 'selected' : ''}>Definitivo</option>
            <option value="descartado"  ${certeza === 'descartado'  ? 'selected' : ''}>Descartado</option>
        </select>`;

    cells[4].innerHTML = `
        <button class="btn-sm" title="Guardar cambios"
                onclick="_guardarEditDx(${id}, ${atencionId})"
                style="color:var(--color-success);margin-right:4px">✓</button>
        <button class="btn-sm" title="Cancelar"
                onclick="verDetalleAtencion(${atencionId}, _atencionBack)">✕</button>`;
}

async function _guardarEditDx(id, atencionId) {
    const jerarquia    = document.getElementById('dx-jerarquia-' + id)?.value;
    const nivelCerteza = document.getElementById('dx-certeza-'   + id)?.value;
    if (!jerarquia || !nivelCerteza) return;

    const res = await api('/api/atenciones/diagnostico', 'PUT', { id, jerarquia, nivel_certeza: nivelCerteza });
    if (res.success) {
        showToast('Diagnóstico actualizado');
        verDetalleAtencion(atencionId, _atencionBack);
    } else {
        showToast(res.message || 'Error al actualizar');
    }
}

// ---- CIE-10 en modal nueva atención ----

function _atDxOnInput() {
    clearTimeout(_atDxTimer);
    document.getElementById('atDxSelectedCode').value = '';
    document.getElementById('atDxSelectedInfo').textContent = 'Ningún código seleccionado';
    document.getElementById('atDxSelectedInfo').style.color = 'var(--color-text-muted)';
    _atDxOcultarError();

    const q = document.getElementById('atDxSearchInput').value.trim();
    if (q.length < 2) { _atDxOcultarDropdown(); return; }
    _atDxTimer = setTimeout(() => _atDxFetch(q), 400);
}

async function _atDxFetch(q) {
    const res = await api('/api/cie10/buscar?q=' + encodeURIComponent(q));
    _atDxResults = res.data || [];

    const dd = document.getElementById('atDxDropdown');
    if (!dd) return;

    if (!_atDxResults.length) {
        dd.innerHTML = '<div style="padding:.5rem .8rem;color:var(--color-text-muted);font-size:.85rem">Sin resultados</div>';
        dd.style.display = 'block';
        return;
    }
    dd.innerHTML = _atDxResults.map((r, i) => `
        <div role="option"
             style="padding:.45rem .8rem;cursor:pointer;font-size:.85rem;"
             onmouseenter="this.style.background='var(--color-bg)'"
             onmouseleave="this.style.background=''"
             onmousedown="_atDxSelect(${i})">
            <strong style="color:var(--color-primary)">${escapeHtml(r.codigo)}</strong>
            <span style="color:var(--color-text-muted)"> — </span>${escapeHtml(r.descripcion_corta || r.descripcion)}
        </div>`).join('');
    dd.style.display = 'block';
}

function _atDxSelect(idx) {
    const r = _atDxResults[idx];
    if (!r) return;
    document.getElementById('atDxSelectedCode').value     = r.codigo;
    document.getElementById('atDxSearchInput').value      = r.codigo;
    document.getElementById('atDxSelectedInfo').textContent = r.codigo + ': ' + (r.descripcion_corta || r.descripcion || '');
    document.getElementById('atDxSelectedInfo').style.color = 'var(--color-text)';
    _atDxOcultarDropdown();
    _atDxOcultarError();
}

function _atDxOcultarDropdown() {
    const dd = document.getElementById('atDxDropdown');
    if (dd) dd.style.display = 'none';
}

function _atDxOcultarError() {
    const el = document.getElementById('atDxErrorMsg');
    if (el) el.style.display = 'none';
}

function _atDxMostrarError(msg) {
    const el = document.getElementById('atDxErrorMsg');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
}

function _atDxAgregar() {
    _atDxOcultarError();
    const codigo       = (document.getElementById('atDxSelectedCode')?.value || '').trim();
    const descripcion  = document.getElementById('atDxSelectedInfo')?.textContent || '';
    const jerarquia    = document.getElementById('atDxJerarquia')?.value    || 'principal';
    const nivelCerteza = document.getElementById('atDxNivelCerteza')?.value || 'presuntivo';

    if (!codigo) { _atDxMostrarError('Seleccione un diagnóstico de la lista.'); return; }
    if (_atDxList.some(d => d.codigo === codigo)) { _atDxMostrarError('Este código ya fue agregado.'); return; }
    if (jerarquia === 'principal' && _atDxList.some(d => d.jerarquia === 'principal')) {
        _atDxMostrarError('Ya hay un diagnóstico principal. Cambie la jerarquía o retire el anterior.');
        return;
    }

    _atDxList.push({ codigo, descripcion, jerarquia, nivel_certeza: nivelCerteza });
    _atDxRenderList();

    // Limpiar búsqueda
    document.getElementById('atDxSearchInput').value = '';
    document.getElementById('atDxSelectedCode').value = '';
    document.getElementById('atDxSelectedInfo').textContent = 'Ningún código seleccionado';
    document.getElementById('atDxSelectedInfo').style.color = 'var(--color-text-muted)';
}

function _atDxQuitar(idx) {
    _atDxList.splice(idx, 1);
    _atDxRenderList();
}

function _atDxRenderList() {
    const cont = document.getElementById('atDxList');
    if (!cont) return;
    if (!_atDxList.length) { cont.innerHTML = ''; return; }

    const JERARQUIA_COLOR = { principal: '#E74C3C', secundario: '#F39C12' };
    const CERTEZA_COLOR   = { definitivo: '#27AE60', presuntivo: '#2E86C1', descartado: '#6C757D' };

    cont.innerHTML = _atDxList.map((d, i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius);font-size:.85rem">
            <code style="font-weight:600;color:var(--color-primary)">${escapeHtml(d.codigo)}</code>
            <span style="flex:1;color:var(--color-text-muted)">${escapeHtml(d.descripcion)}</span>
            <span style="padding:2px 7px;border-radius:4px;font-size:.75rem;font-weight:600;background:${JERARQUIA_COLOR[d.jerarquia]}22;color:${JERARQUIA_COLOR[d.jerarquia]}">${d.jerarquia}</span>
            <span style="padding:2px 7px;border-radius:4px;font-size:.75rem;font-weight:600;background:${CERTEZA_COLOR[d.nivel_certeza]}22;color:${CERTEZA_COLOR[d.nivel_certeza]}">${d.nivel_certeza}</span>
            <button onclick="_atDxQuitar(${i})" title="Quitar"
                    style="border:none;background:none;cursor:pointer;color:var(--color-danger);font-size:1rem;line-height:1;padding:0 2px">&times;</button>
        </div>`).join('');
}

// Cerrar dropdown al hacer clic fuera (modal nueva atención)
if (!window._atDxClickListenerAdded) {
    window._atDxClickListenerAdded = true;
    document.addEventListener('mousedown', function (e) {
        const dd    = document.getElementById('atDxDropdown');
        const input = document.getElementById('atDxSearchInput');
        if (dd && input && !dd.contains(e.target) && e.target !== input) {
            dd.style.display = 'none';
        }
    });
}

// ---- Modal nueva atención ----

async function abrirModalAtencion(pacienteIdPreset = null) {
    clearAtErrors();

    // Limpiar campos
    ['atOcupacion','atMotivoConsulta','atObservacionGeneral','atAntecedentes',
     'atNumeroSesionesPlan'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // Limpiar sección CIE-10
    _atDxList = [];
    _atDxRenderList();

    // Reset tareas
    const atTareasWrapper = document.getElementById('atTareasWrapper');
    if (typeof _resetTareasInline === 'function') _resetTareasInline(atTareasWrapper);
    const dxInput = document.getElementById('atDxSearchInput');
    if (dxInput) dxInput.value = '';
    const dxCode = document.getElementById('atDxSelectedCode');
    if (dxCode) dxCode.value = '';
    const dxInfo = document.getElementById('atDxSelectedInfo');
    if (dxInfo) { dxInfo.textContent = 'Ningún código seleccionado'; dxInfo.style.color = 'var(--color-text-muted)'; }
    _atDxOcultarDropdown();
    _atDxOcultarError();
    document.getElementById('atGradoInstruccion').value = 'no_especificado';
    document.getElementById('atEstadoCivil').value      = 'no_especificado';
    document.getElementById('atSexo').value             = 'no_especificado';
    document.getElementById('atFechaNacimiento').value  = '';
    _atToggleReadonly('atSexo', false);
    _atToggleReadonly('atFechaNacimiento', false);
    _atFechaNacimiento = '';
    const atFechaNacRow = document.getElementById('atFechaNacimientoRow');
    if (atFechaNacRow) atFechaNacRow.style.display = '';
    document.getElementById('atFechaInicio').value      = _localDate();
    document.getElementById('atFechaInicio').onchange   = _atActualizarSexoEdadDisplay;

    // Cargar pacientes
    const resPac = await api('/api/pacientes');
    const selPac = document.getElementById('atPaciente');
    selPac.innerHTML = '<option value="">Seleccionar paciente…</option>';
    if (resPac.data) {
        resPac.data.forEach(p => {
            selPac.innerHTML += `<option value="${p.id}">${p.apellidos}, ${p.nombres} — ${p.dni}</option>`;
        });
    }

    // Cargar profesionales o mostrar campo de solo lectura según rol
    const selPro     = document.getElementById('atProfesional');
    const userAt     = getUser();
    const esProfAt   = userAt?.rol === 'profesional';

    if (esProfAt) {
        selPro.style.display = 'none';
        let rdPro = document.getElementById('atProfesional-readonly');
        if (!rdPro) {
            rdPro = document.createElement('div');
            rdPro.id = 'atProfesional-readonly';
            rdPro.className = 'readonly-field';
            selPro.parentNode.insertBefore(rdPro, selPro.nextSibling);
        }
        rdPro.textContent  = `${userAt.nombres} ${userAt.apellidos}`;
        rdPro.style.display = '';
    } else {
        selPro.style.display = '';
        const rdPro = document.getElementById('atProfesional-readonly');
        if (rdPro) rdPro.style.display = 'none';

        const resPro = await api('/api/profesionales');
        selPro.innerHTML = '<option value="">Seleccionar profesional…</option>';
        if (resPro.data) {
            resPro.data.forEach(p => {
                const espec = p.especialidad ? ` (${p.especialidad})` : '';
                selPro.innerHTML += `<option value="${p.id}">${p.apellidos}, ${p.nombres}${espec}</option>`;
            });
        }
    }

    // Cargar subservicios
    const resSub = await api('/api/subservicios');
    const selSub = document.getElementById('atSubservicio');
    selSub.innerHTML = '<option value="">Seleccionar servicio…</option>';
    if (resSub.data) {
        resSub.data.forEach(s => {
            selSub.innerHTML += `<option value="${s.id}" data-precio="${s.precio_base}" data-modalidad="${s.modalidad || ''}">${s.servicio} — ${s.nombre} (${s.modalidad})</option>`;
        });
    }

    // Ocultar sección vínculo al abrir el modal
    _toggleVinculoSection('');
    // Limpiar opciones de vínculo
    document.getElementById('atVinculoSelect').innerHTML = '<option value="">Cargando…</option>';
    document.getElementById('atRolVinculoExistente').value = '';
    document.getElementById('atVinculoNombre').value       = '';
    document.getElementById('atRolVinculoNuevo').value     = '';
    document.getElementById('atVinculoTipo').value         = 'pareja';
    // Deseleccionar radio "ninguno"
    const radioNinguno = document.querySelector('input[name="atVinculoOpcion"][value="ninguno"]');
    if (radioNinguno) radioNinguno.checked = true;
    _onVinculoRadioChange('ninguno');

    // Pre-seleccionar paciente y cargar sus datos si se indica
    if (pacienteIdPreset) {
        selPac.value = pacienteIdPreset;
        await cargarDatosPacienteEnModal(pacienteIdPreset);
    }

    // Precio base automático y sección vínculo al cambiar subservicio
    selSub.onchange = function () {
        const opt        = this.options[this.selectedIndex];
        const precio     = opt ? opt.dataset.precio    : '';
        const modalidad  = opt ? opt.dataset.modalidad : '';
        if (precio && !document.getElementById('atPrecioAcordado').value) {
            document.getElementById('atPrecioAcordado').value = parseFloat(precio).toFixed(2);
        }
        _toggleVinculoSection(modalidad);
    };

    document.getElementById('modalAtencion').classList.remove('hidden');
}

async function cargarDatosPacienteEnModal(pacienteId) {
    if (!pacienteId) return;
    const res = await api('/api/paciente?id=' + pacienteId);
    if (!res.data) return;
    const p = res.data;
    document.getElementById('atGradoInstruccion').value = p.grado_instruccion || 'no_especificado';
    document.getElementById('atOcupacion').value        = p.ocupacion         || '';
    document.getElementById('atEstadoCivil').value      = p.estado_civil      || 'no_especificado';

    const sexoVal  = p.sexo || 'no_especificado';
    const fechaVal = p.fecha_nacimiento || '';
    const fechaRef = document.getElementById('atFechaInicio').value;
    document.getElementById('atSexo').value            = sexoVal;
    document.getElementById('atFechaNacimiento').value = fechaVal;

    const atFechaNacRow = document.getElementById('atFechaNacimientoRow');
    const labels = { masculino: 'Masculino', femenino: 'Femenino', otro: 'Otro' };

    if (sexoVal !== 'no_especificado' && fechaVal) {
        // Ambos presentes: display compacto "Femenino · 28 años"
        _atFechaNacimiento = fechaVal;
        const edad = _calcEdad(fechaVal, fechaRef);
        const edadStr = edad !== null ? `${edad} años` : 'edad desconocida';
        _atToggleReadonly('atSexo', true, `${labels[sexoVal] || sexoVal} · ${edadStr}`);
        _atToggleReadonly('atFechaNacimiento', false);
        if (atFechaNacRow) atFechaNacRow.style.display = 'none';
    } else if (sexoVal !== 'no_especificado') {
        // Solo sexo: sexo readonly, fecha editable
        _atFechaNacimiento = '';
        _atToggleReadonly('atSexo', true, labels[sexoVal] || sexoVal);
        _atToggleReadonly('atFechaNacimiento', false);
        if (atFechaNacRow) atFechaNacRow.style.display = '';
    } else {
        // Ninguno: ambos editables
        _atFechaNacimiento = '';
        _atToggleReadonly('atSexo', false);
        _atToggleReadonly('atFechaNacimiento', false);
        if (atFechaNacRow) atFechaNacRow.style.display = '';
    }
}

function _atToggleReadonly(fieldId, isReadonly, value = '') {
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

// ---- Helpers edad ----

function _calcEdad(fechaNacStr, fechaRefStr) {
    if (!fechaNacStr || !fechaRefStr) return null;
    const nac = new Date(fechaNacStr + 'T00:00:00');
    const ref = new Date(fechaRefStr + 'T00:00:00');
    if (isNaN(nac) || isNaN(ref)) return null;
    let edad = ref.getFullYear() - nac.getFullYear();
    const m = ref.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < nac.getDate())) edad--;
    return edad >= 0 ? edad : null;
}

function _atActualizarSexoEdadDisplay() {
    const fechaRef = document.getElementById('atFechaInicio').value;
    if (!_atFechaNacimiento || !fechaRef) return;
    const edad = _calcEdad(_atFechaNacimiento, fechaRef);
    const sexoEl = document.getElementById('atSexo');
    const sexoVal = sexoEl ? sexoEl.value : '';
    const labels = { masculino: 'Masculino', femenino: 'Femenino', otro: 'Otro' };
    const edadStr = edad !== null ? `${edad} años` : 'edad desconocida';
    const rdSexo = document.getElementById('atSexo-readonly');
    if (rdSexo) rdSexo.textContent = `${labels[sexoVal] || sexoVal} · ${edadStr}`;
}

// ---- Helper: escapar HTML ----

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ---- Helpers errores sesión ----

function setSesError(fieldId, message) {
    const el    = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (el)    el.classList.toggle('is-invalid', !!message);
    if (errEl) errEl.textContent = message || '';
}

function clearSesErrors() {
    document.querySelectorAll('#sesionModalBody .field-error').forEach(el => { el.textContent = ''; });
    document.querySelectorAll('#sesionModalBody .is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

// ---- Render del cuerpo del modal de sesión ----

// Panel de contexto clínico (lado izquierdo del modal split)
function _renderContextoClinico(a) {
    const panel = document.getElementById('sesionCtxPanel');
    if (!panel || !a) { if (panel) panel.innerHTML = ''; return; }

    const esGrupal = ['pareja', 'familiar', 'grupal'].includes((a.subservicio_modalidad || '').toLowerCase());
    const chevronSvg = '<svg class="ctx-chevron" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 3 11 8 5 13"/></svg>';

    // 1. Datos de la atención
    let atencionHtml = '';
    if (a.motivo_consulta) atencionHtml += `<p><strong>Motivo:</strong> ${escapeHtml(a.motivo_consulta)}</p>`;
    if (a.antecedentes_relevantes) atencionHtml += `<p><strong>Antecedentes:</strong> ${escapeHtml(a.antecedentes_relevantes)}</p>`;
    if (a.recomendaciones) atencionHtml += `<p><strong>Recomendaciones:</strong> ${escapeHtml(a.recomendaciones)}</p>`;
    if (a.observacion_general) atencionHtml += `<p><strong>Obs. general:</strong> ${escapeHtml(a.observacion_general)}</p>`;
    if (a.observacion_conducta) atencionHtml += `<p><strong>Obs. conducta:</strong> ${escapeHtml(a.observacion_conducta)}</p>`;
    if (!atencionHtml) atencionHtml = '<span class="ctx-empty">Sin datos registrados</span>';

    // 2. Diagnósticos
    const dxs = Array.isArray(a.diagnosticos) ? a.diagnosticos : [];
    let dxHtml = '';
    if (dxs.length) {
        dxHtml = dxs.map(d => `
            <div class="ctx-dx">
                <span class="ctx-dx-code">${escapeHtml(d.cie10_codigo)}</span>
                <span class="ctx-dx-desc">${escapeHtml(d.descripcion_corta || d.descripcion || '')}</span>
            </div>`).join('');
    } else {
        dxHtml = '<span class="ctx-empty">Sin diagnósticos</span>';
    }

    // 3. Historial de sesiones (últimas 3, más recientes primero)
    const sesiones = esGrupal
        ? (Array.isArray(a.sesiones_grupo) ? [...a.sesiones_grupo] : [])
        : (Array.isArray(a.sesiones) ? [...a.sesiones] : []);
    const totalSesiones = sesiones.length;
    // Sort by session number descending
    sesiones.sort((a, b) => (b.numero_sesion || 0) - (a.numero_sesion || 0));
    const visibles = sesiones.slice(0, 3);
    const hayMas = totalSesiones > 3;

    let sesHtml = '';
    if (visibles.length) {
        sesHtml = visibles.map(s => {
            const fecha = s.fecha_hora ? s.fecha_hora.replace('T', ' ').slice(0, 16) : '—';
            const dur = s.duracion_min ? `${s.duracion_min} min` : '';
            const nota = esGrupal
                ? (s.nota_clinica_compartida || '')
                : (s.nota_clinica || '');
            const notaHtml = nota
                ? `<div class="ctx-sesion-nota" onclick="this.classList.toggle('expanded')">${escapeHtml(nota)}</div>`
                : '';
            const estadoMap = { realizada: '✓', programada: '◷', cancelada: '✕', no_asistio: '○' };
            const estadoIcon = estadoMap[s.estado] || '';
            return `
                <div class="ctx-sesion">
                    <div class="ctx-sesion-header">
                        <span>${estadoIcon} Sesión #${s.numero_sesion || '—'}</span>
                        <span style="color:var(--color-text-muted)">${fecha} · ${dur}</span>
                    </div>
                    ${notaHtml}
                </div>`;
        }).join('');
        if (hayMas) {
            sesHtml += `<span class="ctx-ver-mas" onclick="_ctxExpandirSesiones()">Ver ${totalSesiones - 3} sesiones más…</span>`;
            // Store all sessions for expansion
            window._ctxAllSessions = sesiones;
            window._ctxEsGrupal = esGrupal;
        }
    } else {
        sesHtml = '<span class="ctx-empty">Sin sesiones previas</span>';
    }

    // 4. Tareas
    const tareas = Array.isArray(a.tareas) ? a.tareas : [];
    let tareasHtml = '';
    if (tareas.length) {
        const pendientes = tareas.filter(t => t.estado !== 'completada');
        const completadas = tareas.filter(t => t.estado === 'completada');
        const toShow = [...pendientes, ...completadas].slice(0, 5);
        tareasHtml = toShow.map(t => {
            const isPendiente = t.estado !== 'completada';
            const icon = isPendiente ? '☐' : '☑';
            const statusColor = isPendiente
                ? 'background:rgba(232,184,75,.15);color:#9A7010'
                : 'background:rgba(42,127,143,.12);color:#1B5C6B';
            const statusLabel = t.estado === 'completada' ? 'Hecho'
                : t.estado === 'respondida' ? 'Respondida'
                : 'Pendiente';
            return `
                <div class="ctx-tarea">
                    <span class="ctx-tarea-icon">${icon}</span>
                    <span class="ctx-tarea-title" style="${isPendiente ? '' : 'text-decoration:line-through;color:var(--color-text-muted)'}">${escapeHtml(t.titulo || t.descripcion || '')}</span>
                    <span class="ctx-tarea-status" style="${statusColor}">${statusLabel}</span>
                </div>`;
        }).join('');
        if (tareas.length > 5) {
            tareasHtml += `<span class="ctx-ver-mas">y ${tareas.length - 5} más</span>`;
        }
    } else {
        tareasHtml = '<span class="ctx-empty">Sin tareas asignadas</span>';
    }

    // 5. Info de atención (header)
    const modalidadBadge = esGrupal
        ? `<span style="display:inline-block;padding:1px 7px;border-radius:9px;font-size:10px;font-weight:600;color:#fff;background:${
            {pareja:'#3498DB',familiar:'#27AE60',grupal:'#8E44AD'}[a.subservicio_modalidad?.toLowerCase()] || '#6C757D'
          }">${a.subservicio_modalidad || ''}</span>`
        : '';

    panel.innerHTML = `
        <div class="ctx-panel-title">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 4h12M2 8h8M2 12h10"/>
            </svg>
            Contexto clínico
        </div>

        <div style="padding:8px 10px;margin-bottom:8px;background:var(--color-surface);border-radius:8px;border:.5px solid var(--color-border)">
            <p style="margin:0 0 2px;font-weight:600;font-size:.8rem">${escapeHtml(a.paciente || '')} ${modalidadBadge}</p>
            <p style="margin:0;font-size:.72rem;color:var(--color-text-muted)">
                ${escapeHtml(a.servicio || '')} — ${escapeHtml(a.subservicio || '')}
                ${a.numero_sesiones_plan ? ` · Plan: ${a.numero_sesiones_plan} ses.` : ''}
            </p>
        </div>

        <div class="ctx-section" id="ctxSeccionAtencion">
            <div class="ctx-section-header" onclick="this.parentElement.classList.toggle('collapsed')">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v12M3 7l5-5 5 5"/></svg>
                Datos de la atención
                ${chevronSvg}
            </div>
            <div class="ctx-section-body">${atencionHtml}</div>
        </div>

        <div class="ctx-section" id="ctxSeccionDx">
            <div class="ctx-section-header" onclick="this.parentElement.classList.toggle('collapsed')">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><line x1="8" y1="5" x2="8" y2="9"/><circle cx="8" cy="11.5" r=".5" fill="currentColor" stroke="none"/></svg>
                Diagnósticos (${dxs.length})
                ${chevronSvg}
            </div>
            <div class="ctx-section-body">${dxHtml}</div>
        </div>

        <div class="ctx-section" id="ctxSeccionSesiones">
            <div class="ctx-section-header" onclick="this.parentElement.classList.toggle('collapsed')">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="1"/><line x1="2" y1="6" x2="14" y2="6"/><line x1="5" y1="1" x2="5" y2="3"/><line x1="11" y1="1" x2="11" y2="3"/></svg>
                Sesiones anteriores (${totalSesiones})
                ${chevronSvg}
            </div>
            <div class="ctx-section-body" id="ctxSesionesBody">${sesHtml}</div>
        </div>

        <div class="ctx-section" id="ctxSeccionTareas">
            <div class="ctx-section-header" onclick="this.parentElement.classList.toggle('collapsed')">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 8 6 12 14 4"/></svg>
                Tareas (${tareas.length})
                ${chevronSvg}
            </div>
            <div class="ctx-section-body">${tareasHtml}</div>
        </div>
    `;
}

// Expand to show all sessions in context panel
function _ctxExpandirSesiones() {
    const body = document.getElementById('ctxSesionesBody');
    if (!body || !window._ctxAllSessions) return;
    const esGrupal = window._ctxEsGrupal;
    const sesiones = window._ctxAllSessions;
    const estadoMap = { realizada: '✓', programada: '◷', cancelada: '✕', no_asistio: '○' };

    body.innerHTML = sesiones.map(s => {
        const fecha = s.fecha_hora ? s.fecha_hora.replace('T', ' ').slice(0, 16) : '—';
        const dur = s.duracion_min ? `${s.duracion_min} min` : '';
        const nota = esGrupal ? (s.nota_clinica_compartida || '') : (s.nota_clinica || '');
        const notaHtml = nota
            ? `<div class="ctx-sesion-nota" onclick="this.classList.toggle('expanded')">${escapeHtml(nota)}</div>`
            : '';
        const estadoIcon = estadoMap[s.estado] || '';
        return `
            <div class="ctx-sesion">
                <div class="ctx-sesion-header">
                    <span>${estadoIcon} Sesión #${s.numero_sesion || '—'}</span>
                    <span style="color:var(--color-text-muted)">${fecha} · ${dur}</span>
                </div>
                ${notaHtml}
            </div>`;
    }).join('');
}

// Toggle mobile context panel
function _toggleCtxPanel() {
    const panel = document.getElementById('sesionCtxPanel');
    if (panel) panel.classList.toggle('ctx-mobile-open');
}



function _renderBodyIndividual(atencionId, ctx) {
    const a               = _currentAtencion;
    const numSig          = ctx.numero_sesion_siguiente;
    const precioRef       = ctx.precio_referencia;
    const descVirtual     = ctx.descuento_virtual ?? 10;
    const paquete         = ctx.paquete_activo;
    const adelanto        = ctx.adelanto_activo;
    const durDefecto      = a?.duracion_min || 50;

    const precioLocked = !!(paquete || adelanto || _sesionCitaOrigen);
    const modalidadValue = _sesionCitaOrigen?.modalidad || (a?.subservicio_modalidad || 'individual').toLowerCase();
    const precioValue = _sesionCitaOrigen ? parseFloat(_sesionCitaOrigen.precio) : (paquete ? paquete.precio_por_sesion : precioRef);

    // ── 1. Encabezado Informativo (Contexto fijo) ──────────────────────────────
    let infoExtraHtml = '';
    if (precioLocked) {
        let detallePrecio = `<strong>S/ ${precioValue.toFixed(2)}</strong>`;
        if (paquete) {
            detallePrecio = `
                <div style="display:flex;flex-direction:column;gap:2px">
                    <span style="font-size:1.1rem;font-weight:700;color:var(--color-primary)">S/ ${precioValue.toFixed(2)}</span>
                    <span style="font-size:11px;color:#7B5EA7;display:flex;align-items:center;gap:4px">
                        <span style="background:#7B5EA7;color:#fff;padding:1px 5px;border-radius:4px;font-weight:700;font-size:9px">PAQUETE</span>
                        ${escapeHtml(paquete.nombre)} (${paquete.sesiones_restantes} rest.)
                    </span>
                </div>`;
        } else if (adelanto) {
            detallePrecio = `
                <div style="display:flex;flex-direction:column;gap:2px">
                    <span style="font-size:1.1rem;font-weight:700;color:#B8860B">S/ ${precioValue.toFixed(2)}</span>
                    <span style="font-size:11px;color:#B8860B;display:flex;align-items:center;gap:4px">
                        <span style="background:#B8860B;color:#fff;padding:1px 5px;border-radius:4px;font-weight:700;font-size:9px">CRÉDITO</span>
                        Saldo: S/ ${adelanto.saldo_disponible.toFixed(2)}
                    </span>
                </div>`;
        }

        infoExtraHtml = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--color-border)">
                <div style="display:flex;gap:20px;align-items:center">
                    <div style="display:flex;flex-direction:column">
                        <span style="font-size:10px;text-transform:uppercase;color:var(--color-text-muted);font-weight:600;letter-spacing:.05em">N° Sesión</span>
                        <span style="font-size:1.4rem;font-weight:800;color:var(--color-primary);line-height:1">#${numSig}</span>
                    </div>
                    <div style="display:flex;flex-direction:column">
                        <span style="font-size:10px;text-transform:uppercase;color:var(--color-text-muted);font-weight:600;letter-spacing:.05em">Modalidad</span>
                        <span style="background:var(--color-bg);border:1px solid var(--color-border);padding:2px 8px;border-radius:6px;font-size:12px;font-weight:600;text-transform:capitalize;margin-top:2px">
                            ${modalidadValue === 'virtual' ? '🌐 Virtual' : '🏠 Presencial'}
                        </span>
                    </div>
                </div>
                <div style="text-align:right">
                    <span style="font-size:10px;text-transform:uppercase;color:var(--color-text-muted);font-weight:600;letter-spacing:.05em;display:block;margin-bottom:2px">Inversión</span>
                    ${detallePrecio}
                </div>
            </div>`;
    }

    const headerRow = `
        <input type="hidden" id="sesionAtencionId" value="${atencionId}">
        <input type="hidden" id="sesionNumero" value="${numSig}">
        <input type="hidden" id="sesionModalidad" value="${modalidadValue}">
        <input type="hidden" id="sesionPrecio" value="${precioValue}">
        ${paquete ? `<input type="hidden" id="sesionPaqueteId" value="${paquete.id}"><input type="hidden" id="sesionPaqueteNombre" value="${escapeHtml(paquete.nombre)}"><input type="hidden" id="sesionPaqueteRestantes" value="${paquete.sesiones_restantes}">` : ''}
        ${adelanto ? `<input type="hidden" id="sesionAdelantoId" value="${adelanto.id}">` : ''}
        <input type="hidden" id="sesionDescuentoVirtual" value="${descVirtual}">
        <input type="hidden" id="sesionPrecioRef" value="${precioRef}">

        <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:14px;margin-bottom:20px;box-shadow:var(--shadow-sm)">
            <p style="margin:0 0 4px;font-size:1.05rem"><strong>${escapeHtml(a?.paciente || '')}</strong></p>
            <p style="margin:0 0 2px;color:var(--color-text-muted);font-size:.85rem">Profesional: ${escapeHtml(a?.profesional || '')}</p>
            <p style="margin:0;color:var(--color-text-muted);font-size:.85rem">Servicio: ${escapeHtml(a?.subservicio || '')} (${a?.subservicio_modalidad || 'individual'})</p>
            ${infoExtraHtml}
        </div>`;

    // ── 2. Campos editables (Solo si NO hay contexto de cita/bloqueo) ───────────
    let fieldsBlock = '';
    if (!precioLocked) {
        fieldsBlock = `
            <div class="form-row">
                <div class="form-group" style="flex:0 0 100px">
                    <label>N° sesión</label>
                    <input type="number" value="${numSig}" readonly class="readonly-field" style="text-align:center">
                </div>
                <div class="form-group" style="flex:1">
                    <label>Modalidad</label>
                    <div style="display:flex;gap:8px">
                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.875rem;padding:6px 12px;border-radius:var(--radius);border:1px solid var(--color-border);background:var(--color-surface)" id="lblPresencial">
                            <input type="radio" name="sesionModalidad" value="presencial" checked onchange="_onSesionModalidadChange()" style="accent-color:var(--color-primary)">
                            Presencial
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.875rem;padding:6px 12px;border-radius:var(--radius);border:1px solid var(--color-border);background:var(--color-surface)" id="lblVirtual">
                            <input type="radio" name="sesionModalidad" value="virtual" onchange="_onSesionModalidadChange()" style="accent-color:var(--color-primary)">
                            Virtual
                        </label>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label class="required">Precio de la sesión (S/)</label>
                <input id="sesionPrecioEditable" type="number" min="0" step="0.01" value="${precioRef.toFixed(2)}" oninput="document.getElementById('sesionPrecio').value = this.value">
                <span class="field-hint">Sugerido del plan de atención. Puedes ajustarlo.</span>
                <span class="field-error" id="sesionPrecio-error"></span>
            </div>`;
    }

    // ── 4. Duración + Fecha/Hora ───────────────────────────────────────────────
    const camposBase = `
        <div class="form-row">
            <div class="form-group">
                <label class="required">Duración (min)</label>
                <input id="sesionDuracion" type="number" min="1" value="${durDefecto}" placeholder="50">
                <span class="field-error" id="sesionDuracion-error"></span>
            </div>
            <div class="form-group">
                <label class="required">Fecha y hora</label>
                <input id="sesionFechaHora" type="datetime-local" value="${_localDatetime()}">
                <span class="field-error" id="sesionFechaHora-error"></span>
            </div>
        </div>
        <input type="hidden" id="sesionEstado" value="realizada">`;

    // ── 5. Nota clínica ────────────────────────────────────────────────────────
    const notaBlock = `
        <div class="form-group">
            <label>Nota clínica</label>
            <textarea id="sesionNota" rows="4" placeholder="Observaciones clínicas de la sesión…"></textarea>
        </div>`;

    document.getElementById('sesionModalBody').innerHTML =
        headerRow + fieldsBlock + camposBase + notaBlock +
        _adjHtmlDropZone('adjDrop', 'adjInput', 'adjPendientes') +
        _tareasInlineHtml();

    _adjPendientes = [];
    requestAnimationFrame(() => _adjIniciarDropZone('adjDrop', 'adjInput', 'adjPendientes'));
}

function _onSesionModalidadChange() {
    const esVirtual = document.getElementById('sesionModalidadVirtual')?.checked;
    const refEl     = document.getElementById('sesionPrecioRef');
    const descEl    = document.getElementById('sesionDescuentoVirtual');
    const precioEl  = document.getElementById('sesionPrecio');
    if (!refEl || !precioEl) return;
    const base = parseFloat(refEl.value) || 0;
    const desc = esVirtual ? (parseFloat(descEl?.value) || 0) : 0;
    precioEl.value = Math.max(0, base - desc).toFixed(2);
}

function _renderBodyGrupal(a, siguienteNum, modalidad, sgExistente, notasPrivadas = {}) {
    const participantes  = _sesionParticipantes;
    const badgeColor     = {pareja:'#3498DB', familiar:'#27AE60', grupal:'#8E44AD'}[modalidad] || '#6C757D';
    const modalidadLabel = {pareja:'Pareja', familiar:'Familiar', grupal:'Grupal'}[modalidad] || modalidad;
    const lockIcon = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="10" height="7" rx="1"/><path d="M5 8V5a3 3 0 0 1 6 0v3"/></svg>`;

    const numSesion = sgExistente ? (sgExistente.numero_sesion || '—') : (siguienteNum ?? '—');
    const duracion  = sgExistente ? (sgExistente.duracion_min ?? 50) : 50;

    const notaCompartida = sgExistente?.nota_clinica_compartida || '';

    const notaPrivadaBlock = (p, valor) => `
        <div class="form-group">
            <label style="display:flex;align-items:center;gap:4px">${lockIcon} Observación privada — ${escapeHtml(p.paciente || 'Participante')}</label>
            <span style="display:block;font-size:11px;color:var(--color-text-muted);margin-bottom:4px">Solo visible para el profesional tratante. No aparece en el expediente del paciente ni en el PDF.</span>
            <textarea id="sgNotaPriv_${p.atencion_id}" rows="3" class="textarea-privado">${escapeHtml(valor || '')}</textarea>
        </div>`;

    let notasPrivadasHtml = '';
    participantes.forEach(p => {
        notasPrivadasHtml += notaPrivadaBlock(p, notasPrivadas[p.atencion_id] || '');
    });

    const hiddenFields = sgExistente
        ? `<input type="hidden" id="sesionGrupalId" value="${sgExistente.id}">`
        : `<input type="hidden" id="sesionAtencionId" value="${a.id}">`;

    const campoDuracion = sgExistente
        ? `<label>Duración (min)</label>
           <input type="text" value="${duracion}" readonly class="readonly-field">`
        : `<label class="required">Duración (min)</label>
           <input id="sesionDuracion" type="number" min="1" value="${duracion}" placeholder="50">
           <span class="field-error" id="sesionDuracion-error"></span>`;

    document.getElementById('sesionModalBody').innerHTML = `
        ${hiddenFields}

        <div style="background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius);padding:12px;margin-bottom:16px;font-size:.875rem">
            <p style="margin:0 0 4px"><strong>${escapeHtml(a?.paciente || '')}</strong></p>
            <p style="margin:0 0 2px;color:var(--color-text-muted)">Profesional: ${escapeHtml(a?.profesional || '')}</p>
            <p style="margin:0 0 2px;color:var(--color-text-muted)">Servicio: ${escapeHtml(a?.subservicio || '')}</p>
            <p style="margin:0;color:var(--color-text-muted)">Proceso: ${escapeHtml(_sesionVinculoNombre || 'Proceso grupal')}
                <span style="display:inline-block;margin-left:4px;padding:1px 7px;border-radius:9px;font-size:11px;font-weight:600;color:#fff;background:${badgeColor}">${modalidadLabel}</span>
            </p>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label>N° sesión</label>
                <input type="text" value="${numSesion}" readonly class="readonly-field">
            </div>
            <div class="form-group">
                ${campoDuracion}
            </div>
        </div>

        <p style="font-size:11px;color:var(--color-text-muted);margin:0 0 14px;display:flex;align-items:flex-start;gap:5px">
            ${lockIcon}
            <span>La fecha y hora se registrarán automáticamente al guardar. Las observaciones privadas son confidenciales y no se comparten entre participantes.</span>
        </p>

        <div class="form-group">
            <label>Nota de sesión</label>
            <span style="display:block;font-size:11px;color:var(--color-text-muted);margin-bottom:4px">Visible para todos los participantes del proceso y en el historial clínico.</span>
            <textarea id="sgNotaCompartida" rows="4" placeholder="Dinámica grupal, hallazgos generales, intervenciones de la sesión…">${escapeHtml(notaCompartida)}</textarea>
        </div>

        <div style="display:flex;align-items:center;gap:8px;margin:16px 0">
            <div style="flex:1;border-top:.5px solid var(--color-border)"></div>
            <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-muted);display:flex;align-items:center;gap:4px;white-space:nowrap">
                ${lockIcon} Observaciones clínicas privadas
            </span>
            <div style="flex:1;border-top:.5px solid var(--color-border)"></div>
        </div>

        ${notasPrivadasHtml}
        ${_adjHtmlDropZone('adjDrop', 'adjInput', 'adjPendientes', 'adjExistentes')}
        ${_tareasInlineHtml()}
    `;
    _adjPendientes = [];
    requestAnimationFrame(() => _adjIniciarDropZone('adjDrop', 'adjInput', 'adjPendientes'));
}

// ---- Modal nueva sesión ----

let _sesionCitaOrigen = null; // Contexto de cita para vincular y heredar datos

async function abrirModalSesion(atencionId, siguienteNum, citaContext = null) {
    _sesionCitaOrigen = citaContext;
    
    // Reset tareas inline
    const body = document.getElementById('sesionModalBody');
    if (body) {
        const tareasSec = body.querySelector('.tareas-inline-section');
        if (tareasSec && typeof _resetTareasInline === 'function') _resetTareasInline(tareasSec);
    }
    const a         = _currentAtencion;
    const modalidad = (a?.subservicio_modalidad || 'individual').toLowerCase();
    const esGrupal  = ['pareja', 'familiar', 'grupal'].includes(modalidad);

    _sesionModo          = 'nueva';
    _sesionModalidad     = modalidad;
    _sesionVinculoId     = a?.vinculo_id || null;
    _sesionGrupalId      = null;
    _sesionParticipantes = [];
    _sesionVinculoNombre = '';

    if (esGrupal) {
        if (_sesionVinculoId) {
            const vRes = await api('/api/vinculo?id=' + _sesionVinculoId);
            if (vRes.success) {
                _sesionParticipantes = vRes.data.participantes || [];
                _sesionVinculoNombre = vRes.data.nombre_grupo || vRes.data.tipo_vinculo || 'Proceso grupal';
            }
        }
        document.getElementById('sesionModalTitle').textContent = 'Nueva sesión grupal';
        document.getElementById('sesionGuardarBtn').textContent = 'Registrar sesión';
        _renderBodyGrupal(a, siguienteNum, modalidad, null);
    } else {
        document.getElementById('sesionModalTitle').textContent = 'Nueva Sesión';
        document.getElementById('sesionGuardarBtn').textContent = 'Registrar sesión';

        const ctxRes = await api(
            `/api/sesiones/contexto?paciente_id=${a.paciente_id}&atencion_id=${atencionId}`
        );
        let paqueteFallback = null;
        if (window._atPaqueteActivo) {
            const p = window._atPaqueteActivo;
            const sesInc = parseInt(p.sesiones_incluidas) || 0;
            const precio = parseFloat(p.precio_paquete)   || 0;
            paqueteFallback = {
                id:                 p.id,
                nombre:             p.nombre_paquete || '',
                sesiones_restantes: parseInt(p.sesiones_restantes) || 0,
                precio_por_sesion:  sesInc > 0 ? Math.round((precio / sesInc) * 100) / 100 : 0,
            };
        }
        const ctx = ctxRes.success ? ctxRes.data : {
            precio_referencia:       0,
            descuento_virtual:       10,
            paquete_activo:          paqueteFallback,
            adelanto_activo:         null,
            numero_sesion_siguiente: siguienteNum,
        };
        _renderBodyIndividual(atencionId, ctx);
    }
    // Populate clinical context panel
    _renderContextoClinico(a);

    // Herencia de datos si viene de una Cita
    if (_sesionCitaOrigen) {
        const { precio, modalidad } = _sesionCitaOrigen;
        if (!esGrupal) {
            // Modalidad
            const radio = document.querySelector(`input[name="sesionModalidad"][value="${modalidad}"]`);
            if (radio) {
                radio.checked = true;
                _onSesionModalidadChange();
            }
            // Precio (si no está bloqueado por paquete/adelanto)
            const precioEl = document.getElementById('sesionPrecio');
            if (precioEl && !precioEl.readOnly) {
                precioEl.value = parseFloat(precio).toFixed(2);
            }
        }
    }

    // Reset mobile panel state
    const ctxP = document.getElementById('sesionCtxPanel');
    if (ctxP) ctxP.classList.remove('ctx-mobile-open');
    document.getElementById('modalSesion').classList.remove('hidden');
}

async function abrirModalEditarNotaGrupal(sgId) {
    const sg = _sgNotasMap[sgId];
    if (!sg) { showToast('Sesión no encontrada'); return; }

    const a         = _currentAtencion;
    const modalidad = (a?.subservicio_modalidad || 'grupal').toLowerCase();

    _sesionModo          = 'editar-grupal';
    _sesionModalidad     = modalidad;
    _sesionVinculoId     = a?.vinculo_id || null;
    _sesionGrupalId      = sgId;
    _sesionParticipantes = [];
    _sesionVinculoNombre = '';

    if (_sesionVinculoId) {
        const vRes = await api('/api/vinculo?id=' + _sesionVinculoId);
        if (vRes.success) {
            _sesionParticipantes = vRes.data.participantes || [];
            _sesionVinculoNombre = vRes.data.nombre_grupo || vRes.data.tipo_vinculo || 'Proceso grupal';
        }
    }

    let notasPrivadas = {};
    const npRes = await api('/api/sesiones-grupo/notas-privadas?sg_id=' + sgId);
    if (npRes.success) notasPrivadas = npRes.data || {};

    document.getElementById('sesionModalTitle').textContent = 'Editar nota de sesión';
    document.getElementById('sesionGuardarBtn').textContent = 'Guardar cambios';
    _renderBodyGrupal(a, null, modalidad, sg, notasPrivadas);
    _renderContextoClinico(a);
    const ctxP2 = document.getElementById('sesionCtxPanel');
    if (ctxP2) ctxP2.classList.remove('ctx-mobile-open');
    document.getElementById('modalSesion').classList.remove('hidden');

    // Cargar archivos existentes de la sesión grupal
    const adjExist = document.getElementById('adjExistentes');
    if (adjExist) await _adjCargarExistentes(null, sgId, 'adjExistentes');
}

async function guardarSesion() {
    if (_isSavingAtencion) return;
    _isSavingAtencion = true;

    try {
        const esGrupal = ['pareja', 'familiar', 'grupal'].includes(_sesionModalidad);

    if (esGrupal && _sesionModo === 'editar-grupal') {
        await _guardarEditarNotaGrupal();
        return;
    }
    if (esGrupal) {
        await _guardarNuevaSesionGrupal();
        return;
    }

    // Sesión individual
    clearSesErrors();
    const atencionId = parseInt(document.getElementById('sesionAtencionId').value);
    const fecha      = document.getElementById('sesionFechaHora').value;
    const duracion   = document.getElementById('sesionDuracion').value;
    const estado     = document.getElementById('sesionEstado').value;
    const nota       = document.getElementById('sesionNota').value.trim();
    const modalidad  = document.querySelector('input[name="sesionModalidad"]:checked')?.value 
                    || document.getElementById('sesionModalidad')?.value 
                    || 'presencial';
    const precio     = document.getElementById('sesionPrecio')?.value;

    let valido = true;
    if (!fecha)                                { setSesError('sesionFechaHora', 'Ingrese la fecha y hora'); valido = false; }
    if (!duracion || parseInt(duracion) < 1)  { setSesError('sesionDuracion',  'Ingrese la duración');     valido = false; }
    if (!precio || isNaN(parseFloat(precio))) { setSesError('sesionPrecio',    'Ingrese el precio');       valido = false; }
    if (!valido) return;

    const paqId      = document.getElementById('sesionPaqueteId')?.value;
    const adelantoId = document.getElementById('sesionAdelantoId')?.value;

    const payload = {
        atencion_id:               atencionId,
        cita_id:                   _sesionCitaOrigen?.id || null, // Vínculo con la cita
        fecha_hora:                fecha,
        duracion_min:              parseInt(duracion),
        modalidad_sesion:          modalidad,
        precio_sesion:             parseFloat(precio),
        estado,
        nota_clinica:              nota || null,
        paciente_paquete_id:       paqId ? parseInt(paqId) : null,
        adelanto_id:               adelantoId ? parseInt(adelantoId) : null,
        paquete_nombre:            document.getElementById('sesionPaqueteNombre')?.value || null,
        paquete_sesiones_restantes: document.getElementById('sesionPaqueteRestantes')?.value
            ? parseInt(document.getElementById('sesionPaqueteRestantes').value) : null,
        subservicio_nombre:        _currentAtencion?.subservicio || null,
    };

    const res = await api('/api/sesiones', 'POST', payload);

    if (res.success) {
        const sesionId = res.data?.id;
        if (_adjPendientes.length) await _adjSubirPendientes(sesionId, null);

        const tareasSection = document.querySelector('#modalSesion .tareas-inline-section');
        const tareasPend    = _recolectarTareasInline(tareasSection);
        if (sesionId && tareasPend.length) await _crearTareasPendientes(sesionId, tareasPend);

        cerrarModal('modalSesion');
        verDetalleAtencion(atencionId, _atencionBack);
        showToast(res.message || 'Sesión registrada');
    } else {
        showToast(res.message || 'Error al guardar sesión');
    }
    } finally {
        _isSavingAtencion = false;
    }
}

async function _guardarNuevaSesionGrupal() {
    // Note: Flag handled by caller (guardarSesion)
    const duracion = document.getElementById('sesionDuracion')?.value;
    if (!duracion || parseInt(duracion) < 1) {
        setSesError('sesionDuracion', 'Ingrese la duración');
        return;
    }

    const notaCompartida = document.getElementById('sgNotaCompartida')?.value.trim() || null;
    const notasPrivadas = {};
    (_sesionParticipantes || []).forEach(p => {
        const campo = document.getElementById('sgNotaPriv_' + p.atencion_id);
        if (campo?.value.trim()) notasPrivadas[p.atencion_id] = campo.value.trim();
    });

    const atencionId = _currentAtencion?.id;
    const res = await api('/api/sesiones-grupo', 'POST', {
        vinculo_id:              _sesionVinculoId,
        cita_id:                 _sesionCitaOrigen?.id || null,
        duracion_min:            parseInt(duracion),
        nota_clinica_compartida: notaCompartida,
        notas_privadas:          notasPrivadas,
    });

    if (res.success) {
        const sesionId = res.data?.id;
        const titularSesionId = res.data?.titular_sesion_id || sesionId;
        if (_adjPendientes.length) await _adjSubirPendientes(null, sesionId);

        // Tareas (vinculadas al titular de la sesión grupal)
        const tareasSection = document.querySelector('#modalSesion .tareas-inline-section');
        const tareasPend    = _recolectarTareasInline(tareasSection);
        if (titularSesionId && tareasPend.length) await _crearTareasPendientes(titularSesionId, tareasPend);

        showToast('Sesión grupal registrada');
        cerrarModal('modalSesion');
        if (_sesionVinculoId) {
            verDetalleVinculo(_sesionVinculoId, _atencionBack);
        } else {
            verDetalleAtencion(atencionId, _atencionBack);
        }
    } else {
        showToast(res.message || 'Error al registrar sesión grupal');
    }
}

async function _guardarEditarNotaGrupal() {
    const notaCompartida = document.getElementById('sgNotaCompartida')?.value.trim() || null;
    const notasPrivadas = {};
    (_sesionParticipantes || []).forEach(p => {
        const campo = document.getElementById('sgNotaPriv_' + p.atencion_id);
        if (campo?.value.trim()) notasPrivadas[p.atencion_id] = campo.value.trim();
    });

    const atencionId = _currentAtencion?.id;
    const res = await api('/api/sesiones-grupo/nota', 'PUT', {
        id:                      _sesionGrupalId,
        nota_clinica_compartida: notaCompartida,
        notas_privadas:          notasPrivadas,
    });

    if (res.success) {
        if (_adjPendientes.length) await _adjSubirPendientes(null, _sesionGrupalId);
        showToast('Nota actualizada');
        cerrarModal('modalSesion');
        if (_sesionVinculoId) {
            verDetalleVinculo(_sesionVinculoId, _atencionBack);
        } else {
            verDetalleAtencion(atencionId, _atencionBack);
        }
    } else {
        showToast(res.message || 'Error al actualizar nota');
    }
}

// ---- Modal editar nota clínica ----

async function abrirModalEditarNota(sesionId) {
    const nota = _sesionNotasMap[sesionId] || '';
    document.getElementById('editNotaSesionId').value     = sesionId;
    document.getElementById('editNotaContenido').value    = nota;
    document.getElementById('editNotaContenido').classList.remove('is-invalid');
    document.getElementById('editNota-error').textContent = '';
    _adjPendientes = [];

    // Inyectar sección adjuntos si no existe aún
    let adjWrap = document.getElementById('editNotaAdjuntosWrap');
    if (!adjWrap) {
        adjWrap = document.createElement('div');
        adjWrap.id = 'editNotaAdjuntosWrap';
        document.getElementById('editNotaContenido').parentElement.after(adjWrap);
    }
    adjWrap.innerHTML =
        '<div id="editNotaExistentes"></div>' +
        _adjHtmlDropZone('editAdjDrop', 'editAdjInput', 'editAdjPendientes');

    document.getElementById('modalEditarNota').classList.remove('hidden');
    requestAnimationFrame(() => _adjIniciarDropZone('editAdjDrop', 'editAdjInput', 'editAdjPendientes'));
    await _adjCargarExistentes(sesionId, null, 'editNotaExistentes');
}

async function guardarNotaSesion() {
    if (_isSavingAtencion) return;
    _isSavingAtencion = true;

    try {
        const id   = parseInt(document.getElementById('editNotaSesionId').value);
    const nota = document.getElementById('editNotaContenido').value.trim();

    if (!nota) {
        document.getElementById('editNotaContenido').classList.add('is-invalid');
        document.getElementById('editNota-error').textContent = 'La nota no puede estar vacía';
        return;
    }

    const res = await api('/api/sesiones/nota', 'PUT', { id, nota_clinica: nota });

    if (res.success) {
        if (_adjPendientes.length) await _adjSubirPendientes(id, null);
        showToast('Nota actualizada');
        cerrarModal('modalEditarNota');
        verDetalleAtencion(_currentAtencionId, _atencionBack);
    } else {
        showToast(res.message || 'Error al actualizar nota');
    }
    } finally {
        _isSavingAtencion = false;
    }
}

// ---- Nueva tarea desde detalle de atención ----

function abrirModalTareaDesdeAtencion() {
    const sesiones = window._atencionSesiones || [];
    const sel = document.getElementById('tareaSesionSelect');
    sel.innerHTML = sesiones.length > 0
        ? sesiones.map(s => `<option value="${s.id}">Sesión ${s.numero_sesion} — ${s.fecha_hora ? s.fecha_hora.replace('T',' ').slice(0,16) : ''}</option>`).join('')
        : '<option value="">Sin sesiones disponibles</option>';

    ['tareaTitulo','tareaDescripcion','tareaFechaLimite'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('tareaEstadoInicial').value    = 'pendiente';
    document.getElementById('tareaTituloError').textContent = '';
    document.getElementById('tareaTitulo').classList.remove('is-invalid');
    document.getElementById('modalTarea').classList.remove('hidden');
}

// ---- Sección de vínculo grupal en el modal de nueva atención ----

function _toggleVinculoSection(modalidad) {
    const section    = document.getElementById('atVinculoSection');
    const esGrupal   = ['pareja','familiar','grupal'].includes(modalidad);
    section.style.display = esGrupal ? '' : 'none';
    if (!esGrupal) {
        const radioNinguno = document.querySelector('input[name="atVinculoOpcion"][value="ninguno"]');
        if (radioNinguno) radioNinguno.checked = true;
        _onVinculoRadioChange('ninguno');
    }
}

function _onVinculoRadioChange(valor) {
    document.getElementById('atVinculoExistenteBox').style.display = valor === 'existente' ? '' : 'none';
    document.getElementById('atVinculoNuevoBox').style.display     = valor === 'nuevo'     ? '' : 'none';

    if (valor === 'existente') {
        _cargarVinculosEnSelect();
    }
}

async function _cargarVinculosEnSelect() {
    const sel = document.getElementById('atVinculoSelect');
    sel.innerHTML = '<option value="">Cargando…</option>';
    const res = await api('/api/vinculos');
    sel.innerHTML = '<option value="">Seleccionar proceso grupal…</option>';
    if (res.data) {
        res.data.filter(v => v.estado === 'activo').forEach(v => {
            const tipoLabel = { pareja:'Pareja', familiar:'Familiar', grupal:'Grupal', taller:'Taller' }[v.tipo] || v.tipo;
            sel.innerHTML += `<option value="${v.id}">[${tipoLabel}] ${v.nombre} — ${v.profesional}</option>`;
        });
    }
}

// Llamado inline desde la tabla de tareas en el detalle de atención
async function cambiarEstadoTareaEnAtencion(tareaId, nuevoEstado) {
    const res = await api('/api/tareas/estado', 'PUT', { id: tareaId, estado: nuevoEstado });
    if (res.success) {
        showToast('Estado actualizado');
        if (_currentAtencionId) verDetalleAtencion(_currentAtencionId, _atencionBack);
    } else {
        showToast(res.message || 'Error al actualizar estado');
        if (_currentAtencionId) verDetalleAtencion(_currentAtencionId, _atencionBack);
    }
}

// ---- Modal nueva atención ----

async function guardarAtencion() {
    if (_isSavingAtencion) return;
    _isSavingAtencion = true;

    try {
        clearAtErrors();

    const esProfAt      = getUser()?.rol === 'profesional';
    const pacienteId    = document.getElementById('atPaciente').value;
    const profesionalId = esProfAt ? null : document.getElementById('atProfesional').value;
    const subservicioId = document.getElementById('atSubservicio').value;
    const fechaInicio   = document.getElementById('atFechaInicio').value;
    const motivo        = document.getElementById('atMotivoConsulta').value.trim();
    const sesionesPlan  = document.getElementById('atNumeroSesionesPlan').value.trim();

    let valido = true;

    if (!pacienteId)                 { setAtError('atPaciente',          'Seleccione un paciente');                 valido = false; }
    if (!esProfAt && !profesionalId) { setAtError('atProfesional',       'Seleccione un profesional');              valido = false; }
    if (!subservicioId)              { setAtError('atSubservicio',        'Seleccione un servicio');                 valido = false; }
    if (!fechaInicio)                { setAtError('atFechaInicio',        'Ingrese la fecha de inicio');             valido = false; }
    if (!motivo)                     { setAtError('atMotivoConsulta',     'El motivo es obligatorio');               valido = false; }
    if (!sesionesPlan || parseInt(sesionesPlan) < 1) { setAtError('atNumeroSesionesPlan', 'Ingrese el número de sesiones planificadas'); valido = false; }

    if (!valido) return;

    const data = {
        paciente_id:             parseInt(pacienteId),
        ...(esProfAt ? {} : { profesional_id: parseInt(profesionalId) }),
        subservicio_id:          parseInt(subservicioId),
        fecha_inicio:            fechaInicio,
        grado_instruccion:       document.getElementById('atGradoInstruccion').value,
        ocupacion:               document.getElementById('atOcupacion').value.trim()          || null,
        estado_civil:            document.getElementById('atEstadoCivil').value,
        sexo:                    document.getElementById('atSexo').value,
        fecha_nacimiento:        document.getElementById('atFechaNacimiento').value || null,
        edad:                    (() => { const fn = _atFechaNacimiento || document.getElementById('atFechaNacimiento').value || null; return fn ? _calcEdad(fn, fechaInicio) : null; })(),
        motivo_consulta:         motivo,
        observacion_general:     document.getElementById('atObservacionGeneral').value.trim() || null,
        antecedentes_relevantes: document.getElementById('atAntecedentes').value.trim()       || null,
        numero_sesiones_plan:    parseInt(sesionesPlan),
    };

    const res = await api('/api/atenciones', 'POST', data);
    if (!res.success) { showToast(res.message || 'Error al guardar'); return; }

    const atencionId = res.data?.id;

    // Registrar diagnósticos CIE-10 en orden (principal primero)
    const hoy = _localDate();
    for (const dx of _atDxList) {
        await api('/api/atenciones/diagnostico', 'POST', {
            atencion_id:   atencionId,
            cie10_codigo:  dx.codigo,
            jerarquia:     dx.jerarquia,
            nivel_certeza: dx.nivel_certeza,
            fecha_dx:      hoy,
        });
    }

    // Vincular a proceso grupal si el profesional lo indicó
    await _procesarVinculoPostAtencion(atencionId);

    // Tareas inline
    const sesionId = res.data?.sesion_id ?? null;
    if (sesionId && typeof _recolectarTareasInline === 'function') {
        const atTareasWrapper = document.getElementById('atTareasWrapper');
        const tareasPend = _recolectarTareasInline(atTareasWrapper);
        if (tareasPend.length) await _crearTareasPendientes(sesionId, tareasPend);
    }

    showToast('Atención creada');
    cerrarModal('modalAtencion');
    atenciones();
    } finally {
        _isSavingAtencion = false;
    }
}

// ---- Sección de paquete en detalle de atención ----


function _pqCardSinPaquete() {
    return `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h4 style="margin:0;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Paquete de sesiones</h4>
            <button class="btn-primary" style="font-size:.8rem;padding:4px 12px" onclick="abrirModalContratarPaquete()">Asignar paquete</button>
        </div>
        <p style="margin:0;font-size:.875rem;color:var(--color-text-muted)">Este paciente no tiene paquete activo asignado.</p>`;
}

function _pqCardActivo(p) {
    const utilizadas = parseInt(p.sesiones_incluidas) - parseInt(p.sesiones_restantes);
    const total      = parseInt(p.sesiones_incluidas);
    const pct        = total > 0 ? Math.round((utilizadas / total) * 100) : 0;

    const estadoBadgeMap = {
        activo:    'badge-success',
        agotado:   'badge-warning',
        vencido:   'badge-danger',
        cancelado: 'badge-danger',
    };
    const estadoBadge = estadoBadgeMap[p.estado] || '';

    return `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h4 style="margin:0;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Paquete de sesiones</h4>
            <button style="font-size:.8rem;padding:4px 12px;border:1px solid var(--color-danger);color:var(--color-danger);background:transparent;border-radius:var(--radius);cursor:pointer"
                onclick="if(confirm('¿Cancelar este paquete? La cuenta de cobro generada no se eliminará.')) cancelarPaqueteActivo(${p.id})">
                Cancelar paquete
            </button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;flex-wrap:wrap">
            <div>
                <p style="margin:0 0 4px;font-weight:600">${escapeHtml(p.nombre_paquete)}</p>
                <p style="margin:0 0 4px;font-size:.875rem;color:var(--color-text-muted)">Activación: ${p.fecha_activacion || '-'}</p>
                ${p.fecha_vencimiento ? `<p style="margin:0 0 4px;font-size:.875rem;color:var(--color-text-muted)">Vencimiento: ${p.fecha_vencimiento}</p>` : ''}
                <span class="badge ${estadoBadge}">${p.estado}</span>
            </div>
            <div>
                <p style="margin:0 0 6px;font-size:.875rem">${utilizadas} de ${total} sesiones utilizadas</p>
                <div style="height:8px;background:var(--color-border);border-radius:4px;overflow:hidden">
                    <div style="width:${pct}%;height:100%;background:#7B5EA7;border-radius:4px;transition:.3s"></div>
                </div>
                <p style="margin:4px 0 0;font-size:.8rem;color:var(--color-text-muted)">${p.sesiones_restantes} restantes (${pct}% utilizado)</p>
            </div>
        </div>`;
}

async function cancelarPaqueteActivo(ppId) {
    const res = await api('/api/paciente-paquetes/cancelar', 'PUT', { id: ppId });
    if (res.success) {
        showToast('Paquete cancelado');
        window._atPaqueteActivo = null;
        verDetalleAtencion(_currentAtencionId, _atencionBack);
    } else {
        showToast(res.message || 'Error al cancelar paquete');
    }
}

async function abrirModalContratarPaquete() {
    // Cargar catálogo de paquetes activos
    const res = await api('/api/paquetes?activo=1');
    const paquetes = (res.data || []).filter(p => p.activo == 1 || p.activo === true);

    const sel = document.getElementById('cpqPaqueteSelect');
    sel.innerHTML = '<option value="">Seleccionar paquete…</option>';
    paquetes.forEach(p => {
        const pxs = p.sesiones_incluidas > 0 ? (parseFloat(p.precio_paquete) / parseInt(p.sesiones_incluidas)).toFixed(2) : '—';
        sel.innerHTML += `<option value="${p.id}" data-precio="${p.precio_paquete}" data-sesiones="${p.sesiones_incluidas}">
            ${escapeHtml(p.nombre)} — ${p.sesiones_incluidas} ses. · S/ ${parseFloat(p.precio_paquete).toFixed(2)} (S/${pxs}/ses.)
        </option>`;
    });

    document.getElementById('cpqFechaActivacion').value = _localDate();
    document.getElementById('cpqFechaVencimiento').value = '';
    document.getElementById('cpqNotas').value = '';
    document.getElementById('modalContratarPaquete').classList.remove('hidden');
}

async function guardarContratarPaquete() {
    const paqueteId = document.getElementById('cpqPaqueteSelect').value;
    if (!paqueteId) { showToast('Selecciona un paquete'); return; }

    const pacienteId    = window._atPacienteId;
    const profesionalId = window._atProfesionalId;

    const res = await api('/api/paciente-paquetes', 'POST', {
        paquete_id:        parseInt(paqueteId),
        paciente_id:       pacienteId,
        profesional_id:    profesionalId,
        fecha_activacion:  document.getElementById('cpqFechaActivacion').value || null,
        fecha_vencimiento: document.getElementById('cpqFechaVencimiento').value || null,
        notas:             document.getElementById('cpqNotas').value.trim() || null,
    });

    if (res.success) {
        showToast(res.message || 'Paquete contratado');
        cerrarModal('modalContratarPaquete');
        verDetalleAtencion(_currentAtencionId, _atencionBack);
    } else {
        showToast(res.message || 'Error al contratar paquete');
    }
}

async function _procesarVinculoPostAtencion(atencionId) {
    // Si el backend no devuelve el id de la atención recién creada, no podemos vincular
    if (!atencionId) return;

    const opcionRadio = document.querySelector('input[name="atVinculoOpcion"]:checked');
    const opcion      = opcionRadio ? opcionRadio.value : 'ninguno';
    if (opcion === 'ninguno') return;

    const rol = opcion === 'existente'
        ? document.getElementById('atRolVinculoExistente').value.trim()
        : document.getElementById('atRolVinculoNuevo').value.trim();

    if (opcion === 'existente') {
        const vinculoId = parseInt(document.getElementById('atVinculoSelect').value);
        if (!vinculoId) return;
        await api('/api/vinculos/participante', 'POST', {
            vinculo_id:  vinculoId,
            atencion_id: atencionId,
            rol:         rol || null,
        });

    } else if (opcion === 'nuevo') {
        const nombre  = document.getElementById('atVinculoNombre').value.trim();
        const tipo    = document.getElementById('atVinculoTipo').value;
        const userVinculo = getUser();
        const profId = userVinculo?.rol === 'profesional'
            ? (userVinculo.profesional_id || 0)
            : parseInt(document.getElementById('atProfesional').value);
        const fecha  = document.getElementById('atFechaInicio').value;
        if (!nombre || !profId) return;

        const resV = await api('/api/vinculos', 'POST', {
            nombre,
            tipo,
            profesional_id: profId,
            fecha_inicio:   fecha,
        });

        if (resV.success && resV.data && resV.data.id) {
            await api('/api/vinculos/participante', 'POST', {
                vinculo_id:  resV.data.id,
                atencion_id: atencionId,
                rol:         rol || null,
            });
        }
    }
}

// ---- Tareas inline en modales de sesión y atención ----

function _tareasInlineHtml() {
    const addIcon = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>`;
    const chevron = `<svg class="ti-chevron" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition:transform .18s ease"><polyline points="4 6 8 10 12 6"/></svg>`;
    return `
        <div class="tareas-inline-section">
            <div class="tareas-inline-header" onclick="_toggleTareasInline(this)">
                <span style="display:flex;align-items:center;gap:6px">${addIcon} Asignar tareas <span class="ti-badge" style="display:none"></span></span>
                ${chevron}
            </div>
            <div class="tareas-inline-body hidden">
                <div class="tareas-inline-lista"></div>
                <button type="button" class="btn ti-add-btn" onclick="_agregarFilaTarea(this)">+ Nueva tarea</button>
            </div>
        </div>`;
}

function _toggleTareasInline(header) {
    const body    = header.nextElementSibling;
    const chevron = header.querySelector('.ti-chevron');
    body.classList.toggle('hidden');
    if (chevron) chevron.style.transform = body.classList.contains('hidden') ? '' : 'rotate(180deg)';
}

function _agregarFilaTarea(btn) {
    const lista = btn.closest('.tareas-inline-body').querySelector('.tareas-inline-lista');
    const row   = document.createElement('div');
    row.className = 'tarea-fila';
    row.innerHTML = `
        <div class="tarea-fila-top">
            <div class="form-group" style="flex:1;margin:0">
                <label>Título de la tarea <span style="color:var(--color-danger)">*</span></label>
                <input type="text" class="tarea-titulo" placeholder="Escribe el título…">
            </div>
            <div class="form-group" style="width:150px;flex-shrink:0;margin:0">
                <label>Fecha límite (opc.)</label>
                <input type="date" class="tarea-fecha-limite">
            </div>
            <button type="button" class="ti-del-btn" onclick="_eliminarFilaTarea(this)" title="Quitar">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
            </button>
        </div>
        <div class="form-group" style="margin:6px 0 0">
            <label>Descripción (opcional)</label>
            <textarea class="tarea-descripcion" rows="2" placeholder="Descripción (opcional)…"></textarea>
        </div>`;
    lista.appendChild(row);
    _actualizarBadgeTareasInline(lista);
    row.querySelector('.tarea-titulo').focus();
}

function _eliminarFilaTarea(btn) {
    const fila  = btn.closest('.tarea-fila');
    const lista = fila.closest('.tareas-inline-lista');
    fila.remove();
    _actualizarBadgeTareasInline(lista);
}

function _actualizarBadgeTareasInline(lista) {
    const section = lista.closest('.tareas-inline-section');
    const badge   = section?.querySelector('.ti-badge');
    if (!badge) return;
    const count = lista.querySelectorAll('.tarea-fila').length;
    badge.textContent   = count > 0 ? count : '';
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

function _recolectarTareasInline(section) {
    if (!section) return [];
    return Array.from(section.querySelectorAll('.tarea-fila')).map(fila => ({
        titulo:       fila.querySelector('.tarea-titulo')?.value.trim() || '',
        descripcion:  fila.querySelector('.tarea-descripcion')?.value.trim() || '',
        fecha_limite: fila.querySelector('.tarea-fecha-limite')?.value || null,
    })).filter(t => t.titulo);
}

function _resetTareasInline(section) {
    if (!section) return;
    const lista   = section.querySelector('.tareas-inline-lista');
    const body    = section.querySelector('.tareas-inline-body');
    const badge   = section.querySelector('.ti-badge');
    const chevron = section.querySelector('.ti-chevron');
    if (lista)   lista.innerHTML            = '';
    if (body)    body.classList.add('hidden');
    if (badge)   { badge.textContent = ''; badge.style.display = 'none'; }
    if (chevron) chevron.style.transform    = '';
}

async function _crearTareasPendientes(sesionId, tareas) {
    let creadas = 0;
    for (const t of tareas) {
        const r = await api('/api/tareas', 'POST', {
            sesion_id:    sesionId,
            titulo:       t.titulo,
            descripcion:  t.descripcion || null,
            fecha_limite: t.fecha_limite || null,
            estado:       'pendiente',
        });
        if (r.success) creadas++;
    }
    if (creadas > 0) showToast(`${creadas} tarea${creadas > 1 ? 's' : ''} asignada${creadas > 1 ? 's' : ''}`);
}

function _hoyISO() {
    return _localDate();
}

function _fmtDDMMYYYY(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function _atToggleRangoPopover() {
    _filtroRangoOpen = !_filtroRangoOpen;
    const popover = document.getElementById('atRangoPopover');
    if (popover) popover.classList.toggle('hidden', !_filtroRangoOpen);
    const btn = document.getElementById('btnRangoAt');
    if (btn) btn.classList.toggle('active', _filtroRangoOpen);
}

function _atCerrarRangoPopover() {
    _filtroRangoOpen = false;
    const popover = document.getElementById('atRangoPopover');
    if (popover) popover.classList.add('hidden');
    const btn = document.getElementById('btnRangoAt');
    if (btn) btn.classList.remove('active');
}

function _atAplicarRangoFechas() {
    const desde = document.getElementById('atRangoDesde')?.value;
    const hasta = document.getElementById('atRangoHasta')?.value;
    if (!desde || !hasta) { showToast('Selecciona ambas fechas'); return; }
    if (desde > hasta) { showToast('La fecha "desde" no puede ser mayor a "hasta"'); return; }
    _filtroDesde = desde;
    _filtroHasta = hasta;
    _filtroRangoOpen = false;
    _atPage = 1;
    atenciones();
    _cargarConteos();
}
