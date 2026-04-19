
let calendarInstance = null;

async function calendario(){

    document.getElementById('view').innerHTML = `
        <h2>Calendario de Citas</h2>
        <div id="calendar"></div>
    `;

    let res = await api('/api/citas');

    let events = [];
    if(res.data){
        events = res.data.map(c => ({
            id:    c.cita_id || c.id,
            title: c.paciente || 'Cita',
            start: c.fecha_hora_inicio,
            color: colorEstado(c.estado),
            extendedProps: {
                tipo_cita:   c.tipo_cita   || null,
                estado:      c.estado      || 'pendiente',
                profesional: c.profesional || '-',
                subservicio: c.subservicio || '-',
                duracion_min: c.duracion_min || null,
            }
        }));
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
            mostrarPopupEvento(info);
        }
    });

    calendarInstance.render();
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

// ---- Popup de evento ----

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
        <div style="color:var(--color-text-muted);margin-bottom:12px">
            <span style="font-weight:500;color:var(--color-text)">Servicio:</span> ${props.subservicio}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn-sm" style="color:var(--color-danger)" onclick="cerrarPopupCalendario();cambiarEstadoCita(${id},'cancelada')">Cancelar cita</button>
        </div>
    `;

    // Posicionar cerca del elemento del evento
    const rect = info.el.getBoundingClientRect();
    const top  = Math.min(rect.bottom + 4, window.innerHeight - 220);
    const left = Math.min(rect.left,       window.innerWidth  - 292);
    popup.style.top  = top  + 'px';
    popup.style.left = left + 'px';

    document.body.appendChild(popup);

    // Cerrar al hacer clic fuera del popup
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
