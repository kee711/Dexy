// app/agent-test/page.tsx
"use client";

import { useState } from "react";

type JudgeEval = {
  query: string;
  task_inferred: string;
  dimensions: {
    name: string;
    score: number; // 0~10
    comment: string;
  }[];
  overall_score: number; // 0~10
  overall_comment: string;
  issues: string[];
};

// 🔥 이제 성공/실패 플래그나 steps 없이, 점수만 있는 결과 타입
type TestResult = {
  type: "json";
  total_score: number; // 최종 통합 점수 (0~10)
  basic_score: number; // 베이직 룰 점수 (0~10)
  judge_score: number; // Judge 평균 점수 (0~10)
  overall_comment: string;
  judge_evals: JudgeEval[];
};

export default function AgentTestPage() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          description,
          url,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Request failed");
      }

      const data = await res.json();
      // 백엔드에서 { testResult: ... } 형태로 내려온다고 가정
      setResult(data.testResult as TestResult);
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Agent Test Runner</h1>
      <p className="text-sm text-gray-600">
        에이전트의 메타데이터와 API URL을 입력하고, LangGraph 기반 테스트를
        실행해보세요.
      </p>

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="space-y-4 border rounded p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Agent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="research / code / ppt ..."
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="이 에이전트가 무엇을 하는지 자세히 적어주세요."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            API URL <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://my-agent-api.com/api/run"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            기본적으로 이 URL로 <code>POST {"{ query: string }"}</code> 요청이
            전송됩니다. (내부에서는 다른 JSON 형태도 지원)
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center px-4 py-2 rounded bg-black text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "테스트 실행 중..." : "테스트 실행"}
        </button>
      </form>

      {/* 에러 */}
      {error && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-3">
          {error}
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div className="space-y-4">
          {/* 상단 요약 점수 카드 */}
          <div className="border rounded p-4 bg-black space-y-2 text-sm">
            <div className="font-semibold mb-1">Scores</div>
            <div className="flex flex-col gap-1">
              <div>
                <span className="font-medium">Total score: </span>
                {result.total_score.toFixed(1)} / 10
              </div>
              <div>
                <span className="font-medium">Basic rule score: </span>
                {result.basic_score.toFixed(1)} / 10
              </div>
              <div>
                <span className="font-medium">Judge score: </span>
                {result.judge_score.toFixed(1)} / 10
              </div>
            </div>
          </div>

          {/* Judge 한줄 코멘트 */}
          <div className="border rounded p-3 bg-black text-sm">
            <div className="font-semibold mb-1">Judge Comment</div>
            <div>{result.overall_comment}</div>
          </div>

          {/* Judge Eval 상세 (per query) */}
          {result.judge_evals.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2">
                Judge Evals (per query)
              </h2>
              <div className="space-y-3">
                {result.judge_evals.map((ev) => (
                  <div
                    key={ev.query}
                    className="border rounded p-3 text-xs space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <div className="font-semibold">
                        Query:{" "}
                        <span className="font-normal break-all">
                          {ev.query}
                        </span>
                      </div>
                      <div>
                        Score:{" "}
                        <span className="font-semibold">
                          {ev.overall_score.toFixed(1)} / 10
                        </span>
                      </div>
                    </div>
                    <div className="text-gray-600">{ev.overall_comment}</div>

                    {/* Dimensions */}
                    {ev.dimensions.length > 0 && (
                      <div>
                        <div className="font-semibold mt-1 mb-1">
                          Dimensions
                        </div>
                        <ul className="list-disc list-inside space-y-1">
                          {ev.dimensions.map((d) => (
                            <li key={d.name}>
                              <span className="font-medium">{d.name}</span>:{" "}
                              {d.score.toFixed(1)} / 10 - {d.comment}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Issues */}
                    {ev.issues.length > 0 && (
                      <div>
                        <div className="font-semibold mt-1 mb-1">Issues</div>
                        <ul className="list-disc list-inside space-y-1 text-red-600">
                          {ev.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
