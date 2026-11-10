import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import sharp from "sharp";
import { z } from "zod";
import { entorno, iaHabilitada } from "@/server/entorno";
import { ErrorNegocio } from "@/server/errores";
import type { DestinoImportacion } from "@/lib/constantes";
import { CAMPOS_IMPORTACION } from "@/lib/importacion-campos";

/**
 * EXTRACCIÓN CON IA (Claude) desde fotos, PDF y Word.
 *
 * PRINCIPIO TÉCNICO DEL PROYECTO: LA IA NO INVENTA INFORMACIÓN.
 *  - Solo transcribe lo que está escrito en el documento.
 *  - Si un dato no se lee con claridad → valor null ("Información no identificada / requiere revisión").
 *  - Cada dato trae su nivel de confianza; lo dudoso se marca para revisión.
 *  - Nada se guarda sin que el usuario lo revise y confirme (IMPORTAR → ANALIZAR → MOSTRAR → VALIDAR → GUARDAR).
 */

const confianza = z.enum(["alta", "media", "baja"]);
const valorCampo = z.object({
  valor: z.string().nullable().describe("Texto exactamente como aparece en el documento, o null si no se identifica con claridad"),
  confianza: confianza.describe("alta: se lee sin ninguna duda; media: legible pero con alguna duda; baja: casi ilegible o deducido"),
});

function esquemaPara(destino: DestinoImportacion) {
  const campos = CAMPOS_IMPORTACION[destino].filter((c) => !["alumno_nombres", "alumno_apellidos"].includes(c.clave));
  const forma = Object.fromEntries(campos.map((c) => [c.clave, valorCampo.describe(c.etiqueta)]));
  return z.object({
    tipo_documento: z.string().describe("Qué tipo de documento es (ej: voucher de transferencia, planilla de alumnos, nómina, contrato)"),
    resumen: z.string().describe("Una o dos frases describiendo el contenido"),
    registros: z.array(
      z.object({
        campos: z.object(forma),
        nota: z.string().nullable().describe("Cualquier aclaración sobre este registro, o null"),
      }),
    ),
    advertencias: z.array(z.string()).describe("Problemas de lectura: partes borrosas, cortadas, ambiguas, etc."),
  });
}

export type ResultadoIa = {
  tipo_documento: string;
  resumen: string;
  registros: { campos: Record<string, { valor: string | null; confianza: "alta" | "media" | "baja" }>; nota: string | null }[];
  advertencias: string[];
};

const SISTEMA = `Eres el asistente de digitalización de documentos de una empresa chilena de transporte escolar y turismo.
Tu única tarea es TRANSCRIBIR información de documentos (fotos de planillas, comprobantes de transferencia, PDF, Word) a campos estructurados.

REGLAS OBLIGATORIAS (no negociables):
1. NO INVENTES NADA. Transcribe solo lo que está escrito y se lee con claridad en el documento.
2. Si un dato no aparece, está borroso, cortado o tienes dudas razonables sobre él, usa valor null. Nunca completes, adivines ni deduzcas datos a partir del contexto.
3. Nunca deduzcas a qué alumno corresponde un pago si el documento no lo dice explícitamente. Un comprobante bancario solo tiene el nombre de quien transfiere: ese va en "nombre_origen", NO en "alumno_nombre".
4. Copia nombres y RUT exactamente como están escritos (respeta tildes y mayúsculas del documento).
5. Montos: solo dígitos, en pesos chilenos, sin puntos ni símbolo (ej: "$95.000" → "95000"). Si el monto es ilegible → null.
6. Fechas: formato AAAA-MM-DD solo si el día, mes y año son inequívocos. Si falta el año o es ambigua, transcríbela tal cual aparece y usa confianza "baja".
7. "periodo" es el mes que se paga (ej: "Agosto 2027"); solo si el documento lo indica.
8. Marca confianza "alta" solo cuando no hay ninguna duda. Ante cualquier duda, "media" o "baja".
9. Un registro por cada fila / persona / comprobante distinto. Si el documento no contiene registros útiles, devuelve la lista vacía y explica en advertencias.
10. Reporta en "advertencias" todo problema de lectura.`;

