DROP INDEX IF EXISTS public.idx_transactions_user_created;
CREATE INDEX IF NOT EXISTS transactions_created_idx ON public.transactions USING btree (created_at DESC);