# Sistema de Gestión — Centro Psicológico

## Stack tecnológico
- **Backend:** PHP 8.3+ puro (sin frameworks)
- **Frontend:** HTML5, CSS3 y JavaScript ES6+ (sin frameworks, sin npm)
- **Base de datos:** MySQL 8.0+ con PDO
- **Servidor:** Apache 2.4+ con mod_rewrite habilitado

## Estructura de directorios

/
├── public/                  # Único directorio expuesto al servidor web
│   ├── index.php            # Front controller — único punto de entrada
│   ├── assets/
│   │   ├── css/
│   │   │   └── styles.css   # Estilos unificados: reset, variables, layout, componentes
│   │   ├── js/
│   │   │   ├── app.js       # Router SPA y estado global mínimo
│   │   │   ├── api.js       # Wrapper fetch() centralizado
│   │   │   ├── auth.js      # Login, logout, validación de sesión y CSRF inicial
│   │   │   └── modules/     # Un archivo JS por módulo (19 módulos)
│   │   └── img/
├── src/
│   ├── Core/
│   │   ├── Router.php       # Enrutador REST simple basado en $_SERVER
│   │   ├── Request.php      # Encapsula $_GET, $_POST, $_FILES, json input
│   │   ├── Response.php     # Helpers json(), redirect(), status()
│   │   ├── Database.php     # Singleton PDO con prepared statements
│   │   ├── Auth.php         # Sesiones y verificación de rol
│   │   ├── CSRF.php         # Generación y validación de tokens CSRF
│   │   └── Validator.php    # Validación de inputs reutilizable
│   ├── Controllers/         # Un controlador por módulo (25 controladores)
│   ├── Models/              # Un modelo por tabla principal (30 modelos)
│   └── Middleware/          # AuthMiddleware, RoleMiddleware
├── views/                   # Plantillas HTML/PHP del lado servidor (SSR parcial)
│   ├── layout/
│   │   ├── header.php
│   │   └── sidebar.php
│   └── modules/             # Una vista por módulo
├── config/
│   ├── database.php         # Credenciales BD (nunca en public/)
│   ├── app.php              # Constantes globales, timezone, modo debug
│   └── routes.php           # Definición de todas las rutas (60+ endpoints)
├── sql/
│   └── centro_psicologico.sql
├── storage/                 # Archivos adjuntos de sesiones (PDF, imágenes)
├── logs/                    # Archivos de log de errores internos
├── vendor/                  # Dependencias Composer (autoloader PSR-4)
├── .htaccess                # Redirige todo a public/index.php
├── .env / .env.example      # Variables de entorno
└── CLAUDE.md                # Este archivo

## Arquitectura

### Patrón MVC sin framework
- **Router** recibe toda petición, determina controlador y método
- **Controllers** reciben Request, llaman a Models, devuelven Response (JSON o vista)
- **Models** encapsulan toda lógica SQL con PDO prepared statements
- **Views** son plantillas PHP simples; el layout se inyecta en cada vista

### API interna REST
Todas las peticiones de datos se hacen vía fetch() a endpoints propios:
- `GET    /api/{modulo}`          → listar
- `GET    /api/{modulo}/{id}`     → detalle
- `POST   /api/{modulo}`         → crear
- `PUT    /api/{modulo}/{id}`     → actualizar
- `DELETE /api/{modulo}/{id}`     → eliminar

Toda respuesta JSON sigue la estructura:
```json
{
  "success": true,
  "data": {},
  "message": "",
  "errors": {}
}
```

### SPA ligera
La navegación entre módulos usa el History API (pushState) sin recargar la página.
Cada módulo JS exporta una función `init()` que el router llama al navegar.
No se usa ningún framework de componentes.

## Base de datos

### Reglas de acceso
- **Solo PDO** con prepared statements. Prohibido concatenar variables en SQL.
- Un único método `Database::query($sql, $params)` para todas las consultas.
- Usar las **vistas SQL** ya definidas para reportes y listados complejos:
  - `v_historial_paciente`
  - `v_agenda_dia`
  - `v_saldo_pacientes`
  - `v_resumen_checkin`
  - `v_pacientes_apoderados`
  - `v_sesiones_planilla`
