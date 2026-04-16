
async function dashboard(){

    const user = getUser();
    const esStaff = user && (user.rol === 'profesional' || user.rol === 'administrador');

    // Peticiones en paralelo; alertas solo para staff
    const [pacientes, citas, pagos, alertasRes] = await Promise.all([
        api('/api/pacientes'),
        api('/api/citas'),
        api('/api/cuentas'),
        esStaff ? api('/api/alertas/conteo') : Promise.resolve({ data: null }),
    ]);

    let totalPac      = pacientes.data ? pacientes.data.length : 0;
    let totalCitas    = citas.data ? citas.data.length : 0;
    let totalIngresos = pagos.data ? pagos.data.reduce((acc,p)=>acc+parseFloat(p.monto_total||0),0) : 0;
    let totalAlertas  = alertasRes.data ? alertasRes.data.total : null;

    // KPI de alertas: destacado visualmente si hay activas
    const kpiAlertas = esStaff ? `
        <div class="kpi" onclick="irAAlertasActivas()"
             style="cursor:pointer;border:2px solid ${totalAlertas > 0 ? 'var(--color-danger)' : 'var(--color-border)'};position:relative;transition:var(--transition)"
             title="Ver alertas activas">
            <span class="kpi-num" style="color:${totalAlertas > 0 ? 'var(--color-danger)' : 'inherit'}">${totalAlertas ?? 0}</span><br>
            Alertas activas
            ${totalAlertas > 0
                ? `<span style="position:absolute;top:8px;right:10px;width:10px;height:10px;border-radius:50%;background:var(--color-danger);animation:pulse 1.4s infinite"></span>`
                : ''}
        </div>` : '';

    let html = `
        <h2>Dashboard</h2>
        <div class="kpis">
            <div class="kpi"><span class="kpi-num">${totalPac}</span><br>Pacientes</div>
            <div class="kpi"><span class="kpi-num">${totalCitas}</span><br>Citas</div>
            <div class="kpi"><span class="kpi-num">S/ ${totalIngresos.toFixed(2)}</span><br>Ingresos</div>
            ${kpiAlertas}
        </div>
        <div class="charts-grid">
            <div class="chart-card"><canvas id="chartCitas"></canvas></div>
            <div class="chart-card"><canvas id="chartEstados"></canvas></div>
            <div class="chart-card"><canvas id="chartIngresos"></canvas></div>
        </div>
    `;

    document.getElementById('view').innerHTML = html;

    // Citas por día
    if(citas.data){
        let citasPorDia = {};
        citas.data.forEach(c=>{
            let d = (c.fecha_hora_inicio || '').split(' ')[0];
            if(d) citasPorDia[d] = (citasPorDia[d]||0)+1;
        });

        new Chart(document.getElementById('chartCitas'), {
            type: 'bar',
            data: {
                labels: Object.keys(citasPorDia),
                datasets: [{ label:'Citas por día', data:Object.values(citasPorDia),
                    backgroundColor:'#2A7F8F' }]  // --color-primary
            },
            options: { responsive:true }
        });

        // Estados — cada estado mapeado a su color semántico de marca
        const COLORES_ESTADO = {
            pendiente:    '#E8B84B', // --color-warning
            confirmada:   '#2A7F8F', // --color-primary
            cancelada:    '#E74C3C', // --color-danger
            completada:   '#27AE60', // --color-success
            reprogramada: '#9B7EC8', // --color-secondary
        };
        const DEFAULT_COLOR = '#6C757D'; // --color-text-muted

        let estados = {};
        citas.data.forEach(c=>{
            let e = c.estado || 'sin estado';
            estados[e] = (estados[e]||0)+1;
        });

        new Chart(document.getElementById('chartEstados'), {
            type: 'pie',
            data: {
                labels: Object.keys(estados),
                datasets: [{ data:Object.values(estados),
                    backgroundColor: Object.keys(estados).map(e => COLORES_ESTADO[e] || DEFAULT_COLOR) }]
            },
            options: { responsive:true }
        });
    }

    // Ingresos
    if(pagos.data){
        let ingresos = {};
        pagos.data.forEach(p=>{
            let d = p.fecha_emision || 'N/A';
            ingresos[d] = (ingresos[d]||0)+parseFloat(p.monto_total||0);
        });

        new Chart(document.getElementById('chartIngresos'), {
            type: 'line',
            data: {
                labels: Object.keys(ingresos),
                datasets: [{ label:'Ingresos', data:Object.values(ingresos),
                    borderColor:'#27AE60', backgroundColor:'rgba(39,174,96,0.1)', fill:true }]  // --color-success
            },
            options: { responsive:true }
        });
    }
}
