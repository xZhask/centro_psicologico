# Documentación de Cambio: Sistema de Reservas y Persistencia de Paquetes
**Fecha:** 14 de Mayo, 2026

---

## 1. Problema Identificado
Se reportó una inconsistencia donde paquetes marcados como "agotados" aún permitían visualizar citas como "cubiertas", o daban la impresión de tener sesiones pendientes cuando administrativamente ya se habían consumido.
- **Causa Raíz A**: Las citas no reservaban sesiones; solo se consumían al registrar la atención clínica.
- **Causa Raíz B**: Un bug en el trigger SQL permitía desbordamiento de datos (wrap-around) si se registraban sesiones en paquetes con saldo cero.

---

## 2. Plan de Implementación (Resumen)
El objetivo fue sincronizar la vista administrativa (Citas) con la realidad financiera (Paquetes) mediante un sistema de reservas preventivas.

### Cambios en Base de Datos:
- Refactorización del trigger `trg_consumir_paquete` para validar saldos positivos.
- Mejora del cálculo de `estado` para asegurar la transición a `agotado`.

### Cambios en Aplicación:
- Modificación de `evaluarCobertura` en el modelo `Cita`.
- Actualización de la consulta principal de listado de citas para incluir lógica de exclusión por reservas previas.
- Doble validación en el proceso de creación de sesiones.

---

## 3. Detalles Técnicos (Modificaciones)

### A. Lógica de Reservas (PHP)
En `src/Models/Cita.php`, se implementó una subconsulta que cuenta cuántas citas `pendientes` o `confirmadas` existen para el mismo paciente y profesional que sean cronológicamente anteriores a la que se está evaluando.
- **Fórmula**: `Sesiones_Disponibles = Saldo_Paquete - Citas_Previas_Agendadas`

### B. Seguridad de Datos (SQL)
Se actualizó el trigger en `sql/centro_psicologico.sql`:
```sql
CREATE TRIGGER `trg_consumir_paquete` AFTER INSERT ON `sesiones` FOR EACH ROW BEGIN
  IF NEW.paciente_paquete_id IS NOT NULL THEN
    UPDATE paciente_paquetes
    SET sesiones_restantes = CASE 
          WHEN sesiones_restantes > 0 THEN sesiones_restantes - 1 
          ELSE 0 
        END,
        estado = CASE
          WHEN sesiones_restantes <= 1 THEN 'agotado'
          ELSE 'activo'
        END
    WHERE id = NEW.paciente_paquete_id;
  END IF;
END
```

---

## 4. Impacto Funcional (Manual de Usuario)
1. **Agendamiento**: Si un paciente tiene un paquete de 5 sesiones y ya tiene 5 citas agendadas, al intentar agendar la 6ta, el sistema **no mostrará** el beneficio del paquete y solicitará pago directo o contratación de nuevo paquete.
2. **Badge de Cobertura**: El indicador lila de "Paquete" en la lista de citas ahora es dinámico y desaparecerá de las citas que excedan el saldo pagado, incluso si aún no han sido atendidas.
3. **Seguridad**: Se eliminó el riesgo de que el contador de sesiones saltara a números astronómicos (255) por errores de registro manual o concurrencia.

---

## 5. Archivos Afectados
- `src/Models/Cita.php`
- `src/Models/Sesion.php`
- `sql/centro_psicologico.sql`