- Los siguientes **triggers** ya existen en BD; no replicar su lógica en PHP:
  - `trg_actualizar_monto_pagado` — actualiza `monto_pagado` y estado en `cuentas_cobro`
  - `trg_consumir_paquete` — decrementa `sesiones_restantes` en `paciente_paquetes`
  - `trg_aplicar_adelanto` — actualiza `monto_aplicado` en `adelantos_paciente`
- Las siguientes columnas son **GENERATED** en BD; nunca calcularlas ni insertarlas desde PHP:
  - `cuentas_cobro.saldo_pendiente`
  - `adelantos_paciente.saldo_disponible`
  - `atencion_vinculo_detalle.precio_final`
  - `planillas.monto_neto`
  - `planilla_conceptos.monto_profesional`

### Tablas raíz (respetar orden de inserción)
1. `personas` → 2. `usuarios` / `profesionales` / `pacientes` / `apoderados`

### Escala actual de la BD
- **37 tablas**, **6 vistas**, **3 triggers**, **5 columnas GENERATED**
- CIE-10 con índice FULLTEXT y jerarquía autorreferencial (codigo_padre)

## Seguridad

- **Autenticación:** sesiones PHP nativas (`session_start`, `session_regenerate_id`)
- **CSRF:** token por formulario y por sesión, generado en `CSRF.php`, verificado en todo POST/PUT/DELETE; se envía desde JS en header `X-CSRF-Token`
- **Roles:** verificar rol en cada endpoint antes de procesar. Roles: `administrador`, `profesional`, `paciente`
- **Inputs:** validar y sanitizar todo input en el servidor antes de usarlo
- **Passwords:** `password_hash()` con `PASSWORD_BCRYPT` (cost 12) al crear, `password_verify()` al autenticar; `debe_cambiar_password` fuerza cambio en primer login
- **Archivos .env y config/:** nunca accesibles desde public/; bloqueados en .htaccess
- **Errores:** en producción nunca mostrar stack traces; loguear en `logs/`
- **Archivos subidos:** almacenados en `storage/` (fuera de public/), solo PDF e imágenes, máx 10 MB

## Diseño y frontend

### Sistema de diseño (minimalista moderno)
- **Variables CSS globales** en `styles.css` — nunca valores hardcodeados en otros archivos:
```css
  :root {
    --color-primary:     #2E86C1;
    --color-primary-dark:#1B4F72;
    --color-bg:          #F8F9FA;
    --color-surface:     #FFFFFF;
    --color-border:      #DEE2E6;
    --color-text:        #212529;
    --color-text-muted:  #6C757D;
    --color-success:     #27AE60;
    --color-warning:     #F39C12;
    --color-danger:      #E74C3C;
    --color-info:        #2E86C1;
    --radius:            8px;
    --radius-lg:         12px;
    --shadow-sm:         0 1px 3px rgba(0,0,0,.08);
    --shadow:            0 2px 8px rgba(0,0,0,.10);
    --font:              'Inter', system-ui, sans-serif;
    --sidebar-width:     240px;
    --header-height:     60px;
    --transition:        .18s ease;
  }
```

### Reglas de estilo
- Fuente: Inter (Google Fonts) — pesos 400, 500, 600 únicamente
- Sin bordes gruesos ni sombras exageradas — elevación sutil
- Tablas con hover en filas y encabezado con fondo `--color-primary` texto blanco
- Formularios: labels siempre visibles (no solo placeholder), inputs con foco visible
- Estados vacíos: siempre mostrar un mensaje descriptivo, nunca una tabla vacía sin texto
- Responsive: sidebar colapsable en móvil con overlay; tablas con scroll horizontal

### Componentes reutilizables (CSS puro)
Clases base definidas: `.btn`, `.btn-primary`, `.btn-danger`, `.card`, `.badge`,
`.table`, `.form-group`, `.input`, `.alert`, `.modal`, `.sidebar`, `.topbar`,
`.pagination`, `.dropdown`

### JavaScript
- ES6+ sin transpiladores (arrow functions, async/await, fetch, template literals, modules)
- `api.js` centraliza todos los fetch() con manejo de errores y token CSRF automático
- `auth.js` maneja login, logout e inicialización de sesión
- Cada módulo JS exporta una función `init()` que el router llama al navegar
- Sin jQuery, sin librerías externas — excepto: **Chart.js CDN** solo para el módulo de reportes

