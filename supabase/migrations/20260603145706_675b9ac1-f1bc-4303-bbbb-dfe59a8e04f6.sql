-- Channel-level authorization for Supabase Realtime
-- Restrict who can subscribe to which Realtime topics.

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any prior versions so this migration is idempotent
DROP POLICY IF EXISTS "realtime_authenticated_read_public_topics" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_admin_read_admin_topics" ON realtime.messages;

-- Authenticated users may subscribe to the public game round topic
CREATE POLICY "realtime_authenticated_read_public_topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() IN ('spaceman-rounds')
);

-- Admins may subscribe to admin-only topics
CREATE POLICY "realtime_admin_read_admin_topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() IN ('admin-stats-tx', 'admin-deposits-rt')
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);