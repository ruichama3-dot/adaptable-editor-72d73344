create or replace function private.notify_work_updated()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.title is not distinct from old.title and new.content is not distinct from old.content then
    return new;
  end if;
  perform private.create_user_notification(
    new.user_id,
    'O teu trabalho foi actualizado',
    'Foram guardadas alterações no trabalho "' || left(new.title, 180) || '". Abre o teu histórico para rever a versão mais recente.',
    '/historico',
    'work_updated'
  );
  return new;
end;
$$;
revoke all on function private.notify_work_updated() from public, anon, authenticated;
drop trigger if exists notify_work_updated on public.works;
create trigger notify_work_updated
after update of title, content on public.works
for each row execute function private.notify_work_updated();