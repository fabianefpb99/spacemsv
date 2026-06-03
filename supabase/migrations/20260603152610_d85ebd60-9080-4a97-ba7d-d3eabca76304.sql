GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_deposit(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_block(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_rtp(text, numeric, boolean) TO authenticated;