import { NextResponse } from "next/server";

type SearchResponse = {
  ok?: boolean;
  mode?: string;
  message?: string;
  results?: Array<Record<string, any>>;
  error?: string | { message?: string };
};

type ExecuteResponse = {
  ok?: boolean;
  result?: { output?: string; summary?: string; formatted?: string };
  usage?: { tokens?: number; cost?: number; latencyMs?: number };
  normalized?: {
    output?: string;
    usage?: { tokens?: number; cost?: number; latencyMs?: number };
  };
  error?: string | { message?: string };
};

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function pickAgentId(agent: Record<string, any> | undefined) {
  if (!agent) return "";
  return (
    agent.id ?? agent.agentId ?? agent.agent_id ?? agent.agentID ?? ""
  ).toString();
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = await request.json();
    const prompt = (body?.prompt ?? "").toString().trim();
    const meta = body?.meta ?? {};
    const stream = Boolean(body?.stream);
    const authHeader = request.headers.get("authorization") ?? undefined;

    if (!prompt) {
      return errorResponse(400, "PROMPT_REQUIRED", "prompt is required");
    }

    const baseUrl = new URL(request.url).origin;
    const baseHeaders = {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    } as Record<string, string>;

    const searchRes = await fetch(`${baseUrl}/api/search`, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({ query: prompt, meta }),
      cache: "no-store",
    });

    const searchJson = (await searchRes.json()) as SearchResponse;

    if (searchJson?.mode === "chat" && searchJson?.message) {
      return NextResponse.json({
        output: searchJson.message,
        agent: null,
        usage: { tokens: 0, cost: 0, latencyMs: Date.now() - startedAt },
        cached: false,
      });
    }

    const agentResult =
      Array.isArray(searchJson?.results) && searchJson.results.length
        ? searchJson.results[0]
        : undefined;
    const agentId = pickAgentId(agentResult);

    if (!agentId) {
      const errorMessage =
        searchJson?.message ||
        (typeof searchJson?.error === "string"
          ? searchJson.error
          : searchJson?.error?.message) ||
        "No suitable agent found for the prompt.";
      return errorResponse(404, "AGENT_NOT_FOUND", errorMessage);
    }

    if (stream) {
      const execStream = await fetch(`${baseUrl}/api/execute/${encodeURIComponent(agentId)}`, {
        method: "POST",
        headers: {
          ...baseHeaders,
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ query: prompt, meta, stream: true }),
        cache: "no-store",
      });

      if (!execStream.ok || !execStream.body) {
        const errorPayload = (await execStream
          .clone()
          .json()
          .catch(() => null)) as ExecuteResponse | null;
        const message =
          (typeof errorPayload?.error === "string"
            ? errorPayload.error
            : errorPayload?.error?.message) || "execute failed";
        return errorResponse(execStream.status || 500, "EXECUTE_FAILED", message);
      }

      return new Response(execStream.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const execRes = await fetch(`${baseUrl}/api/execute/${encodeURIComponent(agentId)}`, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({ query: prompt, meta, stream: false }),
      cache: "no-store",
    });

    const rawExecText = await execRes.text();
    let execJson: ExecuteResponse | null = null;
    try {
      execJson = JSON.parse(rawExecText) as ExecuteResponse;
    } catch {
      execJson = null;
    }

    if (!execRes.ok || execJson?.ok === false) {
      const message =
        (typeof execJson?.error === "string"
          ? execJson.error
          : execJson?.error?.message) || rawExecText || "execute failed";
      return errorResponse(execRes.status || 500, "EXECUTE_FAILED", message);
    }

    const usage =
      execJson?.normalized?.usage ?? execJson?.usage ?? {
        tokens: 0,
        cost: 0,
        latencyMs: Date.now() - startedAt,
      };

    return NextResponse.json({
      output:
        execJson?.normalized?.output ??
        execJson?.result?.output ??
        execJson?.result?.summary ??
        (execJson ? JSON.stringify(execJson) : rawExecText) ??
        "",
      agent: {
        id: agentId,
        score: agentResult?.fitness_score ?? agentResult?.similarity ?? 0,
      },
      usage: {
        tokens: usage.tokens ?? 0,
        cost: usage.cost ?? 0,
        latencyMs: usage.latencyMs ?? Date.now() - startedAt,
      },
      cached: false,
    });
  } catch (error) {
    console.error(error);
    return errorResponse(500, "RUN_FAILED", "run failed");
  }
}
