# 6. IA y carga de datos

## Formas de ingresar información

| Forma | Dónde | Cómo funciona |
|---|---|---|
| Manual | Alumnos → Nuevo · Pagos → Registrar pago | Formulario con control de duplicados (avisa si ya existe alguien parecido). |
| Excel / CSV | Importar datos | Detecta la fila de títulos, propone qué significa cada columna, el usuario corrige y confirma. |
| Word | Importar datos | Si el documento tiene una tabla, se trata como Excel. Si es texto libre, lo lee la IA. |
| PDF | Importar datos | Lo lee la IA (también PDF escaneados). |
| Foto (celular) | Importar datos → Tomar foto · Panel → Subir voucher | La IA transcribe planillas, vouchers o documentos. |
| Cartola bancaria | Importar datos → Pagos | Excel del banco; se marca "dinero confirmado" y se sugiere a quién corresponde cada movimiento. |

## Flujo obligatorio

**IMPORTAR → ANALIZAR → MOSTRAR → VALIDAR → GUARDAR.** Nada se guarda sin que el usuario lo revise.

Para cada fila el sistema propone:

| Propuesta | Significa | Decisiones posibles |
|---|---|---|
| Nuevo registro | No existe nadie parecido | Crear · Omitir |
| Cambio detectado | Mismo RUT, con datos distintos (ej. Bus 16 → 17) | Actualizar · Fusionar · Mantener actual · Omitir |
| Sin cambios | Ya existe idéntico | Omitir · Actualizar |
| Posible registro existente | Nombre igual o muy parecido sin RUT, **o mismo RUT con nombre distinto (conflicto)** | Actualizar · Mantener · Fusionar · Crear como nuevo · Omitir |
| Requiere revisión | Faltan datos o hay datos ilegibles / dudosos | Crear · Omitir (o actualizar si hay coincidencia) |

- **Actualizar**: reemplaza con los datos nuevos (solo los campos que vienen con valor).
- **Fusionar**: completa solo lo que está vacío en el registro actual; no pisa datos existentes.
- **Mantener**: no cambia nada.

Cada fila se guarda en su propia transacción: si una falla, las demás continúan y el error queda anotado en la fila. Todo queda en la auditoría con el motivo "Importación #N, fila M".

## Reconocimiento de columnas

Los nombres de columna habituales están en `src/lib/importacion-campos.ts` (ej. *Valor*, *Mensualidad*, *Monto* → Tarifa mensual; *Dirección*, *Domicilio* → Domicilio). Para que el sistema reconozca una columna nueva basta con agregar su nombre a la lista `sinonimos` del campo.

## Principio: la IA no inventa

Implementado en `src/server/importacion/ia.ts`:

- Instrucciones explícitas: transcribir solo lo legible; si hay duda → dato vacío. Nunca deducir a qué alumno corresponde un pago si el documento no lo dice (el nombre de la transferencia va a "quién paga", no a "alumno").
- Cada dato vuelve con confianza **alta / media / baja**. Lo de confianza baja se marca "Lectura dudosa: revisar contra el documento" y la fila pasa a *Requiere revisión*.
- Los datos vacíos se muestran como **"Información no identificada / requiere revisión"**.
- La foto/PDF original se muestra al lado de los datos extraídos para comparar.
- La respuesta completa de la IA queda guardada en la importación (trazabilidad).

## Conciliación de pagos

Al registrar o importar un pago sin alumno, el sistema busca coincidencias y explica por qué:

1. Pagador ya registrado o nombre de transferencia ya usado antes (aprendido).
2. RUT de origen igual al de un apoderado o alumno.
3. Nombre igual al del apoderado titular / pagador.
4. Apellido en común con el alumno (en Chile el apellido de la madre o el padre suele ser apellido del alumno).
5. Monto igual al saldo de un mes o a la suma de los meses pendientes más antiguos.

Sugiere los meses a los que se aplicaría. **El usuario confirma.** Si no hay coincidencia suficiente → 🟡 **PAGO POR CONCILIAR** y se asigna manualmente. Al conciliar se puede marcar "Recordar a «nombre» como pagador de este alumno": la próxima transferencia con ese nombre se reconocerá casi con certeza.

La sensibilidad se ajusta en Configuración → *Coincidencia mínima para sugerir*.

## Costos de IA

Cada lectura es una llamada a la API de Anthropic (se cobra por uso). Una foto de voucher es una lectura pequeña; un PDF largo cuesta más. El modelo y la profundidad de análisis se configuran en `.env.local` (`AI_MODEL`, `AI_EFFORT`).
