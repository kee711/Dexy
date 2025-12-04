import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embedText } from "@/lib/embedding";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const supabase = await createClient();

    const testResult = payload.testResult as
      | {
          type?: string;
          total_score?: number;
          basic_score?: number;
          judge_score?: number;
          overall_comment?: string;
          judge_evals?: {
            query: string;
            task_inferred?: string;
            dimensions: {
              name: string;
              score: number;
              comment: string;
            }[];
            overall_score: number;
            overall_comment: string;
            issues: string[];
          }[];
        }
      | undefined;

    // testResult 없으면 바로 에러
    if (!testResult) {
      return NextResponse.json(
        { ok: false, error: "testResult is required" },
        { status: 400 }
      );
    }

    // 1) 점수 계산: total → judge → basic 순으로 fallback
    const testResultScore =
      testResult.total_score ??
      testResult.judge_score ??
      testResult.basic_score ??
      0;

    // 2) 임베딩용 텍스트 만들기
    const overallComment = testResult.overall_comment ?? "";
    const judgeEvals = Array.isArray(testResult.judge_evals)
      ? testResult.judge_evals
      : [];

    const judgeText = judgeEvals
      .map((ev) => {
        const dimsText = ev.dimensions
          .map((d) => `${d.name}: ${d.score.toFixed(1)}/10 - ${d.comment}`)
          .join("\n");

        const issuesText = ev.issues.length
          ? `Issues: ${ev.issues.join("; ")}`
          : "";

        return [
          `Query: ${ev.query}`,
          `Overall: ${ev.overall_score.toFixed(1)}/10 - ${ev.overall_comment}`,
          dimsText,
          issuesText,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");

    const testResultText = [overallComment, judgeText]
      .filter((t) => t && t.trim().length > 0)
      .join("\n\n");

    const embedding =
      testResultText.length > 0 ? await embedText(testResultText) : null;

    // 3) price 파싱
    const rawPrice = payload.price;
    let priceNumber = 0;

    if (rawPrice !== undefined && rawPrice !== null && rawPrice !== "") {
      const parsed = Number(rawPrice);
      if (!Number.isNaN(parsed)) {
        priceNumber = parsed;
      }
    }

    const now = new Date().toISOString();

    // 4) Supabase에 저장할 레코드 (스키마에 딱 맞춰서)
    const agentRecord = {
      name: payload.name as string,
      author: payload.author as string,
      address: payload.address as string,
      description: payload.description as string,
      url: payload.url as string,
      pricing_model: payload.pricingModel as string,
      category: payload.category as string,
      price: priceNumber,
      test_result: testResultText || null,
      test_score: Number(testResultScore ?? 0),
      rating_avg: null as number | null, // 처음엔 아직 평점 없음
      rating_count: 0,
      created_at: now,
      updated_at: now,
      test_result_embedding: embedding,
    };

    const { data, error } = await supabase
      .from("agents")
      .insert(agentRecord)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, agent: data });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: "Failed to register agent" },
      { status: 500 }
    );
  }
}