function cliente() {
  if (!iaHabilitada()) {
    throw new ErrorNegocio("La lectura con IA no está configurada. Agrega ANTHROPIC_API_KEY en .env.local y reinicia el sistema.");
  }
  return new Anthropic({ apiKey: entorno.ANTHROPIC_API_KEY });
}

/** Modelos que aceptan el respaldo automático del servidor ante un rechazo de seguridad. */
const aceptaRespaldo = (modelo: string) => /^claude-(opus-5|opus-5-5|fable-5-1|sonnet-5-5)$/.test(modelo);

async function bloqueDocumento(
  buffer: Buffer,
  tipo: "imagen" | "pdf" | "word",
  textoWord?: string,
): Promise<Anthropic.Beta.BetaContentBlockParam> {
  if (tipo === "pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } };
  }
  if (tipo === "word") {
    return { type: "text", text: `CONTENIDO DEL DOCUMENTO WORD:\n<documento>\n${textoWord ?? ""}\n</documento>` };
  }
  // Imágenes: se orientan y reducen (las fotos de celular suelen ser enormes)
  let jpeg: Buffer;
  try {
    jpeg = await sharp(buffer).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  } catch {
    throw new ErrorNegocio("No se pudo leer la imagen. Envía la foto en formato JPG o PNG.");
  }
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } };
}

export async function extraerConIa(opciones: {
  buffer: Buffer;
  tipo: "imagen" | "pdf" | "word";
  destino: DestinoImportacion;
  textoWord?: string;
  indicaciones?: string;
}): Promise<ResultadoIa> {
  const anthropic = cliente();
  const esquema = esquemaPara(opciones.destino);
  const queBuscar =
    opciones.destino === "alumnos"
      ? "Extrae los alumnos (y sus apoderados, buses, tarifas, servicios, etc.) que aparecen en el documento."
      : "Extrae los pagos / comprobantes / transferencias que aparecen en el documento.";

  const parametros: Anthropic.Beta.MessageCreateParamsNonStreaming = {
    model: entorno.AI_MODEL,
    max_tokens: 64000,
    system: SISTEMA,
    output_config: { effort: entorno.AI_EFFORT, format: betaZodOutputFormat(esquema) },
    messages: [
      {
        role: "user",
        content: [
          await bloqueDocumento(opciones.buffer, opciones.tipo, opciones.textoWord),
          {
            type: "text",
            text: `${queBuscar}${opciones.indicaciones ? `\n\nIndicaciones del usuario: ${opciones.indicaciones}` : ""}`,
          },
        ],
      },
    ],
    ...(aceptaRespaldo(entorno.AI_MODEL) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  };

  let mensaje: Anthropic.Beta.BetaMessage;
  try {
    // Streaming: documentos grandes pueden generar respuestas largas
    mensaje = await anthropic.beta.messages.stream(parametros).finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new ErrorNegocio("La clave de la API de IA es inválida (revisa ANTHROPIC_API_KEY).");
    if (e instanceof Anthropic.RateLimitError) throw new ErrorNegocio("El servicio de IA está ocupado. Intenta nuevamente en un minuto.");
    if (e instanceof Anthropic.BadRequestError) throw new ErrorNegocio(`La IA no pudo procesar el archivo: ${e.message}`);
    if (e instanceof Anthropic.APIError) throw new ErrorNegocio(`Error del servicio de IA (${e.status}). Intenta nuevamente.`);
    if (e instanceof Anthropic.APIConnectionError) throw new ErrorNegocio("No hay conexión con el servicio de IA.");
    throw e;
  }

  if (mensaje.stop_reason === "refusal") {
    throw new ErrorNegocio("La IA no procesó este documento. Revísalo y cárgalo manualmente.");
  }
  if (mensaje.stop_reason === "max_tokens") {
    throw new ErrorNegocio("El documento es demasiado extenso para leerlo de una vez. Divídelo en partes más pequeñas.");
  }
  const texto = mensaje.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new ErrorNegocio("La respuesta de la IA no tuvo el formato esperado. Intenta nuevamente.");
  }
  const validado = esquema.safeParse(json);
  if (!validado.success) throw new ErrorNegocio("La respuesta de la IA no tuvo el formato esperado. Intenta nuevamente.");
  return validado.data as ResultadoIa;
}
