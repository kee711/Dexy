import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AgentRecord = {
  id: string;
  name: string | null;
  author: string | null;
  description: string | null;
  url: string | null;
  category: string | null;
  pricing_model: string | null;
  price: number | null;
};

const encoder = new TextEncoder();

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status },
  );
}

function buildUsage(startedAt: number) {
  return {
    tokens: 0,
    cost: 0,
    latencyMs: Date.now() - startedAt,
  };
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = await request.json();
    const agentId = (body?.agentId ?? body?.id ?? "").toString().trim();
    const query = (body?.query ?? body?.input ?? "").toString().trim();
    const stream = Boolean(body?.stream);

    if (!agentId) {
      return errorResponse(400, "AGENT_ID_REQUIRED", "agentId is required");
    }

    const supabase = await createClient();
    const { data: agent, error } = await supabase
      .from("agents")
      .select<AgentRecord>(
        "id, name, author, description, url, category, pricing_model, price",
      )
      .eq("id", agentId)
      .single();

    if (error) {
      return errorResponse(400, "AGENT_LOOKUP_FAILED", error.message);
    }

    const dummyResult = {
      summary: `Executed '${agent?.name ?? "agent"}' for: ${query || "your request"}`,
      output: "This is a dummy execution result for testing. Replace with real agent output.",
      traceId: crypto.randomUUID().slice(0, 8),
      finishedAt: new Date().toISOString(),
    };

    if (stream) {
      const tokens = dummyResult.output.split(/\s+/).filter(Boolean);

      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(
            encoder.encode(
              `event: agent\ndata: ${JSON.stringify({ id: agent.id, name: agent.name })}\n\n`,
            ),
          );

          for (const token of tokens) {
            controller.enqueue(encoder.encode(`data: ${token}\n\n`));
            await new Promise((resolve) => setTimeout(resolve, 8));
          }

          controller.enqueue(
            encoder.encode(
              `event: done\ndata: ${JSON.stringify({ usage: buildUsage(startedAt) })}\n\n`,
            ),
          );
          controller.close();
        },
        cancel() {},
      });

      return new Response(readable, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const usage = buildUsage(startedAt);

    return NextResponse.json({
      ok: true,
      agent,
      message: `Execution triggered for ${agent?.name ?? agentId}`,
      query,
      result: dummyResult,
      usage,
      normalized: {
        output: dummyResult.output,
        agent: { id: agent.id, name: agent.name },
        usage,
        cached: false,
      },
    });
  } catch (error) {
    console.error(error);
    return errorResponse(500, "EXECUTE_FAILED", "execute failed");
  }
}
