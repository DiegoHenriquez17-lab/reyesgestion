/**
 * DATOS DE DEMOSTRACIÓN (ficticios) para probar el sistema en desarrollo.
 * Crea buses, servicios, alumnos con apoderados, mensualidades de los últimos meses
 * y pagos en distintos estados (conciliados, por verificar, por conciliar).
 *
 * No se ejecuta si ya existen alumnos (para no mezclar con datos reales).
 * Uso: pnpm db:demo
 */
import "../_entorno";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { alumnos } from "@/server/db/schema";
import type { Contexto } from "@/server/auditoria";
import { guardarBus, guardarServicio, resolverBus, resolverServicio } from "@/server/modulos/catalogos";
import { crearAlumno } from "@/server/modulos/alumnos";
import { generarMensualidades } from "@/server/modulos/mensualidades";
import { registrarPago, proponerAplicacionFifo } from "@/server/modulos/pagos";
import { recalcularAlertas } from "@/server/alertas/motor";
import { hoy } from "@/server/fechas";
import { leerConfig } from "@/server/configuracion";
import { calcularDv } from "@/lib/rut";
import { sumarDias, sumarMeses } from "@/lib/fechas";

const ctx: Contexto = { usuarioId: null, usuarioNombre: "Datos de demostración", origen: "sistema" };

const NOMBRES = ["Tomás", "Valentina", "Martín", "Isidora", "Benjamín", "Florencia", "Vicente", "Josefa", "Agustín", "Antonella", "Matías", "Emilia", "Joaquín", "Catalina", "Lucas", "Sofía", "Maximiliano", "Trinidad", "Cristóbal", "Amanda", "Diego", "Renata", "Gaspar", "Maite"];
const APELLIDOS = ["Rojas", "Muñoz", "González", "Díaz", "Soto", "Contreras", "Silva", "Martínez", "Sepúlveda", "Morales", "Fuentes", "Torres", "Araya", "Flores", "Espinoza", "Valenzuela", "Castillo", "Tapia", "Reyes", "Gutiérrez"];
const PADRES = ["Pedro", "Carolina", "Juan", "Paula", "Rodrigo", "Andrea", "Felipe", "Daniela", "Cristian", "Marcela"];

let semilla = 7;
const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
const elegir = <T,>(lista: T[]) => lista[Math.floor(azar() * lista.length)];
const rutFicticio = (base: number) => `${base}-${calcularDv(base)}`;

