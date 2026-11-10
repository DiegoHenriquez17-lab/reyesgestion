import "server-only";
import { and, desc, eq, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db, type DbOTx } from "@/server/db";
import { alumnos, mensualidades, pagoAplicaciones, pagos, personas } from "@/server/db/schema";
import { auditar, exigirMotivoSiCerrado, type Contexto } from "@/server/auditoria";
import { ErrorNegocio } from "@/server/errores";
import { esquemaPago } from "@/lib/validaciones";
import { formatearPeriodo, formatearPesos, nombreCompleto } from "@/lib/formato";
import type { EstadoConciliacion, EstadoVerificacion, OrigenPago } from "@/lib/constantes";
import { recalcularMensualidad } from "./mensualidades";
import { agregarAlias, crearPersona } from "./personas";
import { mensualidadesConSaldo, vincularResponsable } from "./alumnos";

export type Aplicacion = { mensualidadId: number; monto: number };

export type EntradaPago = {
  datos: unknown;
  origen?: OrigenPago;
  documentoId?: number | null;
  importacionId?: number | null;
  /** Aplicaciones explícitas a mensualidades. */
  aplicaciones?: Aplicacion[];
  /** Si no hay aplicaciones explícitas: aplicar automáticamente a las deudas más antiguas del alumno. */
  aplicarAutomatico?: boolean;
  /** Permite registrar aunque exista otro pago con el mismo N° de operación. */
  permitirDuplicado?: boolean;
  motivo?: string | null;
};

/** Pagos que podrían ser el mismo (mismo N° de operación, o mismo monto+fecha+nombre). */
export async function pagosSimilares(
  d: { numeroOperacion?: string | null; monto: number; fechaPago: string; nombreOrigen?: string | null },
  excluirId?: number,
  tx: DbOTx = db,
) {
  const condiciones: SQL[] = [];
  if (d.numeroOperacion) condiciones.push(eq(pagos.numeroOperacion, d.numeroOperacion));
  condiciones.push(
    and(
      eq(pagos.monto, d.monto),
      eq(pagos.fechaPago, d.fechaPago),
      d.nombreOrigen ? sql`f_unaccent(lower(${pagos.nombreOrigen})) = f_unaccent(lower(${d.nombreOrigen}))` : sql`true`,
    )!,
  );
  return tx
    .select()
    .from(pagos)
    .where(and(isNull(pagos.anuladoEn), or(...condiciones), excluirId ? ne(pagos.id, excluirId) : undefined))
    .limit(5);
}

/** Registra un pago (dinero recibido o voucher por verificar) y opcionalmente lo concilia. */
export async function registrarPago(ctx: Contexto, entrada: EntradaPago, txExterna?: DbOTx) {
  const ejecutar = async (tx: DbOTx) => {
    const d = esquemaPago.parse(entrada.datos);
    if (!entrada.permitirDuplicado) {
      const similares = await pagosSimilares(d, undefined, tx);
      const mismoNumero = similares.find((s) => d.numeroOperacion && s.numeroOperacion === d.numeroOperacion);
      if (mismoNumero) {
        throw new ErrorNegocio(
          `Ya existe el pago #${mismoNumero.id} con el N° de operación ${d.numeroOperacion} (${formatearPesos(mismoNumero.monto)}). ` +
            "Si realmente es otro pago, marca «registrar de todas formas».",
        );
      }
    }
    const [pago] = await tx
      .insert(pagos)
      .values({
        fechaPago: d.fechaPago,
        monto: d.monto,
        medio: d.medio,
        banco: d.banco,
        numeroOperacion: d.numeroOperacion,
        nombreOrigen: d.nombreOrigen,
        rutOrigen: d.rutOrigen,
        pagadorId: d.pagadorId,
        alumnoId: d.alumnoId,
        estadoVerificacion: d.verificado ? "verificado" : "por_verificar",
        origen: entrada.origen ?? "manual",
        documentoId: entrada.documentoId ?? null,
        importacionId: entrada.importacionId ?? null,
        observaciones: d.observaciones,
        registradoPor: ctx.usuarioId,
      })
      .returning();
    await auditar(tx, ctx, {
      accion: "registrar_pago",
      entidad: "pago",
      entidadId: pago.id,
      resumen: `${formatearPesos(pago.monto)} — ${pago.nombreOrigen ?? "sin nombre"} (${pago.estadoVerificacion === "verificado" ? "dinero recibido" : "por verificar"})`,
      despues: pago,
    });

    let aplicaciones = entrada.aplicaciones ?? [];
    if (aplicaciones.length === 0 && entrada.aplicarAutomatico && d.alumnoId) {
      aplicaciones = await proponerAplicacionFifo(tx, d.alumnoId, d.monto);
    }
    if (aplicaciones.length) await aplicarPagoEnTx(tx, ctx, pago.id, aplicaciones, entrada.motivo);
    const [final] = await tx.select().from(pagos).where(eq(pagos.id, pago.id));
    return final;
  };
  return txExterna ? ejecutar(txExterna) : db.transaction(ejecutar);
}

