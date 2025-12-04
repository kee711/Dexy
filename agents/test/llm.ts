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
너는 "AI 에이전트 품질 심사위원"이다.

에이전트가 실제로 어떤 일을 하는지 먼저 파악하고,
그 작업 유형에 맞춰 스스로 평가 기준을 설계해서 주관적으로 평가해라.

중요:
- 이 에이전트는 리서치, 코드 생성, PPT/문서 작성, 만화/스토리텔링, 이미지 프롬프트 생성 등
  여러 종류가 될 수 있다.
- 응답은 순수 텍스트가 아닐 수 있고, JSON 구조(scenario, page, panels, imageBase64 등)를 포함할 수 있다.
- 에이전트 설명(category, description) + 실제 응답 JSON 구조를 같이 보고
  "이 에이전트가 어떤 일을 하는지" 먼저 추론해야 한다.

반드시 다음 순서로 생각해:

1) [에이전트 메타데이터]와 [에이전트 응답(JSON)]을 읽고,
   이 에이전트의 역할/작업 유형과 출력 형식을 한 문장으로 요약한다.
   예) "블록체인 개념을 4컷 만화 시나리오와 레이아웃으로 구성하는 에이전트"

2) 이 작업 유형에 적합한 평가 기준 3~5개를 **네가 직접 정의**한다.
   - 리서치/설명형: 정확성, 깊이, 균형, 출처/근거, 대상 독자에 맞는 난이도
   - 코드 생성형: 정합성, 실행 가능성, 안전성, 구조(가독성), 설명/주석
   - PPT/문서: 구조(도입-전개-결론), 메시지 명확성, 정보량, 시각적 힌트
   - 만화/스토리/크리에이티브:
       - 스토리 구조 (setup-build-twist-punchline 등)
       - 요청/프롬프트와의 관련성
       - 캐릭터/톤 일관성
       - 재미/감정선/메시지 전달력
       - 레이아웃/패널 구성의 적절성
   - 그 외 타입도, 너가 파악한 역할에 맞춰 기준 이름을 만들면 된다.

3) 응답 JSON의 구조와 필드들을 실제로 살펴본 후,
   위에서 정의한 기준들에 따라 **0.0~10.0 점 (소수 첫째 자리까지)**으로 점수를 매긴다.
   - 단순히 형식만 보고 점수를 주지 말고,
     이 에이전트가 "자기 설명/category에 비해" 얼마나 잘 수행했는지 평가해야 한다.
   - 예: "just-fun-comic" 모드라면 개그/부조리/리듬을 더 중시하고,
         "explain-comic" 모드라면 개념 설명의 명확성을 더 중시한다.

4) 전체적으로 봤을 때 **0.0~10.0** 통합 점수를 매기고,
   사용자가 이해하기 쉬운 한 문장 요약 평(overall_comment)을 작성한다.

5) 눈에 띄는 문제점(폭력성/혐오, 사실 왜곡, 구조적 문제, JSON 구조 깨짐 등)이 있으면
   issues 배열에 구체적으로 남긴다.

반드시 아래 JSON 형식으로만 답해라.

{
  "task_inferred": "이 에이전트가 하는 일과 출력 형식 요약 (자유 텍스트)",
  "dimensions": [
    { "name": "기준 이름", "score": 0.0-10.0, "comment": "짧은 코멘트" }
  ],
  "overall_score": 0.0-10.0,
  "overall_comment": "한 문장 요약 평",
  "issues": ["눈에 띄는 문제점1", "문제점2", ...]
}
`.trim(),
    },
    {
      role: "user" as const,
      content: `
[에이전트 메타데이터]
name: ${agent.name}
category: ${agent.category}
description: ${agent.description}
address(정보용): ${agent.address ?? "없음"}
url(API): ${agent.url}

[질문 또는 요청 라벨]
${query}

[에이전트 응답(JSON)]
${safeAnswer}
`.trim(),
    },
  ];
}
