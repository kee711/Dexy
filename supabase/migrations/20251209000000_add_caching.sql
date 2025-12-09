-- Create Full Cache Table
create table if not exists cache_full (
  key text primary key,
  output jsonb not null,
  created_at timestamp with time zone default now(),
  ttl timestamp with time zone
);

-- Create Semantic Cache Table
create table if not exists cache_semantic (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  embedding vector(1536),
  output jsonb not null,
  created_at timestamp with time zone default now(),
  ttl timestamp with time zone
);

-- Create index for vector search
-- Note: ivfflat or hnsw can be used. using ivfflat for simplicity with standard pgvector
create index if not exists cache_semantic_embedding_idx 
on cache_semantic 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Create Partial Cache Table
create table if not exists cache_partial (
  input_hash text primary key,
  tool_name text not null,
  output jsonb not null,
  created_at timestamp with time zone default now(),
  ttl timestamp with time zone
);

-- Function to match semantic cache
create or replace function match_semantic_cache (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  similarity float,
  output jsonb,
  prompt text
)
language plpgsql
as $$
begin
  return query
  select
    cs.id,
    1 - (cs.embedding <=> query_embedding) as similarity,
    cs.output,
    cs.prompt
  from cache_semantic cs
  where 1 - (cs.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;
