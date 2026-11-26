import assert from "node:assert/strict";
import { test } from "node:test";
import { CAMPOS_IMPORTACION } from "@/lib/importacion-campos";

process.env.DATABASE_URL = "postgres://prueba@127.0.0.1:1/prueba";
process.env.ANTHROPIC_API_KEY = "anthropic-simulado";
process.env.OPENAI_API_KEY = "openai-simulado";
process.env.AI_PROVEEDOR_PRINCIPAL = "anthropic";

const opciones = { destino: "pagos", tipo: "pdf", buffer: Buffer.from("%PDF-1.4\nEjemplo sintético") } as const;
const pago = {
  tipo_documento: "voucher",
  resumen: "Transferencia de prueba",
  registros: [{
    campos: Object.fromEntries(CAMPOS_IMPORTACION.pagos.map((c) => [c.clave,
      c.clave === "monto" ? { valor: "95000", confianza: "alta" } : { valor: null, confianza: "baja" },
    ])),
    nota: null,
  }],
  advertencias: [],
};

function respuestaOpenAi(texto: string) {
  return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: texto }] }] });
}

test("usa OpenAI como respaldo y conserva el formato de revisión", async (t) => {
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (entrada: URL | string, init: RequestInit) => {
    const host = new URL(entrada).hostname;
    urls.push(host);
    if (host === "api.anthropic.com") {
      return Response.json({ type: "error", error: { type: "overloaded_error", message: "Simulación" } }, { status: 503 });
    }
    assert.equal(host, "api.openai.com");
    const solicitud = JSON.parse(String(init.body));
    assert.equal(solicitud.store, false);
    assert.equal(solicitud.text.format.strict, true);
    assert.match(solicitud.input[0].content[0].file_data, /^data:application\/pdf;base64,/);
    return respuestaOpenAi(JSON.stringify(pago));
  });
  const { extraerConIa } = await import("@/server/importacion/ia");
  const resultado = await extraerConIa(opciones);
  assert.deepEqual(urls, ["api.anthropic.com", "api.openai.com"]);
  assert.equal(resultado.proveedor, "openai");
  assert.equal(resultado.respaldo, true);
  assert.equal(resultado.registros[0].campos.monto.valor, "95000");
  assert.equal(resultado.registros[0].campos.nombre_origen.valor, null);
});

test("reporta el fallo de los dos proveedores sin producir registros", async (t) => {
  t.mock.method(globalThis, "fetch", async (entrada: URL | string) => {
    return new URL(entrada).hostname === "api.anthropic.com"
      ? Response.json({ type: "error" }, { status: 401 })
      : respuestaOpenAi('{"registros":[]}');
  });
  const { extraerConIa } = await import("@/server/importacion/ia");
  await assert.rejects(extraerConIa(opciones), /Anthropic ni con OpenAI/);
});
