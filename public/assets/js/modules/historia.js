
async function historia() {
    document.getElementById('view').innerHTML = `
        <div style="max-width:960px;margin:0 auto">
            <h2 style="margin-bottom:1.25rem">Historial Clínico</h2>

            <div class="card" style="margin-bottom:1.5rem;padding:1.25rem">
                <div class="form-group" style="margin-bottom:0">
                    <label for="historiaPacienteSelect">Seleccionar paciente</label>
                    <select id="historiaPacienteSelect" class="input">
                        <option value="">-- Seleccione un paciente --</option>
                    </select>
                </div>
            </div>

            <div id="historiaContent">
                <p style="color:var(--color-text-muted);text-align:center;padding:2rem 0">
                    Seleccione un paciente para ver su historial clínico.
                </p>
            </div>
        </div>`;

    // Cargar lista de pacientes
    const resPac = await api('/api/pacientes');
    const select = document.getElementById('historiaPacienteSelect');

    if (resPac.success && resPac.data.length > 0) {
        resPac.data.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.apellidos}, ${p.nombres} — DNI ${p.dni}`;
            select.appendChild(opt);
        });
    } else {
        select.insertAdjacentHTML('beforeend',
            '<option disabled>No hay pacientes registrados</option>');
    }

    select.addEventListener('change', () => {
        const id = parseInt(select.value);
        if (id) cargarHistorialClinico(id);
    });

    // Si ya hay un valor seleccionado al cargar (p.ej. un solo paciente), cargar de inmediato
    const idInicial = parseInt(select.value);
    if (idInicial) cargarHistorialClinico(idInicial);
}

async function cargarHistorialClinico(pacienteId) {
    const contenedor = document.getElementById('historiaContent');
    if (!contenedor) return;
    contenedor.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:2rem 0">Cargando historial\u2026</p>';

    let resHist, resTar;
    try {
        [resHist, resTar] = await Promise.all([
            api(`/api/reportes/historial?paciente_id=${pacienteId}`),
            api(`/api/tareas?paciente_id=${pacienteId}`)
        ]);
    } catch (e) {
        contenedor.innerHTML = '<div class="card" style="padding:2rem;text-align:center;color:var(--color-danger)">Error al cargar el historial.</div>';
        return;
    }

    const filas  = (resHist.success && resHist.data) ? resHist.data : [];
    const tareas = (resTar.success  && resTar.data)  ? resTar.data  : [];

    if (!filas.length) {
        contenedor.innerHTML = '<div class="card" style="padding:2rem;text-align:center;color:var(--color-text-muted)">Este paciente no tiene atenciones registradas.</div>';
        return;
    }

    // Agrupar filas por atencion_id
    const atenciones = new Map();
    filas.forEach(f => {
        if (!atenciones.has(f.atencion_id)) {
            atenciones.set(f.atencion_id, {
                atencion_id:    f.atencion_id,
                fecha_inicio:   f.fecha_inicio,
                fecha_fin:      f.fecha_fin,
                estado:         f.estado_atencion,
                motivo_consulta: f.motivo_consulta,
                subservicio:    f.subservicio,
                modalidad:      f.modalidad,
                profesional:    f.profesional,
                cie10_codigo:   f.cie10_codigo,
                diagnostico:    f.diagnostico,
                sesiones:       []
            });
        }
        // Agregar sesión si existe (puede ser NULL si no hay sesiones)
        if (f.sesion_id) {
            const atencion = atenciones.get(f.atencion_id);
            const yaExiste = atencion.sesiones.some(s => s.sesion_id === f.sesion_id);
            if (!yaExiste) {
                atencion.sesiones.push({
                    sesion_id:     f.sesion_id,
                    numero_sesion: f.numero_sesion,
                    fecha_sesion:  f.fecha_sesion,
                    duracion_min:  f.duracion_min,
                    nota_clinica:  f.nota_clinica
                });
            }
        }
    });

    // Agrupar tareas por atencion_id
    const tareasPorAtencion = new Map();
    tareas.forEach(t => {
        if (!tareasPorAtencion.has(t.atencion_id)) {
            tareasPorAtencion.set(t.atencion_id, []);
        }
        tareasPorAtencion.get(t.atencion_id).push(t);
    });

    let html = '';
    try {
    atenciones.forEach(at => {
        const estadoBadge = renderBadgeEstado(at.estado);
        const fechaInicio = formatFecha(at.fecha_inicio);
        const fechaFin    = at.fecha_fin ? formatFecha(at.fecha_fin) : 'En curso';

        html += `
        <div class="card" style="margin-bottom:1.5rem;padding:0;overflow:hidden">

            <!-- Encabezado de atención -->
            <div style="background:var(--color-primary);color:#fff;padding:1rem 1.25rem">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.5rem">
                    <div>
                        <span style="font-size:.75rem;opacity:.85;text-transform:uppercase;letter-spacing:.05em">Atención</span>
                        <h3 style="margin:.15rem 0 .35rem;font-size:1.1rem">${escHtml(at.subservicio)}</h3>
                        <span style="font-size:.85rem;opacity:.9">${escHtml(at.profesional)}</span>
                    </div>
                    <div style="text-align:right">
                        ${estadoBadge}
                        <div style="font-size:.82rem;margin-top:.35rem;opacity:.9">
                            ${fechaInicio} → ${fechaFin}
                        </div>
                    </div>
                </div>
            </div>

            <div style="padding:1.25rem">
                <!-- Datos de la atención -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem 1.5rem;margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid var(--color-border)">
                    ${at.motivo_consulta ? `
                    <div style="grid-column:1/-1">
                        <span style="font-size:.75rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Motivo de consulta</span>
                        <p style="margin:.25rem 0 0;font-size:.9rem">${escHtml(at.motivo_consulta)}</p>
                    </div>` : ''}
                    ${at.cie10_codigo ? `
                    <div>
                        <span style="font-size:.75rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Diagnóstico principal</span>
                        <p style="margin:.25rem 0 0;font-size:.9rem">
                            <strong>${escHtml(at.cie10_codigo)}</strong> — ${escHtml(at.diagnostico || '')}
                        </p>
                    </div>` : ''}
                    <div>
                        <span style="font-size:.75rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Modalidad</span>
                        <p style="margin:.25rem 0 0;font-size:.9rem">${escHtml(at.modalidad || '—')}</p>
                    </div>
                </div>

                <!-- Sesiones -->
                ${renderSesiones(at.sesiones)}

                <!-- Tareas -->
                ${renderTareas(tareasPorAtencion.get(at.atencion_id) || [])}
            </div>
        </div>`;
    });
    } catch (e) {
        contenedor.innerHTML = '<div class="card" style="padding:2rem;text-align:center;color:var(--color-danger)">Error al renderizar el historial.</div>';
        return;
    }

    contenedor.innerHTML = html;
}

function _btnLapiz(sesionId) {
    return `<button onclick="editarNotaSesion(${sesionId})"
        style="background:none;border:none;cursor:pointer;color:var(--color-text-muted);padding:.15rem .35rem;line-height:1;font-size:.95rem;flex-shrink:0"
        title="Editar nota">&#9998;</button>`;
}

