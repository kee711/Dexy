-- API keys and usage logging
create extension if not exists "pgcrypto";

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  key_hash text not null unique,
  prefix text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists idx_api_keys_user_id on api_keys(user_id);
create index if not exists idx_api_keys_prefix on api_keys(prefix);

alter table api_keys enable row level security;

create policy api_keys_select_own on api_keys
for select using (auth.uid() = user_id);

create policy api_keys_insert_own on api_keys
for insert with check (auth.uid() = user_id);

create policy api_keys_update_own on api_keys
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Usage ledger for API key executions
create table if not exists api_key_usage (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references api_keys(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  amount numeric(18,6) not null default 0,
  currency text not null default 'USD',
  status text not null default 'captured',
  request_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_key_usage_key on api_key_usage(api_key_id);
create index if not exists idx_api_key_usage_user on api_key_usage(user_id);
create index if not exists idx_api_key_usage_agent on api_key_usage(agent_id);
create index if not exists idx_api_key_usage_created on api_key_usage(created_at desc);

alter table api_key_usage enable row level security;

create policy api_key_usage_select_own on api_key_usage
for select using (auth.uid() = user_id);

create policy api_key_usage_insert_own on api_key_usage
for insert with check (auth.uid() = user_id);
