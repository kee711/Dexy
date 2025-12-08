import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type UsageRow = {
  created_at: string;
  amount: number | null;
  tokens: number | null;
  cost: number | null;
  latency_ms: number | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase
    .from("api_key_usage")
    .select("created_at, amount, tokens, cost, latency_ms")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true })
    .returns<UsageRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const buckets = new Map<
    string,
    {
      amount: number;
      tokens: number;
      cost: number;
      latencyMs: number;
      count: number;
    }
  >();

  for (const row of data ?? []) {
    const dateKey = row.created_at.slice(0, 10); // YYYY-MM-DD
    const bucket =
      buckets.get(dateKey) ??
      { amount: 0, tokens: 0, cost: 0, latencyMs: 0, count: 0 };

    const amount = Number(row.amount ?? 0);
    const tokens = Number(row.tokens ?? 0);
    const cost = Number(row.cost ?? amount);
    const latency = Number(row.latency_ms ?? 0);

    bucket.amount += Number.isFinite(amount) ? Number(amount.toFixed(3)) : 0;
    bucket.tokens += Number.isFinite(tokens) ? Math.round(tokens) : 0;
    bucket.cost += Number.isFinite(cost) ? Number(cost.toFixed(3)) : 0;
    bucket.latencyMs += Number.isFinite(latency) ? latency : 0;
    bucket.count += 1;
    buckets.set(dateKey, bucket);
  }

  const daily = Array.from(buckets.entries())
    .map(([date, value]) => ({ date, ...value }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const totals = daily.reduce(
    (acc, row) => {
      acc.amount += row.amount;
      acc.tokens += row.tokens;
      acc.cost += row.cost;
      acc.latencyMs += row.latencyMs;
      acc.count += row.count;
      return acc;
    },
    { amount: 0, tokens: 0, cost: 0, latencyMs: 0, count: 0 }
  );

  return NextResponse.json({ daily, totals });
}
