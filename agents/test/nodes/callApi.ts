import type { AgentTestGraphStateType, RawResponse } from "../types.ts";

export async function callApiNode(
  state: AgentTestGraphStateType
): Promise<Partial<AgentTestGraphStateType>> {
  const { url } = state.agent;
  const rawResponses: RawResponse[] = [];

  const queries = state.queries ?? [];

  for (const q of queries) {
    const start = Date.now();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    });
    const latencyMs = Date.now() - start;
    const contentType = res.headers.get("content-type") || "";

    let data: any = null;
    try {
      data = await res.json();
    } catch (e) {
      data = { error: "JSON_PARSE_FAILED", raw: await res.text() };
    }

    rawResponses.push({
      query: q,
      status: res.status,
      latencyMs,
      contentType,
      data,
    });
  }

  return { rawResponses };
}