/** Reparte un monto entre las mensualidades con saldo, de la más antigua a la más nueva. */
export async function proponerAplicacionFifo(tx: DbOTx, alumnoId: number, monto: number): Promise<Aplicacion[]> {
  const lista = await mensualidadesConSaldo(alumnoId, tx);
  const salida: Aplicacion[] = [];
  let restante = monto;
  for (const m of lista) {
    if (restante <= 0) break;
    const saldo = m.monto - m.montoPagado;
    if (saldo <= 0) continue;
    const aplicar = Math.min(saldo, restante);
    salida.push({ mensualidadId: m.id, monto: aplicar });
    restante -= aplicar;
  }
  return salida;
}

async function actualizarEstadoPago(tx: DbOTx, pagoId: number) {
  const [p] = await tx.select().from(pagos).where(eq(pagos.id, pagoId));
  const [{ suma }] = await tx
    .select({ suma: sql<number>`coalesce(sum(${pagoAplicaciones.monto}), 0)::int` })
    .from(pagoAplicaciones)
    .where(eq(pagoAplicaciones.pagoId, pagoId));
  const estado: EstadoConciliacion = suma >= p.monto ? "conciliado" : suma > 0 ? "parcial" : "por_conciliar";
  const [n] = await tx
    .update(pagos)
    .set({ montoAplicado: suma, estadoConciliacion: estado })
    .where(eq(pagos.id, pagoId))
    .returning();
  return n;
}

async function aplicarPagoEnTx(tx: DbOTx, ctx: Contexto, pagoId: number, aplicaciones: Aplicacion[], motivo?: string | null) {
  const [pago] = await tx.select().from(pagos).where(eq(pagos.id, pagoId));
  if (!pago) throw new ErrorNegocio("El pago no existe.");
  if (pago.anuladoEn) throw new ErrorNegocio("El pago está anulado.");
  if (pago.estadoVerificacion === "rechazado") throw new ErrorNegocio("El pago fue rechazado; no se puede conciliar.");
  const validas = aplicaciones.filter((a) => a.monto > 0);
  if (validas.length === 0) throw new ErrorNegocio("Indica al menos un mes y monto a aplicar.");
  const total = validas.reduce((s, a) => s + a.monto, 0);
  if (total > pago.monto - pago.montoAplicado) {
    throw new ErrorNegocio(
      `El total a aplicar (${formatearPesos(total)}) supera el saldo disponible del pago (${formatearPesos(pago.monto - pago.montoAplicado)}).`,
    );
  }
  const lista = await tx
    .select({ m: mensualidades, nombres: personas.nombres, apellidos: personas.apellidos })
    .from(mensualidades)
    .innerJoin(alumnos, eq(alumnos.id, mensualidades.alumnoId))
    .innerJoin(personas, eq(personas.id, alumnos.personaId))
    .where(inArray(mensualidades.id, validas.map((a) => a.mensualidadId)));
  const porId = new Map(lista.map((l) => [l.m.id, l]));
  const cerrado = await exigirMotivoSiCerrado(tx, lista.map((l) => l.m.periodo), motivo);

  const detalle: string[] = [];
  for (const a of validas) {
    const fila = porId.get(a.mensualidadId);
    if (!fila) throw new ErrorNegocio("Una de las mensualidades no existe.");
    if (["anulada", "condonada", "no_recuperable"].includes(fila.m.estado)) {
      throw new ErrorNegocio(`${formatearPeriodo(fila.m.periodo)} está ${fila.m.estado}; no admite pagos.`);
    }
    const saldo = fila.m.monto - fila.m.montoPagado;
    if (a.monto > saldo) {
      throw new ErrorNegocio(
        `${nombreCompleto(fila)} — ${formatearPeriodo(fila.m.periodo)}: el saldo es ${formatearPesos(saldo)} y se intenta aplicar ${formatearPesos(a.monto)}.`,
      );
    }
    await tx
      .insert(pagoAplicaciones)
      .values({ pagoId, mensualidadId: a.mensualidadId, monto: a.monto, creadoPor: ctx.usuarioId })
      .onConflictDoUpdate({
        target: [pagoAplicaciones.pagoId, pagoAplicaciones.mensualidadId],
        set: { monto: sql`${pagoAplicaciones.monto} + ${a.monto}` },
      });
    const nueva = await recalcularMensualidad(tx, a.mensualidadId);
    await auditar(tx, ctx, {
      accion: "aplicar_pago",
      entidad: "mensualidad",
      entidadId: a.mensualidadId,
      resumen: `${nombreCompleto(fila)} — ${formatearPeriodo(fila.m.periodo)}: +${formatearPesos(a.monto)} (pago #${pagoId})`,
      antes: { estado: fila.m.estado, montoPagado: fila.m.montoPagado },
      despues: { estado: nueva?.estado, montoPagado: nueva?.montoPagado },
      motivo: motivo ?? "Pago conciliado",
      periodoCerrado: cerrado,
    });
    detalle.push(`${formatearPeriodo(fila.m.periodo)} ${formatearPesos(a.monto)}`);
  }

  const alumnoPrincipal = lista[0]?.m.alumnoId;
  if (!pago.alumnoId && alumnoPrincipal) {
    await tx.update(pagos).set({ alumnoId: alumnoPrincipal }).where(eq(pagos.id, pagoId));
  }
  const actualizado = await actualizarEstadoPago(tx, pagoId);
  await auditar(tx, ctx, {
    accion: "conciliar",
    entidad: "pago",
    entidadId: pagoId,
    resumen: `Pago #${pagoId} ${formatearPesos(pago.monto)} → ${detalle.join(", ")}`,
    antes: { estadoConciliacion: pago.estadoConciliacion, montoAplicado: pago.montoAplicado },
    despues: { estadoConciliacion: actualizado.estadoConciliacion, montoAplicado: actualizado.montoAplicado },
    motivo,
    periodoCerrado: cerrado,
  });
  return actualizado;
}

