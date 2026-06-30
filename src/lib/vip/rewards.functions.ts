import { safeRpcError } from "@/lib/server-safe-error";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VipRewardKind = "none" | "bonus" | "avatar";

export type VipRankRewardRow = {
  rank: string;
  sub_division: string;
  min_level: number;
  reward_kind: VipRewardKind;
  reward_amount: number;
  reward_avatar_key: string | null;
  reward_label: string | null;
  reward_image_url: string | null;
  is_active: boolean;
};

export type UserVipRewardRow = {
  id: string;
  rank: string;
  sub_division: string;
  reward_kind: VipRewardKind;
  reward_amount: number;
  reward_avatar_key: string | null;
  reward_label: string | null;
  reward_image_url: string | null;
  unlocked_at: string;
  claimed_at: string | null;
};

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw safeRpcError(error);
  if (!data) throw new Error("not_admin");
}

/* ---- Admin: list catalog ---- */
export const adminListVipRewards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("vip_rank_rewards")
      .select("*")
      .order("min_level", { ascending: true });
    if (error) throw safeRpcError(error);
    return (data ?? []) as VipRankRewardRow[];
  });

/* ---- Admin: upsert ---- */
const upsertInput = z.object({
  rank: z.string(),
  sub_division: z.string(),
  reward_kind: z.enum(["none", "bonus", "avatar"]),
  reward_amount: z.number().nonnegative().default(0),
  reward_avatar_key: z.string().nullable().optional(),
  reward_label: z.string().nullable().optional(),
  reward_image_url: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
});

export const adminUpsertVipReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase.rpc("admin_upsert_vip_reward", {
      p_rank: data.rank as never,
      p_sub: data.sub_division as never,
      p_kind: data.reward_kind,
      p_amount: data.reward_amount,
      p_avatar_key: (data.reward_avatar_key ?? "") as string,
      p_label: (data.reward_label ?? "") as string,
      p_image_url: (data.reward_image_url ?? "") as string,
      p_is_active: data.is_active,
    } as never);
    if (error) throw safeRpcError(error);
    return Array.isArray(row) ? row[0] : row;
  });

/* ---- User: list their unlocked rewards ---- */
export const listMyVipRewards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_vip_rewards")
      .select("*")
      .eq("user_id", context.userId)
      .order("unlocked_at", { ascending: false });
    if (error) throw safeRpcError(error);
    return (data ?? []) as UserVipRewardRow[];
  });

/* ---- User: claim ---- */
export const claimVipReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rewardId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc("claim_vip_reward", {
      p_reward_id: data.rewardId,
    });
    if (error) throw safeRpcError(error);
    return res as {
      ok: boolean;
      kind?: VipRewardKind;
      amount?: number;
      avatar_key?: string | null;
      new_bonus_balance?: number;
      already_claimed?: boolean;
    };
  });

/* ---- Admin: read a specific user's VIP snapshot ---- */
export const adminGetUserVipSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const supabaseAdmin = (await import("@/integrations/supabase/client.server"))
      .supabaseAdmin;
    const [{ data: vip }, { data: rewards }] = await Promise.all([
      supabaseAdmin
        .from("user_vip")
        .select("total_xp, current_level")
        .eq("user_id", data.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("user_vip_rewards")
        .select(
          "id, rank, sub_division, reward_kind, reward_amount, reward_avatar_key, reward_label, unlocked_at, claimed_at",
        )
        .eq("user_id", data.userId)
        .order("unlocked_at", { ascending: false })
        .limit(10),
    ]);
    return {
      total_xp: Number(vip?.total_xp ?? 0),
      current_level: Number(vip?.current_level ?? 0),
      rewards: (rewards ?? []) as UserVipRewardRow[],
    };
  });

/* ---- Admin: full VIP reset for a user ---- */
export const adminResetUserVip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: res, error } = await context.supabase.rpc(
      "admin_reset_vip_progress",
      { p_target_user_id: data.userId } as never,
    );
    if (error) throw safeRpcError(error);
    return res as { ok: boolean; deleted_rewards: number };
  });