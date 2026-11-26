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
| Nómina de conductores | Importar datos → Conductores | Propone fichas de conductor y sus vencimientos de licencia. |
| Documentos de flota y contratos | Control de flota y Operaciones | Lee una foto, PDF o Word y muestra una propuesta antes de guardar el formulario. |

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
- Cada dato vuelve con confianza **alta / media / baja**. El sistema deja en blanco los valores de confianza media o baja y muestra la advertencia correspondiente. En la revisión, el usuario puede corregir la fila desde el original.
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

## Proveedor principal y respaldo

Para el piloto gratuito, crea una clave de [Google AI Studio](https://aistudio.google.com/apikey) y otra de [Groq Console](https://console.groq.com/keys). Guárdalas en `.env.local` como `GEMINI_API_KEY` y `GROQ_API_KEY`. Con `AI_PROVEEDOR_PRINCIPAL=gemini`, Gemini lee primero. Si la lectura falla por cuota o indisponibilidad, la app intenta con Qwen en Groq. Este perfil usa únicamente ese par. Reinicia el servidor después de editar el archivo.

Gemini recibe el PDF directamente. El respaldo gratuito convierte hasta dos páginas a imágenes para cada lectura con Groq. Para un PDF más largo, divídelo si Gemini está caído. Para el piloto utiliza comprobantes y documentos ficticios. [Condiciones de Gemini](https://aistudio.google.com/docs/terms) · [Límites de Groq](https://console.groq.com/docs/rate-limits)

Configura `ANTHROPIC_API_KEY` y `OPENAI_API_KEY`. `AI_PROVEEDOR_PRINCIPAL=anthropic` usa Claude primero. Con `AI_PROVEEDOR_PRINCIPAL=openai` se invierte el orden. Si el proveedor falla por disponibilidad, autorización, cuota, tiempo de espera o respuesta incompleta o inválida, el otro proveedor configurado recibe la lectura. Ante un rechazo explícito de contenido, se solicita revisión manual. La revisión muestra quién leyó el documento y la auditoría guarda proveedor, modelo y uso del respaldo.

`AI_MODEL`, `AI_EFFORT`, `OPENAI_MODEL` y `AI_TIMEOUT_MS` configuran cada lectura. Su costo depende del proveedor y del documento. Una lectura correcta usa un proveedor. Si ambos devuelven error, puedes volver a intentar o cargar manualmente los datos.
