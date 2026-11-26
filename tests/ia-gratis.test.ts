import assert from "node:assert/strict";
import { test } from "node:test";
import { jsPDF } from "jspdf";
import { CAMPOS_IMPORTACION } from "@/lib/importacion-campos";

process.env.DATABASE_URL = "postgres://prueba@127.0.0.1:1/prueba";
process.env.AI_PROVEEDOR_PRINCIPAL = "gemini";
process.env.GEMINI_API_KEY = "gemini-simulado";
process.env.GROQ_API_KEY = "groq-simulado";
process.env.ANTHROPIC_API_KEY = "anthropic-simulado";
process.env.OPENAI_API_KEY = "openai-simulado";

const voucher = new jsPDF().text("Comprobante de prueba - Monto $95.000", 15, 20);
const opciones = { destino: "pagos", tipo: "pdf", buffer: Buffer.from(voucher.output("arraybuffer")) } as const;
const lectura = JSON.stringify({
  tipo_documento: "voucher", resumen: "Comprobante ficticio", advertencias: [],
  registros: [{ nota: null, campos: Object.fromEntries(CAMPOS_IMPORTACION.pagos.map(({ clave }) => [clave,
    clave === "monto" ? { valor: "95000", confianza: "alta" } : { valor: null, confianza: "baja" },
  ])) }],
});

test("Gemini recibe el PDF nativo y devuelve los campos de revisión", async (t) => {
  t.mock.method(globalThis, "fetch", async (entrada: string, init: RequestInit) => {
    assert.equal(new URL(entrada).hostname, "generativelanguage.googleapis.com");
    assert.equal(new Headers(init.headers).get("x-goog-api-key"), "gemini-simulado");
    const solicitud = JSON.parse(String(init.body));
    assert.equal(solicitud.contents[0].parts[0].inlineData.mimeType, "application/pdf");
    assert.ok(solicitud.generationConfig.responseJsonSchema.properties.registros);
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: lectura }] } }] });
  });
  const { extraerConIa } = await import("@/server/importacion/ia");
  const resultado = await extraerConIa(opciones);
  assert.equal(resultado.proveedor, "gemini");
  assert.equal(resultado.respaldo, false);
  assert.equal(resultado.registros[0].campos.monto.valor, "95000");
});

test("Groq respalda a Gemini ante una cuota agotada y recibe el PDF convertido en JPEG", async (t) => {
  const llamadas: string[] = [];
  t.mock.method(globalThis, "fetch", async (entrada: string, init: RequestInit) => {
    const host = new URL(entrada).hostname;
    llamadas.push(host);
    if (host === "generativelanguage.googleapis.com") return new Response(null, { status: 429 });
    assert.equal(host, "api.groq.com");
    const solicitud = JSON.parse(String(init.body));
    assert.equal(solicitud.response_format.type, "json_object");
    assert.match(solicitud.messages[1].content[0].image_url.url, /^data:image\/jpeg;base64,\/9j\//);
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: lectura } }] });
  });
  const { extraerConIa } = await import("@/server/importacion/ia");
  const resultado = await extraerConIa(opciones);
  assert.deepEqual(llamadas, ["generativelanguage.googleapis.com", "api.groq.com"]);
  assert.equal(resultado.proveedor, "groq");
  assert.equal(resultado.respaldo, true);
  assert.equal(resultado.registros[0].campos.nombre_origen.valor, null);
});
