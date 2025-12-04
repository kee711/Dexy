-- Enable pgvector and add embedding/search helpers for agents.search
create extension if not exists vector;

alter table agents add column if not exists test_result_embedding vector(1536);

create or replace function match_agents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  agent_id uuid,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    id as agent_id,
    1 - (test_result_embedding <=> query_embedding) as similarity
  from agents
  where test_result_embedding is not null
    and 1 - (test_result_embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;