async function main() {
  // Protección: los datos ficticios JAMÁS se cargan en la base oficial
  const host = new URL(process.env.DATABASE_URL ?? "postgres://x@localhost/x").hostname;
  if (process.env.APP_ENTORNO === "oficial" || !["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error("Los datos de demostración solo se cargan en la base local de desarrollo.");
  }
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(alumnos);
  if (total > 0 && !process.argv.includes("--forzar")) {
    console.log("• Ya existen alumnos: no se cargan datos de demostración (usa --forzar si estás seguro).");
    return;
  }

  const buses = [];
  for (const [numero, patente] of [["16", "ABCD11"], ["17", "BCDF22"], ["27", "CDFG33"], ["29", "DFGH44"], ["34", "FGHJ55"]]) {
    buses.push((await resolverBus(numero)) ?? (await guardarBus(ctx, null, { numero, patente, capacidad: 30, activo: true })));
  }
  const servicios = [];
  for (const [nombre, tipo, tarifa] of [
    ["Escolar mañana", "escolar", "95000"],
    ["Escolar tarde", "escolar", "80000"],
    ["Jardín infantil", "especial", "70000"],
  ]) {
    servicios.push((await resolverServicio(nombre)) ?? (await guardarServicio(ctx, null, { nombre, tipo, tarifaReferencia: tarifa, activo: true })));
  }
  console.log(`✓ ${buses.length} buses y ${servicios.length} servicios`);

  const creados: { id: number; tarifa: number; apoderado: string }[] = [];
  for (let i = 0; i < 24; i++) {
    const ap1 = elegir(APELLIDOS);
    const ap2 = elegir(APELLIDOS);
    const tarifa = elegir([95000, 95000, 80000, 100000, 70000]);
    const padre = elegir(PADRES);
    const sinBus = i % 11 === 10;
    const alumno = await crearAlumno(ctx, {
      persona: {
        nombres: NOMBRES[i],
        apellidos: `${ap1} ${ap2}`,
        rut: rutFicticio(24_000_000 + i * 137),
        telefono: null,
        email: null,
        direccion: `Calle ${elegir(["Los Aromos", "El Roble", "Arauco", "Libertad", "Maipón"])} ${100 + i * 7}`,
        comuna: "Chillán",
        observaciones: null,
      },
      alumno: {
        establecimiento: elegir(["Colegio Concepción", "Liceo Narciso Tondreau", "Colegio Seminario"]),
        curso: `${1 + (i % 8)}° básico`,
        busId: sinBus ? null : buses[i % buses.length].id,
        servicioId: servicios[sinBus ? 2 : i % 2].id,
        tarifaMensual: tarifa,
        estado: "activo",
      },
      apoderado: {
        persona: {
          nombres: padre,
          apellidos: `${ap1} ${elegir(APELLIDOS)}`,
          rut: rutFicticio(12_000_000 + i * 911),
          telefono: `+56 9 ${String(50000000 + i * 12345).slice(0, 4)} ${String(1000 + i * 37).slice(0, 4)}`,
          email: null,
          direccion: null,
          comuna: null,
          observaciones: null,
        },
        esApoderado: true,
        esTitular: true,
        esPagador: true,
        parentesco: elegir(["Padre", "Madre"]),
      },
    });
    creados.push({ id: alumno.id, tarifa, apoderado: `${padre} ${ap1}` });
  }
  console.log(`✓ ${creados.length} alumnos con apoderado`);

  // Mensualidades de los últimos meses de cobro
  const hoyStr = hoy();
  const actual = `${hoyStr.slice(0, 7)}-01`;
  const mesesCobro = await leerConfig("cobranza.meses_cobro");
  const periodos = [sumarMeses(actual, -2), sumarMeses(actual, -1), actual].filter((p) => mesesCobro.includes(Number(p.slice(5, 7))));
  for (const p of periodos) await generarMensualidades(ctx, p);
  console.log(`✓ Mensualidades: ${periodos.join(", ")}`);

  // Pagos: la mayoría paga, algunos deben, uno paga parcial, otros por verificar / por conciliar
  let n = 0;
  for (const [i, a] of creados.entries()) {
    if (i % 7 === 3) continue; // morosos
    const mesesQuePaga = i % 5 === 0 ? 1 : periodos.length - (i % 3 === 0 ? 1 : 0);
    for (let m = 0; m < mesesQuePaga; m++) {
      const monto = i === 4 && m === mesesQuePaga - 1 ? Math.round(a.tarifa / 2) : a.tarifa;
      await db.transaction(async (tx) => {
        const aplicaciones = await proponerAplicacionFifo(tx, a.id, monto);
        await registrarPago(
          ctx,
          {
            datos: {
              fechaPago: sumarDias(periodos[Math.min(m, periodos.length - 1)], 2 + (i % 6)),
              monto,
              medio: i % 4 === 0 ? "efectivo" : "transferencia",
              nombreOrigen: a.apoderado,
              alumnoId: a.id,
              numeroOperacion: i % 4 === 0 ? null : String(900000 + n),
              verificado: !(i % 9 === 2 && m === mesesQuePaga - 1),
            },
            aplicaciones,
          },
          tx,
        );
      });
      n++;
    }
  }
  // Transferencias sin identificar (para probar la conciliación asistida)
  const tomas = creados[0];
  await registrarPago(ctx, {
    datos: { fechaPago: sumarDias(hoyStr, -1), monto: tomas.tarifa, nombreOrigen: "María José Fuentes Soto", banco: "BancoEstado", numeroOperacion: "777001", verificado: true },
  });
  await registrarPago(ctx, {
    datos: { fechaPago: sumarDias(hoyStr, -3), monto: 80000, nombreOrigen: "Transferencia de tercero", banco: "Banco de Chile", numeroOperacion: "777002", verificado: true },
  });
  console.log(`✓ ${n + 2} pagos (incluye 2 transferencias por conciliar)`);

  const r = await recalcularAlertas({ forzar: true });
  console.log(`✓ Alertas generadas: ${r.nuevas}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("✗ Error cargando datos de demostración:", e);
    process.exit(1);
  });
