import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type UsageRow = {
  created_at: string;
  amount: number;
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
    .select("created_at, amount")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true })
    .returns<UsageRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const buckets = new Map<string, { total: number; count: number }>();

  for (const row of data ?? []) {
    const dateKey = row.created_at.slice(0, 10); // YYYY-MM-DD
    const bucket = buckets.get(dateKey) ?? { total: 0, count: 0 };
    bucket.total += Number(row.amount ?? 0);
    bucket.count += 1;
    buckets.set(dateKey, bucket);
  }

  const daily = Array.from(buckets.entries())
    .map(([date, value]) => ({ date, ...value }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return NextResponse.json({ daily });
}
