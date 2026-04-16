
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
            id: c.cita_id || c.id,
            title: c.paciente || 'Cita',
            start: c.fecha_hora_inicio,
            color: colorEstado(c.estado)
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
            document.getElementById('citaFecha').value = info.dateStr;
            abrirModalCita();
        },

        eventDrop: async function(info){
            await api('/api/citas/estado', 'PUT', {
                id: info.event.id,
                estado: 'reprogramada'
            });
            showToast('Cita reprogramada');
        },

        eventClick: function(info){
            if(confirm('¿Cancelar cita de ' + info.event.title + '?')){
                cambiarEstadoCita(info.event.id, 'cancelada');
                info.event.remove();
            }
        }
    });

    calendarInstance.render();
}

function colorEstado(e){
    if(e === 'pendiente')    return '#E8B84B'; // --color-warning
    if(e === 'confirmada')   return '#2A7F8F'; // --color-primary
    if(e === 'cancelada')    return '#E74C3C'; // --color-danger
    if(e === 'completada')   return '#27AE60'; // --color-success
    if(e === 'reprogramada') return '#9B7EC8'; // --color-secondary
    return '#6C757D';                          // --color-text-muted
}
