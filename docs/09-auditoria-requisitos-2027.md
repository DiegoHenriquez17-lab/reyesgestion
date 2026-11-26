# Revisión de requisitos de Reyes Gestión para 2027

El sistema tiene una base relacional de cobranza y ahora incorpora control de flota y operaciones en la misma aplicación. El entorno de pruebas en línea tiene configuración de despliegue. Falta provisionar sus servicios y comprobar las integraciones externas con credenciales de prueba.

| Requisitos del mensaje | Estado en el repositorio |
|---|---|
| 1–2. Ingreso manual y Excel | Fichas, importación `.xlsx` / `.xlsm` / `.csv`, mapeo de columnas, revisión y confirmación de aplicación. |
| 3–5. Word, PDF, fotos y vouchers | `.docx` tabular mediante mapeo y `.docx` de texto, PDF e imágenes mediante IA. Alumnos, pagos y nóminas de conductores admiten cargas por lote. En documentos de flota y contratos la lectura revisa un adjunto por vez y muestra los campos para confirmar en el formulario. Quedan por validar los formatos y fotos de la empresa. |
| 6. Incertidumbre | Solo pasan a la propuesta los campos de alta confianza. La revisión conserva acceso al original. El usuario puede editar filas y los pagos sin asignación quedan por conciliar. La revisión humana sigue siendo necesaria incluso con confianza alta. |
| 7–8. Duplicados y cambios masivos | Comparación por RUT y nombre, diferencias entre registros, actualizar, fusionar, mantener, omitir o crear según el caso. Los cambios detectados requieren decisión individual o confirmación en bloque. |
| 9–10. Pagos y conciliación | Carga manual, vouchers y cartolas. Verificación del dinero y conciliación son estados separados. El sistema sugiere un alumno y periodos, y la aplicación del pago requiere confirmación. La conexión bancaria queda para V4. |
| 11–12. Alertas y recordatorios | Panel central y reglas editables para cobranza, buses, conductores, mantención por fecha o kilometraje, contratos, cotizaciones, viajes y recordatorios manuales. El recálculo funciona al entrar y mediante comando de operación diaria. |
| 13–14. Informes | Recaudación mensual con detalle y subtotales por bus, morosidad, verificación, conciliación, pagos agrupados por alumno y apoderado, ingresos por bus y servicio, comparación e informe anual, mantenciones por bus, vencimientos, conductores, cotizaciones, viajes realizados y contratos. Salidas PDF y Excel. |
| 15–16. Cierre y auditoría | Los cierres nuevos guardan totales e informe detallado. Los cierres históricos guardaron totales. Los ajustes de cobranza que afectan un mes cerrado requieren motivo y quedan identificados en auditoría. |
| 17–18. Relaciones y migración | Personas compartidas por alumno, apoderado, pagador, conductor y cliente. Cobranza, flota y operaciones se relacionan por sus fichas. La migración inicial de la empresa depende de recibir sus archivos y validar muestras de cada formato. |
| 19. Uso diario | Menú móvil y buscador con accesos por persona, bus y pago. Las preguntas frecuentes sobre recaudación, deuda, pagos, vencimientos, mantenciones y viajes ejecutan consultas predefinidas. |
| 20. Seguridad y recuperación | Inicio de sesión, roles, creación del primer usuario restringida en producción, RLS, descargas autenticadas, adjuntos en bucket privado, auditoría y comandos de respaldo. Quedan por programar los trabajos y ensayar una restauración de base y adjuntos juntos en el entorno que se use. |
| 21–22. Implementación por etapas | V1 de cobranza ampliada, control de flota V2 y operación V3 con PDF de cotización y borrador de contrato. V4 mantiene la conciliación asistida de cartola como punto de partida. |

## Pendientes para el piloto

1. Crear el proyecto Supabase de pruebas, configurar el bucket privado y desplegar Render usando [la guía de prueba en línea](08-pruebas-en-linea.md).
2. Configurar las claves de Gemini y Groq en Render y verificar la lectura de un PDF escaneado, una foto y un voucher ficticio desde el piloto en línea.
3. Tomar una muestra anonimizada de las planillas, nóminas y cartolas antiguas para ajustar encabezados, identificar duplicados frecuentes y comprobar los subtotales contra los registros existentes.
4. Antes de producción, validar el préstamo o sustitución de buses en los informes históricos, autorizar las plantillas contractuales, rotar la contraseña oficial y activar respaldos y pruebas de restauración. Los informes en vivo por bus y servicio usan la asignación vigente de la ficha. Los nuevos informes archivados conservan la asignación que se veía al cerrar.
5. Para V4, definir el banco o agregador y los formatos de cartola concretos. La API bancaria, los perfiles de importación por banco y la conciliación avanzada quedan pendientes.

## Datos y servicios verificados

- La conexión de la base oficial de Supabase respondió a una consulta de solo lectura. Sus 22 tablas vigentes tenían RLS activado. Las nuevas migraciones se prepararon y aplicaron en PostgreSQL de pruebas aislado.
- En PostgreSQL con datos ficticios se verificaron flota, vencimientos, mantenciones, viajes, devoluciones, importación confirmada y concurrente, informes PDF y Excel y motivo obligatorio al modificar un mes cerrado. El servidor compilado permitió iniciar sesión y abrir las páginas protegidas.
- Se generó un respaldo de adjuntos con verificación de huellas y se restauró un respaldo PostgreSQL en una base vacía de pruebas. La restauración conservó los registros, la búsqueda sin tildes y RLS en las 30 tablas.
- En local, Gemini leyó un comprobante ficticio por su API y Qwen en Groq tomó el relevo ante una falla simulada de Gemini. La importación dejó el comprobante en revisión.
