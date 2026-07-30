import { z } from "zod";

export const desktopGateSchema = z.object({
  enabled: z.boolean().default(false),
  min_width: z.number().int().min(700).max(2200).default(1024),
  title: z.string().trim().min(2).max(60).default("Versión de escritorio en construcción"),
  message: z
    .string()
    .trim()
    .min(2)
    .max(240)
    .default(
      "Estamos puliendo la experiencia BETSPACE para pantallas grandes. Por ahora, ingresa desde tu móvil para disfrutar de todos los juegos.",
    ),
});

export type DesktopGate = z.infer<typeof desktopGateSchema>;

export const DESKTOP_GATE_DEFAULTS: DesktopGate = desktopGateSchema.parse({});
