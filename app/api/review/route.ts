import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const agentId = (body?.agentId ?? "").toString().trim();
    const rating = Number(body?.rating ?? 0);
    const review = body?.review?.toString().slice(0, 500) ?? null;
    const userName = body?.userName?.toString().trim() || "Guest";
    const userId = body?.userId?.toString().trim() || crypto.randomUUID();

    if (!agentId) {
      return NextResponse.json({ ok: false, error: "agentId is required" }, { status: 400 });
    }
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { ok: false, error: "rating must be an integer between 1 and 5" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Ensure user exists
    const { error: userError } = await supabase
      .from("users")
      .upsert({ id: userId, name: userName }, { onConflict: "id" });

    if (userError) {
      return NextResponse.json({ ok: false, error: userError.message }, { status: 400 });
    }

    // Insert or update review for this user-agent pair
    const { data, error: reviewError } = await supabase
      .from("review")
      .upsert(
        {
          user_id: userId,
          agent_id: agentId,
          rating: Math.round(rating),
          review,
        },
        { onConflict: "user_id,agent_id" },
      )
      .select()
      .single();

    if (reviewError) {
      return NextResponse.json({ ok: false, error: reviewError.message }, { status: 400 });
    }

    // Trigger refresh of agent rating stats via DB function if needed (optional safety)
    await supabase.rpc("refresh_agent_rating_stats", { aid: agentId });

    return NextResponse.json({ ok: true, review: data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "review submit failed" }, { status: 500 });
  }
}