### Control de acceso en frontend
```javascript
ACCESO_MODULOS = {
  administrador: ['dashboard','pacientes','profesionales','servicios','citas',
                  'calendario','vinculos','atenciones','alertas','historia',
                  'pagos','paquetes','talleres','planillas','reportes','usuarios','administracion'],
  profesional:   ['dashboard','pacientes','citas','calendario','atenciones',
                  'vinculos','alertas','historia','reportes','talleres'],
  paciente:      ['dashboard','citas','checkin','tareas']
}
```

## Convenciones de código

### PHP
- PSR-12 para estilo
- Clases en PascalCase, métodos en camelCase, variables en camelCase
- Métodos de modelo: `findById()`, `findAll()`, `create()`, `update()`, `delete()`
- Siempre type hints en parámetros y retorno de funciones
- Un archivo = una clase

### JavaScript
- camelCase para variables y funciones
- UPPER_SNAKE_CASE para constantes
- Comentarios en español (consistente con el dominio del proyecto)

### SQL / Modelos
- Nombres de tabla y columna en snake_case (ya definidos en el script SQL)
- Los modelos no deben tener lógica de negocio compleja; esa va en los controladores
- Los SELECTs complejos van en métodos descriptivos del modelo: `getPacienteConApoderado()`, `getAgendaDia()`, etc.

## Módulos del sistema

Todos los módulos están implementados. Se listan con su controlador y módulo JS correspondiente:

### Módulos core
1. **Auth** — `AuthController` / `auth.js` — login, logout, cambio forzado de password, CSRF
2. **Pacientes** — `PacienteController` / `pacientes.js` — CRUD con apoderados y búsqueda DNI (RENIEC + BD local)
3. **Profesionales** — `ProfesionalController` / `profesionales.js` — CRUD con tarifa y colegiatura
4. **Servicios y subservicios** — `ServicioController` + `SubservicioController` / `servicios.js`
5. **Citas** — `CitaController` / `citas.js` — agenda, reprogramación, historial de cambios
6. **Calendario** — `CitaController` / `calendario.js` — vista mensual con drag-drop y talleres
7. **Atenciones** — `AtencionController` + `SesionController` / `atenciones.js` — apertura, sesiones, diagnósticos CIE-10, archivos adjuntos, cierre
8. **Vínculos grupales** — `VinculoController` / `vinculos.js` — terapia de pareja, familiar y grupal con sesiones compartidas y notas privadas por participante
9. **Diagnósticos CIE-10** — `Cie10Controller` — búsqueda por FULLTEXT, integrado en atenciones.js
10. **Tareas** — `TareaController` / `tareas.js` — asignación a pacientes, respuesta, estados
11. **Check-in emocional** — `CheckinController` / `checkin.js` — escalas 0-10 de estado, sueño, estrés y tarea
12. **Alertas y seguimiento** — `AlertaController` / `alertas.js` — alertas automáticas por reglas configurables (riesgo emocional, inasistencia, escala crítica, tarea pendiente)
13. **Historial clínico** — `ReporteController` / `historia.js` — expediente consolidado (usa `v_historial_paciente`)
14. **Pagos pacientes** — `PagoController` / `pagos.js` — cuentas de cobro, abonos, adelantos, paquetes
15. **Paquetes de sesiones** — `PaqueteController` / `paquetes.js` — catálogo, contratación, consumo automático por trigger
16. **Talleres institucionales** — `TallerController` / `talleres.js` — talleres en instituciones externas, fechas, asistentes y facturación
17. **Planillas (pagos personal)** — `PlanillaController` / `planillas.js` — cálculo, aprobación y pago a profesionales
18. **Reportes** — `ReporteController` / `reportes.js` — clínicos (progreso, asistencia, carga) y financieros (facturación, morosidad, ingresos por servicio); usa Chart.js
19. **Usuarios** — `UsuarioController` / `usuarios.js` — ABM, roles, activación/desactivación
20. **Dashboard** — `DashboardController` / `dashboard.js` — KPIs diferenciados por rol
21. **PDF** — `PDFController` — historial clínico y comprobante de pago (usa dompdf)
22. **Archivos adjuntos** — `ArchivoController` — upload/descarga en sesiones, almacenados en `storage/`

