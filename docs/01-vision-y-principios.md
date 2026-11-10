# 1. Visión y principios

## Objetivo

No digitalizar planillas: **transformar la administración** de Transportes y Turismo Reyes en un sistema integrado, trazable, automatizado y preparado para crecer. Usuario principal durante 2027: el dueño de la empresa.

## Principios técnicos (obligatorios en todo el código)

1. **Una sola base de datos, todo relacionado.** Cada persona existe una sola vez (tabla `personas`); ser alumno, apoderado, pagador o (en V2) conductor son *roles* que se relacionan con esa ficha.
2. **Ingresar una vez.** Lo que se carga por un módulo se ve desde todos los demás (la ficha del alumno muestra mensualidades, pagos, comprobantes, apoderados e historial).
3. **Alertas en todos los módulos.** Cada módulo nuevo agrega su "generador" al motor de alertas (`src/server/alertas/generadores.ts`). Las reglas (días de aviso y colores) se configuran desde la pantalla, no en el código.
4. **La IA no inventa.** La IA solo transcribe lo que está escrito. Si no lo lee con claridad deja el dato vacío → *"Información no identificada / requiere revisión"*. Cada dato trae su nivel de confianza.
5. **La IA propone, el usuario confirma.** Ninguna importación ni lectura por IA guarda nada sin revisión: *IMPORTAR → ANALIZAR → MOSTRAR → VALIDAR → GUARDAR*.
6. **Sin duplicados silenciosos.** Si un registro parece existir, el sistema pregunta: *Actualizar / Mantener / Fusionar / Crear como nuevo*. Mismo RUT con nombre distinto = **conflicto** que exige revisión.
7. **Cambios detectados, no reemplazos.** Al cargar un Excel nuevo se comparan los datos con lo existente y se muestra *"CAMBIO DETECTADO: Bus 16 → 17"* para confirmar.
8. **Dinero recibido ≠ pago conciliado.** Un pago tiene dos estados independientes: si el dinero está confirmado (*verificación*) y a qué alumno/mes corresponde (*conciliación*). Sin coincidencia clara → 🟡 **PAGO POR CONCILIAR**.
9. **Todo queda auditado.** Quién — cuándo — qué cambió — por qué. La auditoría solo se inserta; no se edita ni se borra.
10. **Nada se borra físicamente desde la interfaz.** Se anula o se elimina lógicamente (recuperable). Los meses cerrados exigen motivo para cualquier cambio.
11. **Sin valores fijos en el código.** Configuración (empresa, día de vencimiento, meses de cobro, umbrales…) en la tabla `configuracion` editable desde la UI; secretos y conexión en `.env.local`.
12. **Pensado para el usuario principal:** rápido, simple, visual, pocos pasos, buscador potente, adaptable a celular.
