// app/api/format-execution/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";

// 필요하면 runtime 지정 (Edge가 아니어도 됨)
// export const runtime = "nodejs";

const model = new ChatOpenAI({
  model: "qwen3-30b-a3b-instruct-2507",
  temperature: 0.3,
  apiKey: process.env.FLOCK_API_KEY,
  configuration: {
    baseURL: "https://api.flock.io/v1",
  },
});

/**
 * POST /api/format-execution
 * body: { rawResult: string, userQuery?: string, agentName?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const rawResult = String(body.rawResult ?? "");
    const userQuery = String(body.userQuery ?? "").slice(0, 4000);
    const agentName = String(body.agentName ?? "Agent").slice(0, 200);

    if (!rawResult) {
      return NextResponse.json(
        { ok: false, error: "rawResult is required" },
        { status: 400 }
      );
    }

    const systemPrompt = `
당신은 "에이전트 실행 결과 포맷터"입니다.

역할:
- 도구(에이전트)에서 나온 JSON/텍스트 결과를 사용자가 읽기 좋은 Markdown으로 정리합니다.
- 요약(summary)은 채팅 UI 상단에 짧게 보여줄 한두 문장 요약입니다.
- 결과에는 이미지 base64는 이미 제거되어 있고, 텍스트 정보만 들어 있습니다.

규칙:
1. 반드시 **JSON** 형식으로만 답변해야 합니다.
2. JSON 최상위 필드는 정확히 아래 두 개만 포함하세요:
   - "formatted": string  // 깔끔한 Markdown 결과 (섹션/리스트/코드블럭 등을 자유롭게 사용)
   - "summary":  string  // 1~2문장 정도의 짧은 요약 (사용자 언어/컨텍스트에 맞게)
3. "formatted" 안에서는:
   - 제목/소제목을 적절히 사용해 논리적으로 구조화합니다.
   - 표, 목록, 인용, 코드블럭 등 Markdown을 적극 활용해 가독성을 높입니다.
   - JSON 구조를 그대로 설명하기보다는, **사용자가 실제로 보고 싶은 내용** 위주로 정리합니다.
4. rawResult가 이미 잘 구조화된 리포트라면, 필요한 부분만 재구성/정리하고 불필요한 메타데이터는 최소화합니다.
5. 이미지나 base64 문자열에 대해서는 텍스트로만 언급하고, 실제 이미지를 생성하진 않습니다.
`;

    const userPrompt = `
[에이전트 이름]
${agentName}

[사용자 쿼리]
${userQuery || "(제공되지 않음)"}

[에이전트 raw 결과 (JSON 또는 텍스트)]
\`\`\`json
${rawResult}
\`\`\`

요구사항:
- 위 내용을 기반으로 사용자가 보기 좋은 Markdown 리포트를 "formatted" 필드에 생성하세요.
- 가장 중요한 인사이트/결론/추천 사항 위주로 구조화하세요.
- "summary" 필드에는 전체 내용을 한두 문장으로 요약하세요.
- 응답 전체는 아래와 같은 JSON 형식을 반드시 지키세요:

{
  "formatted": "...Markdown 형식...",
  "summary": "..."
}
`;

    const aiMessage = await model.invoke([
      {
        role: "system",
        content: systemPrompt.trim(),
      },
      {
        role: "user",
        content: userPrompt.trim(),
      },
    ]);

    let content: string;

    const messageContent = aiMessage.content;
    if (typeof messageContent === "string") {
      content = messageContent;
    } else if (Array.isArray(messageContent)) {
      // ChatOpenAI v0.2에서 content가 array인 경우
      content = messageContent
        .map((part) => {
          if (typeof part === "string") return part;
          if (
            part &&
            typeof part === "object" &&
            "text" in part &&
            typeof (part as { text?: unknown }).text === "string"
          ) {
            return (part as { text?: string }).text ?? "";
          }
          return "";
        })
        .join("\n");
    } else {
      content = "";
    }

    let formatted = rawResult;
    let summary = `Execution completed for ${agentName}.`;

    const stripCodeFence = (text: string) => {
      const trimmed = text.trim();
      if (!trimmed.startsWith("```")) return trimmed;
      const withoutFence = trimmed.replace(/^```[a-zA-Z0-9_-]*\n?/, "");
      const closingIndex = withoutFence.lastIndexOf("```");
      return closingIndex >= 0
        ? withoutFence.slice(0, closingIndex).trim()
        : withoutFence.trim();
    };

    try {
      const cleaned = stripCodeFence(content);
      const parsed = JSON.parse(cleaned);
      if (typeof parsed.formatted === "string") {
        formatted = parsed.formatted;
      }
      if (typeof parsed.summary === "string") {
        summary = parsed.summary;
      }
    } catch (e) {
      console.error("[format-execution] JSON parse error from LLM:", e);
      // 파싱 실패 시, LLM이 준 전체 내용을 formatted로 그대로 사용
      formatted = content;
      summary = `Execution completed for ${agentName}.`;
    }

    return NextResponse.json(
      {
        ok: true,
        formatted,
        summary,
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    console.error("[format-execution] error:", e);
    return NextResponse.json(
      {
        ok: false,
        error:
          e instanceof Error ? e.message : "Failed to format execution result",
      },
      { status: 500 }
    );
  }
}
