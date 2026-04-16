
// ================================================================
// Módulo: Check-in Emocional
// Accesible para: paciente (formulario + historial propio)
//                 profesional / administrador (historial por atención)
// ================================================================

async function checkin() {
    const user = getUser();
    if (user && user.rol === 'paciente') {
        await _checkinPaciente();
    } else {
        await _checkinStaff();
    }
}

// ----------------------------------------------------------------
// VISTA PACIENTE
// ----------------------------------------------------------------

async function _checkinPaciente() {
    const res = await api('/api/checkin');
    const view = document.getElementById('view');

    if (!res.success) {
        view.innerHTML = `<p style="color:var(--color-danger)">Error al cargar los datos.</p>`;
        return;
    }

    const { atencion, checkins, promedio } = res.data;

    if (!atencion) {
        view.innerHTML = `
            <h2>Check-in emocional</h2>
            <div class="card" style="padding:32px;text-align:center;color:var(--color-text-muted)">
                <p style="font-size:1.1rem;margin:0">No tienes una atención activa en este momento.</p>
                <p style="font-size:.875rem;margin-top:8px">Cuando tu profesional abra una atención podrás registrar tus check-ins aquí.</p>
            </div>`;
        return;
    }

    view.innerHTML = `
        <h2>Check-in emocional</h2>

        <!-- Contexto de la atención -->
        <div class="card" style="padding:14px 18px;margin-bottom:20px;display:flex;flex-wrap:wrap;gap:12px;align-items:center">
            <div>
                <span style="font-size:.75rem;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Atención activa</span>
                <p style="margin:2px 0 0;font-weight:600">${escapeHtml(atencion.subservicio)}</p>
            </div>
            <div style="margin-left:auto;text-align:right">
                <span style="font-size:.75rem;color:var(--color-text-muted)">Profesional</span>
                <p style="margin:2px 0 0;font-size:.875rem">${escapeHtml(atencion.profesional)}</p>
            </div>
        </div>

        <!-- Formulario de check-in -->
        <div class="card" style="padding:24px;margin-bottom:24px">
            <h3 style="margin:0 0 20px;font-size:1rem">¿Cómo estás hoy?</h3>

            <!-- Slider: ¿Cómo te sientes? -->
            <div class="form-group" style="margin-bottom:20px">
                <label style="display:flex;justify-content:space-between;align-items:center">
                    <span>¿Cómo te sientes?</span>
                    <span id="lblSientes" style="font-weight:600;color:var(--color-primary);min-width:28px;text-align:right">5</span>
                </label>
                <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
                    <span style="font-size:.75rem;color:var(--color-text-muted)">Muy mal</span>
                    <input type="range" id="sldSientes" min="0" max="10" value="5"
                        oninput="document.getElementById('lblSientes').textContent=this.value"
                        style="flex:1;accent-color:var(--color-primary)">
                    <span style="font-size:.75rem;color:var(--color-text-muted)">Excelente</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--color-text-muted);padding:0 2px;margin-top:2px">
                    ${[0,1,2,3,4,5,6,7,8,9,10].map(n => `<span>${n}</span>`).join('')}
                </div>
            </div>

            <!-- Slider: ¿Dormiste bien? -->
            <div class="form-group" style="margin-bottom:20px">
                <label style="display:flex;justify-content:space-between;align-items:center">
                    <span>¿Cómo dormiste?</span>
                    <span id="lblSueno" style="font-weight:600;color:var(--color-primary);min-width:28px;text-align:right">5</span>
                </label>
                <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
                    <span style="font-size:.75rem;color:var(--color-text-muted)">Muy mal</span>
                    <input type="range" id="sldSueno" min="0" max="10" value="5"
                        oninput="document.getElementById('lblSueno').textContent=this.value"
                        style="flex:1;accent-color:var(--color-primary)">
                    <span style="font-size:.75rem;color:var(--color-text-muted)">Muy bien</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--color-text-muted);padding:0 2px;margin-top:2px">
                    ${[0,1,2,3,4,5,6,7,8,9,10].map(n => `<span>${n}</span>`).join('')}
                </div>
            </div>

            <!-- Slider: Nivel de estrés -->
            <div class="form-group" style="margin-bottom:20px">
                <label style="display:flex;justify-content:space-between;align-items:center">
                    <span>Nivel de estrés</span>
                    <span id="lblEstres" style="font-weight:600;color:var(--color-warning);min-width:28px;text-align:right">5</span>
                </label>
                <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
                    <span style="font-size:.75rem;color:var(--color-text-muted)">Sin estrés</span>
                    <input type="range" id="sldEstres" min="0" max="10" value="5"
                        oninput="document.getElementById('lblEstres').textContent=this.value"
                        style="flex:1;accent-color:var(--color-warning)">
                    <span style="font-size:.75rem;color:var(--color-text-muted)">Muy alto</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--color-text-muted);padding:0 2px;margin-top:2px">
                    ${[0,1,2,3,4,5,6,7,8,9,10].map(n => `<span>${n}</span>`).join('')}
                </div>
            </div>

            <!-- Botones Sí/No: ¿Hiciste tu tarea? -->
            <div class="form-group" style="margin-bottom:20px">
                <label style="display:block;margin-bottom:8px">¿Realizaste tu tarea terapéutica?</label>
                <div style="display:flex;gap:10px">
                    <button id="btnTareaSi"
                        onclick="_seleccionarTarea(1)"
                        style="flex:1;padding:10px;border:2px solid var(--color-border);border-radius:var(--radius);background:var(--color-surface);cursor:pointer;font-size:.9rem;transition:var(--transition)">
                        Sí
                    </button>
                    <button id="btnTareaNo"
                        onclick="_seleccionarTarea(0)"
                        style="flex:1;padding:10px;border:2px solid var(--color-border);border-radius:var(--radius);background:var(--color-surface);cursor:pointer;font-size:.9rem;transition:var(--transition)">
                        No
                    </button>
                    <button id="btnTareaNa"
                        onclick="_seleccionarTarea(null)"
                        style="flex:1;padding:10px;border:2px solid var(--color-primary);border-radius:var(--radius);background:var(--color-primary);color:#fff;cursor:pointer;font-size:.9rem;transition:var(--transition)">
                        No aplica
                    </button>
                </div>
            </div>

            <!-- Textarea opcional -->
            <div class="form-group" style="margin-bottom:20px">
                <label for="checkinNota">Nota adicional <span style="color:var(--color-text-muted);font-weight:400">(opcional)</span></label>
                <textarea id="checkinNota" rows="3"
                    placeholder="¿Hay algo más que quieras compartir con tu profesional?"
                    style="margin-top:6px"></textarea>
            </div>

            <button class="btn-primary" onclick="enviarCheckin()" style="width:100%;padding:12px;font-size:.95rem">
                Registrar check-in
            </button>
        </div>

        <!-- Promedios -->
        ${promedio ? _renderPromedios(promedio) : ''}

        <!-- Línea de tiempo -->
        <div id="checkinTimeline">
            ${_renderTimeline(checkins)}
        </div>
    `;

    // Estado inicial del botón "No aplica" seleccionado
    window._checkinTareaVal = null;
}

