alter table public.journals
  add column if not exists lock_hash text;

create index if not exists journals_user_locked_idx
  on public.journals (user_id, lock_hash, created_at desc)
  where deleted_at is null;

create table if not exists public.journal_view_locks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  lock_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scope),
  constraint journal_view_locks_scope_check check (scope in ('favorites', 'hidden'))
);

create index if not exists journal_view_locks_user_scope_idx
  on public.journal_view_locks (user_id, scope);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists journal_view_locks_set_updated_at on public.journal_view_locks;

create trigger journal_view_locks_set_updated_at
before update on public.journal_view_locks
for each row
execute function public.set_updated_at();

alter table public.journal_view_locks enable row level security;

drop policy if exists "Users can read their journal view locks" on public.journal_view_locks;
create policy "Users can read their journal view locks"
  on public.journal_view_locks
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their journal view locks" on public.journal_view_locks;
create policy "Users can create their journal view locks"
  on public.journal_view_locks
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their journal view locks" on public.journal_view_locks;
create policy "Users can update their journal view locks"
  on public.journal_view_locks
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their journal view locks" on public.journal_view_locks;
create policy "Users can delete their journal view locks"
  on public.journal_view_locks
  for delete
  using (auth.uid() = user_id);