/**
 * Conciliar un pago existente (lo confirma el usuario).
 * Opcionalmente "aprende" quién paga: registra el nombre de la transferencia como pagador del alumno.
 */
export async function conciliarPago(
  ctx: Contexto,
  pagoId: number,
  aplicaciones: Aplicacion[],
  opciones: { motivo?: string | null; registrarPagador?: { personaId?: number; nombre?: string } | null } = {},
) {
  return db.transaction(async (tx) => {
    const resultado = await aplicarPagoEnTx(tx, ctx, pagoId, aplicaciones, opciones.motivo);
    const rp = opciones.registrarPagador;
    if (rp && resultado.alumnoId) {
      let personaId = rp.personaId;
      if (!personaId && rp.nombre?.trim()) {
        const partes = rp.nombre.trim().split(/\s+/);
        const nombres = partes.length > 2 ? partes.slice(0, -2).join(" ") : partes[0];
        const apellidos = partes.length > 2 ? partes.slice(-2).join(" ") : partes.slice(1).join(" ");
        const p = await crearPersona(ctx, { nombres, apellidos, rut: resultado.rutOrigen ?? undefined }, tx);
        personaId = p.id;
      }
      if (personaId) {
        await vincularResponsable(ctx, resultado.alumnoId, personaId, { esApoderado: false, esPagador: true }, tx);
        if (resultado.nombreOrigen) await agregarAlias(tx, personaId, resultado.nombreOrigen, "banco");
        await tx.update(pagos).set({ pagadorId: personaId }).where(eq(pagos.id, pagoId));
      }
    } else if (resultado.pagadorId && resultado.nombreOrigen) {
      await agregarAlias(tx, resultado.pagadorId, resultado.nombreOrigen, "banco");
    }
    return resultado;
  });
}

/** Quita una aplicación (deshace la conciliación de un mes). */
export async function quitarAplicacion(ctx: Contexto, aplicacionId: number, motivo: string) {
  if (!motivo?.trim()) throw new ErrorNegocio("Indica el motivo.");
  return db.transaction(async (tx) => {
    const [ap] = await tx.select().from(pagoAplicaciones).where(eq(pagoAplicaciones.id, aplicacionId));
    if (!ap) throw new ErrorNegocio("La aplicación no existe.");
    const [m] = await tx.select().from(mensualidades).where(eq(mensualidades.id, ap.mensualidadId));
    const cerrado = await exigirMotivoSiCerrado(tx, [m.periodo], motivo);
    await tx.delete(pagoAplicaciones).where(eq(pagoAplicaciones.id, aplicacionId));
    const nueva = await recalcularMensualidad(tx, ap.mensualidadId);
    await actualizarEstadoPago(tx, ap.pagoId);
    await auditar(tx, ctx, {
      accion: "quitar_aplicacion",
      entidad: "mensualidad",
      entidadId: ap.mensualidadId,
      resumen: `${formatearPeriodo(m.periodo)}: −${formatearPesos(ap.monto)} (pago #${ap.pagoId})`,
      antes: { estado: m.estado, montoPagado: m.montoPagado },
      despues: { estado: nueva?.estado, montoPagado: nueva?.montoPagado },
      motivo,
      periodoCerrado: cerrado,
    });
  });
}

