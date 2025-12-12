import { ChatOpenAI } from "@langchain/openai";
import type { AgentInfo } from "./types.ts";

export const llm = new ChatOpenAI({
  model: "qwen3-30b-a3b-instruct-2507",
  temperature: 0,
  apiKey: process.env.FLOCK_API_KEY,
  configuration: {
    baseURL: "https://api.flock.io/v1",
  },
});

// sanitizer.ts 같은 파일로 빼도 되고, 아래에 같이 둬도 됩니다.
function stripLargeBinaryFields(raw: string): string {
  // 1) JSON 형태일 때
  try {
    const parsed = JSON.parse(raw);

    const clean = (value: any): any => {
      if (Array.isArray(value)) {
        return value.map(clean);
      }
      if (value && typeof value === "object") {
        const out: any = {};
        for (const [key, v] of Object.entries(value)) {
          const lowerKey = key.toLowerCase();

          // 이미지 / base64 의심 필드 이름들
          const looksLikeImageField =
            lowerKey.includes("imagebase64") ||
            lowerKey.includes("image_base64") ||
            (lowerKey.includes("image") && typeof v === "string");

          if (
            looksLikeImageField &&
            typeof v === "string" &&
            v.length > 200 // 길이 기준은 상황에 맞게 조절
          ) {
            out[key] = "[omitted base64 image]";
          } else if (typeof v === "string" && v.length > 5000) {
            // 그냥 너무 긴 문자열도 잘라 버리기 (옵션)
            out[key] = v.slice(0, 5000) + "… [truncated]";
          } else {
            out[key] = clean(v);
          }
        }
        return out;
      }
      return value;
    };

    const cleaned = clean(parsed);
    return JSON.stringify(cleaned, null, 2);
  } catch {
    // 2) JSON 아니면 정규식으로 단순 치환
    return raw.replace(
      /"imageBase64"\s*:\s*"([\s\S]*?)"/gi,
      `"imageBase64": "[omitted base64 image]"`
    );
  }
}

export function buildJudgeMessages(params: {
  agent: AgentInfo;
  query: string;
  answer: string;
}) {
  const { agent, query, answer } = params;
  const safeAnswer = stripLargeBinaryFields(params.answer);
  return [
    {
      role: "system" as const,
      content: `
You are an "AI Agent Quality Assessor".

First, ascertain what tasks the agent actually performs,
then design your own evaluation criteria tailored to that task type and assess it subjectively.

Important:
- This agent may be of various types, such as research, code generation, PPT/document creation, comics/storytelling, image prompt generation, etc.
- Responses may not be pure text and could include JSON structures (e.g., scenario, page, panels, imageBase64).
- You must first infer "what this agent does" by examining both the agent description (category, description) and the actual response JSON structure together.

Always consider in the following order:

1) Read the [Agent Metadata] and [Agent Response (JSON)],
   then summarise this agent's role/task type and output format in one sentence.
   Example: "An agent that structures blockchain concepts into four-panel comic scenarios and layouts."

2) **Define yourself** 3–5 evaluation criteria suitable for this task type.
   - Research/Explanatory: Accuracy, depth, balance, sources/evidence, difficulty level appropriate for target audience
   - Code Generation: Consistency, executability, safety, structure (readability), explanations/comments
   - PPT/Document: Structure (introduction-development-conclusion), message clarity, information density, visual cues
   - Comics/Stories/Creative:
       - Story structure (e.g., setup-build-twist-punchline)
       - Relevance to the request/prompt
       - Character/tone consistency
       - Entertainment value/emotional arc/message delivery
       - Appropriateness of layout/panel composition
   - For other types, create criteria names aligned with the role you've identified.

3) After examining the structure and fields of the response JSON,
   score it on a scale of **0.0 to 10.0 (to one decimal place)** according to the criteria defined above.
   - Do not simply score based on format alone;
    assess how well this agent performed relative to its "self-description/category".
   - e.g., for "just-fun-comic" mode, prioritise gags/absurdity/rhythm;
        for "explain-comic" mode, prioritise clarity of concept explanation.

4) Assign an overall **0.0–10.0** integrated score,
   and write a single-sentence summary comment (overall_comment) that is easy for users to understand.

5) If there are any noticeable issues (violence/hate speech, factual distortion, structural problems, JSON structure breakage, etc.),
   record them specifically in the issues array.

You must answer strictly in the JSON format below.

{
  "task_inferred": "Summary of this agent's function and output format (free text)",
  "dimensions": [
    { "name": "Criterion name", "score": 0.0-10.0, "comment": "Brief comment" }
  ],
  "overall_score": 0.0-10.0,
  "overall_comment": "One-sentence summary evaluation",
  "issues": ["Notable issue 1", "Issue 2", ...]
}
`.trim(),
    },
    {
      role: "user" as const,
      content: `
[Agent Metadata]
name: ${agent.name}
category: ${agent.category}
description: ${agent.description}
address(For information purposes): ${agent.address ?? "None"}
url(API): ${agent.url}

[Question or Request Label]
${query}

[Agent Response (JSON)]
${safeAnswer}
`.trim(),
    },
  ];
}
