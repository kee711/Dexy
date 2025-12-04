-- PRD schema migration for agents, users, history, and review tables.

-- Enable UUID generation helpers.
create extension if not exists "pgcrypto";

-- Utility to keep updated_at in sync on updates.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Agents catalog
create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  category text not null check (length(trim(category)) > 0),
  address text,
  description text,
  url text,
  pricing_model text not null check (length(trim(pricing_model)) > 0),
  price numeric(12,2) check (price is null or price >= 0),
  test_result text,
  test_score numeric(5,2) check (test_score is null or (test_score >= 0 and test_score <= 100)),
  rating_avg numeric(3,2) check (rating_avg is null or (rating_avg >= 1 and rating_avg <= 5)),
  rating_count integer not null default 0 check (rating_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_agents_category on agents (category);
create index if not exists idx_agents_pricing_model on agents (pricing_model);
create trigger trg_agents_set_updated_at
before update on agents
for each row execute function set_updated_at();

-- Users
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_users_set_updated_at
before update on users
for each row execute function set_updated_at();

-- Task history between users and agents
create table if not exists history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  time timestamptz not null default now(),
  price numeric(12,2) check (price is null or price >= 0),
  task text,
  result text,
  created_at timestamptz not null default now()
);
create index if not exists idx_history_user_id on history (user_id);
create index if not exists idx_history_agent_id on history (agent_id);
create index if not exists idx_history_time on history (time desc);

-- Reviews with 1-5 rating scope
create table if not exists review (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_review_agent_id on review (agent_id);
create index if not exists idx_review_user_id on review (user_id);
create unique index if not exists idx_review_user_agent_unique on review (user_id, agent_id);
create trigger trg_review_set_updated_at
before update on review
for each row execute function set_updated_at();

-- Helpers to keep rating_count and rating_avg consistent with reviews
create or replace function refresh_agent_rating_stats(aid uuid)
returns void
language plpgsql
as $$
declare
  v_count integer;
  v_avg numeric(3,2);
begin
  select count(*)::int, avg(rating)::numeric(3,2)
  into v_count, v_avg
  from review
  where agent_id = aid;

  update agents
  set rating_count = coalesce(v_count, 0),
      rating_avg = case when coalesce(v_count, 0) > 0 then v_avg else null end,
      updated_at = now()
  where id = aid;
end;
$$;

create or replace function trigger_refresh_agent_rating()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform refresh_agent_rating_stats(old.agent_id);
  else
    perform refresh_agent_rating_stats(new.agent_id);
  end if;

  if tg_op = 'UPDATE' and new.agent_id is distinct from old.agent_id then
    perform refresh_agent_rating_stats(old.agent_id);
  end if;

  return null;
end;
$$;

create trigger trg_review_refresh_agent_rating
after insert or update or delete on review
for each row execute function trigger_refresh_agent_rating();