export async function cambiarVerificacion(ctx: Contexto, pagoId: number, estado: EstadoVerificacion, motivo?: string | null) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(pagos).where(eq(pagos.id, pagoId));
    if (!p) throw new ErrorNegocio("El pago no existe.");
    if (estado === "rechazado") {
      if (!motivo?.trim()) throw new ErrorNegocio("Indica por qué se rechaza el pago.");
      if (p.montoAplicado > 0) throw new ErrorNegocio("Primero quita las aplicaciones del pago antes de rechazarlo.");
    }
    const [n] = await tx.update(pagos).set({ estadoVerificacion: estado }).where(eq(pagos.id, pagoId)).returning();
    await auditar(tx, ctx, {
      accion: estado === "verificado" ? "verificar_pago" : "cambiar_verificacion",
      entidad: "pago",
      entidadId: pagoId,
      resumen: `Pago #${pagoId} ${formatearPesos(p.monto)}: ${p.estadoVerificacion} → ${estado}`,
      antes: p,
      despues: n,
      motivo,
    });
    return n;
  });
}

/** Anula un pago (no se borra): deshace sus aplicaciones. Solo administradores. */
export async function anularPago(ctx: Contexto, pagoId: number, motivo: string) {
  if (!motivo?.trim()) throw new ErrorNegocio("Indica el motivo de la anulación.");
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(pagos).where(eq(pagos.id, pagoId));
    if (!p) throw new ErrorNegocio("El pago no existe.");
    if (p.anuladoEn) throw new ErrorNegocio("El pago ya está anulado.");
    const aps = await tx.select().from(pagoAplicaciones).where(eq(pagoAplicaciones.pagoId, pagoId));
    const ms = aps.length
      ? await tx.select().from(mensualidades).where(inArray(mensualidades.id, aps.map((a) => a.mensualidadId)))
      : [];
    const cerrado = await exigirMotivoSiCerrado(tx, ms.map((m) => m.periodo), motivo);
    await tx.delete(pagoAplicaciones).where(eq(pagoAplicaciones.pagoId, pagoId));
    for (const a of aps) await recalcularMensualidad(tx, a.mensualidadId);
    const [n] = await tx
      .update(pagos)
      .set({ anuladoEn: new Date(), motivoAnulacion: motivo, montoAplicado: 0, estadoConciliacion: "por_conciliar" })
      .where(eq(pagos.id, pagoId))
      .returning();
    await auditar(tx, ctx, {
      accion: "anular_pago",
      entidad: "pago",
      entidadId: pagoId,
      resumen: `Pago #${pagoId} ${formatearPesos(p.monto)} anulado`,
      antes: p,
      despues: n,
      motivo,
      periodoCerrado: cerrado,
    });
  });
}

export type FiltrosPagos = {
  verificacion?: EstadoVerificacion;
  conciliacion?: EstadoConciliacion | "no_conciliado";
  desde?: string;
  hasta?: string;
  q?: string;
  incluirAnulados?: boolean;
};

export async function listarPagos(f: FiltrosPagos = {}, limite = 300) {
  const c: (SQL | undefined)[] = [];
  if (!f.incluirAnulados) c.push(isNull(pagos.anuladoEn));
  if (f.verificacion) c.push(eq(pagos.estadoVerificacion, f.verificacion));
  if (f.conciliacion === "no_conciliado") c.push(ne(pagos.estadoConciliacion, "conciliado"));
  else if (f.conciliacion) c.push(eq(pagos.estadoConciliacion, f.conciliacion));
  if (f.desde) c.push(sql`${pagos.fechaPago} >= ${f.desde}`);
  if (f.hasta) c.push(sql`${pagos.fechaPago} <= ${f.hasta}`);
  if (f.q) {
    const q = `%${f.q.trim()}%`;
    c.push(
      or(
        sql`f_unaccent(lower(coalesce(${pagos.nombreOrigen}, ''))) like f_unaccent(lower(${q}))`,
        sql`coalesce(${pagos.numeroOperacion}, '') ilike ${q}`,
        sql`${pagos.monto}::text = ${f.q.replace(/\D/g, "") || "-1"}`,
      ),
    );
  }
  return db.query.pagos.findMany({
    where: and(...c),
    with: { alumno: { with: { persona: true } }, pagador: true },
    orderBy: [desc(pagos.fechaPago), desc(pagos.id)],
    limit: limite,
  });
}

export async function obtenerPago(id: number) {
  const pago = await db.query.pagos.findFirst({
    where: (p, { eq }) => eq(p.id, id),
    with: {
      alumno: { with: { persona: true } },
      pagador: true,
      documento: true,
      aplicaciones: { with: { mensualidad: { with: { alumno: { with: { persona: true } } } } } },
    },
  });
  return pago ?? null;
}
