import type { AgentTestGraphStateType, JudgeEval } from "../types.ts";
import { llm, buildJudgeMessages } from "../llm";
import { safeJson, serializeAnswer } from "../utils";

export async function llmJudgeNode(
  state: AgentTestGraphStateType
): Promise<Partial<AgentTestGraphStateType>> {
  const rawResponses = state.rawResponses ?? [];
  const judgeEvals: JudgeEval[] = [];

  for (const r of rawResponses) {
    const answerText = serializeAnswer(r);
    const messages = buildJudgeMessages({
      agent: state.agent,
      query: r.query,
      answer: answerText,
    });

    const res = await llm.invoke(messages);

    const parsed = safeJson<JudgeEval>(String(res.content), {
      query: r.query,
      task_inferred: "parse_error",
      dimensions: [],
      overall_score: 0.5,
      overall_comment: "Judge 응답 JSON 파싱 실패, 기본 점수 사용",
      issues: ["judge_parse_error"],
    });

    parsed.query = r.query;
    judgeEvals.push(parsed);
  }

  return { judgeEvals };
}
