"use client";

import React, { useState } from "react";
import { createWalletClient, createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";

import { getCurrentUser, toViemAccount } from "@coinbase/cdp-core";

import { decodePaymentResponseHeader, PaymentInfo } from "@/utils/x402";

type ExecuteResult = {
  status: number;
  body: string;
};

type DirectPaymentRequirements = {
  x402Version: number;
  accepts: {
    scheme: string;
    network: string;
    resource: string;
    mimeType: string;
    maxTimeoutSeconds: number;
    asset: string;
    payTo: string;
    value: string;
    description?: string;
    extra?: Record<string, any>;
  }[];
};

export default function TestExecuteAgentPage() {
  const [agentId, setAgentId] = useState("");
  const [bodyJson, setBodyJson] = useState(
    `{
  "title": "foo",
  "body": "bar",
  "userId": 1
}`
  );
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [errorText, setErrorText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [rawPaymentHeader, setRawPaymentHeader] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);

  const handleRun = async () => {
    setErrorText("");
    setResult(null);
    setRawPaymentHeader(null);
    setPaymentInfo(null);

    if (!agentId.trim()) {
      alert("agentId를 입력해줘");
      return;
    }

    let payload: any = {};
    try {
      payload = bodyJson ? JSON.parse(bodyJson) : {};
    } catch {
      alert("Body JSON 형식이 잘못됐어 (마지막 콤마 확인!)");
      return;
    }

    setIsLoading(true);

    try {
      const user = await getCurrentUser();
      if (!user || !user.evmAccounts || user.evmAccounts.length === 0) {
        setIsLoading(false);
        setErrorText("CDP 지갑이 연결되지 않았어 (evmAccounts 없음)");
        return;
      }

      const viemAccount = await toViemAccount(user.evmAccounts[0]);

      const chain = baseSepolia;
      const rpcUrl =
        Number(chain.id) === Number(base.id)
          ? "https://mainnet.base.org"
          : "https://sepolia.base.org";

      const walletClient = createWalletClient({
        account: viemAccount,
        chain,
        transport: http(rpcUrl),
      });

      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      });

      const firstRes = await fetch(`/api/execute/${agentId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (firstRes.status === 200) {
        const text = await firstRes.text();
        setResult({
          status: firstRes.status,
          body: safePretty(text),
        });

        const header = firstRes.headers.get("X-PAYMENT-RESPONSE");
        setRawPaymentHeader(header);
        const decoded = decodePaymentResponseHeader(header);
        if (decoded) setPaymentInfo(decoded);

        setIsLoading(false);
        return;
      }

      if (firstRes.status !== 402) {
        const text = await firstRes.text();
        setErrorText(
          `Unexpected status from execute (first call): ${firstRes.status} ${firstRes.statusText}\n\n${text}`
        );
        setIsLoading(false);
        return;
      }

      const requirements: DirectPaymentRequirements = await firstRes.json();

      if (!requirements.accepts || requirements.accepts.length === 0) {
        setErrorText("paymentRequirements.accepts 가 비어 있어");
        setIsLoading(false);
        return;
      }

      const accept = requirements.accepts[0];

      const usdcAddress = accept.asset as `0x${string}`;
      const payTo = accept.payTo as `0x${string}`;
      const valueUnits = BigInt(accept.value);

      const txHash = await walletClient.writeContract({
        address: usdcAddress,
        abi: [
          {
            type: "function",
            name: "transfer",
            stateMutability: "nonpayable",
            inputs: [
              { name: "to", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ name: "", type: "bool" }],
          },
        ] as const,
        functionName: "transfer",
        args: [payTo, valueUnits],
      });

      console.log("Sent USDC.transfer tx:", txHash);
      console.log(
        `View on BaseScan: https://sepolia.basescan.org/tx/${txHash}`
      );

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      const secondRes = await fetch(`/api/execute/${agentId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TX-HASH": txHash,
        },
        body: JSON.stringify(payload),
      });

      const text2 = await secondRes.text();

      setResult({
        status: secondRes.status,
        body: safePretty(text2),
      });

      const header2 = secondRes.headers.get("X-PAYMENT-RESPONSE");
      setRawPaymentHeader(header2);

      const decoded2 = decodePaymentResponseHeader(header2);
      if (decoded2) {
        setPaymentInfo(decoded2);
        console.log("Decoded payment info:", decoded2);
      }
    } catch (err: any) {
      console.error("Execute failed:", err);
      setErrorText(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-slate-950 text-slate-50 p-8">
      <div className="w-full max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">
          🧪 /api/execute/[id] 테스트 (유저 지갑 직접 결제)
        </h1>

        <p className="text-sm text-slate-300">
          Supabase에 등록된 agent의 <code className="font-mono">id</code>와
          Request Body를 넣고 실행하면,
          <br />
          CDP 지갑에서 직접 USDC를 보내고, 우리 서버가 온체인에서 검증한 뒤
          upstream API를 호출해.
        </p>

        {/* Agent ID 입력 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">
            Agent ID (Supabase agents.id)
          </label>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: 51b1e792-cc22-48f8-a1c0-9f1ee614ab23"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          />
        </div>

        {/* Request Body 입력 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">
            Request Body (JSON)
          </label>
          <textarea
            className="w-full h-40 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={bodyJson}
            onChange={(e) => setBodyJson(e.target.value)}
          />
          <p className="text-xs text-slate-400">
            JSON 형식으로 입력해야 해. 마지막 필드 뒤에 콤마(,) 있으면 안 돼.
          </p>
        </div>

        {/* 실행 버튼 */}
        <button
          onClick={handleRun}
          disabled={isLoading}
          className="w-full rounded-md bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 px-4 py-2 text-sm font-semibold"
        >
          {isLoading ? "결제 + 실행 중..." : "에이전트 실행 (지갑 결제 포함)"}
        </button>

        {/* 에러 출력 */}
        {errorText && (
          <div className="mt-4 rounded-md border border-red-500 bg-red-950/40 p-3 text-sm text-red-200 whitespace-pre-wrap">
            ⚠️ Error
            <br />
            {errorText}
          </div>
        )}

        {/* 응답 출력 */}
        {result && (
          <div className="mt-4 rounded-md border border-slate-700 bg-slate-900 p-3 text-sm whitespace-pre-wrap">
            <div className="font-semibold mb-1 text-slate-200">
              ✅ Response (status: {result.status})
            </div>
            <pre>{result.body}</pre>
          </div>
        )}

        {/* 결제 정보 (tx hash + BaseScan 링크) */}
        {paymentInfo && (
          <div className="mt-4 rounded-md border border-emerald-500/60 bg-emerald-950/40 p-3 text-sm">
            <div className="font-semibold mb-1">💸 결제 정보</div>

            {paymentInfo.txHash ? (
              <>
                <div className="text-xs text-emerald-200 mb-1">
                  Network: {paymentInfo.network || "unknown"}
                </div>
                <div className="text-xs">Tx Hash:</div>
                <div className="font-mono break-all text-xs mb-2">
                  {paymentInfo.txHash}
                </div>

                {paymentInfo.explorerUrl ? (
                  <a
                    href={paymentInfo.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-emerald-300 hover:underline text-xs"
                  >
                    🔗 BaseScan에서 보기
                  </a>
                ) : (
                  <div className="text-xs text-emerald-200">
                    explorer URL을 알 수 없는 네트워크야. tx hash만 표시했어.
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-emerald-200">
                X-PAYMENT-RESPONSE는 있었지만 tx hash 필드는 없었어.
              </div>
            )}
          </div>
        )}

        {/* raw X-PAYMENT-RESPONSE 헤더 (디버깅용) */}
        {rawPaymentHeader && (
          <div className="mt-2 rounded-md border border-emerald-700/60 bg-emerald-950/20 p-2 text-[11px] break-all">
            <div className="font-semibold mb-1">
              🧩 Raw X-PAYMENT-RESPONSE Header (base64)
            </div>
            {rawPaymentHeader}
          </div>
        )}
      </div>
    </div>
  );
}

function safePretty(text: string): string {
  try {
    const json = JSON.parse(text);
    return JSON.stringify(json, null, 2);
  } catch {
    return text;
  }
}
