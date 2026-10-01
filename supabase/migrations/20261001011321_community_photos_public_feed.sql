alter table public.community_posts add column photo_paths text[] not null default '{}';
alter table public.community_posts add constraint post_photo_count check(cardinality(photo_paths) <= 3);
alter table public.community_posts add constraint post_photo_owner check(
 photo_paths <@ array[user_id::text||'/'||id::text||'/1.jpg',user_id::text||'/'||id::text||'/2.jpg',user_id::text||'/'||id::text||'/3.jpg']);
drop policy posts_read on public.community_posts;
create policy posts_read on public.community_posts for select to anon, authenticated using(true);
grant usage on schema public to anon;
grant select on public.community_posts to anon;
grant update on public.community_posts to authenticated;
create policy posts_update on public.community_posts for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index posts_created_id_idx on public.community_posts(created_at desc,id desc);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('community-photos','community-photos',false,4194304,array['image/jpeg']);
create policy community_photo_read on storage.objects for select to anon, authenticated using(
 bucket_id='community-photos' and ( (storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.community_posts p where storage.objects.name=any(p.photo_paths))));
create policy community_photo_insert on storage.objects for insert to authenticated with check(
 bucket_id='community-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and name ~ '^[0-9a-f-]+/[0-9a-f-]+/[123]\.jpg$');
create policy community_photo_update on storage.objects for update to authenticated using(
 bucket_id='community-photos' and (storage.foldername(name))[1]=(select auth.uid())::text)
 with check(bucket_id='community-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and name ~ '^[0-9a-f-]+/[0-9a-f-]+/[123]\.jpg$');
create policy community_photo_delete on storage.objects for delete to authenticated using(bucket_id='community-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