function _notaDisplayHtml(sesionId, nota) {
    if (nota) {
        return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">
            <p style="font-size:.875rem;margin:0;line-height:1.5;white-space:pre-wrap;flex:1">${escHtml(nota)}</p>
            ${_btnLapiz(sesionId)}
        </div>`;
    }
    return _btnLapiz(sesionId);
}

function renderSesiones(sesiones) {
    if (!sesiones.length) {
        return `<div style="margin-bottom:1rem">
            <h4 style="font-size:.95rem;margin:0 0 .5rem;color:var(--color-text-muted)">Sesiones</h4>
            <p style="font-size:.85rem;color:var(--color-text-muted)">Sin sesiones registradas.</p>
        </div>`;
    }

    sesiones.sort((a, b) => a.numero_sesion - b.numero_sesion);

    let html = `<div style="margin-bottom:1.25rem">
        <h4 style="font-size:.95rem;margin:0 0 .75rem;display:flex;align-items:center;gap:.5rem">
            Sesiones
            <span style="font-size:.8rem;font-weight:400;color:var(--color-text-muted)">(${sesiones.length})</span>
        </h4>`;

    sesiones.forEach(s => {
        const durText  = s.duracion_min ? ` &middot; ${escHtml(String(s.duracion_min))} min` : '';
        const notaHtml = s.nota_clinica
            ? `<div id="notaDisplay_${s.sesion_id}" data-nota="${escHtml(s.nota_clinica)}" style="margin-top:.4rem">
                   ${_notaDisplayHtml(s.sesion_id, s.nota_clinica)}
               </div>`
            : `<div id="notaDisplay_${s.sesion_id}" data-nota="" style="margin-top:.25rem">${_btnLapiz(s.sesion_id)}</div>`;
        html += `
        <div id="sesionCard_${s.sesion_id}" style="border-left:3px solid var(--color-border);padding:.75rem 1rem;margin-bottom:.75rem;background:var(--color-bg);border-radius:0 var(--radius) var(--radius) 0">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.25rem">
                <strong style="font-size:.9rem">Sesi&oacute;n #${escHtml(String(s.numero_sesion))}</strong>
                <span style="font-size:.8rem;color:var(--color-text-muted)">${formatFechaHora(s.fecha_sesion)}${durText}</span>
            </div>
            ${notaHtml}
        </div>`;
    });

    html += '</div>';
    return html;
}

function editarNotaSesion(sesionId) {
    const display = document.getElementById(`notaDisplay_${sesionId}`);
    if (!display) return;
    const notaActual = display.dataset.nota || '';
    display.innerHTML = `
        <textarea id="notaEdit_${sesionId}" rows="4" class="input"
            style="width:100%;resize:vertical;font-size:.875rem;margin-bottom:.5rem;box-sizing:border-box"
        >${escHtml(notaActual)}</textarea>
        <div style="display:flex;gap:.5rem;justify-content:flex-end">
            <button class="btn" onclick="cancelarEditarNota(${sesionId})" style="font-size:.82rem;padding:.3rem .75rem">Cancelar</button>
            <button class="btn btn-primary" id="btnGuardarNota_${sesionId}" onclick="guardarNotaSesion(${sesionId})" style="font-size:.82rem;padding:.3rem .75rem">Guardar</button>
        </div>`;
}

function cancelarEditarNota(sesionId) {
    const display = document.getElementById(`notaDisplay_${sesionId}`);
    if (!display) return;
    const nota = display.dataset.nota || '';
    display.innerHTML = nota ? _notaDisplayHtml(sesionId, nota) : _btnLapiz(sesionId);
}

async function guardarNotaSesion(sesionId) {
    const ta  = document.getElementById(`notaEdit_${sesionId}`);
    const btn = document.getElementById(`btnGuardarNota_${sesionId}`);
    if (!ta || !btn) return;
    const nota = ta.value;
    btn.disabled = true;
    btn.textContent = 'Guardando\u2026';
    try {
        const res = await api('/api/sesiones/nota', {
            method: 'PUT',
            body: JSON.stringify({ id: sesionId, nota_clinica: nota })
        });
        if (!res.success) throw new Error(res.message || 'Error al guardar');
        const display = document.getElementById(`notaDisplay_${sesionId}`);
        display.dataset.nota = nota;
        display.innerHTML = nota ? _notaDisplayHtml(sesionId, nota) : _btnLapiz(sesionId);
    } catch (e) {
        alert(e.message);
        btn.disabled = false;
        btn.textContent = 'Guardar';
    }
}

function renderTareas(tareas) {
    if (!tareas.length) return '';

    let html = `<div>
        <h4 style="font-size:.95rem;margin:0 0 .75rem;display:flex;align-items:center;gap:.5rem">
            Tareas
            <span style="font-size:.8rem;font-weight:400;color:var(--color-text-muted)">(${tareas.length})</span>
        </h4>`;

    tareas.forEach(t => {
        const estadoColor = t.estado === 'completada' ? 'var(--color-success)'
                          : t.estado === 'pendiente'  ? 'var(--color-warning)'
                          : 'var(--color-info)';
        html += `
        <div style="border:1px solid var(--color-border);border-radius:var(--radius);padding:.75rem 1rem;margin-bottom:.65rem">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;margin-bottom:.4rem;flex-wrap:wrap">
                <strong style="font-size:.9rem">${escHtml(t.titulo)}</strong>
                <span style="font-size:.75rem;color:#fff;background:${estadoColor};padding:.15rem .5rem;border-radius:999px;white-space:nowrap">${escHtml(t.estado || '')}</span>
            </div>
            ${t.descripcion ? `<p style="font-size:.85rem;margin:0 0 .4rem;color:var(--color-text-muted)">${escHtml(t.descripcion)}</p>` : ''}
            <div style="font-size:.8rem;color:var(--color-text-muted);margin-bottom:.35rem">
                Asignada: ${formatFecha(t.fecha_asignacion)}
                ${t.fecha_limite ? ' · Límite: ' + formatFecha(t.fecha_limite) : ''}
            </div>
            ${t.respuesta_paciente ? `
            <div style="background:#f0f9ff;border-left:3px solid var(--color-info);padding:.5rem .75rem;border-radius:0 var(--radius) var(--radius) 0;margin-top:.4rem">
                <span style="font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:var(--color-info)">Respuesta del paciente</span>
                <p style="font-size:.85rem;margin:.2rem 0 0;white-space:pre-wrap">${escHtml(t.respuesta_paciente)}</p>
            </div>` : ''}
        </div>`;
    });

    html += '</div>';
    return html;
}

function renderBadgeEstado(estado) {
    const map = {
        'activa':     ['var(--color-success)', 'Activa'],
        'cerrada':    ['var(--color-text-muted)', 'Cerrada'],
        'suspendida': ['var(--color-warning)', 'Suspendida'],
    };
    const [bg, label] = map[estado] || ['var(--color-text-muted)', estado || '—'];
    return `<span style="display:inline-block;background:${bg};color:#fff;font-size:.75rem;padding:.2rem .6rem;border-radius:999px">${escHtml(label)}</span>`;
}

function formatFecha(str) {
    if (!str) return '—';
    // Acepta "YYYY-MM-DD" o datetime completo
    const d = new Date(str.includes('T') ? str : str + 'T00:00:00');
    if (isNaN(d)) return str;
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatFechaHora(str) {
    if (!str) return '—';
    const d = new Date(str.includes('T') ? str : str.replace(' ', 'T'));
    if (isNaN(d)) return str;
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
         + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function escHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
