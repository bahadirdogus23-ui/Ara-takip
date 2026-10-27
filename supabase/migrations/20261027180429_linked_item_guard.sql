-- F1-9: elle imalat ile güzergâh seferlerinin çift sayılmasını engelle (H09).
-- Güzergâha bağlı "sefer"/"ton" birimli kalemin miktarı seferlerden hesaplanır
-- (production_summary). Aynı kaleme elle imalat da girilirse iki kez sayılırdı.
-- Yalnızca tetikleyici eklenir; mevcut veri değişmez.

create or replace function private.guard_linked_production()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.routes r
    join public.work_items wi on wi.id = r.work_item_id
    where r.work_item_id = new.work_item_id
      and wi.unit::text in ('sefer', 'ton')
  ) then
    raise exception 'Bu iş kalemi bir güzergâha bağlı; miktarı seferlerden otomatik hesaplanır. Seferleri Sefer sayacından girin.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger production_entries_guard_linked
  before insert or update of work_item_id on public.production_entries
  for each row execute function private.guard_linked_production();

-- Ters yön: elle imalatı olan kalem güzergâha bağlanamaz (geçmiş kayıtlar iki kez sayılırdı)
create or replace function private.guard_route_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.work_item_id is not null
     and (tg_op = 'INSERT' or new.work_item_id is distinct from old.work_item_id)
     and exists (
       select 1
       from public.production_entries pe
       join public.work_items wi on wi.id = pe.work_item_id
       where pe.work_item_id = new.work_item_id
         and wi.unit::text in ('sefer', 'ton')
     ) then
    raise exception 'Bu iş kalemine elle girilmiş imalat var; güzergâha bağlanırsa iki kez sayılır. Sayaç için ayrı bir iş kalemi açın (ör. "Nakliye – sayaç").'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger routes_guard_link
  before insert or update of work_item_id on public.routes
  for each row execute function private.guard_route_link();

revoke all on function private.guard_linked_production() from public;
revoke all on function private.guard_route_link() from public;
