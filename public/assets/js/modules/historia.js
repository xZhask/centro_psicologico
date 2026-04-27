
// ─── Colores de avatar rotantes ───────────────────────────────────
const HC_AVATAR_COLORS = [
    { bg: 'rgba(42,127,143,.15)',  text: '#1B5C6B' },
    { bg: 'rgba(155,126,200,.15)', text: '#6B4FA0' },
    { bg: 'rgba(232,131,106,.15)', text: '#A84A30' },
    { bg: 'rgba(232,184,75,.15)',  text: '#7A5C10' },
];

const HC_MODALIDADES_GRUPALES = new Set(['pareja', 'familiar', 'grupal']);

// ─── Función principal del módulo ─────────────────────────────────
async function historia() {
    document.getElementById('view').innerHTML = `
    <div class="hc-wrap">
        <div class="hc-header">
            <h2>Historial Clínico</h2>
            <p>Busca un paciente por nombre o DNI para ver su expediente completo</p>
        </div>

        <div class="hc-search-wrap" id="hcSearchWrap">
            <span class="hc-search-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="6.5" cy="6.5" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/>
                </svg>
            </span>
            <input id="hcSearch" class="hc-search-input"
                   placeholder="Buscar por nombre o DNI..."
                   autocomplete="off">
            <button id="hcClear" class="hc-clear-btn" style="display:none">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
                </svg>
            </button>
            <div id="hcDropdown" class="hc-dropdown" style="display:none"></div>
        </div>

        <div id="hcContent">${_hcEmptyState()}</div>
    </div>`;

    _hcInitSearch();
}

// ─── Inicializar lógica del buscador ──────────────────────────────
function _hcInitSearch() {
    const input    = document.getElementById('hcSearch');
    const dropdown = document.getElementById('hcDropdown');
    const clearBtn = document.getElementById('hcClear');
    if (!input) return;

    let debounceTimer;

    input.addEventListener('input', () => {
        const q = input.value.trim();
        clearBtn.style.display = q ? '' : 'none';
        clearTimeout(debounceTimer);
        if (q.length < 2) { dropdown.style.display = 'none'; return; }
        debounceTimer = setTimeout(() => _hcBuscar(q), 350);
    });

    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        dropdown.style.display = 'none';
        document.getElementById('hcContent').innerHTML = _hcEmptyState();
    });

    document.addEventListener('click', (e) => {
        const wrap = document.getElementById('hcSearchWrap');
        if (wrap && !wrap.contains(e.target)) dropdown.style.display = 'none';
    });
}

