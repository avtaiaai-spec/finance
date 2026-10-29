-- Profile photos only. Run in Supabase SQL Editor after setup.sql.
-- No existing financial records or photos are deleted.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('finance-avatars', 'finance-avatars', false, 1048576, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];

-- Storage already has RLS enabled in Supabase. Do not change its global grants.
drop policy if exists finance_avatar_read on storage.objects;
create policy finance_avatar_read on storage.objects for select to authenticated
using (bucket_id = 'finance-avatars' and split_part(name, '/', 1) = (select auth.uid())::text);
drop policy if exists finance_avatar_create on storage.objects;
create policy finance_avatar_create on storage.objects for insert to authenticated
with check (bucket_id = 'finance-avatars' and split_part(name, '/', 1) = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$');
drop policy if exists finance_avatar_delete on storage.objects;
create policy finance_avatar_delete on storage.objects for delete to authenticated
using (bucket_id = 'finance-avatars' and split_part(name, '/', 1) = (select auth.uid())::text);
commit;
