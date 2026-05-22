let calendarInstance = null;

async function calendario() {
    if (calendarInstance) {
        try {
            calendarInstance.destroy();
        } catch(e) {
            console.warn('Error al destruir instancia de calendario:', e);
        }
        calendarInstance = null;
    }

    // Inyectar estructura HTML del calendario y la barra de navegación premium
    document.getElementById('view').innerHTML = `
        <div class="calendar-wrapper">
            <div class="calendar-header-toolbar">
                <div class="cht-left">
                    <button class="cht-btn cht-btn-today" id="btnToday">Hoy</button>
                    <div class="cht-nav-group">
                        <button class="cht-btn cht-btn-icon" id="btnPrev" title="Anterior">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </button>
                        <button class="cht-btn cht-btn-icon" id="btnNext" title="Siguiente">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </button>
                    </div>
                    <span class="calendar-title" id="calendarTitle">Cargando fecha...</span>
                </div>
                <div class="cht-right">
                    <div class="cht-view-group">
                        <button class="cht-btn cht-view-btn active" data-view="week" id="btnViewWeek">Semana</button>
                        <button class="cht-btn cht-view-btn" data-view="month" id="btnViewMonth">Mes</button>
                        <button class="cht-btn cht-view-btn" data-view="day" id="btnViewDay">Día</button>
                    </div>
                </div>
            </div>
            <div id="calendar" style="height: 700px; background: var(--color-surface); border-radius: var(--radius-lg); box-shadow: var(--shadow);"></div>
        </div>
    `;

    // Cargar citas y talleres en paralelo
    const [resCitas, resTalleres] = await Promise.all([
        api('/api/citas'),
        api('/api/talleres'),
    ]);

    let events = [];

    // Mapear citas
    if (resCitas.data) {
        const citaEvents = resCitas.data.map(c => {
            const start = c.fecha_hora_inicio.replace(' ', 'T');
            const duracion = parseInt(c.duracion_min) || 50;
            const end = new Date(new Date(start).getTime() + duracion * 60000).toISOString();
            const color = colorEstado(c.estado);

            return {
                id:              String(c.cita_id || c.id),
                calendarId:      'cita',
                title:           c.paciente || 'Cita',
                start,
                end,
                backgroundColor: color,
                borderColor:     color,
                color:           '#ffffff',
                category:        'time',
                isReadOnly:      false, // Habilitar drag & drop
                raw: {
                    tipo:            'cita',
                    tipo_cita:       c.tipo_cita || null,
                    estado:          c.estado || 'pendiente',
                    profesional:     c.profesional || '-',
                    subservicio:     c.subservicio || '-',
                    duracion_min:    c.duracion_min || null,
                    precio_acordado: c.precio_acordado ?? null,
                }
            };
        });
        events = events.concat(citaEvents);
    }

    // Mapear talleres
    if (resTalleres.data) {
        for (const taller of resTalleres.data) {
            if (!taller.fechas) continue;
            for (const fecha of taller.fechas) {
                if (fecha.estado === 'cancelada') continue;
                const start = fecha.fecha_hora.replace(' ', 'T');
                const endMs = new Date(start).getTime() + (fecha.duracion_min || 90) * 60000;
                const end   = new Date(endMs).toISOString();

                events.push({
                    id:              'tf_' + fecha.id,
                    calendarId:      'taller',
                    title:           taller.tema + (taller.institucion ? ' · ' + taller.institucion : ''),
                    start,
                    end,
                    backgroundColor: '#E8B84B',
                    borderColor:     '#E8B84B',
                    color:           '#ffffff',
                    category:        'time',
                    isReadOnly:      true, // Talleres no son reprogramables desde calendario
                    raw: {
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

    // Si findAll no incluyó fechas de talleres de primeras, hacer second fetch de detalle
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
                const end   = new Date(endMs).toISOString();

                if (!events.find(e => e.id === 'tf_' + fecha.id)) {
                    events.push({
                        id:              'tf_' + fecha.id,
                        calendarId:      'taller',
                        title:           taller.tema + (taller.institucion ? ' · ' + taller.institucion : ''),
                        start,
                        end,
                        backgroundColor: '#E8B84B',
                        borderColor:     '#E8B84B',
                        color:           '#ffffff',
                        category:        'time',
                        isReadOnly:      true,
                        raw: {
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

    const calendarEl = document.getElementById('calendar');

    // Inicializar Toast UI Calendar
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    const calendarTheme = {
        common: {
            backgroundColor: isDark ? '#1E252B' : '#ffffff',
            border: isDark ? '1px solid #2E3A46' : '1px solid var(--color-border)',
            gridSelection: {
                backgroundColor: 'rgba(42, 127, 143, 0.08)',
                border: '1.5px dashed var(--color-primary)'
            },
            dayName: {
                color: isDark ? '#E0E6ED' : 'var(--color-text)'
            },
            holiday: {
                color: 'var(--color-danger)'
            },
            saturday: {
                color: 'var(--color-primary-dark)'
            }
        },
        week: {
            today: {
                color: 'var(--color-primary-dark)',
                backgroundColor: 'rgba(42, 127, 143, 0.05)'
            },
            pastDay: {
                color: 'var(--color-text-muted)'
            },
            timegridHalfHour: {
                borderBottom: '1px dotted var(--color-border-tertiary)'
            }
        }
    };
    
    calendarInstance = new tui.Calendar(calendarEl, {
        defaultView: 'week',
        useFormPopup: false,
        useDetailPopup: false,
        gridSelection: true,
        isReadOnly: false,
        week: {
            startDayOfWeek: 1, // Lunes
            hourStart: 8,
            hourEnd: 21,
            taskView: false,
            eventView: ['time'],
            dayNames: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
        },
        month: {
            startDayOfWeek: 1,
            dayNames: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
        }
    });

    calendarInstance.setTheme(calendarTheme);

    window._calendarioInstance = calendarInstance;

    // Cargar eventos mapeados en la instancia
    calendarInstance.createEvents(events);

    // Configurar controladores de navegación de la barra superior
    document.getElementById('btnToday').onclick = () => {
        calendarInstance.today();
        actualizarTituloCalendario();
    };

    document.getElementById('btnPrev').onclick = () => {
        calendarInstance.prev();
        actualizarTituloCalendario();
    };

    document.getElementById('btnNext').onclick = () => {
        calendarInstance.next();
        actualizarTituloCalendario();
    };

    const viewButtons = {
        week: document.getElementById('btnViewWeek'),
        month: document.getElementById('btnViewMonth'),
        day: document.getElementById('btnViewDay')
    };

    Object.keys(viewButtons).forEach(view => {
        viewButtons[view].onclick = () => {
            calendarInstance.changeView(view);
            Object.values(viewButtons).forEach(btn => btn.classList.remove('active'));
            viewButtons[view].classList.add('active');
            actualizarTituloCalendario();
        };
    });

    // Eventos del calendario
    
    // 1. Abrir modal para crear nueva cita al hacer clic en un rango del calendario
    calendarInstance.on('selectDateTime', (info) => {
        const selectedDate = info.start.toDate();
        abrirModalCita(selectedDate);
        calendarInstance.clearGridSelections();
    });

    // 2. Drag & drop para reprogramar cita
    calendarInstance.on('beforeUpdateEvent', async ({ event, changes }) => {
        if (event.raw.tipo === 'taller') {
            showToast('Los talleres no se reprograman desde el calendario');
            return;
        }

        const newStart = changes.start ? changes.start.toDate() : event.start.toDate();

        const y = newStart.getFullYear();
        const m = String(newStart.getMonth() + 1).padStart(2, '0');
        const d = String(newStart.getDate()).padStart(2, '0');
        const h = String(newStart.getHours()).padStart(2, '0');
        const min = String(newStart.getMinutes()).padStart(2, '0');
        const nuevaFecha = `${y}-${m}-${d} ${h}:${min}:00`;

        const res = await api('/api/citas/reprogramar', 'POST', {
            id:          parseInt(event.id),
            nueva_fecha: nuevaFecha,
            motivo:      'Reprogramación desde calendario',
        });

        if (!res.success) {
            showToast(res.message || 'No se pudo reprogramar');
        } else {
            showToast('Cita reprogramada');
            calendario(); // Refrescar calendario para sincronizar con backend
        }
    });

    // 3. Click en evento existente para abrir popup de detalle
    calendarInstance.on('clickEvent', ({ event, nativeEvent }) => {
        const simulatedInfo = {
            event: {
                id: event.id,
                title: event.title,
                extendedProps: event.raw
            },
            nativeEvent: nativeEvent
        };

        if (event.raw.tipo === 'taller') {
            mostrarPopupTaller(simulatedInfo);
        } else {
            mostrarPopupEvento(simulatedInfo);
        }
    });

    // Inicializar el título
    actualizarTituloCalendario();
    cerrarPopupCalendario();
}

// Actualizar dinámicamente el título del calendario según el rango visible actual
function actualizarTituloCalendario() {
    if (!calendarInstance) return;
    
    const start = calendarInstance.getDateRangeStart().toDate();
    const end = calendarInstance.getDateRangeEnd().toDate();
    const titleEl = document.getElementById('calendarTitle');
    if (!titleEl) return;

    const currentView = calendarInstance.getViewName();

    const MESES = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    if (currentView === 'month') {
        const date = calendarInstance.getDate().toDate();
        titleEl.textContent = `${MESES[date.getMonth()]} ${date.getFullYear()}`;
    } else if (currentView === 'week') {
        const startMes = MESES[start.getMonth()];
        const endMes = MESES[end.getMonth()];
        const startDia = start.getDate();
        const endDia = end.getDate();
        
        if (start.getFullYear() !== end.getFullYear()) {
            titleEl.textContent = `${startDia} de ${startMes} ${start.getFullYear()} - ${endDia} de ${endMes} ${end.getFullYear()}`;
        } else if (start.getMonth() !== end.getMonth()) {
            titleEl.textContent = `${startDia} de ${startMes} - ${endDia} de ${endMes} ${start.getFullYear()}`;
        } else {
            titleEl.textContent = `${startDia} - ${endDia} de ${startMes} ${start.getFullYear()}`;
        }
    } else {
        const date = calendarInstance.getDate().toDate();
        titleEl.textContent = `${date.getDate()} de ${MESES[date.getMonth()]} ${date.getFullYear()}`;
    }
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

    // Posicionamiento adaptativo del popup basado en coordenadas de click o bounding rect del elemento
    let top, left;
    if (info.nativeEvent) {
        top  = Math.min(info.nativeEvent.clientY + 12, window.innerHeight - 250);
        left = Math.min(info.nativeEvent.clientX - 100, window.innerWidth - 300);
        if (left < 10) left = 10;
    } else {
        top = 200;
        left = 200;
    }
    popup.style.top  = top  + 'px';
    popup.style.left = left + 'px';

    document.body.appendChild(popup);
    setTimeout(() => document.addEventListener('click', _onClickFueraPopup), 0);
}

// ---- Badge de tipo_cita (igual al listado) ----

function tipoCitaBadge(tipoCita) {
    if (tipoCita === 'sesion_existente') {
        return `<span style="display:inline-block;font-size:.6rem;font-weight:600;padding:1px 6px;border-radius:3px;background:var(--color-secondary,#9B7EC8);color:#fff;letter-spacing:.03em">SESIÓN</span>`;
    }
    if (tipoCita === 'nueva_atencion') {
        return `<span style="display:inline-block;font-size:.6rem;font-weight:600;padding:1px 6px;border-radius:3px;background:var(--color-primary,#2A7F8F);color:#fff;letter-spacing:.03em">NUEVA ATENCIÓN</span>`;
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
        confirmada:   '#2A7F8F',
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
            const pc = props.precio_acordado != null ? parseFloat(props.precio_acordado) : null;
            if (pc !== null) {
                return `<div style="color:var(--color-text-muted);margin-bottom:12px"><span style="font-weight:500;color:var(--color-text)">Precio:</span> S/ ${pc.toFixed(2)}</div>`;
            }
            return `<div style="color:var(--color-text-muted);margin-bottom:12px"><span style="font-weight:500;color:var(--color-text)">Precio:</span> —</div>`;
        })()}
        <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn-sm" style="color:var(--color-danger); border: 1px solid var(--color-border); background: var(--color-surface); padding: 4px 10px; border-radius: 4px; cursor: pointer;" onclick="cerrarPopupCalendario();cambiarEstadoCita(${id},'cancelada')">Cancelar cita</button>
        </div>
    `;

    // Posicionamiento adaptativo del popup basado en coordenadas de click o bounding rect del elemento
    let top, left;
    if (info.nativeEvent) {
        top  = Math.min(info.nativeEvent.clientY + 12, window.innerHeight - 230);
        left = Math.min(info.nativeEvent.clientX - 100, window.innerWidth - 292);
        if (left < 10) left = 10;
    } else {
        top = 200;
        left = 200;
    }
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

function colorEstado(e) {
    if (e === 'pendiente')    return '#E8B84B';
    if (e === 'confirmada')   return '#2A7F8F';
    if (e === 'cancelada')    return '#E74C3C';
    if (e === 'completada')   return '#27AE60';
    if (e === 'reprogramada') return '#9B7EC8';
    return '#6C757D';
}
