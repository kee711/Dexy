import type { AgentTestGraphStateType } from "../types.ts";
import { llm } from "../llm";
import { safeJson } from "../utils";

export async function generateTestsNode(
  state: AgentTestGraphStateType
): Promise<Partial<AgentTestGraphStateType>> {
  const { category, description, name } = state.agent;

  const messages = [
    {
      role: "system" as const,
      content: `
너는 에이전트 테스트 쿼리를 만드는 보조 도우미야.
에이전트 설명을 보고, 품질 평가에 적합한 테스트 쿼리 2개를 만들어라.
반드시 JSON 배열(string[])로만 답해라.
`.trim(),
    },
    {
      role: "user" as const,
      content: `
[에이전트 정보]
name: ${name}
category: ${category}
description: ${description}
`.trim(),
    },
  ];

  const res = await llm.invoke(messages);
  const queries = safeJson<string[]>(String(res.content), [
    "기본 테스트 쿼리 1",
    "기본 테스트 쿼리 2",
  ]);

  return { queries };
}
