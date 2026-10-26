-- Admin-to-user notifications and per-user read tracking.
-- Global announcements use user_id IS NULL; targeted notifications use a recipient UUID.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 1000),
  link text,
  kind text NOT NULL DEFAULT 'admin',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_at_idx
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx
  ON public.notifications (created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

DROP POLICY IF EXISTS "users read own and global notifications" ON public.notifications;
CREATE POLICY "users read own and global notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "admins create notifications" ON public.notifications;
CREATE POLICY "admins create notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND created_by = auth.uid()
  );

-- Admins need to see the delivery history in the admin panel.
DROP POLICY IF EXISTS "admins read all notifications" ON public.notifications;
CREATE POLICY "admins read all notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS notification_reads_user_id_idx
  ON public.notification_reads (user_id);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;

DROP POLICY IF EXISTS "users manage own notification reads" ON public.notification_reads;
CREATE POLICY "users manage own notification reads"
  ON public.notification_reads
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.id = notification_id
        AND (n.user_id IS NULL OR n.user_id = auth.uid())
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.id = notification_id
        AND (n.user_id IS NULL OR n.user_id = auth.uid())
    )
  );
