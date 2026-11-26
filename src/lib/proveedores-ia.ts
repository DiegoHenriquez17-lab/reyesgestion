export const PROVEEDORES_IA = ["anthropic", "openai", "gemini", "groq"] as const;
export type ProveedorIa = (typeof PROVEEDORES_IA)[number];

export const PROVEEDOR_IA_ETIQUETA: Record<ProveedorIa, string> = {
  anthropic: "Anthropic", openai: "OpenAI", gemini: "Gemini", groq: "Qwen (Groq)",
};

export const RESPALDO_IA: Record<ProveedorIa, ProveedorIa> = {
  anthropic: "openai", openai: "anthropic", gemini: "groq", groq: "gemini",
};
