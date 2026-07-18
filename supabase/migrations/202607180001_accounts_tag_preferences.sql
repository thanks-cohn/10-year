-- Additive v6 account preferences. Apply manually in Supabase SQL editor.
create table if not exists public.user_tag_preferences (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tag_key text not null check (tag_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(tag_key) between 1 and 96),
  preference text not null check (preference in ('exclude','allow_default')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, tag_key)
);
create index if not exists user_tag_preferences_user_idx on public.user_tag_preferences(user_id, updated_at desc);
alter table public.user_tag_preferences enable row level security;
do $$ begin
  create policy user_tag_preferences_own_select on public.user_tag_preferences for select to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy user_tag_preferences_own_insert on public.user_tag_preferences for insert to authenticated with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy user_tag_preferences_own_update on public.user_tag_preferences for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy user_tag_preferences_own_delete on public.user_tag_preferences for delete to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Profiles already exist for comments; keep public display_name behavior for comments
-- and add no public account URL or private metadata fields.
grant select, insert, update, delete on public.user_tag_preferences to authenticated;
