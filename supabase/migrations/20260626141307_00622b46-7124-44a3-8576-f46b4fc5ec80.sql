
-- Storage policies for vip-rewards bucket (mirror mission-rewards)
CREATE POLICY "vip_rewards_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vip-rewards' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "vip_rewards_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'vip-rewards' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "vip_rewards_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'vip-rewards' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "vip_rewards_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'vip-rewards');

-- Backfill: when admin saves/activates a reward, create user_vip_rewards rows
-- for every user that already meets the level. Without this, only users that
-- earn XP AFTER the reward is configured would unlock it.
CREATE OR REPLACE FUNCTION public.admin_upsert_vip_reward(
  p_rank vip_rank,
  p_sub vip_sub,
  p_kind text,
  p_amount numeric,
  p_avatar_key text,
  p_label text,
  p_image_url text,
  p_is_active boolean
) RETURNS public.vip_rank_rewards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_row public.vip_rank_rewards;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  IF p_kind NOT IN ('none','bonus','avatar') THEN
    RAISE EXCEPTION 'invalid_kind' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.vip_rank_rewards
     SET reward_kind = p_kind,
         reward_amount = COALESCE(p_amount, 0),
         reward_avatar_key = NULLIF(p_avatar_key, ''),
         reward_label = NULLIF(p_label, ''),
         reward_image_url = NULLIF(p_image_url, ''),
         is_active = COALESCE(p_is_active, true),
         updated_at = now(),
         updated_by = v_admin
   WHERE rank = p_rank AND sub_division = p_sub
   RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reward_row_missing' USING ERRCODE = 'P0001';
  END IF;

  -- Backfill: insert unlocked rows for every user already at/above this level.
  -- Bronce V (min_level = 1) never grants a reward.
  IF v_row.is_active
     AND v_row.reward_kind <> 'none'
     AND v_row.min_level > 1 THEN
    INSERT INTO public.user_vip_rewards (
      user_id, rank, sub_division, reward_kind, reward_amount,
      reward_avatar_key, reward_label, reward_image_url
    )
    SELECT
      uv.user_id, v_row.rank, v_row.sub_division, v_row.reward_kind, v_row.reward_amount,
      v_row.reward_avatar_key, v_row.reward_label, v_row.reward_image_url
    FROM public.user_vip uv
    WHERE uv.current_level >= v_row.min_level
    ON CONFLICT (user_id, rank, sub_division) DO UPDATE
      SET reward_kind = EXCLUDED.reward_kind,
          reward_amount = EXCLUDED.reward_amount,
          reward_avatar_key = EXCLUDED.reward_avatar_key,
          reward_label = EXCLUDED.reward_label,
          reward_image_url = EXCLUDED.reward_image_url
      WHERE public.user_vip_rewards.claimed_at IS NULL;
  END IF;

  RETURN v_row;
END;
$$;
