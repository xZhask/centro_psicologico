# Rediseño UX — Vista "Detalle de Atención"

## Contexto

Estoy trabajando en el módulo de **Atenciones** del centro psicológico Magusa. La vista actual `Detalle de Atención #N` funciona, pero tiene problemas de jerarquía de información, orden de flujo clínico y desperdicio de espacio visual. Necesito refactorizar esta vista aplicando los cambios descritos abajo.

**Restricción importante del negocio:** las sesiones se crean **únicamente desde el módulo de Citas** (al marcar una cita como completada). **Nunca** debe existir un botón "Registrar sesión" o "Nueva sesión" en esta vista. El psicólogo viene aquí a **consultar** la atención y registrar información clínica complementaria (notas, diagnósticos, tareas, etc.), no a abrir sesiones nuevas.

## Estructura propuesta de la vista

El nuevo orden vertical debe ser:

```
1. Patient banner (cabecera condensada con contexto del paciente)
2. Resumen de progreso (sesiones realizadas vs planificadas + estado financiero)
3. Sesiones (lista tipo timeline, con check-in emocional integrado)
4. Tareas terapéuticas
5. Diagnósticos CIE-10
6. Datos de contexto clínico (colapsable: motivo, observaciones, antecedentes)
7. Recomendaciones de cierre (solo visible cuando la atención está completada)
```

Detallo cada bloque a continuación.

---

## 1. Patient banner (reemplaza las dos tarjetas superiores y el título actual)

Eliminar las dos tarjetas `PACIENTE` y `ATENCIÓN` y la línea "Detalle de Atención #7 [activa]". En su lugar, una cabecera horizontal compacta con esta información en una sola fila:

- **Nombre completo del paciente** (font-size grande, peso bold)
- **Edad** calculada desde `personas.fecha_nacimiento` + sexo (ej. `37 años · F`)
- **DNI** (texto pequeño, peso normal)
- **Badge de estado** de la atención (`activa` / `pausada` / `completada` / `cancelada`) con su color correspondiente
- **Profesional asignado** (ej. `Atendido por: Ana García Pérez`)
- **Subservicio** (ej. `Consulta psicológica adulto · individual`)
- **Fecha de inicio + días transcurridos** (ej. `Inicio: 14 may 2026 · día 1`)

Al lado derecho de la cabecera:
- **Badge financiero contextual** según el estado de cobertura de la atención (ver lógica abajo en sección "Lógica del badge financiero").

Debajo del patient banner, una sub-línea pequeña con datos socioeconómicos capturados en la atención (no en el paciente, ya que pueden diferir entre atenciones): `Grado instrucción: ... · Ocupación: ... · Estado civil: ...`.

**Eliminar el breadcrumb actual** "Atenciones · jueves, 14 de mayo de 2026" — la fecha de hoy no aporta valor. Reemplazarlo por un breadcrumb clickeable de navegación: `Atenciones › [Nombre del paciente] › Atención #7`.

### Lógica del badge financiero

Calcular el estado de cobertura de la atención consultando las relaciones existentes y mostrar el badge más relevante:

- Si el paciente tiene un `paciente_paquetes` activo vinculado a esta atención o profesional → badge azul: `📦 Paquete activo · X/Y sesiones`, donde X = sesiones usadas, Y = `sesiones_incluidas` del paquete.
- Si existe un `adelantos_paciente` activo para esta atención con `saldo_disponible > 0` → badge verde: `💰 Adelanto disponible · S/{saldo_disponible}`.
- Si hay `cuentas_cobro` con `estado IN ('pendiente', 'pago_parcial')` vinculadas a sesiones de esta atención → badge amarillo: `⚠ Saldo pendiente · S/{suma_saldos}`.
- Si todas las sesiones realizadas tienen su `cuenta_cobro` con `estado = 'pagado'` → badge gris discreto: `✓ Al día`.
- Si la atención aún no tiene sesiones realizadas → no mostrar badge.

Solo uno a la vez, priorizando en el orden listado (paquete > adelanto > pendiente > al día).

---

## 2. Resumen de progreso

Bloque visual compacto debajo del patient banner. Reemplaza el dato suelto "Sesiones plan: 5" actual:

- Una **barra de progreso horizontal** con: `Sesión {COUNT(sesiones)} de {atenciones.numero_sesiones_plan} ▓▓░░░░ {porcentaje}%`.
- Si `numero_sesiones_plan` es NULL, mostrar solo el contador: `{COUNT(sesiones)} sesiones realizadas`.
- A la derecha, en pequeño: fecha de la **última sesión** y fecha de la **próxima cita confirmada** asociada a la atención (consultar `citas` con `atencion_id` y `estado IN ('confirmada','pendiente')`).

Este bloque es solo lectura, sin acciones.

---

