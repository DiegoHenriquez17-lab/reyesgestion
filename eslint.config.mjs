import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Parámetros que empiezan con "_" son intencionalmente no usados (firmas de Server Actions)
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  globalIgnores([".next/**", ".next-oficial/**", "out/**", "build/**", "next-env.d.ts", "storage/**", "drizzle/**"]),
]);

export default eslintConfig;
