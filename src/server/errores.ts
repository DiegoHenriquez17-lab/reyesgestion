/** Error de negocio: su mensaje se muestra tal cual al usuario. */
export class ErrorNegocio extends Error {
  constructor(
    mensaje: string,
    public readonly campos?: Record<string, string[]>,
  ) {
    super(mensaje);
    this.name = "ErrorNegocio";
  }
}

/** Convierte cualquier error en un mensaje apto para mostrar (sin filtrar detalles internos). */
export function mensajeDeError(e: unknown): string {
  if (e instanceof ErrorNegocio) return e.message;
  console.error(e);
  return "Ocurrió un error inesperado. El detalle quedó registrado en el servidor.";
}
