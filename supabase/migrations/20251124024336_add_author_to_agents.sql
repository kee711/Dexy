-- Add author column to agents table for tracking the creator/owner of an agent.
alter table agents
add column if not exists author text not null default 'Unknown' check (length(trim(author)) > 0);

-- Optional: remove default to enforce explicit values on future inserts.
alter table agents alter column author drop default;
