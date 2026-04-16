
async function historia(){

    let res = await api('/api/reportes/historial');

    let html = '<h2>Historia Clínica</h2>';
    html += '<div class="timeline">';

    if(res.data && res.data.length > 0){
        res.data.forEach(e => {
            html += `
            <div class="event">
                <strong>${e.fecha || ''}</strong><br>
                Paciente: ${e.paciente || '-'}<br>
                Profesional: ${e.profesional || '-'}<br>
                Diagnóstico: ${e.cie10_codigo || '-'}<br>
                Observación: ${e.observacion || '-'}
            </div>`;
        });
    }else{
        html += '<div class="card">No hay registros de historia clínica disponibles.</div>';
    }

    html += '</div>';
    document.getElementById('view').innerHTML = html;
}
