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
│   │   │   ├── base.css     # Reset, variables CSS, tipografía
│   │   │   ├── layout.css   # Sidebar, header, grid principal
│   │   │   └── components.css # Botones, cards, tablas, formularios, badges
│   │   ├── js/
│   │   │   ├── app.js       # Router SPA y estado global mínimo
│   │   │   ├── api.js       # Wrapper fetch() centralizado
│   │   │   └── modules/     # Un archivo JS por módulo
│   │   └── img/
├── src/
│   ├── Core/
│   │   ├── Router.php       # Enrutador REST simple basado en $_SERVER
│   │   ├── Request.php      # Encapsula $_GET, $_POST, $_FILES, json input
│   │   ├── Response.php     # Helpers json(), redirect(), status()
│   │   ├── Database.php     # Singleton PDO con prepared statements
│   │   ├── Auth.php         # Sesiones, verificación de rol, CSRF
│   │   └── Validator.php    # Validación de inputs reutilizable
│   ├── Controllers/         # Un controlador por módulo
│   ├── Models/              # Un modelo por tabla principal
│   ├── Middleware/          # AuthMiddleware, RoleMiddleware
│   └── Helpers/             # Funciones utilitarias (fecha, formato, etc.)
├── views/                   # Plantillas HTML/PHP del lado servidor (SSR parcial)
│   ├── layout/
│   │   ├── header.php
│   │   └── sidebar.php
│   └── modules/             # Una vista por módulo
├── config/
│   ├── database.php         # Credenciales BD (nunca en public/)
│   ├── app.php              # Constantes globales, timezone, modo debug
│   └── routes.php           # Definición de todas las rutas
├── sql/
│   └── centro_psicologico_v2.sql
├── .htaccess                # Redirige todo a public/index.php
├── .env.example             # Variables de entorno de referencia
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
Cada módulo JS es responsable de renderizar su vista y manejar sus eventos.
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
- El trigger `trg_actualizar_monto_pagado` ya existe en BD; no replicar su lógica en PHP.
- Las columnas `precio_final`, `saldo_pendiente` y `monto_neto` son **GENERATED** en BD;
  nunca calcularlas ni insertarlas desde PHP.

### Tablas raíz (respetar orden de inserción)
1. `personas` → 2. `usuarios` / `profesionales` / `pacientes` / `apoderados`

## Seguridad

- **Autenticación:** sesiones PHP nativas (`session_start`, `session_regenerate_id`)
- **CSRF:** token por formulario y por sesión, verificado en todo POST/PUT/DELETE
- **Roles:** verificar rol en cada endpoint antes de procesar. Roles: `administrador`, `profesional`, `paciente`
- **Inputs:** validar y sanitizar todo input en el servidor antes de usarlo
- **Passwords:** `password_hash()` con `PASSWORD_BCRYPT` al crear, `password_verify()` al autenticar
- **Archivos .env y config/:** nunca accesibles desde public/; bloqueados en .htaccess
- **Errores:** en producción nunca mostrar stack traces; loguear en archivo interno

## Diseño y frontend

### Sistema de diseño (minimalista moderno)
- **Variables CSS globales** en `base.css` — nunca valores hardcodeados en otros archivos:
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
Definir clases base para: `.btn`, `.btn-primary`, `.btn-danger`, `.card`, `.badge`,
`.table`, `.form-group`, `.input`, `.alert`, `.modal`, `.sidebar`, `.topbar`,
`.pagination`, `.dropdown`

### JavaScript
- ES6+ sin transpiladores (arrow functions, async/await, fetch, template literals, modules)
- `api.js` centraliza todos los fetch() con manejo de errores y token CSRF automático
- Cada módulo JS exporta una función `init()` que el router llama al navegar
- Sin jQuery, sin librerías externas — excepto: **Chart.js CDN** solo para el módulo de reportes

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

Desarrollar en este orden de prioridad:

1. **Auth** — login, logout, control de sesión y middleware de roles
2. **Pacientes** — CRUD con apoderados
3. **Profesionales** — CRUD
4. **Servicios y subservicios** — catálogo
5. **Citas** — agenda y calendario
6. **Atenciones** — apertura, sesiones, cierre
7. **Diagnósticos CIE-10** — búsqueda y asignación
8. **Tareas** — asignación y respuesta
9. **Check-in emocional** — vista del paciente
10. **Seguimiento y alertas** — plan y bandeja
11. **Historial clínico** — vista consolidada
12. **Pagos pacientes** — cuentas y abonos
13. **Pagos personal** — planillas
14. **Reportes** — vistas y gráficos

## Lo que NO se debe hacer
- No usar frameworks PHP (Laravel, Symfony, Slim, etc.)
- No usar frameworks JS (React, Vue, Angular, Alpine, etc.)
- No usar librerías CSS (Bootstrap, Tailwind, etc.)
- No concatenar variables en queries SQL
- No guardar passwords en texto plano
- No exponer archivos fuera de public/ al servidor web
- No calcular desde PHP las columnas GENERATED de la BD
- No duplicar la lógica del trigger de pagos en PHP
- Composer se usa SOLO para el autoloader PSR-4 y los paquetes
  autorizados: phpdotenv, phpmailer, un generador de PDF (dompdf o tcpdf) y un generador de Excel (SpreadSheet).
  No instalar ningún otro paquete sin consultar primero.
- No usar frameworks PHP (Laravel, Symfony, Slim, etc.) ni micro-frameworks
- No usar ORMs (Eloquent, Doctrine, etc.) — toda la capa de datos se construye con PDO propio
- npm, Webpack, Vite y bundlers de JS siguen prohibidos