// Valor de tarea seleccionado (null = no aplica, 0 = no, 1 = sí)
window._checkinTareaVal = null;

function _seleccionarTarea(val) {
    window._checkinTareaVal = val;

    const si  = document.getElementById('btnTareaSi');
    const no  = document.getElementById('btnTareaNo');
    const na  = document.getElementById('btnTareaNa');

    const estiloActivo   = 'border-color:var(--color-primary);background:var(--color-primary);color:#fff';
    const estiloInactivo = 'border-color:var(--color-border);background:var(--color-surface);color:var(--color-text)';

    si.style.cssText  = val === 1    ? estiloActivo : estiloInactivo;
    no.style.cssText  = val === 0    ? estiloActivo : estiloInactivo;
    na.style.cssText  = val === null ? estiloActivo : estiloInactivo;
}

async function enviarCheckin() {
    const payload = {
        como_te_sientes: parseInt(document.getElementById('sldSientes').value),
        dormiste_bien:   parseInt(document.getElementById('sldSueno').value),
        nivel_estres:    parseInt(document.getElementById('sldEstres').value),
        hiciste_tarea:   window._checkinTareaVal,
        nota_opcional:   document.getElementById('checkinNota').value.trim() || null,
    };

    const res = await api('/api/checkin', 'POST', payload);

    if (res.success) {
        showToast('Check-in registrado correctamente');
        await _checkinPaciente(); // refrescar
    } else {
        showToast(res.message || 'Error al registrar el check-in');
    }
}