## 3. Sesiones — pasar de tabla a timeline vertical

Reemplazar la tabla actual de sesiones por un **timeline vertical** donde cada sesión es una tarjeta apilada cronológicamente (más reciente arriba). Cada tarjeta debe mostrar:

- **Número de sesión grande y visible** (ej. `Sesión 3`), no como columna `#`.
- Fecha y hora formateadas legibles (ej. `Lunes 15 abr · 10:00`).
- Modalidad (`presencial` / `virtual`) como pill pequeño.
- Duración en minutos como texto plano.
- **Nota clínica completa** (no truncar a una línea — mostrar todo el texto envuelto). Si la nota es larga, se puede colapsar con "Ver más" tras ~3 líneas.
- Si la sesión tiene un **check-in emocional** asociado (consultar `checkin_emocional` por `atencion_id` + fecha cercana a la sesión), mostrarlo inline en la tarjeta como mini-indicadores: `😊 Cómo se siente: 5/10 · 😴 Sueño: 6/10 · 😰 Estrés: 5/10 · ✅ Hizo tarea: Sí`.
- **Botón de editar nota** (lápiz) a la derecha de cada tarjeta, no en una columna fija.

**No incluir** la columna `PRECIO` en las tarjetas de sesión. Esa información pertenece al módulo de Pagos. Si el usuario es administrador y necesita verla, puede hacerse mediante un toggle global "Ver información financiera" en la parte superior de la vista, pero por defecto está oculta.

Si la atención **no tiene sesiones aún**, mostrar un estado vacío con icono y texto: *"Las sesiones aparecerán aquí cuando se complete la primera cita. Las sesiones se registran desde el módulo Citas."*

**Encima del timeline**, si hay 3+ sesiones con check-in, mostrar un **mini-gráfico de evolución emocional** (sparkline) de las últimas 5-7 mediciones de `como_te_sientes`, `nivel_estres` y `dormiste_bien`. Tres líneas pequeñas superpuestas o tres sparklines en columna. Esto es el dato clínico más rico del modelo y debe ser visible.

---

## 4. Tareas terapéuticas

Mantener la sección de tareas en su posición pero con estos cambios:

- Eliminar la columna `SESIÓN` como texto plano `Sesión 1`; mostrarlo como **link clickeable** que haga scroll a la tarjeta de esa sesión arriba.
- La columna `RESPUESTA PACIENTE` actualmente dice "Sin respuesta" en gris pequeño cuando no hay respuesta. Cambiar la jerarquía visual: cuando **sí hay respuesta**, mostrarla con peso visual (texto del paciente, fecha de respuesta). Cuando **no hay respuesta**, dejar la celda vacía o con un guion discreto.
- Agregar una columna o badge para tareas **vencidas sin respuesta**: si `fecha_limite < hoy` y `estado = 'pendiente'`, marcar visualmente en rojo. El texto actual "El estado 'No realizada' se asigna automáticamente cuando vence la fecha límite sin respuesta" puede quedar como tooltip al hover sobre el header de columna ESTADO, no permanentemente visible.
- El botón `+ Nueva tarea` debe abrir un modal en lugar de inline. Esto se mantiene como ahora si ya funciona así.

---

## 5. Diagnósticos CIE-10

Cambios al bloque actual:

- **Esconder el formulario de "Buscar diagnóstico CIE-10"** detrás de un botón `+ Agregar diagnóstico`. El formulario solo aparece (inline o modal) cuando el usuario hace click. Hoy ocupa el mismo espacio visual que la lista de diagnósticos existentes, lo cual le resta protagonismo a estos últimos.
- La tabla de diagnósticos actuales está bien; mantener las pills de `JERARQUÍA` (Principal/Secundario) y `CERTEZA` (Definitivo/Presuntivo/Descartado) con sus colores.
- Agregar un botón pequeño de **editar/anular diagnóstico** en cada fila (lápiz + X), porque un diagnóstico puede pasar de `presuntivo` a `definitivo` o a `descartado` durante el proceso clínico.

---

## 6. Datos de contexto clínico (colapsable)

Agrupar en **una sola sección colapsable** llamada *"Contexto clínico inicial"* (cerrada por defecto si la atención lleva más de una sesión) los siguientes campos que hoy aparecen como tarjetas separadas:

- Motivo de consulta
- Observación general
- Observación de conducta
- Antecedentes relevantes (campo `atenciones.antecedentes_relevantes` que hoy no se muestra)

Justificación: estos campos se llenan en la **primera sesión** y rara vez se consultan después. Tenerlos arriba y siempre desplegados desplaza el contenido accionable hacia abajo de la pantalla.

En la primera sesión / atención sin sesiones aún, esta sección sí debe estar **expandida por defecto** porque es lo único que hay para registrar.

---

