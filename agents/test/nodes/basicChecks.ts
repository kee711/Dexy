import type { AgentTestGraphStateType, Check } from "../types.ts";

export async function basicChecksNode(
  state: AgentTestGraphStateType
): Promise<Partial<AgentTestGraphStateType>> {
  const rawResponses = state.rawResponses ?? [];

  const basicChecks = rawResponses.map((r) => {
    const checks: Check[] = [];

    // 1) HTTP 상태
    checks.push({
      name: "httpStatus",
      pass: r.status >= 200 && r.status < 300,
      detail: `status=${r.status}`,
    });

    // 2) latency
    checks.push({
      name: "latency",
      pass: r.latencyMs < 10000,
      detail: `latency=${r.latencyMs}ms`,
    });

    // 3) JSON 구조 체크
    const json = r.data ?? {};
    const isJsonObject =
      typeof json === "object" && json !== null && !Array.isArray(json);

    checks.push({
      name: "json.isObject",
      pass: isJsonObject,
      detail: `type=${typeof json}`,
    });

    const hasErrorField = !!(json && typeof (json as any).error === "string");
    checks.push({
      name: "json.noErrorField",
      pass: !hasErrorField,
      detail: hasErrorField ? `error=${(json as any).error}` : "에러 필드 없음",
    });

    return { query: r.query, checks };
  });

  return { basicChecks };
}