// ----------------------------------------------------------------
// HELPERS DE RENDERIZADO
// ----------------------------------------------------------------

function _renderPromedios(p) {
    const barColor = (val, invertir) => {
        const v = invertir ? (10 - val) : val;
        if (v >= 7) return 'var(--color-success)';
        if (v >= 4) return 'var(--color-warning)';
        return 'var(--color-danger)';
    };

    const barra = (val, invertir = false) => `
        <div style="height:8px;border-radius:4px;background:var(--color-border);overflow:hidden;margin-top:4px">
            <div style="height:100%;width:${val * 10}%;background:${barColor(val, invertir)};border-radius:4px;transition:.3s"></div>
        </div>`;

    return `
    <div class="card" style="padding:20px;margin-bottom:20px">
        <h4 style="margin:0 0 16px;font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">
            Promedios de esta atención (${p.total} check-in${p.total !== '1' ? 's' : ''})
        </h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px">
            <div>
                <p style="margin:0;font-size:.8rem;color:var(--color-text-muted)">Estado emocional</p>
                <p style="margin:4px 0 0;font-size:1.5rem;font-weight:600">${p.avg_estado}<span style="font-size:.8rem;color:var(--color-text-muted)">/10</span></p>
                ${barra(parseFloat(p.avg_estado))}
            </div>
            <div>
                <p style="margin:0;font-size:.8rem;color:var(--color-text-muted)">Calidad de sueño</p>
                <p style="margin:4px 0 0;font-size:1.5rem;font-weight:600">${p.avg_sueno}<span style="font-size:.8rem;color:var(--color-text-muted)">/10</span></p>
                ${barra(parseFloat(p.avg_sueno))}
            </div>
            <div>
                <p style="margin:0;font-size:.8rem;color:var(--color-text-muted)">Nivel de estrés</p>
                <p style="margin:4px 0 0;font-size:1.5rem;font-weight:600">${p.avg_estres}<span style="font-size:.8rem;color:var(--color-text-muted)">/10</span></p>
                ${barra(parseFloat(p.avg_estres), true)}
            </div>
        </div>
    </div>`;
}

function _renderTimeline(checkins) {
    if (!checkins || checkins.length === 0) {
        return `<div class="card" style="padding:24px;text-align:center;color:var(--color-text-muted)">
                    Aún no has registrado ningún check-in para esta atención.
                </div>`;
    }

    const items = checkins.map(c => {
        const fecha   = c.fecha_hora ? c.fecha_hora.replace('T', ' ').substring(0, 16) : '—';
        const tarea   = c.hiciste_tarea === null ? null :
                        c.hiciste_tarea == 1     ? 'Sí' : 'No';
        const tareaColor = c.hiciste_tarea == 1 ? 'var(--color-success)' : 'var(--color-danger)';

        const nota = c.nota_opcional
            ? `<p style="margin:8px 0 0;font-size:.8rem;color:var(--color-text-muted);white-space:pre-line;border-top:1px solid var(--color-border);padding-top:8px">"${escapeHtml(c.nota_opcional)}"</p>`
            : '';

        return `
        <div style="display:flex;gap:12px;margin-bottom:16px">
            <!-- Línea vertical + punto -->
            <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
                <div style="width:10px;height:10px;border-radius:50%;background:var(--color-primary);margin-top:5px;flex-shrink:0"></div>
                <div style="width:2px;flex:1;background:var(--color-border);margin-top:4px"></div>
            </div>
            <!-- Contenido -->
            <div class="card" style="flex:1;padding:14px 16px;margin-bottom:0">
                <p style="margin:0 0 8px;font-size:.75rem;color:var(--color-text-muted)">${escapeHtml(fecha)}</p>
                <div style="display:flex;flex-wrap:wrap;gap:10px">
                    ${_chipIndicador('Estado', c.como_te_sientes, false)}
                    ${_chipIndicador('Sueño', c.dormiste_bien, false)}
                    ${_chipIndicador('Estrés', c.nivel_estres, true)}
                    ${tarea !== null
                        ? `<span style="padding:3px 10px;border-radius:20px;font-size:.75rem;font-weight:600;background:${tareaColor}22;color:${tareaColor}">Tarea: ${tarea}</span>`
                        : ''}
                </div>
                ${nota}
            </div>
        </div>`;
    }).join('');

    return `
    <h3 style="font-size:.875rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em;margin:0 0 14px">
        Historial de check-ins
    </h3>
    <div>${items}</div>`;
}

