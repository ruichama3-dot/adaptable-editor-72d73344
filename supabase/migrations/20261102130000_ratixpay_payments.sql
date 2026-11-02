alter table public.payment_requests
  add column if not exists ratixpay_payment_id text,
  add column if not exists ratixpay_product_id text;

create unique index if not exists payment_requests_ratixpay_payment_id_uidx
  on public.payment_requests(ratixpay_payment_id)
  where ratixpay_payment_id is not null;

create table if not exists public.ratixpay_products (
  plan_id text primary key,
  product_id text not null unique,
  amount integer not null,
  created_at timestamptz not null default now()
);
alter table public.ratixpay_products enable row level security;

create or replace function public.confirm_ratixpay_payment(
  p_payment_request_id uuid, p_payment_id text, p_plan text, p_daily_limit integer, p_days integer
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_request public.payment_requests%rowtype;
  v_expected_amount integer;
begin
  select * into v_request from public.payment_requests where id = p_payment_request_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'order_not_found'); end if;
  if v_request.ratixpay_payment_id is distinct from p_payment_id then
    return jsonb_build_object('ok', false, 'reason', 'payment_id_mismatch');
  end if;
  v_expected_amount := case p_plan
    when 'Plano 1 dia' then 30 when 'Plano Semanal' then 150
    when 'Plano 14 dias' then 250 when 'Plano 30 dias' then 400 else -1 end;
  if v_request.amount <> v_expected_amount then
    return jsonb_build_object('ok', false, 'reason', 'amount_plan_mismatch');
  end if;
  if v_request.status in ('aprovado', 'approved', 'pago') then
    return jsonb_build_object('ok', true, 'already_processed', true);
  end if;
  if v_request.status <> 'pendente' then
    return jsonb_build_object('ok', false, 'reason', 'order_not_pending');
  end if;
  update public.payment_requests set status = 'aprovado', updated_at = now()
    where id = p_payment_request_id;
  insert into public.subscriptions(user_id, plan, daily_limit, starts_at, expires_at)
    values (v_request.user_id, p_plan, p_daily_limit, now(), now() + make_interval(days => p_days));
  return jsonb_build_object('ok', true, 'already_processed', false);
end;
$$;
revoke all on function public.confirm_ratixpay_payment(uuid,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.confirm_ratixpay_payment(uuid,text,text,integer,integer) to service_role;