async function _hcBuscar(q) {
    const dropdown = document.getElementById('hcDropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '<div class="hc-no-results">Buscando...</div>';
    dropdown.style.display = '';

    const res = await api('/api/pacientes?q=' + encodeURIComponent(q));
    if (!dropdown || !document.getElementById('hcSearch')) return;

    if (!res.success || !res.data || !res.data.length) {
        dropdown.innerHTML = '<div class="hc-no-results">No se encontraron pacientes</div>';
        return;
    }

    dropdown.innerHTML = res.data.map((p, i) => {
        const col   = HC_AVATAR_COLORS[i % HC_AVATAR_COLORS.length];
        const inits = _hcIniciales(p.nombres, p.apellidos);
        const edad  = p.fecha_nacimiento ? _hcEdad(p.fecha_nacimiento) : null;
        const meta  = [p.dni ? 'DNI ' + p.dni : null, edad !== null ? edad + ' años' : null]
                        .filter(Boolean).join(' · ');
        const badge = (p.total_atenciones != null)
            ? `<span class="hc-drop-badge">${p.total_atenciones} atención${p.total_atenciones !== 1 ? 'es' : ''}</span>`
            : '';
        const nombreCompleto = (p.apellidos || '') + ', ' + (p.nombres || '');
        return `
        <div class="hc-drop-item" onclick="_hcSeleccionar(${p.id}, ${_hcEscAttr(nombreCompleto)})">
            <div class="hc-drop-avatar" style="background:${col.bg};color:${col.text}">${inits}</div>
            <div>
                <div class="hc-drop-name">${_hcEsc(p.apellidos)}, ${_hcEsc(p.nombres)}</div>
                <div class="hc-drop-meta">${_hcEsc(meta)}</div>
            </div>
            ${badge}
        </div>`;
    }).join('');
}

function _hcSeleccionar(id, nombre) {
    const input    = document.getElementById('hcSearch');
    const dropdown = document.getElementById('hcDropdown');
    const clearBtn = document.getElementById('hcClear');
    if (input)    input.value = nombre;
    if (clearBtn) clearBtn.style.display = '';
    if (dropdown) dropdown.style.display = 'none';
    cargarHistorial(id);
}

// ─── Carga directa desde otros módulos ───────────────────────────
function cargarHistorialDirecto(id, nombre) {
    const input    = document.getElementById('hcSearch');
    const clearBtn = document.getElementById('hcClear');
    if (input)    input.value = nombre || '';
    if (clearBtn) clearBtn.style.display = nombre ? '' : 'none';
    cargarHistorial(id);
}

// ─── Navegación inter-módulo desde pacientes ─────────────────────
function verHistorialPaciente(id, nombre) {
    navigate('historia').then(() => {
        if (typeof cargarHistorialDirecto === 'function') {
            cargarHistorialDirecto(id, nombre);
        }
    });
}

// ─── Carga del historial completo ────────────────────────────────
async function cargarHistorial(id) {
    const cont = document.getElementById('hcContent');
    if (!cont) return;
    cont.innerHTML = `
    <div class="hc-empty" style="padding:40px 24px">
        <svg class="hc-empty-icon" width="36" height="36" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p class="hc-empty-title" style="opacity:.4">Cargando expediente…</p>
    </div>`;

    try {
        const [resPac, resHist] = await Promise.all([
            api('/api/paciente?id=' + id),
            api('/api/reportes/historial-completo?paciente_id=' + id),
        ]);

        const paciente = (resPac.success && resPac.data) ? resPac.data : null;
        const filas    = (resHist.success && Array.isArray(resHist.data)) ? resHist.data : [];

        if (!document.getElementById('hcContent')) return;
        document.getElementById('hcContent').innerHTML =
            renderFichaHc(paciente, filas, id) +
            renderAtencionesHc(filas);

        // Cargar adjuntos para sesiones que los tienen
        const sesionesConArchivos = [];
        filas.forEach(f => {
            if (f.sesion_id && parseInt(f.archivos_count) > 0) {
                if (!sesionesConArchivos.includes(f.sesion_id)) {
                    sesionesConArchivos.push(f.sesion_id);
                }
            }
        });
        if (sesionesConArchivos.length) {
            await Promise.all(sesionesConArchivos.map(sid => _hcCargarAdjuntos(sid)));
        }
    } catch (e) {
        const c = document.getElementById('hcContent');
        if (c) c.innerHTML = `<div style="color:var(--color-danger);padding:20px;text-align:center">Error al cargar el historial.</div>`;
    }
}

// ─── Ficha del paciente ───────────────────────────────────────────
function renderFichaHc(pac, filas, pacienteId) {
    const totalAtenciones = new Set(filas.map(f => f.atencion_id)).size;
    const totalSesiones   = new Set(filas.filter(f => f.sesion_id).map(f => f.sesion_id)).size;

    const nombres    = pac?.nombres   || '';
    const apellidos  = pac?.apellidos || '';
    const inits      = _hcIniciales(nombres, apellidos);
    const nombreComp = _hcEsc(apellidos ? apellidos + ', ' + nombres : nombres || '—');
    const dni        = _hcEsc(pac?.dni || '—');
    const ocupacion  = _hcEsc(pac?.ocupacion || '—');
    const subMeta    = [pac?.dni ? 'DNI ' + pac.dni : null, pac?.ocupacion || null]
                         .filter(Boolean).join(' · ');

    const edad      = pac?.fecha_nacimiento ? _hcEdad(pac.fecha_nacimiento) + ' años' : '—';
    const estCivil  = _hcEsc(_hcCapitalize(pac?.estado_civil      || '—'));
    const gradoInst = _hcEsc(_hcCapitalize(pac?.grado_instruccion || '—'));

    return `
    <div class="hc-ficha">
        <div class="hc-ficha-header">
            <div class="hc-ficha-avatar">${inits}</div>
            <div>
                <p class="hc-ficha-nombre">${nombreComp}</p>
                <p class="hc-ficha-submeta">${_hcEsc(subMeta)}</p>
            </div>
            <div class="hc-ficha-actions">
                <button class="hc-ficha-btn" onclick="navigate('pacientes')">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 2l3 3-9 9H2v-3L11 2z"/>
                    </svg>
                    Editar paciente
                </button>
                <button class="hc-ficha-btn" onclick="_hcExportarPdf(${pacienteId})">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M13 10v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3"/>
                        <polyline points="5 7 8 10 11 7"/><line x1="8" y1="2" x2="8" y2="10"/>
                    </svg>
                    Exportar PDF
                </button>
            </div>
        </div>

        <div class="hc-ficha-datos">
            <div>
                <div class="hc-dato-label">Estado civil</div>
                <div class="hc-dato-val">${estCivil}</div>
            </div>
            <div>
                <div class="hc-dato-label">Ocupación</div>
                <div class="hc-dato-val">${ocupacion}</div>
            </div>
            <div>
                <div class="hc-dato-label">Edad</div>
                <div class="hc-dato-val">${_hcEsc(edad)}</div>
            </div>
            <div>
                <div class="hc-dato-label">Grado de instrucción</div>
                <div class="hc-dato-val">${gradoInst}</div>
            </div>
        </div>

        <div class="hc-ficha-stats">
            <div class="hc-stat">
                <span class="hc-stat-num">${totalAtenciones}</span>
                <span class="hc-stat-label">Atenciones</span>
            </div>
            <div class="hc-stat">
                <span class="hc-stat-num">${totalSesiones}</span>
                <span class="hc-stat-label">Sesiones</span>
            </div>
            <div class="hc-stat">
                <span class="hc-stat-num">—</span>
                <span class="hc-stat-label">Estado emocional prom.</span>
            </div>
            <div class="hc-stat">
                <span class="hc-stat-num">—</span>
                <span class="hc-stat-label">Check-ins</span>
            </div>
        </div>
    </div>`;
}

function _hcExportarPdf(pacienteId) {
    const a = document.createElement('a');
    a.href   = '/api/pdf/historial?paciente_id=' + pacienteId;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ─── Renderizar atenciones ────────────────────────────────────────
function renderAtencionesHc(filas) {
    if (!filas.length) {
        return `
        <div class="hc-empty">
            <svg class="hc-empty-icon" width="56" height="56" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
            <p class="hc-empty-title">Sin atenciones registradas</p>
            <p class="hc-empty-sub">Este paciente no tiene atenciones registradas.</p>
        </div>`;
    }

    const atenciones = new Map();
    filas.forEach(f => {
        if (!atenciones.has(f.atencion_id)) {
            atenciones.set(f.atencion_id, {
                atencion_id:     f.atencion_id,
                fecha_inicio:    f.fecha_inicio,
                fecha_fin:       f.fecha_fin,
                estado:          f.estado_atencion,
                motivo_consulta: f.motivo_consulta,
                subservicio:     f.subservicio,
                modalidad:       f.modalidad,
                profesional:     f.profesional,
                cie10_codigo:    f.cie10_codigo,
                diagnostico:     f.diagnostico,
                sesiones:        []
            });
        }
        if (f.sesion_id) {
            const at = atenciones.get(f.atencion_id);
            if (!at.sesiones.some(s => s.sesion_id === f.sesion_id)) {
                at.sesiones.push({
                    sesion_id:       f.sesion_id,
                    numero_sesion:   f.numero_sesion,
                    fecha_sesion:    f.fecha_sesion,
                    duracion_min:    f.duracion_min,
                    modalidad_sesion: f.modalidad_sesion || null,
                    nota_clinica:    f.nota_clinica,
                    nota_privada:    f.nota_privada || null,
                    nombre_paquete:  f.nombre_paquete || null,
                });
            }
        }
    });

    let html = '';
    atenciones.forEach(at => {
        const esGrupal   = HC_MODALIDADES_GRUPALES.has(at.modalidad);
        const fechaIni   = _hcFecha(at.fecha_inicio);
        const fechaFin   = at.fecha_fin ? _hcFecha(at.fecha_fin) : null;
        const fechasHtml = fechaFin
            ? `${fechaIni} → ${fechaFin}`
            : `${fechaIni} → <em>En curso</em>`;

        const motivoHtml = at.motivo_consulta ? `
            <div class="hc-at-section-label">Motivo de consulta</div>
            <div class="hc-at-motivo">${_hcEsc(at.motivo_consulta)}</div>` : '';

        const dxHtml = at.cie10_codigo ? `
            <div class="hc-at-dx">
                <span class="hc-at-dx-code">${_hcEsc(at.cie10_codigo)}</span>
                <span class="hc-at-dx-desc">${_hcEsc(at.diagnostico || '')}</span>
            </div>` : '';

        html += `
        <div class="hc-atencion">
            <div class="hc-at-header">
                <div>
                    <div class="hc-at-sup">Atención</div>
                    <div class="hc-at-servicio">${_hcEsc(at.subservicio || '—')}</div>
                    <div class="hc-at-prof">${_hcEsc(at.profesional || '—')}</div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                    <span class="hc-at-estado-badge">${_hcEsc(_hcLabelEstado(at.estado))}</span>
                    <div class="hc-at-fechas">${fechasHtml}</div>
                </div>
            </div>
            <div class="hc-at-body">
                ${motivoHtml}
                ${dxHtml}
                ${_hcRenderSesiones(at.sesiones, esGrupal)}
            </div>
        </div>`;
    });

    return html;
}

function _hcRenderSesiones(sesiones, esGrupal) {
    if (!sesiones.length) {
        return `<p style="font-size:12.5px;color:var(--color-text-muted)">Sin sesiones registradas.</p>`;
    }

    sesiones.sort((a, b) => a.numero_sesion - b.numero_sesion);

    let html = `
    <div class="hc-sesiones-title">
        Sesiones <span class="hc-sesiones-count">(${sesiones.length})</span>
    </div>`;

    sesiones.forEach(s => {
        const durHtml = s.duracion_min
            ? `<span style="font-size:11px;color:var(--color-text-muted)">${_hcEsc(String(s.duracion_min))} min</span>`
            : '';

        let notaHtml = '';
        if (esGrupal) {
            let partes = '';
            if (s.nota_clinica) {
                partes += `
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#2A7F8F;opacity:.7;margin-bottom:3px">NOTA DE SESIÓN</div>
                <div class="hc-sesion-nota">${_hcEsc(s.nota_clinica)}</div>`;
            }
            if (s.nota_privada) {
                partes += `
                <div style="margin-top:${s.nota_clinica ? '10px' : '0'};border-left:3px solid #9B7EC8;background:rgba(155,126,200,.05);padding:7px 10px;border-radius:0 4px 4px 0">
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#9B7EC8;opacity:.75;margin-bottom:4px;display:flex;align-items:center;gap:4px">
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="#9B7EC8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
                            <rect x="3" y="7" width="10" height="8" rx="1.5"/>
                            <path d="M5 7V5a3 3 0 016 0v2"/>
                        </svg>
                        OBSERVACIÓN CLÍNICA PRIVADA
                    </div>
                    <div style="font-size:12.5px;font-weight:400;color:var(--color-text)">${_hcEsc(s.nota_privada)}</div>
                    <div style="font-size:10px;font-weight:300;color:var(--color-text-muted);margin-top:5px">Visible solo para el profesional tratante. No incluida en el PDF del expediente.</div>
                </div>`;
            }
            if (partes) notaHtml = partes;
        } else if (s.nota_clinica) {
            notaHtml = `<div id="notaDisplay_${s.sesion_id}" data-nota="${_hcEsc(s.nota_clinica)}">
                    ${_hcNotaDisplay(s.sesion_id, s.nota_clinica)}
                </div>`;
        } else {
            notaHtml = `<div id="notaDisplay_${s.sesion_id}" data-nota="">${_hcBtnLapiz(s.sesion_id)}</div>`;
        }

        const pqBadge = s.nombre_paquete
            ? `<span style="display:inline-block;margin-left:4px;padding:1px 5px;border-radius:4px;font-size:.68rem;font-weight:600;background:rgba(155,126,200,.12);color:#7B5EA7" title="Sesión cubierta por paquete: ${_hcEsc(s.nombre_paquete)}">[P]</span>`
            : '';

        const modalidadBadge = s.modalidad_sesion === 'virtual'
            ? `<span style="padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;background:rgba(155,126,200,.12);color:#7B5EA7">Virtual</span>`
            : s.modalidad_sesion === 'presencial'
                ? `<span style="padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;background:rgba(32,178,170,.10);color:#1A7F79">Presencial</span>`
                : '';

        html += `
        <div id="sesionCard_${s.sesion_id}" class="hc-sesion">
            <div class="hc-sesion-header">
                <span class="hc-sesion-num">Sesión #${_hcEsc(String(s.numero_sesion))}${pqBadge}</span>
                <div style="display:flex;align-items:center;gap:8px">
                    ${modalidadBadge}
                    ${durHtml}
                    <span class="hc-sesion-fecha">${_hcFechaHora(s.fecha_sesion)}</span>
                </div>
            </div>
            ${notaHtml}
            <div id="hcAdjuntos_${s.sesion_id}"></div>
        </div>`;
    });

    return html;
}

// ─── Estado vacío ─────────────────────────────────────────────────
function _hcEmptyState() {
    return `
    <div class="hc-empty">
        <svg class="hc-empty-icon" width="56" height="56" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p class="hc-empty-title">Ningún paciente seleccionado</p>
        <p class="hc-empty-sub">Usa el buscador para encontrar un paciente y ver su expediente.</p>
    </div>`;
}

// ─── Edición de notas clínicas ────────────────────────────────────
function _hcBtnLapiz(sesionId) {
    return `<button onclick="editarNotaSesionHistoria(${sesionId})"
        style="background:none;border:none;cursor:pointer;color:var(--color-text-muted);padding:.15rem .35rem;line-height:1;font-size:.95rem;flex-shrink:0"
        title="Editar nota">&#9998;</button>`;
}

function _hcNotaDisplay(sesionId, nota) {
    if (!nota) return _hcBtnLapiz(sesionId);
    return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">
        <p class="hc-sesion-nota" style="margin:0;white-space:pre-wrap;flex:1">${_hcEsc(nota)}</p>
        ${_hcBtnLapiz(sesionId)}
    </div>`;
}

function editarNotaSesionHistoria(sesionId) {
    const display = document.getElementById(`notaDisplay_${sesionId}`);
    if (!display) return;
    const notaActual = display.dataset.nota || '';
    display.innerHTML = `
        <textarea id="notaEdit_${sesionId}" rows="4" class="input"
            style="width:100%;resize:vertical;font-size:.875rem;margin-bottom:.5rem;box-sizing:border-box"
        >${_hcEsc(notaActual)}</textarea>
        <div style="display:flex;gap:.5rem;justify-content:flex-end">
            <button class="btn" onclick="cancelarEditarNotaHistoria(${sesionId})" style="font-size:.82rem;padding:.3rem .75rem">Cancelar</button>
            <button class="btn btn-primary" id="btnGuardarNota_${sesionId}" onclick="guardarNotaSesionHistoria(${sesionId})" style="font-size:.82rem;padding:.3rem .75rem">Guardar</button>
        </div>`;
}

function cancelarEditarNotaHistoria(sesionId) {
    const display = document.getElementById(`notaDisplay_${sesionId}`);
    if (!display) return;
    const nota = display.dataset.nota || '';
    display.innerHTML = nota ? _hcNotaDisplay(sesionId, nota) : _hcBtnLapiz(sesionId);
}

async function guardarNotaSesionHistoria(sesionId) {
    const ta  = document.getElementById(`notaEdit_${sesionId}`);
    const btn = document.getElementById(`btnGuardarNota_${sesionId}`);
    if (!ta || !btn) return;
    const nota = ta.value;
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
        const res = await api('/api/sesiones/nota', 'PUT', { id: sesionId, nota_clinica: nota });
        if (!res.success) throw new Error(res.message || 'Error al guardar');
        const display = document.getElementById(`notaDisplay_${sesionId}`);
        display.dataset.nota = nota;
        display.innerHTML = nota ? _hcNotaDisplay(sesionId, nota) : _hcBtnLapiz(sesionId);
    } catch (e) {
        alert(e.message);
        btn.disabled = false;
        btn.textContent = 'Guardar';
    }
}

// ─── Adjuntos en historial ────────────────────────────────────────

async function _hcCargarAdjuntos(sesionId) {
    const cont = document.getElementById(`hcAdjuntos_${sesionId}`);
    if (!cont) return;

    const res = await api(`/api/sesiones/archivos?sesion_id=${sesionId}`);
    if (!res.success || !res.data || !res.data.length) return;

    const chipSvgPdf = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:#E74C3C;flex-shrink:0">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
    </svg>`;
    const chipSvgImg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:#2A7F8F;flex-shrink:0">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
    </svg>`;
    const dlSvg = `<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round">
        <path d="M8 2v8m0 0l-3-3m3 3l3-3"/><path d="M3 13h10"/>
    </svg>`;

    const chips = res.data.map(a => {
        const icon = a.tipo_mime === 'application/pdf' ? chipSvgPdf : chipSvgImg;
        return `<a href="/api/archivos/descargar?id=${a.id}"
                   download="${_hcEsc(a.nombre_original)}"
                   class="adjunto-chip"
                   style="text-decoration:none;color:inherit"
                   title="Descargar ${_hcEsc(a.nombre_original)}">
            ${icon}
            <span class="adjunto-chip-name">${_hcEsc(a.nombre_original)}</span>
            ${dlSvg}
        </a>`;
    }).join('');

    cont.innerHTML = `<div class="sesion-adjuntos">
        <span class="sa-label">Adjuntos:</span>
        ${chips}
    </div>`;
}

// ─── Utilidades ───────────────────────────────────────────────────
function _hcIniciales(nombres, apellidos) {
    const n = (nombres   || '').trim().charAt(0).toUpperCase();
    const a = (apellidos || '').trim().charAt(0).toUpperCase();
    return (n + a) || '?';
}

function _hcEdad(fechaNac) {
    if (!fechaNac) return null;
    const nac = new Date(fechaNac.includes('T') ? fechaNac : fechaNac + 'T00:00:00');
    if (isNaN(nac)) return null;
    const hoy  = new Date();
    let edad   = hoy.getFullYear() - nac.getFullYear();
    const m    = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad;
}

function _hcCapitalize(str) {
    if (!str || str === '—') return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function _hcLabelEstado(estado) {
    const map = { activa: 'Activa', cerrada: 'Cerrada', suspendida: 'Suspendida' };
    return map[estado] || estado || '—';
}

function _hcFecha(str) {
    if (!str) return '—';
    const d = new Date(str.includes('T') ? str : str + 'T00:00:00');
    if (isNaN(d)) return str;
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function _hcFechaHora(str) {
    if (!str) return '—';
    const d = new Date(str.includes('T') ? str : str.replace(' ', 'T'));
    if (isNaN(d)) return str;
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
         + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function _hcEsc(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function _hcEscAttr(str) {
    return _hcEsc(JSON.stringify(String(str || '')));
}
