import "server-only";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { Readable } from "node:stream";
import { ErrorNegocio } from "@/server/errores";

export type TablaLeida = { columnas: string[]; filas: Record<string, unknown>[]; hoja?: string };

/** Valor "plano" de una celda de Excel (fórmulas → resultado, texto enriquecido → texto). */
function valorCelda(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return valorCelda(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return v.text;
    if ("error" in v) return null;
  }
  return v;
}

/** Convierte una matriz (filas de celdas) en tabla con encabezados, detectando la fila de títulos. */
function matrizATabla(matriz: unknown[][], hoja?: string): TablaLeida {
  const noVacia = (f: unknown[]) => f.filter((c) => c !== null && c !== undefined && String(c).trim() !== "").length;
  // Fila de encabezado: la primera (dentro de las 15 primeras) con al menos 2 celdas de texto
  let idx = matriz.findIndex((f, i) => i < 15 && f.filter((c) => typeof c === "string" && c.trim()).length >= 2);
  if (idx < 0) idx = matriz.findIndex((f) => noVacia(f) > 0);
  if (idx < 0) throw new ErrorNegocio("El archivo no contiene datos.");

  const usados = new Map<string, number>();
  const columnas = matriz[idx].map((c, i) => {
    let nombre = c === null || c === undefined || String(c).trim() === "" ? `Columna ${i + 1}` : String(c).trim();
    const n = usados.get(nombre) ?? 0;
    usados.set(nombre, n + 1);
    if (n > 0) nombre = `${nombre} (${n + 1})`;
    return nombre;
  });
  const filas: Record<string, unknown>[] = [];
  for (const f of matriz.slice(idx + 1)) {
    if (noVacia(f) === 0) continue;
    const obj: Record<string, unknown> = {};
    columnas.forEach((col, i) => {
      const v = f[i];
      obj[col] = typeof v === "string" ? v.trim() : (v ?? null);
    });
    filas.push(obj);
  }
  // Quitar columnas completamente vacías
  const conDatos = columnas.filter((c) => filas.some((f) => f[c] !== null && f[c] !== ""));
  return { columnas: conDatos, filas: filas.map((f) => Object.fromEntries(conDatos.map((c) => [c, f[c]]))), hoja };
}

export async function leerExcel(buffer: Buffer, nombreHoja?: string): Promise<TablaLeida & { hojas: string[] }> {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ErrorNegocio("No se pudo leer el Excel. Si es un archivo .xls antiguo, ábrelo y guárdalo como .xlsx.");
  }
  const hojas = libro.worksheets.map((h) => h.name);
  const hoja = (nombreHoja && libro.getWorksheet(nombreHoja)) || libro.worksheets.find((h) => h.actualRowCount > 0);
  if (!hoja) throw new ErrorNegocio("El Excel no tiene hojas con datos.");
  const matriz: unknown[][] = [];
  hoja.eachRow({ includeEmpty: true }, (fila) => {
    const valores = (fila.values as ExcelJS.CellValue[]).slice(1).map(valorCelda);
    matriz.push(valores);
  });
  return { ...matrizATabla(matriz, hoja.name), hojas };
}

export async function leerCsv(buffer: Buffer): Promise<TablaLeida> {
  const libro = new ExcelJS.Workbook();
  const texto = buffer.toString("utf8").replace(/^﻿/, "");
  const primera = texto.split(/\r?\n/)[0] ?? "";
  const delimiter = (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ";" : ",";
  const hoja = await libro.csv.read(Readable.from([texto]), { parserOptions: { delimiter } });
  const matriz: unknown[][] = [];
  hoja.eachRow({ includeEmpty: true }, (fila) => matriz.push((fila.values as ExcelJS.CellValue[]).slice(1).map(valorCelda)));
  return matrizATabla(matriz);
}

/** Texto plano de un Word (.docx) para enviarlo a la IA. */
export async function textoDeWord(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value.trim();
}

/** Si el Word contiene una tabla (ej. nómina), la devuelve como tabla para mapear sin IA. */
export async function tablaDeWord(buffer: Buffer): Promise<TablaLeida | null> {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const tabla = /<table[\s\S]*?<\/table>/i.exec(html)?.[0];
  if (!tabla) return null;
  const filas = [...tabla.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((tr) =>
    [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((td) =>
      td[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim(),
    ),
  );
  if (filas.length < 2) return null;
  return matrizATabla(filas);
}
