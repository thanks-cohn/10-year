create or replace function public.normalized_tag_array(value text[]) returns text[]
language sql immutable set search_path=pg_catalog as $$
  select coalesce(array_agg(tag order by tag), '{}')
  from (
    select distinct lower(btrim(item)) as tag
    from unnest(coalesce(value, '{}')) item
    where btrim(item) <> '' and char_length(btrim(item)) <= 80
  ) normalized;
$$;

create table if not exists public.user_tag_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  excluded_tags text[] not null default '{}',
  allowed_default_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint excluded_tags_normalized check (excluded_tags = public.normalized_tag_array(excluded_tags)),
  constraint allowed_default_tags_normalized check (allowed_default_tags = public.normalized_tag_array(allowed_default_tags))
);

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

create index if not exists user_tag_preferences_excluded_tags_gin on public.user_tag_preferences using gin (excluded_tags);
create index if not exists user_tag_preferences_allowed_default_tags_gin on public.user_tag_preferences using gin (allowed_default_tags);

grant execute on function public.normalized_tag_array(text[]) to authenticated;
grant select, insert, update, delete on public.user_tag_preferences to authenticated;
