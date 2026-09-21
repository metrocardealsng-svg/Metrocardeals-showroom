-- MetroCarDeals inventory schema
-- Run this once in your Supabase project's SQL Editor (Dashboard -> SQL Editor -> New query).
-- Safe to re-run: uses "if not exists" / "or replace" throughout.

create table if not exists public.vehicles (
  id text primary key,
  make text not null,
  model text not null,
  year integer,
  price bigint not null,
  type text not null default 'Sedan',
  condition text not null default 'Confirm condition',
  color text default 'Colour to confirm',
  paint text default '#83938c',
  tag text default 'NEW LISTING',
  note text default '',
  instagram_source text,
  photos jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active','sold')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pending_vehicles (
  id text primary key,
  make text,
  model text,
  year integer,
  price bigint,
  type text,
  condition text,
  color text,
  paint text default '#83938c',
  tag text default 'NEW LISTING',
  note text,
  instagram_source text,
  instagram_post_id text,
  raw_caption text,
  photos jsonb not null default '[]'::jsonb,
  added_at timestamptz not null default now()
);

create table if not exists public.synced_instagram_posts (
  post_id text primary key,
  synced_at timestamptz not null default now()
);

-- allowlist of admin users (their Supabase Auth user id). Insert your own after
-- creating your login in Authentication -> Users -- see README for the exact step.
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from public.app_admins where user_id = auth.uid());
$$;

alter table public.vehicles enable row level security;
alter table public.pending_vehicles enable row level security;
alter table public.synced_instagram_posts enable row level security;
alter table public.app_admins enable row level security;

drop policy if exists "Public read active vehicles" on public.vehicles;
create policy "Public read active vehicles" on public.vehicles
  for select using (status = 'active');

drop policy if exists "Admin full access to vehicles" on public.vehicles;
create policy "Admin full access to vehicles" on public.vehicles
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin full access to pending" on public.pending_vehicles;
create policy "Admin full access to pending" on public.pending_vehicles
  for all using (public.is_admin()) with check (public.is_admin());

-- synced_instagram_posts: no client access at all; only the server (using
-- the service_role key, which bypasses RLS) touches it.

drop policy if exists "Users can check their own admin row" on public.app_admins;
create policy "Users can check their own admin row" on public.app_admins
  for select using (user_id = auth.uid());

-- Storage bucket for uploaded car photos.
insert into storage.buckets (id, name, public)
values ('vehicle-photos', 'vehicle-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public read vehicle photos" on storage.objects;
create policy "Public read vehicle photos" on storage.objects
  for select using (bucket_id = 'vehicle-photos');

drop policy if exists "Admin write vehicle photos" on storage.objects;
create policy "Admin write vehicle photos" on storage.objects
  for insert with check (bucket_id = 'vehicle-photos' and public.is_admin());

drop policy if exists "Admin update vehicle photos" on storage.objects;
create policy "Admin update vehicle photos" on storage.objects
  for update using (bucket_id = 'vehicle-photos' and public.is_admin());

drop policy if exists "Admin delete vehicle photos" on storage.objects;
create policy "Admin delete vehicle photos" on storage.objects
  for delete using (bucket_id = 'vehicle-photos' and public.is_admin());

-- Seed the 6 existing listings (images stay on the existing static site for
-- these — only new admin uploads go to Supabase Storage).
insert into public.vehicles (id, make, model, year, price, type, condition, color, paint, tag, note, instagram_source, photos, sort_order)
values
  ('infiniti-qx56','Infiniti','QX56',2011,10500000,'SUV','Nigerian used','Colour to confirm','#53585f','DISTRESS SALE','Described as super clean in the listing. Ask Metro for current photos, inspection details and availability.','https://www.instagram.com/p/DdE4IEpAKDJ/',
   '[{"src":"assets/cars/infiniti-qx56-1.jpg","label":"Front view"},{"src":"assets/cars/infiniti-qx56-2.jpg","label":"Rear view"}]'::jsonb, 1),
  ('hyundai-sonata','Hyundai','Sonata Sport',2016,12850000,'Sedan','Confirm condition','Red','#923d43','SPORT SEDAN','Red Sonata Sport. Confirm current condition, price and availability with Metro.','https://www.instagram.com/p/Dc89JjHgM_C/',
   '[{"src":"assets/cars/hyundai-sonata-1.jpg","label":"Front view"},{"src":"assets/cars/hyundai-sonata-2.jpg","label":"Rear view"}]'::jsonb, 2),
  ('toyota-rav4','Toyota','RAV4',2017,23800000,'SUV','Confirm condition','White','#e3e3df','FAMILY SUV','White Toyota RAV4. Ask Metro for current vehicle photos, condition and inspection arrangements.','https://www.instagram.com/p/DdE4OoqgD_v/',
   '[{"src":"assets/cars/toyota-rav4-1.jpg","label":"Front view"},{"src":"assets/cars/toyota-rav4-2.jpg","label":"Rear view"}]'::jsonb, 3),
  ('toyota-corolla','Toyota','Corolla',2012,6850000,'Sedan','Confirm condition','Colour to confirm','#a0a3aa','EVERYDAY DRIVE','Listed as South Africa spec. Confirm current condition, specification, price and availability.','https://www.instagram.com/p/Dbn3epsAPS9/',
   '[{"src":"assets/cars/toyota-corolla-1.jpg","label":"Front view"},{"src":"assets/cars/toyota-corolla-2.jpg","label":"Rear view"}]'::jsonb, 4),
  ('hyundai-santa-fe','Hyundai','Santa Fe Sport',2013,15650000,'SUV','Foreign used','Colour to confirm','#5c6565','FOREIGN USED','Listed as direct Belgium. Ask Metro to confirm the current vehicle details and inspection availability.','https://www.instagram.com/p/DblJeE4ALOq/',
   '[{"src":"assets/cars/hyundai-santa-fe-1.jpg","label":"Front three-quarter view"},{"src":"assets/cars/hyundai-santa-fe-2.jpg","label":"Rear three-quarter view"},{"src":"assets/cars/hyundai-santa-fe-3.jpg","label":"Dashboard and front seats"},{"src":"assets/cars/hyundai-santa-fe-4.jpg","label":"Rear seats and panoramic roof"}]'::jsonb, 5),
  ('xiaomi-su7','Xiaomi','SU7',null,78000000,'Sedan','Brand new','Colour to confirm','#83938c','BRAND NEW','Xiaomi SU7, listed as brand new. Confirm the model year, colour, specification and current availability.','https://www.instagram.com/p/Da0N-9MgMgq/',
   '[{"src":"assets/cars/xiaomi-su7-1.jpg","label":"Front three-quarter view"},{"src":"assets/cars/xiaomi-su7-2.jpg","label":"Front view"},{"src":"assets/cars/xiaomi-su7-3.jpg","label":"Rear three-quarter view"},{"src":"assets/cars/xiaomi-su7-4.jpg","label":"Rear view"},{"src":"assets/cars/xiaomi-su7-5.jpg","label":"Dashboard and front seats"},{"src":"assets/cars/xiaomi-su7-6.jpg","label":"Rear cabin and glass roof"}]'::jsonb, 6)
on conflict (id) do nothing;
