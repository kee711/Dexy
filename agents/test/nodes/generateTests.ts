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
You are an assistant tasked with creating agent test queries.
Review the agent description and generate two test queries suitable for quality assessment.
Ensure your response is exclusively in JSON array format (string[]).
`.trim(),
    },
    {
      role: "user" as const,
      content: `
[Agent Information]
name: ${name}
category: ${category}
description: ${description}
`.trim(),
    },
  ];

  const res = await llm.invoke(messages);
  const queries = safeJson<string[]>(String(res.content), [
    "Basic Test Query 1",
    "Basic Test Query 2",
  ]);

  return { queries };
}
