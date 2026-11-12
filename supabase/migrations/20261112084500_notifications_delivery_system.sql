create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete cascade,
  title varchar(120) not null,
  body varchar(1000) not null default '',
  link text null,
  kind varchar(40) not null default 'system',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_created_idx on public.notifications (created_at desc);
create index if not exists notifications_created_by_idx on public.notifications (created_by) where created_by is not null;

create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);
create index if not exists notification_reads_user_idx on public.notification_reads (user_id, read_at desc);

alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;

drop policy if exists "Users can read relevant notifications" on public.notifications;
create policy "Users can read relevant notifications" on public.notifications for select to authenticated
using (
  user_id = (select auth.uid()) or user_id is null
  or exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = 'admin')
);

drop policy if exists "Admins can create notifications" on public.notifications;
create policy "Admins can create notifications" on public.notifications for insert to authenticated
with check (
  exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = 'admin')
  and (user_id is null or user_id in (select p.id from public.profiles p))
  and (created_by is null or created_by = (select auth.uid()))
);

drop policy if exists "Users can read their notification receipts" on public.notification_reads;
create policy "Users can read their notification receipts" on public.notification_reads for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can mark their notifications as read" on public.notification_reads;
create policy "Users can mark their notifications as read" on public.notification_reads for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.notifications n where n.id = notification_id and (n.user_id = (select auth.uid()) or n.user_id is null))
);

create schema if not exists private;

create or replace function private.create_user_notification(p_user_id uuid, p_title text, p_body text, p_link text default null, p_kind text default 'system')
returns void language plpgsql security definer set search_path = pg_catalog, public, private
as $$
begin
  if p_user_id is null or nullif(trim(p_title), '') is null then return; end if;
  insert into public.notifications (user_id, title, body, link, kind)
  values (p_user_id, left(trim(p_title), 120), left(coalesce(p_body, ''), 1000), p_link, coalesce(p_kind, 'system'));
end;
$$;
revoke all on function private.create_user_notification(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function private.notify_profile_created()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, private
as $$
begin
  perform private.create_user_notification(new.id, 'Bem-vindo à RuJe IA!',
    'A tua conta foi criada. A partir de agora vais receber avisos importantes sobre pagamentos, trabalhos, exames, currículo e novidades da plataforma.',
    '/painel', 'welcome');
  return new;
end;
$$;
revoke all on function private.notify_profile_created() from public, anon, authenticated;
drop trigger if exists notify_profile_created on public.profiles;
create trigger notify_profile_created after insert on public.profiles for each row execute function private.notify_profile_created();

create or replace function private.notify_payment_status_changed()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, private
as $$
declare
  v_status text := lower(coalesce(new.status, ''));
  v_plan text := coalesce(new.plan, 'serviço');
  v_link text := '/planos';
begin
  if old.status is not distinct from new.status then return new; end if;
  if lower(v_plan) like '%exame%' then v_link := '/exames';
  elsif lower(v_plan) like '%currículo%' or lower(v_plan) like '%curriculo%' then v_link := '/curriculo';
  end if;

  if v_status in ('aprovado', 'aprovada', 'approved', 'pago', 'paid', 'completed', 'success') then
    perform private.create_user_notification(new.user_id, 'Pagamento confirmado com sucesso',
      'O teu pagamento de ' || coalesce(new.amount, 0)::text || ' MT para ' || v_plan || ' foi confirmado. O acesso correspondente já pode ser utilizado.',
      v_link, 'payment_success');
  elsif v_status in ('falhou', 'failed', 'rejeitado', 'rejected', 'declined', 'cancelled', 'canceled', 'expired', 'expirado') then
    perform private.create_user_notification(new.user_id, 'Não foi possível concluir o pagamento',
      'O pedido de pagamento de ' || coalesce(new.amount, 0)::text || ' MT para ' || v_plan || ' terminou com o estado "' || new.status || '". Verifica o pedido e tenta novamente se necessário.',
      v_link, 'payment_failed');
  end if;
  return new;
end;
$$;
revoke all on function private.notify_payment_status_changed() from public, anon, authenticated;
drop trigger if exists notify_payment_status_changed on public.payment_requests;
create trigger notify_payment_status_changed after update of status on public.payment_requests for each row execute function private.notify_payment_status_changed();

create or replace function private.notify_work_created()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, private
as $$
begin
  perform private.create_user_notification(new.user_id, 'O teu trabalho foi criado',
    'O trabalho "' || left(new.title, 180) || '" foi guardado na tua conta. Podes consultá-lo e continuar a editar quando quiseres.',
    '/historico', 'work_created');
  return new;
end;
$$;
revoke all on function private.notify_work_created() from public, anon, authenticated;
drop trigger if exists notify_work_created on public.works;
create trigger notify_work_created after insert on public.works for each row execute function private.notify_work_created();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;