import path from "node:path";
import type { NextConfig } from "next";

const uploadMaxMb = Number(process.env.UPLOAD_MAX_MB ?? 20);

const nextConfig: NextConfig = {
  // La base oficial compila en su propia carpeta, para poder tener abiertos
  // a la vez el sistema de pruebas (puerto 3000) y el oficial (puerto 3001).
  distDir: process.env.APP_ENTORNO === "oficial" ? ".next-oficial" : ".next",
  // App interna 100% dinámica (todo depende de la sesión del usuario):
  // usamos el modelo clásico de renderizado por solicitud, sin Cache Components.
  cacheComponents: false,
  turbopack: {
    // Raíz del proyecto (evita que Next tome un package-lock.json de carpetas superiores)
    root: path.resolve("."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Paquetes de servidor que no deben empaquetarse (binarios nativos / archivos propios).
  serverExternalPackages: ["@node-rs/argon2", "sharp", "exceljs", "mammoth", "jspdf", "jspdf-autotable"],
  experimental: {
    serverActions: {
      // Permite subir fotos, PDF y Excel mediante Server Actions.
      bodySizeLimit: `${uploadMaxMb + 1}mb`,
    },
  },
  poweredByHeader: false,
};

export default nextConfig;
