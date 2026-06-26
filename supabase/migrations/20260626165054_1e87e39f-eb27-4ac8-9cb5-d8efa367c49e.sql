DROP VIEW IF EXISTS public.admin_users_overview;
CREATE VIEW public.admin_users_overview AS
SELECT p.id, p.email, p.username, p.verification_status, p.is_blocked, p.created_at,
       COALESCE(b.balance, 0::numeric) AS balance,
       COALESCE(b.bonus_balance, 0::numeric) AS bonus_balance,
       p.avatar_key
  FROM public.profiles p
  LEFT JOIN public.user_balances b ON b.user_id = p.id;
GRANT SELECT ON public.admin_users_overview TO authenticated, service_role;