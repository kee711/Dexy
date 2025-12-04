import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const agentId = (body?.agentId ?? body?.id ?? "").toString().trim();
    const query = (body?.query ?? "").toString().trim();

    if (!agentId) {
      return NextResponse.json({ ok: false, error: "agentId is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: agent, error } = await supabase
      .from("agents")
      .select("id, name, author, description, url, category, pricing_model, price")
      .eq("id", agentId)
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: `agent lookup failed: ${error.message}` },
        { status: 400 },
      );
    }

    const dummyResult = {
      summary: `Executed '${agent?.name ?? "agent"}' for: ${query || "your request"}`,
      output: "This is a dummy execution result for testing. Replace with real agent output.",
      traceId: crypto.randomUUID().slice(0, 8),
      finishedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      ok: true,
      agent,
      message: `Execution triggered for ${agent?.name ?? agentId}`,
      query,
      result: dummyResult,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "execute failed" }, { status: 500 });
  }
}