function _chipIndicador(label, val, invertir) {
    const v  = parseInt(val);
    let color;
    if (invertir) {
        color = v <= 3 ? 'var(--color-success)' : v <= 6 ? 'var(--color-warning)' : 'var(--color-danger)';
    } else {
        color = v >= 7 ? 'var(--color-success)' : v >= 4 ? 'var(--color-warning)' : 'var(--color-danger)';
    }
    return `<span style="padding:3px 10px;border-radius:20px;font-size:.75rem;font-weight:600;background:${color}22;color:${color}">${label}: ${v}</span>`;
}

// ----------------------------------------------------------------
// VISTA STAFF (profesional / admin)
// ----------------------------------------------------------------

async function _checkinStaff() {
    // Cargar lista de pacientes para filtrar
    const resPac = await api('/api/pacientes');

    let opciones = '<option value="">Seleccionar paciente…</option>';
    if (resPac.data) {
        resPac.data.forEach(p => {
            opciones += `<option value="${p.id}">${p.apellidos}, ${p.nombres} — ${p.dni}</option>`;
        });
    }

    document.getElementById('view').innerHTML = `
        <h2>Check-in emocional — Seguimiento</h2>
        <div style="display:flex;align-items:flex-end;gap:12px;margin-bottom:20px;flex-wrap:wrap">
            <div class="form-group" style="margin:0;min-width:280px">
                <label for="chkFiltPaciente" style="display:block;margin-bottom:4px">Paciente</label>
                <select id="chkFiltPaciente" onchange="cargarCheckinStaff(this.value)">
                    ${opciones}
                </select>
            </div>
        </div>
        <div id="checkinStaffPanel">
            <p style="color:var(--color-text-muted)">Seleccione un paciente para ver su historial de check-ins.</p>
        </div>
    `;
}

async function cargarCheckinStaff(pacienteId) {
    const panel = document.getElementById('checkinStaffPanel');
    if (!pacienteId) {
        panel.innerHTML = '<p style="color:var(--color-text-muted)">Seleccione un paciente para ver su historial de check-ins.</p>';
        return;
    }

    panel.innerHTML = '<p style="color:var(--color-text-muted)">Cargando…</p>';

    // Obtener atención activa del paciente (desde atenciones)
    const resAt = await api('/api/atenciones/paciente?id=' + pacienteId);
    if (!resAt.success || !resAt.data || resAt.data.length === 0) {
        panel.innerHTML = '<p style="color:var(--color-text-muted)">Este paciente no tiene atenciones registradas.</p>';
        return;
    }

    // Mostrar selector de atención
    let opAt = resAt.data.map(a =>
        `<option value="${a.id}">${escapeHtml(a.subservicio || 'Atención')} — ${a.estado} (${a.fecha_inicio || ''})</option>`
    ).join('');

    panel.innerHTML = `
        <div class="form-group" style="margin-bottom:20px;max-width:400px">
            <label for="chkFiltAtencion" style="display:block;margin-bottom:4px">Atención</label>
            <select id="chkFiltAtencion" onchange="cargarCheckinPorAtencion(this.value)">
                <option value="">Seleccionar atención…</option>
                ${opAt}
            </select>
        </div>
        <div id="checkinAtencionPanel">
            <p style="color:var(--color-text-muted)">Seleccione una atención para ver los check-ins.</p>
        </div>
    `;
}

async function cargarCheckinPorAtencion(atencionId) {
    const panel = document.getElementById('checkinAtencionPanel');
    if (!atencionId) {
        panel.innerHTML = '<p style="color:var(--color-text-muted)">Seleccione una atención para ver los check-ins.</p>';
        return;
    }

    panel.innerHTML = '<p style="color:var(--color-text-muted)">Cargando…</p>';

    const res = await api('/api/checkin?atencion_id=' + atencionId);
    if (!res.success) {
        panel.innerHTML = '<p style="color:var(--color-danger)">Error al cargar los check-ins.</p>';
        return;
    }

    const { checkins, promedio } = res.data;

    panel.innerHTML = `
        ${promedio ? _renderPromedios(promedio) : `
            <div class="card" style="padding:20px;text-align:center;color:var(--color-text-muted);margin-bottom:16px">
                Aún no hay check-ins registrados para esta atención.
            </div>`}
        ${_renderTimeline(checkins)}
    `;
}
