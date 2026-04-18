// ============================================================
// Módulo: Administración
// Panel de acceso rápido a funciones administrativas.
// Solo visible para el rol administrador.
// ============================================================

function administracion() {
    const user = getUser();
    const esAdmin = user && user.rol === 'administrador';

    document.getElementById('view').innerHTML = `
        <div style="padding:1.5rem">
            <h2 style="margin:0 0 1.5rem;font-size:1.25rem;font-weight:600">Administración</h2>

            ${!esAdmin ? `
            <div class="card" style="padding:2rem;text-align:center;color:var(--color-text-muted)">
                Acceso restringido a administradores.
            </div>` : `
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem">

                <div class="card" style="padding:1.5rem;cursor:pointer" onclick="navigate('usuarios')">
                    <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem">
                        <span style="width:40px;height:40px;border-radius:var(--radius);background:var(--color-primary);display:flex;align-items:center;justify-content:center">
                            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="8" cy="5" r="3"/>
                                <path d="M2 14c0-3 2.5-5 6-5s6 2 6 5"/>
                            </svg>
                        </span>
                        <strong style="font-size:.95rem">Usuarios</strong>
                    </div>
                    <p style="font-size:.82rem;color:var(--color-text-muted);margin:0">
                        Crear, activar y gestionar cuentas de acceso al sistema.
                    </p>
                </div>

                <div class="card" style="padding:1.5rem;cursor:pointer" onclick="navigate('planillas')">
                    <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem">
                        <span style="width:40px;height:40px;border-radius:var(--radius);background:var(--color-primary);display:flex;align-items:center;justify-content:center">
                            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="1" y="2" width="14" height="12" rx="1.5"/>
                                <path d="M1 6h14"/>
                                <path d="M5 2v12"/>
                                <path d="M8 9h4M8 11h3"/>
                            </svg>
                        </span>
                        <strong style="font-size:.95rem">Planillas</strong>
                    </div>
                    <p style="font-size:.82rem;color:var(--color-text-muted);margin:0">
                        Gestionar planillas de pago y honorarios del personal.
                    </p>
                </div>

                <div class="card" style="padding:1.5rem;cursor:pointer" onclick="navigate('reportes')">
                    <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem">
                        <span style="width:40px;height:40px;border-radius:var(--radius);background:var(--color-primary);display:flex;align-items:center;justify-content:center">
                            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M1 13L5 8l3 3 3-4 3-2"/>
                                <path d="M1 13h14"/>
                            </svg>
                        </span>
                        <strong style="font-size:.95rem">Reportes</strong>
                    </div>
                    <p style="font-size:.82rem;color:var(--color-text-muted);margin:0">
                        Ver reportes clínicos, financieros y de actividad del centro.
                    </p>
                </div>

            </div>`}
        </div>`;
}
