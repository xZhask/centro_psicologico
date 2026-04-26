
let calendarInstance = null;

async function calendario(){

    document.getElementById('view').innerHTML = `
        <h2>Calendario de Citas</h2>
        <div id="calendar"></div>
    `;

    // Cargar citas y talleres en paralelo
    const [resCitas, resTalleres] = await Promise.all([
        api('/api/citas'),
        api('/api/talleres'),
    ]);

    let events = [];

    if (resCitas.data) {
        const citaEvents = resCitas.data.map(c => ({
            id:    c.cita_id || c.id,
            title: c.paciente || 'Cita',
            start: c.fecha_hora_inicio,
            color: colorEstado(c.estado),
            extendedProps: {
                tipo:                  'cita',
                tipo_cita:             c.tipo_cita              || null,
                estado:                c.estado                 || 'pendiente',
                profesional:           c.profesional            || '-',
                subservicio:           c.subservicio            || '-',
                duracion_min:          c.duracion_min           || null,
                precio_acordado:       c.precio_acordado        ?? null,
                precio_final_atencion: c.precio_final_atencion  ?? null,
            }
        }));
        events = events.concat(citaEvents);
    }

    if (resTalleres.data) {
        for (const taller of resTalleres.data) {
            if (!taller.fechas) continue;
            for (const fecha of taller.fechas) {
                if (fecha.estado === 'cancelada') continue;
                const start = fecha.fecha_hora.replace(' ', 'T');
                const endMs = new Date(start).getTime() + (fecha.duracion_min || 90) * 60000;
                const end   = new Date(endMs).toISOString().slice(0, 16);
                events.push({
                    id:    'tf_' + fecha.id,
                    title: taller.tema + (taller.institucion ? ' · ' + taller.institucion : ''),
                    start,
                    end,
                    color: '#E8B84B',
                    extendedProps: {
                        tipo:        'taller',
                        taller_id:   taller.id,
                        fecha_id:    fecha.id,
                        institucion: taller.institucion || '-',
                        profesional: taller.profesional || '-',
                        asistentes:  fecha.asistentes,
                        estado:      fecha.estado,
                    }
                });
            }
        }
    }

    // Para talleres necesitamos sus fechas: hacer second fetch de detalle
    // Si findAll no incluye fechas, las buscamos ahora
    if (resTalleres.data && resTalleres.data.length > 0 && !resTalleres.data[0].fechas) {
        const detalles = await Promise.all(
            resTalleres.data.map(t => api('/api/taller?id=' + t.id))
        );
        for (const det of detalles) {
            if (!det.success || !det.data) continue;
            const taller = det.data;
            for (const fecha of (taller.fechas || [])) {
                if (fecha.estado === 'cancelada') continue;
                const start = fecha.fecha_hora.replace(' ', 'T');
                const endMs = new Date(start).getTime() + (fecha.duracion_min || 90) * 60000;
                const end   = new Date(endMs).toISOString().slice(0, 16);
                // Evitar duplicados si ya se cargaron arriba
                if (!events.find(e => e.id === 'tf_' + fecha.id)) {
                    events.push({
                        id:    'tf_' + fecha.id,
                        title: taller.tema + (taller.institucion ? ' · ' + taller.institucion : ''),
                        start,
                        end,
                        color: '#E8B84B',
                        extendedProps: {
                            tipo:        'taller',
                            taller_id:   taller.id,
                            fecha_id:    fecha.id,
                            institucion: taller.institucion || '-',
                            profesional: taller.profesional || '-',
                            asistentes:  fecha.asistentes,
                            estado:      fecha.estado,
                        }
                    });
                }
            }
        }
    }

    let calendarEl = document.getElementById('calendar');

    if(calendarInstance){
        calendarInstance.destroy();
    }

    calendarInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        locale: 'es',
        selectable: true,
        editable: true,
        height: 'auto',

        events: events,

        dateClick: function(info){
            abrirModalCita();
        },

        eventDrop: async function(info){
            // Solo citas son reprogramables desde el calendario
            if (info.event.extendedProps.tipo === 'taller') {
                info.revert();
                showToast('Los talleres no se reprograman desde el calendario');
                return;
            }
            const nuevaFecha = info.event.startStr.replace('T', ' ').substring(0, 16) + ':00';
            const res = await api('/api/citas/reprogramar', 'POST', {
                id:          parseInt(info.event.id),
                nueva_fecha: nuevaFecha,
                motivo:      'Reprogramación desde calendario',
            });
            if (!res.success) {
                info.revert();
                showToast(res.message || 'No se pudo reprogramar');
            } else {
                showToast('Cita reprogramada');
                calendario();
            }
        },

        eventClick: function(info){
            if (info.event.extendedProps.tipo === 'taller') {
                mostrarPopupTaller(info);
            } else {
                mostrarPopupEvento(info);
            }
        }
    });

    calendarInstance.render();
}

