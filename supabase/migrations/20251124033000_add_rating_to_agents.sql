-- Add a direct rating column to agents for initial seeding before aggregated stats.
alter table agents
add column if not exists rating numeric(3,2) check (rating is null or (rating >= 0 and rating <= 5));
