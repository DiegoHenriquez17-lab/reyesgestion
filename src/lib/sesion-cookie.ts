/**
 * Nombre de la cookie de sesión. Es distinto en la base oficial y en la de desarrollo,
 * para que ambas puedan estar abiertas en el mismo computador sin cerrarse la sesión una a otra.
 * (Sin "server-only": lo usa también proxy.ts)
 */
export const COOKIE_SESION = process.env.APP_ENTORNO === "oficial" ? "rg_sesion_oficial" : "rg_sesion";
