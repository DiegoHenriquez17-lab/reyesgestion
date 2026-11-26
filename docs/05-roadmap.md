# Hoja de ruta de Reyes Gestión

## Versión 1 — Cobranza escolar

El piloto incluye fichas relacionadas de alumnos, apoderados y pagadores, mensualidades, pagos manuales y por voucher, carga de cartolas, conciliación asistida, devoluciones, buscador, alertas, informes PDF y Excel, auditoría y cierre de mes con informe archivado. Excel, Word, PDF e imágenes pasan por una revisión antes de llegar a las fichas o pagos.

Para completar el piloto en línea, falta configurar las claves de Gemini y Groq en Render y validar planillas y comprobantes ficticios. El respaldo y la restauración deben probarse también en el entorno de la empresa.

## Versión 2 — Flota y conductores

Control de buses, fichas de conductor, carga de nóminas, vencimientos de documentos, lectura asistida de adjuntos, kilometraje y planes de mantención por fecha o km. El panel recibe las alertas y los informes muestran gastos por bus, documentos y conductores.

En el piloto se revisarán los vencimientos de los primeros documentos y se ajustarán los avisos de cada tipo.

## Versión 3 — Cotizaciones, viajes y contratos

Las cotizaciones aceptadas se pueden convertir en viajes. Cada viaje registra estado, fecha, cliente, servicio, bus, conductor y preparación de documentos. Los contratos registran vigencia y adjuntos privados. La app genera la cotización y el borrador de contrato en PDF y avisa de vencimientos y preparativos pendientes.

Antes de operar, revisa la plantilla contractual de la empresa y el flujo de aprobación de cotizaciones y contratos.

## Versión 4 — Conciliación bancaria avanzada

Definir bancos o agregadores, evaluar sus APIs, guardar formatos específicos de cartola y ampliar las reglas de conciliación manteniendo la confirmación humana cuando haya dudas.

## Despliegue

El piloto usa Render y un proyecto de Supabase separado de producción. Los pasos de despliegue están en la [guía de pruebas en línea](08-pruebas-en-linea.md). La [revisión de requisitos](09-auditoria-requisitos-2027.md) detalla qué está implementado y qué necesita validación.
