-- Run once in the Supabase SQL Editor for the MetroCarDeals project.
-- All writes are made through the Vercel API after verifying the owner's Supabase session.
create table if not exists public.vehicles (
 id text primary key check(id ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$'),
 make text not null, model text not null,
 year int check(year between 1900 and 2100),
 price bigint not null check(price>0),
 type text not null default 'SUV',
 condition text not null default 'Confirm condition',
 color text not null default 'Confirm colour',
 paint text not null default '#6d727b',
 tag text not null default '',
 note text not null default '',
 instagram_source text,
 status text not null default 'available' check(status in ('available','reserved','sold')),
 photos jsonb not null default '[]'::jsonb check(jsonb_typeof(photos)='array'),
 updated_at timestamptz not null default now()
);
alter table public.vehicles enable row level security;
revoke all on public.vehicles from anon, authenticated;
-- No client write policy: only service-role API accesses vehicles.
-- Supabase Storage's public bucket permits image reads only.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('car-images','car-images',true,2600000,ARRAY['image/jpeg'])
on conflict (id) do update set public=true, file_size_limit=2600000,allowed_mime_types=ARRAY['image/jpeg'];
-- No client write policies are created for the image bucket.
