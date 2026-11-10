import { asc } from "drizzle-orm";
import { requerirUsuario } from "@/server/auth/sesion";
import { db } from "@/server/db";
import { reglasAlerta } from "@/server/db/schema";
import { EncabezadoPagina, Insignia } from "@/components/ui/basicos";
import { MODULO_ETIQUETA } from "@/lib/constantes";
import { accionGuardarRegla } from "../../alertas/acciones";
import { FormularioRegla } from "./formulario";

export const metadata = { title: "Reglas de alerta" };

export default async function PaginaReglas() {
  await requerirUsuario(["admin"]);
  const reglas = await db.select().from(reglasAlerta).orderBy(asc(reglasAlerta.modulo), asc(reglasAlerta.nombre));
  return (
    <>
      <EncabezadoPagina
        titulo="Reglas de alerta"
        volver={{ href: "/configuracion", texto: "Configuración" }}
        descripcion="Define cuántos días antes (o después) avisar y con qué color. Ej: 30 días antes → amarilla · 7 días antes → naranja · vencido → roja."
      />
      <div className="space-y-3">
        {reglas.map((r) => (
          <details key={r.codigo} className="tarjeta p-4">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
              <Insignia>{MODULO_ETIQUETA[r.modulo]}</Insignia>
              <span className="font-bold">{r.nombre}</span>
              {r.activa ? <Insignia color="verde">Activa</Insignia> : <Insignia color="gris">Desactivada</Insignia>}
              <span className="ml-auto text-xs text-slate-500">Configurar ▾</span>
            </summary>
            <p className="mt-2 text-sm text-slate-600">{r.descripcion}</p>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <FormularioRegla accion={accionGuardarRegla.bind(null, r.codigo)} regla={{ activa: r.activa, umbrales: r.umbrales, parametros: r.parametros }} />
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
