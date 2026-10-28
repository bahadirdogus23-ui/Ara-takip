-- F1-10: işlem geçmişi (H24). Araç, güzergâh, üyelik ve firma değişiklikleri de kayda geçer;
-- firma sahibi ve yönetici "kim neyi değiştirdi" ekranını audit_feed ile okur.
-- Yalnızca tetikleyici ve fonksiyon ekleme / güncelleme.

-- Firmanın kendi satırında tenant_id yok (id kullanılır); üyelikte kayıt kimliği user_id;
-- anahtarı metin olan davet kodunda kayıt kimliği yine firma kimliğidir
create or replace function public.write_audit_log()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log(tenant_id, table_name, record_id, action, old_data, new_data, changed_by)
  values (
    coalesce(v_row ->> 'tenant_id', case when tg_table_name = 'tenants' then v_row ->> 'id' end)::uuid,
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'work_item_id', v_row ->> 'route_id', v_row ->> 'vehicle_id',
             v_row ->> 'user_id', v_row ->> 'tenant_id')::uuid,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return null;
end;
$$;
revoke execute on function public.write_audit_log() from authenticated, anon, public;

create trigger audit_vehicles after insert or update or delete on public.vehicles
  for each row execute function public.write_audit_log();
create trigger audit_routes after insert or update or delete on public.routes
  for each row execute function public.write_audit_log();
create trigger audit_memberships after insert or update or delete on public.memberships
  for each row execute function public.write_audit_log();
-- Firma silinince geçmişi de silinir; yalnızca değişiklikler yazılır
create trigger audit_tenants after update on public.tenants
  for each row execute function public.write_audit_log();

create index audit_log_tenant_table_idx on public.audit_log(tenant_id, table_name, id desc);

-- İşlem geçmişi: değişikliği yapanın e-postasıyla (auth.users'a üyeler doğrudan erişemez).
-- p_tables boşsa tüm tablolar; p_before ile daha eski kayıtlar sayfa sayfa okunur.
create or replace function public.audit_feed(
  p_tenant uuid,
  p_tables text[] default null,
  p_before bigint default null,
  p_limit integer default 50
)
returns table (
  id               bigint,
  table_name       text,
  record_id        uuid,
  action           text,
  old_data         jsonb,
  new_data         jsonb,
  changed_at       timestamptz,
  changed_by_email text
)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.table_name, a.record_id, a.action, a.old_data, a.new_data, a.changed_at,
         u.email::text
  from public.audit_log a
  left join auth.users u on u.id = a.changed_by
  where a.tenant_id = p_tenant
    and private.has_role(p_tenant, '{owner,manager}')
    and (p_tables is null or a.table_name = any (p_tables))
    and (p_before is null or a.id < p_before)
  order by a.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke execute on function public.audit_feed(uuid, text[], bigint, integer) from public, anon;
grant execute on function public.audit_feed(uuid, text[], bigint, integer) to authenticated;