// ---- Popup de taller ----

function mostrarPopupTaller(info) {
    cerrarPopupCalendario();

    const props = info.event.extendedProps;

    const ESTADO_COLOR = {
        programada: 'var(--color-info)',
        realizada:  'var(--color-success)',
        cancelada:  'var(--color-danger)',
    };
    const estadoColor = ESTADO_COLOR[props.estado] || 'var(--color-text-muted)';

    const popup = document.createElement('div');
    popup.id = 'calendarPopup';
    popup.style.cssText = [
        'position:fixed',
        'z-index:2000',
        'background:var(--color-surface)',
        'border:1px solid var(--color-border)',
        'border-radius:var(--radius-lg)',
        'padding:14px 16px',
        'min-width:220px',
        'max-width:290px',
        'box-shadow:var(--shadow)',
        'font-size:.88rem',
    ].join(';');

    popup.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
            <strong style="font-size:.95rem">${info.event.title}</strong>
            <button onclick="cerrarPopupCalendario()" style="background:none;border:none;cursor:pointer;color:var(--color-text-muted);font-size:1.2rem;line-height:1;padding:0 0 0 8px">&times;</button>
        </div>
        <div style="margin-bottom:6px">
            <span style="display:inline-block;font-size:.68rem;font-weight:700;padding:2px 7px;border-radius:3px;background:#E8B84B;color:#fff;letter-spacing:.04em">TALLER</span>
            <span style="display:inline-block;font-size:.7rem;font-weight:600;padding:2px 7px;border-radius:3px;background:${estadoColor};color:#fff;margin-left:4px">${props.estado}</span>
        </div>
        <div style="color:var(--color-text-muted);margin-bottom:4px">
            <span style="font-weight:500;color:var(--color-text)">Profesional:</span> ${props.profesional}
        </div>
        <div style="color:var(--color-text-muted);margin-bottom:4px">
            <span style="font-weight:500;color:var(--color-text)">Institución:</span> ${props.institucion}
        </div>
        ${props.asistentes != null ? `<div style="color:var(--color-text-muted);margin-bottom:12px"><span style="font-weight:500;color:var(--color-text)">Asistentes:</span> ${props.asistentes}</div>` : '<div style="margin-bottom:12px"></div>'}
        <div style="display:flex;gap:6px">
            <button class="btn-sm" style="background:var(--color-primary);color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer" onclick="cerrarPopupCalendario();navigate('talleres');setTimeout(()=>verDetalleTaller(${props.taller_id}),400)">Ver taller completo</button>
        </div>
    `;

    const rect = info.el.getBoundingClientRect();
    const top  = Math.min(rect.bottom + 4, window.innerHeight - 240);
    const left = Math.min(rect.left,       window.innerWidth  - 300);
    popup.style.top  = top  + 'px';
    popup.style.left = left + 'px';

    document.body.appendChild(popup);
    setTimeout(() => document.addEventListener('click', _onClickFueraPopup), 0);
}

// ---- Badge de tipo_cita (igual al listado) ----

function tipoCitaBadge(tipoCita) {
    if (tipoCita === 'sesion_existente') {
        return `<span style="display:inline-block;font-size:.6rem;font-weight:600;padding:1px 6px;border-radius:3px;background:var(--color-secondary,#17a589);color:#fff;letter-spacing:.03em">SESIÓN</span>`;
    }
    if (tipoCita === 'nueva_atencion') {
        return `<span style="display:inline-block;font-size:.6rem;font-weight:600;padding:1px 6px;border-radius:3px;background:var(--color-primary,#2E86C1);color:#fff;letter-spacing:.03em">NUEVA ATENCIÓN</span>`;
    }
    return '';
}

// ---- Popup de evento de cita ----

function mostrarPopupEvento(info) {
    cerrarPopupCalendario();

    const props = info.event.extendedProps;
    const id    = info.event.id;

    const badgeTipo = tipoCitaBadge(props.tipo_cita);

    const ESTADO_COLOR = {
        pendiente:    'var(--color-warning)',
        confirmada:   'var(--color-info)',
        completada:   'var(--color-success)',
        cancelada:    'var(--color-danger)',
        no_asistio:   'var(--color-warning)',
        reprogramada: '#9B7EC8',
    };
    const estadoColor = ESTADO_COLOR[props.estado] || 'var(--color-text-muted)';

    const popup = document.createElement('div');
    popup.id = 'calendarPopup';
    popup.style.cssText = [
        'position:fixed',
        'z-index:2000',
        'background:var(--color-surface)',
        'border:1px solid var(--color-border)',
        'border-radius:var(--radius-lg)',
        'padding:14px 16px',
        'min-width:220px',
        'max-width:280px',
        'box-shadow:var(--shadow)',
        'font-size:.88rem',
    ].join(';');

    popup.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
            <strong style="font-size:.95rem">${info.event.title}</strong>
            <button onclick="cerrarPopupCalendario()" style="background:none;border:none;cursor:pointer;color:var(--color-text-muted);font-size:1.2rem;line-height:1;padding:0 0 0 8px">&times;</button>
        </div>
        ${badgeTipo ? `<div style="margin-bottom:8px">${badgeTipo}</div>` : ''}
        <div style="margin-bottom:6px">
            <span style="display:inline-block;font-size:.7rem;font-weight:600;padding:2px 7px;border-radius:3px;background:${estadoColor};color:#fff">${props.estado.replace('_', ' ')}</span>
        </div>
        <div style="color:var(--color-text-muted);margin-bottom:4px">
            <span style="font-weight:500;color:var(--color-text)">Profesional:</span> ${props.profesional}
        </div>
        <div style="color:var(--color-text-muted);margin-bottom:4px">
            <span style="font-weight:500;color:var(--color-text)">Servicio:</span> ${props.subservicio}
        </div>
        ${(() => {
            const pc = props.precio_acordado      != null ? parseFloat(props.precio_acordado)      : null;
            const pf = props.precio_final_atencion != null ? parseFloat(props.precio_final_atencion) : null;
            if (pc !== null && pf !== null) {
                return `<div style="color:var(--color-text-muted);margin-bottom:12px"><span style="font-weight:500;color:var(--color-text)">Precio:</span> S/ ${pf.toFixed(2)} <span style="font-size:.75rem">(confirmado)</span></div>`;
            } else if (pc !== null) {
                return `<div style="color:var(--color-text-muted);margin-bottom:12px"><span style="font-weight:500;color:var(--color-text)">Precio:</span> S/ ${pc.toFixed(2)} <span style="font-size:.75rem">(acordado)</span></div>`;
            }
            return `<div style="color:var(--color-text-muted);margin-bottom:12px"><span style="font-weight:500;color:var(--color-text)">Precio:</span> —</div>`;
        })()}
        <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn-sm" style="color:var(--color-danger)" onclick="cerrarPopupCalendario();cambiarEstadoCita(${id},'cancelada')">Cancelar cita</button>
        </div>
    `;

    const rect = info.el.getBoundingClientRect();
    const top  = Math.min(rect.bottom + 4, window.innerHeight - 220);
    const left = Math.min(rect.left,       window.innerWidth  - 292);
    popup.style.top  = top  + 'px';
    popup.style.left = left + 'px';

    document.body.appendChild(popup);
    setTimeout(() => document.addEventListener('click', _onClickFueraPopup), 0);
}

function _onClickFueraPopup(e) {
    const popup = document.getElementById('calendarPopup');
    if (popup && !popup.contains(e.target)) {
        cerrarPopupCalendario();
    }
}

function cerrarPopupCalendario() {
    const popup = document.getElementById('calendarPopup');
    if (popup) popup.remove();
    document.removeEventListener('click', _onClickFueraPopup);
}

// ---- Color por estado ----

function colorEstado(e){
    if(e === 'pendiente')    return '#E8B84B';
    if(e === 'confirmada')   return '#2A7F8F';
    if(e === 'cancelada')    return '#E74C3C';
    if(e === 'completada')   return '#27AE60';
    if(e === 'reprogramada') return '#9B7EC8';
    return '#6C757D';
}
