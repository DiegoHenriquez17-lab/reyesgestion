/**
 * Recalcula todas las alertas. Pensado para ejecutarse programado (cada mañana, por ejemplo)
 * con el Programador de tareas de Windows o un cron en el servidor.
 *
 * Uso: pnpm alertas
 */
import "./_entorno";
import { recalcularAlertas } from "@/server/alertas/motor";

recalcularAlertas({ forzar: true })
  .then((r) => {
    console.log(`✓ Alertas: ${r.nuevas} nuevas, ${r.actualizadas} actualizadas, ${r.resueltas} resueltas`);
    process.exit(0);
  })
  .catch((e) => {
    console.error("✗ Error al recalcular alertas:", e);
    process.exit(1);
  });
