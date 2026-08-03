import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RouletteTableConfig = {
  green_weight: number;
  /** Pago del pleno al 0, ajustado al peso del verde. */
  zero_multiplier: number;
};

export const getRouletteTableConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<RouletteTableConfig> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("roulette_config")
      .select("green_weight")
      .limit(1)
      .maybeSingle();

    const weight = Math.max(Number(data?.green_weight ?? 1) || 1, 1);
    return {
      green_weight: weight,
      zero_multiplier: Math.round((36 / weight) * 100) / 100,
    };
  });
