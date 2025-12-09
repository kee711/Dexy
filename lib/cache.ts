import { createClient } from "@/lib/supabase/server";
import { createHash } from "crypto";
import { OpenAI } from "openai";

// types
export type CacheEntry = {
  output: any;
  created_at: string;
};

export type SemanticCacheEntry = CacheEntry & {
  similarity: number;
  prompt: string;
};

export class CacheService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // --- Utilities ---

  computeHash(data: any): string {
    const str = typeof data === "string" ? data : JSON.stringify(data);
    return createHash("sha256").update(str).digest("hex");
  }

  async computeEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small", // or text-embedding-ada-002, 1536 dims
      input: text,
      encoding_format: "float",
    });
    return response.data[0].embedding;
  }

  // --- Full Request Cache ---

  async getFullCache(key: string): Promise<CacheEntry | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("cache_full")
      .select("output, created_at")
      .eq("key", key)
      .single();

    if (error || !data) return null;
    return {
      output: data.output,
      created_at: data.created_at,
    };
  }

  async setFullCache(key: string, output: any, ttlSeconds: number = 24 * 60 * 60) {
    const supabase = await createClient();
    const ttl = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await supabase.from("cache_full").upsert(
      {
        key,
        output,
        ttl,
      },
      { onConflict: "key" }
    );
  }

  // --- Semantic Cache ---

  async getSemanticCache(
    prompt: string,
    threshold: number = 0.88
  ): Promise<SemanticCacheEntry | null> {
    const embedding = await this.computeEmbedding(prompt);
    const supabase = await createClient();

    // Call the RPC function we defined in migration
    const { data, error } = await supabase.rpc("match_semantic_cache", {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: 1,
    });

    if (error || !data || data.length === 0) return null;

    const hit = data[0];
    return {
      output: hit.output,
      created_at: new Date().toISOString(), // or fetch if RPC returns it
      similarity: hit.similarity,
      prompt: hit.prompt,
    };
  }

  async setSemanticCache(prompt: string, output: any, ttlSeconds: number = 7 * 24 * 60 * 60) {
    const embedding = await this.computeEmbedding(prompt);
    const supabase = await createClient();
    const ttl = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    await supabase.from("cache_semantic").insert({
      prompt,
      embedding,
      output,
      ttl,
    });
  }
}
