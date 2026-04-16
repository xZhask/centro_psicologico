
async function reportes(){

    let html = `
        <h2>Reportes</h2>
        <div class="tabs">
            <button class="tab-btn active" onclick="reporteSaldos(this)">Saldos</button>
            <button class="tab-btn" onclick="reporteHistorial(this)">Historial</button>
            <button class="tab-btn" onclick="reporteAgenda(this)">Agenda Hoy</button>
            <button class="tab-btn" onclick="reporteCheckin(this)">Check-in</button>
        </div>
        <div id="reporteContent"></div>
    `;

    document.getElementById('view').innerHTML = html;
    reporteSaldos(document.querySelector('.tab-btn'));
}

function activarTab(btn){
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

async function reporteSaldos(btn){
    activarTab(btn);
    let res = await api('/api/reportes/saldos');
    let html = '<table class="table"><tr><th>Paciente</th><th>Saldo Pendiente</th></tr>';
    if(res.data){
        res.data.forEach(r=>{
            html += `<tr><td>${r.paciente || '-'}</td><td>S/ ${r.saldo_total_pendiente || '0.00'}</td></tr>`;
        });
    }
    html += '</table>';
    document.getElementById('reporteContent').innerHTML = html;
}

async function reporteHistorial(btn){
    activarTab(btn);
    let res = await api('/api/reportes/historial');
    let html = '<table class="table"><tr><th>Fecha</th><th>Paciente</th><th>Profesional</th><th>Diagnóstico</th></tr>';
    if(res.data){
        res.data.forEach(r=>{
            html += `<tr>
                <td>${r.fecha || '-'}</td>
                <td>${r.paciente || '-'}</td>
                <td>${r.profesional || '-'}</td>
                <td>${r.cie10_codigo || '-'}</td>
            </tr>`;
        });
    }
    html += '</table>';
    document.getElementById('reporteContent').innerHTML = html;
}

async function reporteAgenda(btn){
    activarTab(btn);
    let res = await api('/api/reportes/agenda');
    let html = '<table class="table"><tr><th>Paciente</th><th>Hora</th><th>Estado</th></tr>';
    if(res.data){
        res.data.forEach(r=>{
            html += `<tr>
                <td>${r.paciente || '-'}</td>
                <td>${r.fecha_hora_inicio || '-'}</td>
                <td>${r.estado || '-'}</td>
            </tr>`;
        });
    }
    html += '</table>';
    document.getElementById('reporteContent').innerHTML = html;
}

async function reporteCheckin(btn){
    activarTab(btn);
    let res = await api('/api/reportes/checkin');
    let html = '<table class="table"><tr><th>Paciente</th><th>Sesiones</th><th>Estado</th></tr>';
    if(res.data){
        res.data.forEach(r=>{
            html += `<tr>
                <td>${r.paciente || '-'}</td>
                <td>${r.total_sesiones || '-'}</td>
                <td>${r.estado || '-'}</td>
            </tr>`;
        });
    }
    html += '</table>';
    document.getElementById('reporteContent').innerHTML = html;
}
