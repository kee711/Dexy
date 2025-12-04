import type { AgentTestGraphStateType, AgentTestResult } from "../types.ts";

export async function aggregateNode(
  state: AgentTestGraphStateType
): Promise<Partial<AgentTestGraphStateType>> {
  const basicChecks = state.basicChecks ?? [];
  const judgeEvals = state.judgeEvals ?? [];

  const allRuleChecks = basicChecks.flatMap((b) => b.checks);
  const rulePassRatio =
    allRuleChecks.length === 0
      ? 0
      : allRuleChecks.filter((c) => c.pass).length / allRuleChecks.length;

  const judgeScores10 = judgeEvals.map((e) => e.overall_score);
  const judgeAvg10 =
    judgeScores10.length === 0
      ? 0
      : judgeScores10.reduce((a, b) => a + b, 0) / judgeScores10.length;

  const basicScore10 = Number((rulePassRatio * 10).toFixed(1));
  const judgeScore10 = Number(judgeAvg10.toFixed(1));

  const BASIC_WEIGHT = 0.1;
  const JUDGE_WEIGHT = 0.9;

  const finalNorm =
    BASIC_WEIGHT * rulePassRatio + JUDGE_WEIGHT * (judgeScore10 / 10);

  const totalScore10 = Number((finalNorm * 10).toFixed(1));

  const overall_comment =
    judgeEvals[0]?.overall_comment ?? "아직 Judge 평가 코멘트가 없습니다.";

  const finalResult: AgentTestResult = {
    type: "json",
    total_score: totalScore10,
    basic_score: basicScore10,
    judge_score: judgeScore10,
    overall_comment,
    judge_evals: judgeEvals,
  };

  return { finalResult };
}
