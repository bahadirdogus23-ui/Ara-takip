-- 3. aşama: fotoğraflar (kantar fişi, saha, hasar). Dosyalar Supabase Storage'da özel
-- (herkese kapalı) "photos" kovasında; yol: <firma>/<şantiye>/<gün>/<uuid>.jpg
-- Kayıt tablosu public.photos; erişim kuralları hem tabloda hem dosyalarda aynı.

-- Klasör adı uuid değilse politika hata vermesin, erişim reddedilsin
create function private.try_uuid(t text)
returns uuid
language plpgsql immutable
set search_path = ''
as $$
begin
  return t::uuid;
exception when others then
  return null;
end;
$$;
revoke all on function private.try_uuid(text) from public;
grant execute on function private.try_uuid(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Dosyalar: yalnızca o firmanın üyeleri görür ve yükler; silme yükleyen kişi veya sahip/yönetici
create policy photos_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and private.is_member(private.try_uuid((storage.foldername(name))[1])));
create policy photos_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and private.is_member(private.try_uuid((storage.foldername(name))[1])));
create policy photos_objects_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and (
      owner_id = (select auth.uid())::text
      or private.has_role(private.try_uuid((storage.foldername(name))[1]), '{owner,manager}')
    )
  );

create table public.photos (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  site_id       uuid not null,
  taken_on      date not null,
  kind          text not null check (kind in ('kantar', 'saha', 'hasar', 'diger')),
  storage_path  text not null unique,
  caption       text check (length(caption) <= 300),
  created_by    uuid not null default auth.uid() references auth.users(id),
  created_at    timestamptz not null default now(),
  foreign key (site_id, tenant_id) references public.sites(id, tenant_id) on delete cascade,
  -- Dosya yolu kaydın firmasına ve şantiyesine ait olmalı
  check (storage_path like tenant_id::text || '/' || site_id::text || '/%')
);

create index photos_site_date_idx   on public.photos(site_id, taken_on);
create index photos_site_tenant_idx on public.photos(site_id, tenant_id);
create index photos_created_by_idx  on public.photos(created_by);

create trigger photos_created_by before insert on public.photos
  for each row execute function public.force_created_by();
create trigger audit_photos after insert or update or delete on public.photos
  for each row execute function public.write_audit_log();

alter table public.photos enable row level security;

create policy photos_select on public.photos for select to authenticated
  using (private.is_member(tenant_id));
create policy photos_insert on public.photos for insert to authenticated
  with check (private.is_member(tenant_id));
create policy photos_delete on public.photos for delete to authenticated
  using (private.has_role(tenant_id, '{owner,manager}')
         or (created_by = (select auth.uid()) and private.is_member(tenant_id)));

revoke all on public.photos from anon;
grant select, insert, delete on public.photos to authenticated;
