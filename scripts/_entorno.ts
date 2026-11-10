// Carga .env y .env.local igual que Next.js. Debe ser el PRIMER import de cada script.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
