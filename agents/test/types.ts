import { z } from "zod";

// 에이전트 메타 정보
export const AgentInfoSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  address: z.string().optional(),
  url: z.string(),
});

// API 응답
export const RawResponseSchema = z.object({
  query: z.string(),
  status: z.number(),
  latencyMs: z.number(),
  contentType: z.string(),
  data: z.unknown(), // any JSON
});

// 개별 체크
export const CheckSchema = z.object({
  name: z.string(),
  pass: z.boolean(),
  detail: z.string().optional(),
});

// Judge 평가
export const JudgeEvalSchema = z.object({
  query: z.string(),
  task_inferred: z.string(),
  dimensions: z.array(
    z.object({
      name: z.string(),
      score: z.number(),
      comment: z.string(),
    })
  ),
  overall_score: z.number(),
  overall_comment: z.string(),
  issues: z.array(z.string()),
});

// 최종 테스트 결과
export const AgentTestResultSchema = z.object({
  type: z.literal("json"),
  total_score: z.number(),
  basic_score: z.number(),
  judge_score: z.number(),
  overall_comment: z.string(),
  judge_evals: z.array(JudgeEvalSchema),
});

// 전체 State
export const AgentTestGraphState = z.object({
  agent: AgentInfoSchema,
  queries: z.array(z.string()).optional(),
  rawResponses: z.array(RawResponseSchema).optional(),
  basicChecks: z
    .array(
      z.object({
        query: z.string(),
        checks: z.array(CheckSchema),
      })
    )
    .optional(),
  judgeEvals: z.array(JudgeEvalSchema).optional(),
  finalResult: AgentTestResultSchema.optional(),
});

export type AgentInfo = z.infer<typeof AgentInfoSchema>;
export type RawResponse = z.infer<typeof RawResponseSchema>;
export type Check = z.infer<typeof CheckSchema>;
export type JudgeEval = z.infer<typeof JudgeEvalSchema>;
export type AgentTestResult = z.infer<typeof AgentTestResultSchema>;
export type AgentTestGraphStateType = z.infer<typeof AgentTestGraphState>;
