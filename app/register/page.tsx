"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { categories } from "@/lib/agents";
import { CheckCircle2, Loader2, Play, Sparkles } from "lucide-react";

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

type TestResult = {
  type: "json";
  total_score: number; // 최종 통합 점수 (0~10)
  basic_score: number; // 베이직 룰 점수 (0~10)
  judge_score: number; // Judge 평균 점수 (0~10)
  overall_comment: string;
  judge_evals: JudgeEval[];
};

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    author: "",
    address: "",
    description: "",
    url: "",
    pricingModel: "",
    price: "",
    category: categories[0]?.id ?? "ppt",
  });

  const [testStatus, setTestStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [registerStatus, setRegisterStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleTest = async () => {
    setTestStatus("loading");
    setRegisterStatus("idle");
    setMessage(null);
    setTestResult(null);

    try {
      const res = await fetch("/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 필요하면 일부 필드만 보내도 됨 (예: name, category, description, url)
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Test failed");
      }

      const data = await res.json();
      // 백엔드에서 { testResult: ... } 형태라고 가정
      setTestResult(data.testResult as TestResult);
      setTestStatus("success");
      setMessage("Test completed. Review result and finish registration.");
    } catch (err: any) {
      console.error(err);
      setTestStatus("error");
      setMessage(err.message ?? "Test failed. Please adjust and retry.");
    }
  };

  const handleRegister = async () => {
    if (testStatus !== "success" || !testResult) return;

    setRegisterStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, testResult }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Register failed");

      setRegisterStatus("success");
      setMessage("Agent registered successfully.");
      window.location.href = "/agents";
    } catch (err: any) {
      console.error(err);
      setRegisterStatus("error");
      setMessage(err.message ?? "Registration failed. Please retry.");
    }
  };

  const allFilled =
    form.name.trim() &&
    form.category.trim() &&
    form.description.trim() &&
    form.url.trim() &&
    form.author.trim() &&
    form.address.trim() &&
    form.pricingModel.trim() &&
    form.price.trim();

  const disabledDone =
    !allFilled || testStatus !== "success" || registerStatus === "loading";

  return (
    <main className="h-full overflow-auto bg-white px-4 py-10 text-gray-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-10 pb-10">
        <header className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold">Register Agent</h1>
            <p className="text-sm text-gray-600">
              Run AI validation before adding your agent.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-400">
            <Sparkles className="h-4 w-4" />
            AI-powered validation
          </div>
        </header>

        <section className="grid gap-6 rounded-3xl bg-gray-50 p-6 shadow-sm">
          <div className="space-y-1">
            <p className="text-xl font-semibold">Registration</p>
            <p className="text-sm font-semibold text-gray-700">Basic</p>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Name
                </label>
                <Input
                  placeholder="Agent name"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Creator Name
                </label>
                <Input
                  placeholder="Alice"
                  value={form.author}
                  onChange={(e) => handleChange("author", e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col space-y-1">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => handleChange("category", e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-gray-500"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  placeholder="Describe what this agent does best"
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  className="min-h-[120px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Endpoint URL
                </label>
                <Input
                  placeholder="https://api.example.com/agent"
                  value={form.url}
                  onChange={(e) => handleChange("url", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Creator Address
                </label>
                <Input
                  placeholder="0x..."
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                />
              </div>
            </div>

            <p className="text-sm font-semibold text-gray-700">X402 Pricing</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Pricing Model
                </label>
                <Input
                  placeholder="per_run / subscription"
                  value={form.pricingModel}
                  onChange={(e) => handleChange("pricingModel", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Default Price
                </label>
                <Input
                  placeholder="0.001"
                  value={form.price}
                  onChange={(e) => handleChange("price", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 🔥 Validation + Test 결과 통합 카드 */}
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">
                Validation
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleTest}
                  disabled={testStatus === "loading"}
                  className="rounded-full bg-gray-900 px-5 text-white hover:bg-gray-800"
                >
                  {testStatus === "loading" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Start Test
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleRegister}
                  disabled={disabledDone}
                  className="rounded-full bg-white px-5 text-gray-900 ring-1 ring-gray-300 hover:bg-gray-100 disabled:opacity-50"
                >
                  {registerStatus === "loading" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Done"
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-800 space-y-4">
              {testStatus === "success" && testResult ? (
                <>
                  {/* 상단 요약 점수 카드 */}
                  <div className="border rounded p-4 bg-white space-y-2 text-sm">
                    <div className="font-semibold mb-1">Scores</div>
                    <div className="flex flex-col gap-1">
                      <div>
                        <span className="font-medium">Total score: </span>
                        {testResult.total_score.toFixed(1)} / 10
                      </div>
                      <div>
                        <span className="font-medium">Basic rule score: </span>
                        {testResult.basic_score.toFixed(1)} / 10
                      </div>
                      <div>
                        <span className="font-medium">Judge score: </span>
                        {testResult.judge_score.toFixed(1)} / 10
                      </div>
                    </div>
                  </div>

                  {/* Judge 한 줄 코멘트 */}
                  <div className="border rounded p-3 bg-white text-sm">
                    <div className="font-semibold mb-1">Judge Comment</div>
                    <div>{testResult.overall_comment}</div>
                  </div>

                  {/* Judge Eval 상세 (per query) */}
                  {testResult.judge_evals.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-sm font-semibold mb-1">
                        Judge Evals (per query)
                      </div>
                      {testResult.judge_evals.map((ev) => (
                        <div
                          key={ev.query}
                          className="border rounded p-3 text-xs space-y-2 bg-white"
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

                          <div className="text-gray-600">
                            {ev.overall_comment}
                          </div>

                          {/* Dimensions */}
                          {ev.dimensions.length > 0 && (
                            <div>
                              <div className="font-semibold mt-1 mb-1">
                                Dimensions
                              </div>
                              <ul className="list-disc list-inside space-y-1">
                                {ev.dimensions.map((d) => (
                                  <li key={d.name}>
                                    <span className="font-medium">
                                      {d.name}
                                    </span>
                                    : {d.score.toFixed(1)} / 10 - {d.comment}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Issues */}
                          {ev.issues.length > 0 && (
                            <div>
                              <div className="font-semibold mt-1 mb-1">
                                Issues
                              </div>
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
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 text-gray-600">
                  <CheckCircle2 className="h-4 w-4 text-gray-400" />
                  <span>
                    Click &quot;Start Test&quot; to validate the agent
                    automatically.
                  </span>
                </div>
              )}
            </div>

            {message ? (
              <p
                className={`text-sm ${
                  registerStatus === "error" || testStatus === "error"
                    ? "text-red-600"
                    : "text-gray-800"
                }`}
              >
                {message}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
