import "server-only";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { autoTable, type RowInput } from "jspdf-autotable";
import { esNumerico, formatearValor, type FilaInforme, type Informe } from "@/lib/informe";

/** Exporta cualquier informe a Excel (.xlsx) con formato. */
export async function informeAExcel(inf: Informe): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = inf.empresa;
  libro.created = new Date();
  const hoja = libro.addWorksheet(inf.titulo.slice(0, 31).replace(/[\\/?*[\]:]/g, "-"), {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  const nCols = inf.columnas.length;

  const fila = (valores: unknown[]) => hoja.addRow(valores);
  const titulo = fila([inf.empresa]);
  titulo.font = { bold: true, size: 12 };
  fila([inf.titulo]).font = { bold: true, size: 14 };
  if (inf.subtitulo) fila([inf.subtitulo]).font = { italic: true, color: { argb: "FF555555" } };
  fila([`Generado: ${inf.generadoEn}`]).font = { size: 9, color: { argb: "FF777777" } };
  fila([]);

  if (inf.indicadores?.length) {
    for (const ind of inf.indicadores) {
      const r = fila([ind.etiqueta, typeof ind.valor === "number" && ind.tipo === "porcentaje" ? ind.valor / 100 : ind.valor]);
      r.getCell(1).font = { bold: true };
      const c = r.getCell(2);
      if (ind.tipo === "pesos") c.numFmt = '"$"#,##0';
      if (ind.tipo === "porcentaje") c.numFmt = "0.0%";
      if (ind.destacado) c.font = { bold: true, color: { argb: "FF1D4ED8" } };
    }
    fila([]);
  }

  const escribirFila = (f: FilaInforme, estilo?: "subtotal" | "total") => {
    const r = fila(
      inf.columnas.map((c) => {
        const v = f[c.clave];
        if (v === null || v === undefined) return null;
        if (c.tipo === "porcentaje") return Number(v) / 100;
        if (c.tipo === "fecha" || c.tipo === "periodo") return formatearValor(v, c.tipo);
        return v;
      }),
    );
    inf.columnas.forEach((c, i) => {
      const cell = r.getCell(i + 1);
      if (c.tipo === "pesos") cell.numFmt = '"$"#,##0';
      if (c.tipo === "numero") cell.numFmt = "#,##0";
      if (c.tipo === "porcentaje") cell.numFmt = "0.0%";
    });
    if (estilo) {
      r.font = { bold: true };
      r.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: estilo === "total" ? "FFDBEAFE" : "FFF1F5F9" } };
      });
    }
  };

  const cabecera = fila(inf.columnas.map((c) => c.titulo));
  cabecera.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cabecera.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
    c.alignment = { vertical: "middle", wrapText: true };
  });

  for (const s of inf.secciones) {
    if (s.titulo) {
      const r = fila([s.titulo]);
      r.font = { bold: true, color: { argb: "FF1E3A8A" } };
      hoja.mergeCells(r.number, 1, r.number, nCols);
    }
    for (const f of s.filas) escribirFila(f);
    if (s.subtotal) escribirFila(s.subtotal, "subtotal");
  }
  if (inf.totalGeneral) escribirFila(inf.totalGeneral, "total");
  if (inf.notas?.length) {
    fila([]);
    for (const n of inf.notas) fila([n]).font = { italic: true };
  }

  inf.columnas.forEach((c, i) => {
    hoja.getColumn(i + 1).width = c.ancho ?? 16;
  });
  return Buffer.from(await libro.xlsx.writeBuffer());
}

/** Exporta cualquier informe a PDF (A4 horizontal) con tabla, subtotales y total general. */
export function informeAPdf(inf: Informe): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const ancho = doc.internal.pageSize.getWidth();
  let y = 14;
  doc.setFontSize(10).setTextColor(90).text(inf.empresa, 14, y);
  doc.setFontSize(8).text(`Generado: ${inf.generadoEn}`, ancho - 14, y, { align: "right" });
  y += 7;
  doc.setFontSize(15).setTextColor(20).setFont("helvetica", "bold").text(inf.titulo, 14, y);
  doc.setFont("helvetica", "normal");
  if (inf.subtitulo) {
    y += 6;
    doc.setFontSize(9).setTextColor(100).text(inf.subtitulo, 14, y);
  }
  y += 5;

  if (inf.indicadores?.length) {
    const porFila = 5;
    const anchoCaja = (ancho - 28 - (porFila - 1) * 3) / porFila;
    inf.indicadores.forEach((ind, i) => {
      const col = i % porFila;
      const filaN = Math.floor(i / porFila);
      const x = 14 + col * (anchoCaja + 3);
      const yy = y + filaN * 15;
      doc.setDrawColor(220).setFillColor(ind.destacado ? 239 : 248, ind.destacado ? 246 : 250, ind.destacado ? 255 : 252);
      doc.roundedRect(x, yy, anchoCaja, 13, 1.5, 1.5, "FD");
      doc.setFontSize(7).setTextColor(100).text(ind.etiqueta, x + 2.5, yy + 4.5);
      doc
        .setFontSize(11)
        .setTextColor(ind.destacado ? 29 : 20, ind.destacado ? 78 : 20, ind.destacado ? 216 : 20)
        .setFont("helvetica", "bold")
        .text(formatearValor(ind.valor, ind.tipo), x + 2.5, yy + 10.5);
      doc.setFont("helvetica", "normal");
    });
    y += Math.ceil(inf.indicadores.length / porFila) * 15 + 2;
  }

  const n = inf.columnas.length;
  const celda = (f: FilaInforme) => inf.columnas.map((c) => formatearValor(f[c.clave], c.tipo));
  const cuerpo: RowInput[] = [];
  for (const s of inf.secciones) {
    if (s.titulo) {
      cuerpo.push([{ content: s.titulo, colSpan: n, styles: { fontStyle: "bold", textColor: [30, 58, 138], fillColor: [238, 242, 255] } }]);
    }
    for (const f of s.filas) cuerpo.push(celda(f));
    if (s.subtotal) {
      cuerpo.push(celda(s.subtotal).map((v) => ({ content: v, styles: { fontStyle: "bold" as const, fillColor: [241, 245, 249] as [number, number, number] } })));
    }
  }
  if (inf.totalGeneral) {
    cuerpo.push(
      celda(inf.totalGeneral).map((v) => ({ content: v, styles: { fontStyle: "bold" as const, fillColor: [219, 234, 254] as [number, number, number] } })),
    );
  }

  autoTable(doc, {
    startY: y + 2,
    head: [inf.columnas.map((c) => c.titulo)],
    body: cuerpo,
    styles: { fontSize: 7.5, cellPadding: 1.4, overflow: "linebreak" },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold" },
    columnStyles: Object.fromEntries(inf.columnas.map((c, i) => [i, { halign: esNumerico(c.tipo) ? "right" : "left" }])),
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      const pag = doc.getNumberOfPages();
      doc.setFontSize(7).setTextColor(150).text(`Página ${pag}`, ancho - 14, doc.internal.pageSize.getHeight() - 6, { align: "right" });
    },
  });

  if (inf.notas?.length) {
    // @ts-expect-error lastAutoTable lo agrega el plugin
    let yn = (doc.lastAutoTable?.finalY ?? y) + 6;
    doc.setFontSize(8).setTextColor(80);
    for (const nota of inf.notas) {
      doc.text(nota, 14, yn);
      yn += 4;
    }
  }
  return Buffer.from(doc.output("arraybuffer"));
}
