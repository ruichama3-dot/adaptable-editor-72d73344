-- Executar uma vez no editor SQL da base de dados
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text,
  kind text NOT NULL DEFAULT 'info',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS notifications_recipient_created_at_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications (created_at DESC);
DROP POLICY IF EXISTS "read own or broadcast notifications" ON public.notifications;
CREATE POLICY "read own or broadcast notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);
DROP POLICY IF EXISTS "admins manage notifications" ON public.notifications;
DROP POLICY IF EXISTS "admins create notifications" ON public.notifications;
CREATE POLICY "admins create notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) AND created_by = auth.uid());
DROP POLICY IF EXISTS "admins read all notifications" ON public.notifications;
CREATE POLICY "admins read all notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
GRANT UPDATE ON public.notification_reads TO authenticated;
DROP POLICY IF EXISTS "own reads" ON public.notification_reads;
DROP POLICY IF EXISTS "users manage own notification reads" ON public.notification_reads;
CREATE POLICY "own reads" ON public.notification_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_admins_new_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, link, kind)
  SELECT r.user_id, 'Novo pagamento pendente',
         NEW.full_name || ' enviou um comprovativo do plano ' || NEW.plan || ' (' || NEW.amount || ' MT).',
         '/admin', 'pagamento'
  FROM public.user_roles r WHERE r.role = 'admin';
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS payment_requests_notify_admins ON public.payment_requests;
CREATE TRIGGER payment_requests_notify_admins AFTER INSERT ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_payment();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
