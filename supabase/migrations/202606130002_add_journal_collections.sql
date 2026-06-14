create table if not exists public.journal_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default 'blue',
  pin_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint journal_collections_name_length check (char_length(trim(name)) between 1 and 60),
  constraint journal_collections_color_check check (
    color in ('slate', 'blue', 'purple', 'rose', 'amber', 'emerald', 'cyan', 'pink')
  )
);

create table if not exists public.journal_collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid not null references public.journal_collections(id) on delete cascade,
  journal_id uuid not null references public.journals(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (collection_id, journal_id)
);

create index if not exists journal_collections_user_idx
  on public.journal_collections (user_id, created_at desc)
  where deleted_at is null;

create index if not exists journal_collection_items_collection_idx
  on public.journal_collection_items (collection_id, created_at desc);

create index if not exists journal_collection_items_user_journal_idx
  on public.journal_collection_items (user_id, journal_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists journal_collections_set_updated_at on public.journal_collections;

create trigger journal_collections_set_updated_at
before update on public.journal_collections
for each row
execute function public.set_updated_at();

alter table public.journal_collections enable row level security;
alter table public.journal_collection_items enable row level security;

drop policy if exists "Users can read their journal collections" on public.journal_collections;
create policy "Users can read their journal collections"
  on public.journal_collections
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their journal collections" on public.journal_collections;
create policy "Users can create their journal collections"
  on public.journal_collections
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their journal collections" on public.journal_collections;
create policy "Users can update their journal collections"
  on public.journal_collections
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their journal collections" on public.journal_collections;
create policy "Users can delete their journal collections"
  on public.journal_collections
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read their journal collection items" on public.journal_collection_items;
create policy "Users can read their journal collection items"
  on public.journal_collection_items
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their journal collection items" on public.journal_collection_items;
create policy "Users can create their journal collection items"
  on public.journal_collection_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their journal collection items" on public.journal_collection_items;
create policy "Users can delete their journal collection items"
  on public.journal_collection_items
  for delete
  using (auth.uid() = user_id);
