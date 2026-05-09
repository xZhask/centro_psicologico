# Resumen de Cambios: Notas Privadas en Atenciones Grupales (Desde Citas)

**Fecha:** 9 de Mayo, 2026

## Contexto del Problema
Anteriormente, cuando se abría una nueva atención desde la pestaña de **Citas** (modal `abrirModalGestionAtencion`), el sistema solo mostraba un campo básico de "Nota clínica", incluso si el servicio era de modalidad grupal (pareja, familiar o grupal). Esto causaba que no se pudieran capturar las **observaciones clínicas privadas** para cada participante al momento de abrir el proceso, algo que sí era posible desde el modal de "Nueva sesión grupal".

## Solución Implementada
Se actualizó la interfaz y la lógica del servidor para que las atenciones grupales tengan soporte nativo de notas privadas y compartidas desde el primer momento en el que se convierten desde una Cita.

### 1. Interfaz de Usuario (`public/app.html` y `public/assets/js/modules/citas.js`)
*   Se agregó la estructura HTML necesaria en la sección de **"Primera sesión"** (`gAt1raSesionGrupalWrap`) para mostrar:
    *   Una **Nota de sesión** (compartida).
    *   Tres campos de **Observaciones clínicas privadas** (Paciente titular, Participante 2 y Participante 3).
*   Se modificó el script de citas (`citas.js`) para que al seleccionar un servicio, se detecte dinámicamente si su modalidad es individual o grupal (pareja/familiar/grupal).
*   Si es grupal, se oculta el campo de "Nota clínica" simple y se despliegan automáticamente los campos avanzados de notas privadas y compartidas.
*   Al hacer clic en "Guardar", se capturan estos nuevos campos y se envían en el payload (`primera_sesion_nota_compartida`, `primera_sesion_nota_privada_p1`, etc.) al endpoint `/api/atenciones`.

### 2. Backend (`src/Controllers/AtencionController.php`)
*   Se actualizó el método `store()` de `AtencionController`.
*   Ahora el sistema verifica la modalidad del subservicio en el momento de crear la primera sesión.
*   Si la modalidad es grupal y se proporcionaron notas compartidas/privadas, el sistema realiza automáticamente las siguientes acciones de fondo (para mantener la consistencia de la base de datos):
    1.  **Crea un nuevo Vínculo** en la tabla `atenciones_vinculadas` bajo el nombre "Proceso [Modalidad] (Autocreado)".
    2.  Vincula la nueva atención individual a este nuevo grupo como `paciente_titular` en la tabla `atencion_vinculo_detalle`.
    3.  Crea la sesión de apertura en la tabla `sesiones_grupo` (en lugar de la tabla de sesiones individuales), persistiendo correctamente la nota compartida y todas las notas privadas ingresadas.
*   Si la modalidad es individual, el flujo sigue funcionando como siempre, guardando solo una `nota_clinica` en la tabla `sesiones`.

## Cómo continuar (Pruebas)
Desde tu otra PC, para verificar que todo funciona correctamente:
1. Asegúrate de tener los últimos cambios del repositorio.
2. Inicia sesión en el sistema y ve a **Citas**.
3. Haz clic en **Registrar atención** en una cita que corresponda a un servicio de *pareja*, *familia* o *grupal*.
4. Revisa que aparezcan los nuevos campos de observaciones privadas.
5. Llénalos y guarda la atención.
6. Ve a la pestaña **Vínculos** y confirma que se generó un nuevo proceso grupal ("Autocreado") y que la sesión inicial contiene las notas que ingresaste.
