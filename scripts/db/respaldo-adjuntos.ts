import "../_entorno";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { leerArchivo } from "@/server/almacenamiento";
import { db } from "@/server/db";
import { documentos } from "@/server/db/schema";
import { entorno } from "@/server/entorno";

async function respaldar() {
  const destino = path.resolve(process.env.RESPALDO_ADJUNTOS_DIR ?? "respaldos");
  const carpeta = `${entorno.APP_ENTORNO}-adjuntos-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
  const incompleto = path.join(destino, `${carpeta}.incompleto`);
  await mkdir(incompleto, { recursive: true });
  const archivos = await db.select({ id: documentos.id, ruta: documentos.ruta, sha256: documentos.sha256 }).from(documentos);
  const manifiesto = [];
  for (const archivo of archivos) {
    const datos = await leerArchivo(archivo.ruta);
    if (createHash("sha256").update(datos).digest("hex") !== archivo.sha256) throw new Error(`El adjunto #${archivo.id} no coincide con su huella.`);
    const copia = `${archivo.id}.bin`;
    await writeFile(path.join(incompleto, copia), datos, { flag: "wx" });
    manifiesto.push({ ...archivo, copia });
  }
  await writeFile(path.join(incompleto, "manifest.json"), JSON.stringify(manifiesto, null, 2));
  await rename(incompleto, path.join(destino, carpeta));
  console.log(`Respaldo de ${archivos.length} adjunto(s): ${path.join(destino, carpeta)}`);
}

respaldar().then(() => process.exit(0), (error) => {
  console.error("Respaldo incompleto de adjuntos.", error);
  process.exit(1);
});
