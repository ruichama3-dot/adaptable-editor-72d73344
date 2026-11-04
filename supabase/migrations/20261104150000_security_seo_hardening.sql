-- RuJe IA security hardening (no user data is modified).
-- Keep admin roles explicit; never grant admin based only on a sign-up email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone',
    new.email
  )
  on conflict (id) do update set email = excluded.email;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user'::public.app_role)
  on conflict do nothing;

  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
comment on schema private is 'Internal security helpers. Do not expose this schema through PostgREST.';

create or replace function private.has_role(_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = _role
  );
$$;

revoke all on function private.has_role(public.app_role) from public, anon;
grant execute on function private.has_role(public.app_role) to authenticated, service_role;

drop policy if exists "Admins manage payment requests" on public.payment_requests;
create policy "Admins manage payment requests"
  on public.payment_requests for all to authenticated
  using ((select private.has_role('admin'::public.app_role)))
  with check ((select private.has_role('admin'::public.app_role)));

drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles"
  on public.profiles for select to authenticated
  using ((select private.has_role('admin'::public.app_role)));

drop policy if exists "Admins manage samples" on public.samples;
create policy "Admins manage samples"
  on public.samples for all to authenticated
  using ((select private.has_role('admin'::public.app_role)))
  with check ((select private.has_role('admin'::public.app_role)));

drop policy if exists "Admins manage subscriptions" on public.subscriptions;
create policy "Admins manage subscriptions"
  on public.subscriptions for all to authenticated
  using ((select private.has_role('admin'::public.app_role)))
  with check ((select private.has_role('admin'::public.app_role)));

drop policy if exists "Admins manage user roles" on public.user_roles;
create policy "Admins manage user roles"
  on public.user_roles for all to authenticated
  using ((select private.has_role('admin'::public.app_role)))
  with check ((select private.has_role('admin'::public.app_role)));

drop policy if exists "Admins read all user roles" on public.user_roles;
create policy "Admins read all user roles"
  on public.user_roles for select to authenticated
  using ((select private.has_role('admin'::public.app_role)));

drop policy if exists "Admins read all works" on public.works;
create policy "Admins read all works"
  on public.works for select to authenticated
  using ((select private.has_role('admin'::public.app_role)));

drop policy if exists "Users create own payment requests" on public.payment_requests;
drop policy if exists "create own payment request" on public.payment_requests;
revoke insert on table public.payment_requests from public, anon, authenticated;

revoke all on table public.ratixpay_products from public, anon, authenticated;
grant all on table public.ratixpay_products to service_role;

revoke all on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
drop function if exists public.has_role(uuid, public.app_role);
