begin;

create index if not exists journals_user_created_at_idx
  on public.journals (user_id, created_at desc);

create index if not exists journals_user_deleted_created_at_idx
  on public.journals (user_id, deleted_at, created_at desc);

create index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id);

create index if not exists subscriptions_customer_id_idx
  on public.subscriptions (stripe_customer_id);

create index if not exists subscriptions_subscription_id_idx
  on public.subscriptions (stripe_subscription_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'subscriptions_user_id_key'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_user_id_key unique (user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'subscriptions_stripe_customer_id_key'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_stripe_customer_id_key
      unique (stripe_customer_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'subscriptions_stripe_subscription_id_key'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_stripe_subscription_id_key
      unique (stripe_subscription_id);
  end if;
end $$;

alter table public.journals enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "journals_select_own" on public.journals;
create policy "journals_select_own"
  on public.journals
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "journals_insert_own" on public.journals;
create policy "journals_insert_own"
  on public.journals
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "journals_update_own" on public.journals;
create policy "journals_update_own"
  on public.journals
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "journals_delete_own" on public.journals;
create policy "journals_delete_own"
  on public.journals
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "subscriptions_insert_seed_row" on public.subscriptions;
create policy "subscriptions_insert_seed_row"
  on public.subscriptions
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and plan = 'free'
    and status = 'inactive'
    and stripe_customer_id is null
    and stripe_subscription_id is null
    and current_period_end is null
  );

commit;