## 7. Recomendaciones

**Mostrar esta sección solo cuando la atención está en estado `completada` o tiene `fecha_fin IS NOT NULL`.** Si la atención está activa, ocultar completamente la sección. Mostrar "sin recomendación de prueba 1" en una atención activa es ruido y confunde — las recomendaciones son del cierre del proceso terapéutico.

---

## 8. Paquete de sesiones

Eliminar la sección actual "Paquete de sesiones" que hoy ocupa una caja entera con el texto "Este paciente no tiene paquete activo asignado." cuando está vacía.

En su lugar:

- Si **sí hay paquete activo**: la información ya se muestra en el patient banner (badge financiero) y no necesita repetirse. Opcionalmente, agregar un link discreto en el patient banner que diga "Ver detalle del paquete" y abra un modal con la info del paquete (sesiones restantes, fecha de activación, vencimiento, cuenta de cobro asociada).
- Si **no hay paquete**: mover el botón "Asignar paquete" a un menú de acciones de la atención (un dropdown `⋯` arriba a la derecha del patient banner) junto con otras acciones como "Pausar atención", "Cerrar atención", "Editar atención". No ocupar una sección entera.

---

## Consideraciones técnicas y de implementación

- **No modificar el esquema de base de datos.** Toda la información necesaria ya existe en las tablas: `personas`, `pacientes`, `atenciones`, `sesiones`, `checkin_emocional`, `diagnosticos_atencion`, `cie10`, `tareas`, `paciente_paquetes`, `paquetes`, `adelantos_paciente`, `cuentas_cobro`. Las nuevas vistas son solo cambios de presentación y queries adicionales.

- **Queries nuevas que probablemente necesites**:
  - Cálculo del badge financiero: JOIN entre `paciente_paquetes`, `adelantos_paciente` y `cuentas_cobro` filtrando por paciente + atención + estado.
  - Sesiones con check-in emocional: LEFT JOIN entre `sesiones` y `checkin_emocional` por `atencion_id` + rango de fecha cercana (la sesión y el check-in no están vinculados directamente por FK, hay que matchear por fecha próxima o por `atencion_id` + ventana temporal).
  - Sparkline de evolución: SELECT de los últimos N `checkin_emocional` ordenados por `fecha_hora`.

- **Responsive**: el patient banner debe degradar bien en móvil — apilar verticalmente nombre, edad/sexo/DNI, badges. El timeline de sesiones funciona naturalmente en móvil.

- **Permisos**: si la app tiene roles diferenciados (administrador vs profesional), el toggle "Ver información financiera" del paso 3 solo aplica al administrador. El profesional clínico no debería ver precios de sesión por defecto.

- **Mantener accesibilidad**: los pills y badges deben tener `aria-label` con su significado completo, no solo el color. Los iconos decorativos (📦, 💰, 😊, etc.) deben estar marcados como `aria-hidden`.

- **No tocar el sidebar** (la barra lateral izquierda con Dashboard, Citas, Calendario, etc.). El refactor es solo del contenido principal de la vista.

## Resumen de cambios visuales (de un vistazo)

| Sección actual | Cambio |
|---|---|
| Tarjetas Paciente + Atención + título "Detalle de Atención #N" | Reemplazar por patient banner horizontal compacto |
| Breadcrumb con fecha de hoy | Reemplazar por breadcrumb de navegación clickeable |
| Motivo, Observaciones, Recomendaciones (siempre arriba y expandidas) | Agrupar en acordeón "Contexto clínico inicial", cerrado por defecto si hay sesiones |
| Recomendaciones visibles en atención activa | Ocultar hasta que la atención esté completada |
| Formulario de diagnóstico siempre visible | Esconder tras botón "+ Agregar diagnóstico" |
| Tabla de sesiones con columna PRECIO visible | Timeline vertical sin precio; precio detrás de toggle admin |
| Sesiones al final de la vista | Subir sesiones al tope (después de patient banner + progreso) |
| Check-in emocional no aparece | Integrar inline en cada sesión + sparkline de evolución |
| Bloque "Paquete de sesiones" vacío ocupando espacio | Mover a badge en banner + menú de acciones |
| "Sesiones plan: 5" como texto suelto | Barra de progreso visual |

## Lo que NO cambia

- Sidebar de navegación.
- Esquema de base de datos.
- Origen único de creación de sesiones (módulo Citas).
- Estilo general / paleta de colores / tipografía (mantener consistencia con el resto de la app).
- Pills de jerarquía y certeza de diagnósticos (ya están bien resueltas).

---

¿Puedes implementar estos cambios? Comienza por el **patient banner** y el **timeline de sesiones**, que son los de mayor impacto. Antes de tocar código muéstrame qué archivos vas a modificar y un esquema de cómo quedará el componente principal de la vista.
