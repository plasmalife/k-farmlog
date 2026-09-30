-- K영농일지 beta. Run once in the target project's SQL editor.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 phone text not null check(phone ~ '^01[016789][0-9]{7,8}$),
 nickname text not null default '농부' check(char_length(nickname) between 1 and 30),
 created_at timestamptz not null default now()
);
create table public.cultivation_sites (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 50),
 region text not null check(char_length(region) between 1 and 80), crop text not null check(char_length(crop) between 1 and 50),
 created_at timestamptz not null default now(), unique(id,user_id)
);
create table public.notes (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 site_id uuid not null, note_date date not null, region text not null, crop text not null,
 created_at timestamptz not null default now(), unique(user_id,site_id,note_date), unique(id,user_id),
 foreign key(site_id,user_id) references public.cultivation_sites(id,user_id) on delete cascade
);
create table public.entries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 note_id uuid not null, kind text not null check(kind in ('text','voice','photo')),
 content text not null check(char_length(content) between 1 and 12000), keywords text[] not null default '{}',
 created_at timestamptz not null default now(),
 foreign key(note_id,user_id) references public.notes(id,user_id) on delete cascade
);
create table public.note_photos (
 note_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
 slot integer not null check(slot between 1 and 3), path text not null,
 score integer not null check(score between 0 and 100), description text not null default '', pinned boolean not null default false,
 created_at timestamptz not null default now(), primary key(note_id,slot),
 foreign key(note_id,user_id) references public.notes(id,user_id) on delete cascade,
 check(path = user_id::text || '/' || note_id::text || '/' || slot::text || '.jpg')
);
create table public.community_posts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 nickname text not null check(char_length(nickname) between 1 and 30), region text not null, crop text not null,
 content text not null check(char_length(content) between 1 and 2000), created_at timestamptz not null default now()
);
create table public.ai_usage (
 id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.cultivation_sites enable row level security;
alter table public.notes enable row level security;
alter table public.entries enable row level security;
alter table public.note_photos enable row level security;
alter table public.community_posts enable row level security;
alter table public.ai_usage enable row level security;
create policy profiles_owner on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy sites_owner on public.cultivation_sites for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy notes_owner on public.notes for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy entries_owner on public.entries for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy photos_owner on public.note_photos for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy posts_read on public.community_posts for select to authenticated using(true);
create policy posts_create on public.community_posts for insert to authenticated with check(user_id=auth.uid());
create policy posts_delete on public.community_posts for delete to authenticated using(user_id=auth.uid());
-- Private bucket: exactly three fixed slots per user/day/site note. No voice files.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('farm-photos','farm-photos',false,4194304,array['image/jpeg']) on conflict(id) do nothing;
create policy farm_photo_access on storage.objects for all to authenticated
 using(bucket_id='farm-photos' and (storage.foldername(name))[1]=auth.uid()::text)
 with check(bucket_id='farm-photos' and (storage.foldername(name))[1]=auth.uid()::text
 and name ~ '^[0-9a-f-]+/[0-9a-f-]+/[123]\.jpg$'
 and exists(select 1 from public.notes n where n.id::text=(storage.foldername(name))[2] and n.user_id=auth.uid()));
-- Hard daily beta caps, serialized to prevent concurrent quota bypass.
create or replace function public.reserve_ai_call() returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not exists(select 1 from profiles where id=auth.uid()) then return false; end if;
 perform pg_advisory_xact_lock(724192);
 if (select count(*) from ai_usage where created_at>now()-interval '24 hours') >= 300
 or (select count(*) from ai_usage where user_id=auth.uid() and created_at>now()-interval '24 hours') >= 40 then return false; end if;
 insert into ai_usage(user_id) values(auth.uid()); return true;
end; $$;
revoke all on function public.reserve_ai_call() from public, anon;
grant execute on function public.reserve_ai_call() to authenticated;
create index entries_note_idx on public.entries(note_id,created_at);
create index notes_user_date_idx on public.notes(user_id,note_date desc);
create index usage_date_idx on public.ai_usage(created_at);
create index photos_expiry_idx on public.note_photos(created_at);
