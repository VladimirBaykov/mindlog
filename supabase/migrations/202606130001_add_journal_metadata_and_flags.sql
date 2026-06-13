alter table public.journals
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists is_favorite boolean not null default false,
  add column if not exists hidden_at timestamptz;

create index if not exists journals_user_favorite_idx
  on public.journals (user_id, is_favorite, created_at desc)
  where deleted_at is null;

create index if not exists journals_user_hidden_idx
  on public.journals (user_id, hidden_at, created_at desc)
  where deleted_at is null;
