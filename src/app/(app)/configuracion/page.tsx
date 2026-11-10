import Link from "next/link";
import { Bell, Users } from "lucide-react";
import { requerirUsuario } from "@/server/auth/sesion";
import { leerVariasConfig } from "@/server/configuracion";
import { iaHabilitada, entorno } from "@/server/entorno";
import { EncabezadoPagina, Insignia, Tarjeta } from "@/components/ui/basicos";
import { FormularioGeneral } from "./general";

export const metadata = { title: "Configuración" };

const SECCIONES = [
  { href: "/configuracion/alertas", texto: "Reglas de alerta", desc: "Días de aviso y colores", icono: Bell, admin: true },
  { href: "/configuracion/usuarios", texto: "Usuarios", desc: "Accesos y permisos", icono: Users, admin: true },
];

export default async function PaginaConfiguracion() {
  const usuario = await requerirUsuario();
  const c = await leerVariasConfig([
    "empresa.nombre",
    "empresa.rut",
    "cobranza.dia_vencimiento",
    "cobranza.meses_cobro",
    "conciliacion.coincidencia_minima",
    "alertas.intervalo_minutos",
  ]);
  return (
    <>
      <EncabezadoPagina titulo="Configuración" descripcion="Ajustes del sistema. Buses y servicios están en el menú lateral, sección «Flota y servicios»." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {SECCIONES.filter((s) => !s.admin || usuario.rol === "admin").map((s) => (
          <Link key={s.href} href={s.href} className="tarjeta flex items-center gap-3 p-4 transition hover:border-marca-300">
            <s.icono className="size-6 text-marca-700" />
            <span>
              <span className="block font-semibold text-slate-900">{s.texto}</span>
              <span className="block text-xs text-slate-500">{s.desc}</span>
            </span>
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Tarjeta titulo="General y cobranza" className="lg:col-span-2">
          {usuario.rol === "admin" ? (
            <FormularioGeneral
              valores={{
                empresaNombre: String(c["empresa.nombre"] ?? ""),
                empresaRut: String(c["empresa.rut"] ?? ""),
                dia: Number(c["cobranza.dia_vencimiento"]),
                meses: (c["cobranza.meses_cobro"] as number[]) ?? [],
                coincidencia: Number(c["conciliacion.coincidencia_minima"]),
                intervalo: Number(c["alertas.intervalo_minutos"]),
              }}
            />
          ) : (
            <p className="text-sm text-slate-500">Solo un administrador puede cambiar la configuración general.</p>
          )}
        </Tarjeta>
        <Tarjeta titulo="Sistema">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>Lectura con IA</dt>
              <dd>{iaHabilitada() ? <Insignia color="verde">Activa · {entorno.AI_MODEL}</Insignia> : <Insignia color="amarillo">No configurada</Insignia>}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Zona horaria</dt>
              <dd>{entorno.APP_TIMEZONE}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Máx. por archivo</dt>
              <dd>{entorno.UPLOAD_MAX_MB} MB</dd>
            </div>
          </dl>
          {!iaHabilitada() && <p className="mt-3 text-xs text-slate-500">Para activar la IA agrega ANTHROPIC_API_KEY en .env.local y reinicia el sistema.</p>}
        </Tarjeta>
      </div>
    </>
  );
}