## Lo que NO se debe hacer
- No usar frameworks PHP (Laravel, Symfony, Slim, etc.) ni micro-frameworks
- No usar frameworks JS (React, Vue, Angular, Alpine, etc.)
- No usar librerías CSS (Bootstrap, Tailwind, etc.)
- No concatenar variables en queries SQL
- No guardar passwords en texto plano
- No exponer archivos fuera de public/ al servidor web
- No calcular desde PHP las columnas GENERATED de la BD
- No duplicar la lógica de los triggers en PHP
- Composer se usa SOLO para el autoloader PSR-4 y los paquetes autorizados:
  `vlucas/phpdotenv`, `dompdf/dompdf`. No instalar ningún otro paquete sin consultar primero.
- No usar ORMs (Eloquent, Doctrine, etc.) — toda la capa de datos se construye con PDO propio
- npm, Webpack, Vite y bundlers de JS siguen prohibidos

## Convenciones financieras (mayo 2026)

### Anclas de `cuentas_cobro`
Cada fila de `cuentas_cobro` puede vincularse a su origen mediante estas columnas (no son mutuamente excluyentes):
- `cita_id` → cita individual (origen más común)
- `sesion_id` → sesión registrada directamente
- `atencion_id` → atención (backfill vía `sesiones.atencion_id` o `citas.atencion_id`)
- `vinculo_id` → atención grupal / terapia de pareja o familia
- `taller_id` → taller institucional

### Sincronización de estados cita ↔ cuenta
El trigger `trg_anular_cuenta_cita_cancelada` anula automáticamente la `cuenta_cobro` (sin pagos previos) cuando una cita pasa a `cancelada` o `no_asistio`. Si hubo pagos parciales, la cuenta queda intacta para decisión manual.

### Notas privadas en sesiones grupales
Cada participante tiene una sesión espejo en `sesiones` con `precio_sesion = 0` y `cita_id = NULL` para evitar duplicación. La `nota_clinica` de ese espejo contiene la nota privada individual. **Las columnas `nota_privada_p1/p2/p3` no existen** en el esquema y no deben referenciarse.

### Distribución clínica y Diagnósticos en Procesos Grupales (Fase 0)
- **Información clínica del proceso**: Las columnas clínicas compartidas (`motivo_consulta_proceso`, `hipotesis_sistemica`, `recomendaciones`, `numero_sesiones_plan`) viven en `atenciones_vinculadas`, no en las atenciones individuales de los miembros.
- **Evitar duplicados**: Al registrar un proceso grupal, las atenciones individuales de los miembros deben tener sus campos `motivo_consulta`, `numero_sesiones_plan`, y `observacion_general` en `NULL` (evitando placeholders).
- **Diagnósticos relacionales**: Soporta diagnósticos a nivel de proceso (`vinculo_id`) en `diagnosticos_atencion`.
- **Exclusión Mutua (Arco Exclusivo XOR)**: La tabla `diagnosticos_atencion` tiene un constraint `chk_dx_arco_exclusivo` que exige que exactamente uno de `atencion_id` o `vinculo_id` sea no nulo: `(atencion_id IS NULL) <> (vinculo_id IS NULL)`.
- **Límites de sesión efectivos**: La columna `numero_sesiones_plan_efectivo` en las atenciones individuales se computa dinámicamente como su límite individual o el límite heredado del proceso grupal vinculante.

### Columnas deprecadas en cuentas_cobro (Fase 4A en curso)
Las columnas cuentas_cobro.atencion_id y cuentas_cobro.sesion_id están deprecadas.
NO agregar nuevas queries que las usen. El JOIN correcto es:
  - Para atención: JOIN citas ci ON ci.id = cc.cita_id → JOIN atenciones a ON a.id = ci.atencion_id
  - Para sesión: JOIN cuentas_cobro cc ON cc.cita_id = s.cita_id
El DROP COLUMN se ejecutará en Fase 4B cuando ningún archivo del código las referencie.
