-- Yerel test için Supabase ortamının en küçük taklidi.
-- Gerçek Supabase'te bu nesneler zaten vardır; bu dosya oraya UYGULANMAZ.

create role anon nologin;
create role authenticated nologin;

create schema auth;
grant usage on schema auth to anon, authenticated;

create table auth.users (
  id                 uuid primary key,
  email              text,
  created_at         timestamptz not null default now(),
  last_sign_in_at    timestamptz,
  email_confirmed_at timestamptz
);

-- Supabase'teki gibi: oturumdaki kullanıcının kimliği JWT'den okunur.
create function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema public to anon, authenticated;

-- Supabase Storage'ın test için en küçük taklidi (gerçek Supabase'te storage servisi kurar)
create schema storage;
create table storage.buckets (
  id text primary key, name text not null unique, owner uuid, owner_id text,
  public boolean default false, file_size_limit bigint, allowed_mime_types text[],
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, owner_id text, metadata jsonb, created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language plpgsql as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end $$;
grant usage on schema storage to anon, authenticated;
grant all on storage.objects, storage.buckets to authenticated;
