
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function reportes() {
    const html = `
        <h2>Reportes</h2>
        <div class="tabs">
            <button class="tab-btn active" onclick="reporteSaldos(this)">Saldos</button>
            <button class="tab-btn" onclick="reporteHistorial(this)">Historial Clínico</button>
            <button class="tab-btn" onclick="reporteAgenda(this)">Agenda Hoy</button>
            <button class="tab-btn" onclick="reporteCheckin(this)">Check-in</button>
        </div>
        <div id="reporteContent"></div>
    `;
    document.getElementById('view').innerHTML = html;
    reporteSaldos(document.querySelector('.tab-btn'));
}

function activarTab(btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

/* ── Saldos ────────────────────────────────────────────────── */
async function reporteSaldos(btn) {
    activarTab(btn);
    const res = await api('/api/reportes/saldos');
    let html = '<table class="table"><thead><tr><th>Paciente</th><th>Saldo Pendiente</th></tr></thead><tbody>';
    if (res.data && res.data.length) {
        res.data.forEach(r => {
            html += `<tr><td>${escapeHtml(r.paciente)}</td><td>S/ ${escapeHtml(r.saldo_total_pendiente ?? '0.00')}</td></tr>`;
        });
    } else {
        html += '<tr><td colspan="2" style="text-align:center;color:var(--color-text-muted)">Sin registros</td></tr>';
    }
    html += '</tbody></table>';
    document.getElementById('reporteContent').innerHTML = html;
}

/* ── Historial Clínico ─────────────────────────────────────── */
async function reporteHistorial(btn) {
    activarTab(btn);

    // Cargar lista de pacientes para el selector
    const resPacientes = await api('/api/pacientes');
    const pacientes = resPacientes.data || [];

    let opts = '<option value="">-- Seleccione un paciente --</option>';
    pacientes.forEach(p => {
        const nombre = `${p.apellidos || ''}, ${p.nombres || ''}`.trim().replace(/^,\s*/, '');
        opts += `<option value="${escapeHtml(p.id)}">${escapeHtml(nombre)}</option>`;
    });

    document.getElementById('reporteContent').innerHTML = `
        <div style="display:flex;align-items:flex-end;gap:.75rem;flex-wrap:wrap;margin-bottom:1.2rem">
            <div class="form-group" style="flex:1;min-width:260px;max-width:420px;margin:0">
                <label for="historialPacienteSelect">Paciente</label>
                <select id="historialPacienteSelect" class="input" onchange="cargarHistorial(this.value)">
                    ${opts}
                </select>
            </div>
            <button id="btnExportarHistorialPDF" class="btn btn-primary"
                    style="display:none;gap:.4rem;padding:.45rem .9rem;font-size:.85rem;white-space:nowrap"
                    onclick="exportarHistorialPDF()">
                ↓ Exportar PDF
            </button>
        </div>
        <div id="historialResultado">
            <p style="color:var(--color-text-muted)">Seleccione un paciente para ver su historial clínico.</p>
        </div>
    `;
}

async function cargarHistorial(pacienteId) {
    const contenedor  = document.getElementById('historialResultado');
    const btnPDF      = document.getElementById('btnExportarHistorialPDF');

    if (!pacienteId) {
        contenedor.innerHTML = '<p style="color:var(--color-text-muted)">Seleccione un paciente para ver su historial clínico.</p>';
        if (btnPDF) btnPDF.style.display = 'none';
        return;
    }

    contenedor.innerHTML = '<p style="color:var(--color-text-muted)">Cargando...</p>';
    if (btnPDF) btnPDF.style.display = 'none';

    const res = await api(`/api/reportes/historial?paciente_id=${encodeURIComponent(pacienteId)}`);

    if (!res.success || !res.data || !res.data.length) {
        contenedor.innerHTML = '<p style="color:var(--color-text-muted)">Este paciente no tiene historial registrado.</p>';
        return;
    }

    // Agrupar filas por atencion_id
    const atenciones = {};
    res.data.forEach(row => {
        const aid = row.atencion_id;
        if (!atenciones[aid]) {
            atenciones[aid] = {
                atencion_id:    row.atencion_id,
                fecha_inicio:   row.fecha_inicio,
                fecha_fin:      row.fecha_fin,
                estado_atencion: row.estado_atencion,
                motivo_consulta: row.motivo_consulta,
                subservicio:    row.subservicio,
                modalidad:      row.modalidad,
                profesional:    row.profesional,
                diagnostico:    row.diagnostico,
                cie10_codigo:   row.cie10_codigo,
                recomendaciones: row.recomendaciones,
                sesiones: [],
            };
        }
        // Solo agregar si hay sesión real
        if (row.sesion_id) {
            atenciones[aid].sesiones.push({
                sesion_id:     row.sesion_id,
                numero_sesion: row.numero_sesion,
                fecha_sesion:  row.fecha_sesion,
                estado_sesion: row.estado_sesion,
                nota_clinica:  row.nota_clinica,
            });
        }
    });

    let html = '';
    Object.values(atenciones).forEach(at => {
        const estadoBadge = _badgeEstadoAtencion(at.estado_atencion);
        const fechaFin = at.fecha_fin ? ` — ${at.fecha_fin}` : '';
        const dx = at.cie10_codigo
            ? `<span class="badge" style="background:var(--color-info);color:#fff">${escapeHtml(at.cie10_codigo)}</span> ${escapeHtml(at.diagnostico)}`
            : '<span style="color:var(--color-text-muted)">Sin diagnóstico principal</span>';

        html += `
        <div class="card" style="margin-bottom:1.2rem;padding:1.2rem 1.4rem">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.5rem;margin-bottom:.8rem">
                <div>
                    <strong style="font-size:1.05rem">${escapeHtml(at.subservicio)}</strong>
                    <span style="color:var(--color-text-muted);font-size:.85rem;margin-left:.5rem">${escapeHtml(at.modalidad || '')}</span><br>
                    <span style="color:var(--color-text-muted);font-size:.88rem">
                        ${escapeHtml(at.fecha_inicio)}${escapeHtml(fechaFin)} &nbsp;·&nbsp; ${escapeHtml(at.profesional)}
                    </span>
                </div>
                <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
                    ${estadoBadge}
                </div>
            </div>

            <div style="margin-bottom:.7rem;font-size:.92rem">
                <strong>Motivo de consulta:</strong> ${escapeHtml(at.motivo_consulta)}
            </div>

            <div style="margin-bottom:.9rem;font-size:.92rem">
                <strong>Diagnóstico principal:</strong> ${dx}
            </div>

            ${_renderSesiones(at.sesiones)}

            ${at.recomendaciones ? `<div style="margin-top:.7rem;font-size:.88rem;color:var(--color-text-muted)"><strong>Recomendaciones:</strong> ${escapeHtml(at.recomendaciones)}</div>` : ''}
        </div>`;
    });

    contenedor.innerHTML = html;

    // Mostrar botón PDF ahora que hay datos
    if (btnPDF) {
        btnPDF.dataset.pacienteId = pacienteId;
        btnPDF.style.display = '';
    }
}

function exportarHistorialPDF() {
    const btn = document.getElementById('btnExportarHistorialPDF');
    const pid = btn ? btn.dataset.pacienteId : null;
    if (!pid) return;
    window.open('/api/pdf/historial?paciente_id=' + encodeURIComponent(pid), '_blank');
}

function _badgeEstadoAtencion(estado) {
    const map = {
        activa:     ['var(--color-success)', 'Activa'],
        completada: ['var(--color-primary)', 'Completada'],
        cancelada:  ['var(--color-danger)',  'Cancelada'],
    };
    const [color, label] = map[estado] || ['var(--color-text-muted)', estado || ''];
    return `<span class="badge" style="background:${color};color:#fff">${escapeHtml(label)}</span>`;
}

function _renderSesiones(sesiones) {
    if (!sesiones.length) {
        return '<p style="color:var(--color-text-muted);font-size:.88rem">Sin sesiones registradas.</p>';
    }
    const estadoColor = { realizada: 'var(--color-success)', programada: 'var(--color-info)', cancelada: 'var(--color-danger)', no_asistio: 'var(--color-warning)' };
    let rows = sesiones.map(s => {
        const color = estadoColor[s.estado_sesion] || 'var(--color-text-muted)';
        const nota  = s.nota_clinica
            ? `<div style="margin-top:.3rem;font-size:.85rem;color:var(--color-text);background:var(--color-bg);border-left:3px solid var(--color-primary);padding:.4rem .7rem;border-radius:0 4px 4px 0">${escapeHtml(s.nota_clinica)}</div>`
            : `<span style="color:var(--color-text-muted);font-size:.83rem">Sin nota clínica</span>`;
        return `
            <tr>
                <td style="white-space:nowrap">#${escapeHtml(String(s.numero_sesion))}</td>
                <td style="white-space:nowrap">${escapeHtml(s.fecha_sesion || '-')}</td>
                <td><span class="badge" style="background:${color};color:#fff">${escapeHtml(s.estado_sesion || '-')}</span></td>
                <td style="width:60%">${nota}</td>
            </tr>`;
    }).join('');

    return `
        <details open style="margin-top:.4rem">
            <summary style="cursor:pointer;font-size:.93rem;font-weight:600;color:var(--color-primary-dark);margin-bottom:.4rem">
                Sesiones (${sesiones.length})
            </summary>
            <div style="overflow-x:auto">
                <table class="table" style="font-size:.88rem">
                    <thead><tr><th>#</th><th>Fecha</th><th>Estado</th><th>Nota clínica</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </details>`;
}

/* ── Agenda ────────────────────────────────────────────────── */
async function reporteAgenda(btn) {
    activarTab(btn);
    const res = await api('/api/reportes/agenda');
    let html = '<table class="table"><thead><tr><th>Paciente</th><th>Hora</th><th>Estado</th></tr></thead><tbody>';
    if (res.data && res.data.length) {
        res.data.forEach(r => {
            html += `<tr>
                <td>${escapeHtml(r.paciente)}</td>
                <td>${escapeHtml(r.fecha_hora_inicio)}</td>
                <td>${escapeHtml(r.estado)}</td>
            </tr>`;
        });
    } else {
        html += '<tr><td colspan="3" style="text-align:center;color:var(--color-text-muted)">Sin citas para hoy</td></tr>';
    }
    html += '</tbody></table>';
    document.getElementById('reporteContent').innerHTML = html;
}

/* ── Check-in ──────────────────────────────────────────────── */
async function reporteCheckin(btn) {
    activarTab(btn);
    const res = await api('/api/reportes/checkin');
    let html = '<table class="table"><thead><tr><th>Paciente</th><th>Sesiones</th><th>Estado</th></tr></thead><tbody>';
    if (res.data && res.data.length) {
        res.data.forEach(r => {
            html += `<tr>
                <td>${escapeHtml(r.paciente)}</td>
                <td>${escapeHtml(r.total_sesiones)}</td>
                <td>${escapeHtml(r.estado)}</td>
            </tr>`;
        });
    } else {
        html += '<tr><td colspan="3" style="text-align:center;color:var(--color-text-muted)">Sin registros</td></tr>';
    }
    html += '</tbody></table>';
    document.getElementById('reporteContent').innerHTML = html;
}
