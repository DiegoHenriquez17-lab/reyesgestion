import "./_entorno";
import { recalcularAlertas } from "@/server/alertas/motor";
import { contextoSistema, periodosCerrados } from "@/server/auditoria";
import { leerConfig } from "@/server/configuracion";
import { db } from "@/server/db";
import { periodoActual } from "@/server/fechas";
import { generarMensualidades } from "@/server/modulos/mensualidades";

async function ejecutar() {
  if (process.argv.includes("--mensualidades")) {
    const periodo = periodoActual();
    const meses = await leerConfig("cobranza.meses_cobro");
    if (meses.includes(Number(periodo.slice(5, 7))) && !(await periodosCerrados(db, [periodo])).length) {
      const { creadas } = await generarMensualidades(contextoSistema, periodo);
      console.log(`Mensualidades generadas: ${creadas}`);
    }
  }
  const { nuevas, actualizadas, resueltas } = await recalcularAlertas({ forzar: true });
  console.log(`Alertas: ${nuevas} nuevas, ${actualizadas} actualizadas, ${resueltas} resueltas.`);
}

ejecutar().then(() => process.exit(0), (error) => {
  console.error("No se pudo completar la operación diaria.", error);
  process.exit(1);
});
