"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AgentCard } from "@/components/agent-card";
import { Button } from "@/components/ui/button";
import { useHeaderVisibility } from "@/components/app-frame";
import { cn } from "@/lib/utils";
import { type Agent } from "@/lib/agents";
import { createClient } from "@/lib/supabase/client";
import {
  Bot,
  Feather,
  Grid,
  Loader2,
  Mic,
  Palette,
  PenSquare,
  Plus,
  Presentation,
  Send,
  Star,
  UserRound,
  Wallet,
  X,
  Search,
} from "lucide-react";

import { createWalletClient, createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";
import { getCurrentUser, toViemAccount } from "@coinbase/cdp-core";
import { decodePaymentResponseHeader, type PaymentInfo } from "@/utils/x402";
import { MarkdownRenderer } from "@/components/markdown-renderer";

type TextMessage = {
  id: string;
  kind: "text";
  from: "user" | "ai";
  text: string;
};

type ExecutionImage = {
  type: "base64" | "url";
  src: string;
  mimeType?: string;
  alt?: string;
};

type ExecutionMessage = {
  id: string;
  kind: "execution";
  execution: {
    agentId: string;
    agentName?: string;
    result: string;
    summary: string;
    reviewSubmitted: boolean;
    rating: number;
    reviewText: string;
    submitting: boolean;
    reviewMessage: string | null;

    // 🔥 이미지들 (선택)
    images?: ExecutionImage[];
  };
};

type ChatMessage = TextMessage | ExecutionMessage;
type ChatUser = { name?: string | null };

// 🔹 X-402 Direct Payment 요구사항 타입 (서버와 동일 형태)
type DirectAcceptOption = {
  scheme: string;
  network: string;
  resource: string;
  mimeType: string;
  maxTimeoutSeconds: number;
  asset: string;
  payTo: string;
  value: string;
  description?: string;
  extra?: Record<string, unknown>;
};

type DirectPaymentRequirements = {
  x402Version: number;
  accepts: DirectAcceptOption[];
};

function parseExecutionResult(
  rawText: string,
  fallbackAgentName: string
): { resultText: string; summaryText: string } {
  let resultText = rawText;
  let summaryText = `Execution completed for ${fallbackAgentName}.`;

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

  const stripCodeFence = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed.startsWith("```")) return trimmed;
    const withoutFence = trimmed.replace(/^```[a-zA-Z0-9_-]*\n?/, "");
    const closingIndex = withoutFence.lastIndexOf("```");
    return closingIndex >= 0
      ? withoutFence.slice(0, closingIndex).trim()
      : withoutFence.trim();
  };

  const parseMaybeJson = (text: string): unknown => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  const cleanedText = stripCodeFence(rawText);

  // Handle stringified JSON string (e.g., "\"{\\\"formatted\\\":...}\"")
  const firstParse = parseMaybeJson(cleanedText);
  const parsed =
    typeof firstParse === "string"
      ? parseMaybeJson(firstParse) ?? firstParse
      : firstParse ?? cleanedText;

  try {
    const parsedObj =
      typeof parsed === "string" ? parseMaybeJson(parsed) ?? parsed : parsed;
    const parsedRecord = isRecord(parsedObj) ? parsedObj : null;
    const resultRecord = isRecord(parsedRecord?.result)
      ? (parsedRecord?.result as Record<string, unknown>)
      : null;

    const pickString = (
      obj: Record<string, unknown> | null,
      key: string
    ): string | undefined => {
      if (!obj) return undefined;
      const value = obj[key];
      return typeof value === "string" ? value : undefined;
    };

    // Prefer explicitly formatted markdown if present.
    const formatted =
      pickString(parsedRecord, "formatted") ??
      pickString(resultRecord, "formatted");
    if (typeof formatted === "string" && formatted.trim().length > 0) {
      resultText = formatted;
    }

    const resultOutput =
      resultRecord?.["output"] ??
      parsedRecord?.["output"] ??
      parsedRecord?.["body"] ??
      parsedRecord?.["result"] ??
      parsedObj;

    const summary =
      pickString(resultRecord, "summary") ??
      pickString(parsedRecord, "summary") ??
      `Execution triggered for ${fallbackAgentName}.`;

    if (!formatted) {
      resultText =
        typeof resultOutput === "string"
          ? resultOutput
          : JSON.stringify(resultOutput, null, 2);
    }
    summaryText = summary;
  } catch {}

  return { resultText, summaryText };
}

function sanitizeRawResultForLlm(rawText: string): {
  sanitizedText: string;
  images: ExecutionImage[];
} {
  const images: ExecutionImage[] = [];
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

  try {
    const parsed = JSON.parse(rawText);

    if (
      isRecord(parsed) &&
      isRecord(parsed.imageBase64) &&
      typeof parsed.imageBase64.imageBase64 === "string"
    ) {
      images.push({
        type: "base64",
        src: parsed.imageBase64.imageBase64,
        mimeType: "image/png",
        alt: "Generated image",
      });
      delete parsed.imageBase64;
    }

    if (isRecord(parsed) && Array.isArray(parsed.results)) {
      parsed.results = parsed.results.map((r, idx: number) => {
        if (!isRecord(r)) return r;
        const copy: Record<string, unknown> = { ...r };

        const nestedImageBase64 = isRecord(copy.imageBase64)
          ? copy.imageBase64
          : null;
        if (
          nestedImageBase64 &&
          typeof nestedImageBase64.imageBase64 === "string"
        ) {
          images.push({
            type: "base64",
            src: nestedImageBase64.imageBase64,
            mimeType: "image/png",
            alt:
              typeof copy.title === "string"
                ? copy.title
                : `Result image #${idx + 1}`,
          });
          delete copy.imageBase64;
        }

        const imageUrl =
          typeof copy.imageUrl === "string"
            ? copy.imageUrl
            : typeof copy.image_url === "string"
            ? copy.image_url
            : null;
        if (imageUrl) {
          images.push({
            type: "url",
            src: imageUrl,
            alt:
              typeof copy.title === "string"
                ? copy.title
                : `Result image #${idx + 1}`,
          });
        }

        return copy;
      });
    }

    return {
      sanitizedText: JSON.stringify(parsed, null, 2),
      images,
    };
  } catch {
    return { sanitizedText: rawText, images: [] };
  }
}

async function formatWithLlm(
  rawText: string,
  userQuery: string,
  agentName: string
): Promise<{
  resultText: string;
  summaryText: string;
  images: ExecutionImage[];
}> {
  const { sanitizedText, images } = sanitizeRawResultForLlm(rawText);

  try {
    const res = await fetch("/api/format", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawResult: sanitizedText,
        userQuery,
        agentName,
      }),
    });

    if (!res.ok) {
      const { resultText, summaryText } = parseExecutionResult(
        rawText,
        agentName
      );
      return { resultText, summaryText, images };
    }

    const json = await res.json();
    if (!json?.ok) {
      const { resultText, summaryText } = parseExecutionResult(
        rawText,
        agentName
      );
      return { resultText, summaryText, images };
    }

    return {
      resultText: json.formatted ?? sanitizedText,
      summaryText: json.summary ?? `Execution completed for ${agentName}.`,
      images,
    };
  } catch (e) {
    console.error("formatWithLlm error:", e);
    const { resultText, summaryText } = parseExecutionResult(
      rawText,
      agentName
    );
    return { resultText, summaryText, images };
  }
}

export default function ChatPage({ user }: { user: ChatUser }) {
  const { setShowHeader } = useHeaderVisibility();
  const [view, setView] = useState<"landing" | "chat">("landing");
  const [prompt, setPrompt] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentModal, setAgentModal] = useState<Agent | null>(null);
  const [searchResults, setSearchResults] = useState<Agent[]>([]);
  const [catalogAgents, setCatalogAgents] = useState<Agent[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [agentExecuted, setAgentExecuted] = useState(false);

  const [finalQueryMode, setFinalQueryMode] = useState(false);
  const [finalQueryAgentId, setFinalQueryAgentId] = useState<string | null>(
    null
  );

  useEffect(() => {
    const loadCatalogAgents = async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("agents")
          .select(
            "id, name, author, description, category, price, rating_avg, rating_count, test_score, pricing_model, url"
          );

        if (error) throw new Error(error.message);

        const sorted =
          data?.sort((a, b) => {
            const aRating =
              (a.rating_avg ?? 0) + (a.rating_count ?? 0) * 0.001;
            const bRating =
              (b.rating_avg ?? 0) + (b.rating_count ?? 0) * 0.001;
            if (bRating === aRating) {
              return (a.price ?? 0) - (b.price ?? 0);
            }
            return bRating - aRating;
          }) ?? [];

        setCatalogAgents(
          sorted.map((agent, index) => ({
            ...agent,
            author: agent.author ?? "Unknown",
            price: agent.price ?? 0,
            rank: index + 1,
            rating: agent.rating_avg ?? undefined,
          }))
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load agents";
        setCatalogError(message);
      } finally {
        setCatalogLoading(false);
      }
    };

    void loadCatalogAgents();
  }, []);

  const hasSearchResults = searchResults.length > 0;

  const landingAgents = useMemo(() => {
    if (selectedCategory === "all") return catalogAgents;
    return catalogAgents.filter((agent) => agent.category === selectedCategory);
  }, [catalogAgents, selectedCategory]);

  const recommendedAgents = useMemo(() => {
    if (!searchResults.length) return [];

    return searchResults.map((agent, index) => ({
      ...agent,
      rank: agent.rank ?? index + 1,
    }));
  }, [searchResults]);

  const updateExecutionMessage = (
    executionId: string,
    updater: (
      exec: ExecutionMessage["execution"]
    ) => ExecutionMessage["execution"]
  ) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.kind !== "execution" || msg.id !== executionId) return msg;
        return { ...msg, execution: updater(msg.execution) };
      })
    );
  };

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgentId(agent.id);
    setAgentExecuted(false);
  };

  const primaryAgent = hasSearchResults
    ? recommendedAgents.find((agent) => agent.id === selectedAgentId) ??
      recommendedAgents[0]
    : undefined;

  useEffect(() => {
    setShowHeader(view === "landing");
    return () => setShowHeader(true);
  }, [view, setShowHeader]);

  const handleSend = async () => {
    const text = prompt.trim();
    if (!text) return;

    const now = Date.now();

    if (finalQueryMode && finalQueryAgentId) {
      const cleanedQuery = text;

      setMessages((prev) => [
        ...prev,
        {
          id: `user-final-${now}`,
          kind: "text",
          from: "user",
          text: cleanedQuery,
        },
        {
          id: `ai-prep-${now}`,
          kind: "text",
          from: "ai",
          text: "Right, I'll proceed with the payment based on the details you've just sent and run the agent.",
        },
      ]);

      setPrompt("");
      setFinalQueryMode(false);
      setView("chat");

      await executeAgent(cleanedQuery, finalQueryAgentId);
      return;
    }

    const follow =
      view === "landing"
        ? "Searching for the best-fitting agents now."
        : "Refreshing the recommendations based on your latest note.";

    setMessages((prev) => [
      ...prev,
      { id: `user-${now}`, kind: "text", from: "user", text },
      {
        id: `ai-${now}-follow`,
        kind: "text",
        from: "ai",
        text: follow,
      },
    ]);

    setView("chat");
    setPrompt("");

    await runSearch(text);
  };

  const runSearch = async (queryText: string) => {
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: queryText,
          topK: 10,
          matchThreshold: 0.35,
          category: selectedCategory,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Search failed");
      }

      const payload = await response.json();
      if (!payload?.ok) {
        throw new Error(payload?.error ?? "Search failed");
      }

      if (payload?.mode === "chat") {
        const aiMessage = payload?.message ?? "I can help with that.";
        setSearchResults([]);
        setMessages((prev) => [
          ...prev,
          {
            id: `chat-${Date.now()}`,
            kind: "text",
            from: "ai",
            text: aiMessage,
          },
        ]);
        return;
      }

      type RawAgent = Partial<Agent> & {
        id: string;
        name: string;
        similarity?: number;
        fitness_score?: number;
        rank?: number;
      };

      const rawResults: RawAgent[] = Array.isArray(payload?.results)
        ? payload.results
        : [];
      const results: Agent[] = rawResults.map((item) => ({
        id: item.id,
        name: item.name,
        author: item.author ?? "Unknown",
        description: item.description ?? "",
        price: item.price ?? 0,
        rating_avg: item.rating_avg ?? null,
        rating_count: item.rating_count ?? 0,
        category: item.category ?? selectedCategory,
        fitness_score: item.fitness_score ?? 0,
        similarity: item.similarity ?? 0,
        score: item.fitness_score ?? 0,
        rank: item.rank,
        pricing_model: item.pricing_model ?? "",
        url: item.url ?? "",
        test_score: item.test_score ?? null,
        rationale: item.rationale ?? "",
      }));

      setSearchResults(results);

      if (results.length) {
        const firstForCategory =
          results.find((agent) => agent.category === selectedCategory) ??
          results[0];

        setSelectedAgentId(firstForCategory.id);
        setAgentExecuted(false);
        handleSelectAgent(firstForCategory);

        if (payload?.message) {
          setMessages((prev) => [
            ...prev,
            {
              id: `chat-${Date.now()}`,
              kind: "text",
              from: "ai",
              text: payload.message,
            },
          ]);
        }
      } else if (payload?.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: `chat-${Date.now()}`,
            kind: "text",
            from: "ai",
            text: payload.message,
          },
        ]);
      }
    } catch (error) {
      console.error(error);
      setSearchResults([]);
      const message =
        error instanceof Error ? error.message : "Failed to search";
      setSearchError(message);
    } finally {
      setSearching(false);
    }
  };

  // 🔥 Confirm 버튼 클릭 시: window.prompt 대신 "최종 요청 요청 모드"로 진입
  const handleConfirmClick = () => {
    if (!selectedAgentId) return;

    const now = Date.now();
    const agentName =
      recommendedAgents.find((a) => a.id === selectedAgentId)?.name ??
      selectedAgentId;

    setFinalQueryMode(true);
    setFinalQueryAgentId(selectedAgentId);

    setMessages((prev) => [
      ...prev,
      {
        id: `ai-confirm-${now}`,
        kind: "text",
        from: "ai",
        text:
          `Before running with the selected agent **${agentName}**,\n` +
          `Please send the final request details once more via message.\n\n` +
          `Example: "What is X402?"`,
      },
    ]);
  };

  const executeAgent = async (finalQuery: string, agentIdOverride?: string) => {
    const agentIdToUse = agentIdOverride ?? selectedAgentId;
    if (!agentIdToUse) return;

    const cleanedQuery = finalQuery.trim();
    if (!cleanedQuery) return;

    setAgentExecuted(false);
    setExecuting(true);

    try {
      const currentUser = await getCurrentUser();
      if (
        !currentUser ||
        !currentUser.evmAccounts ||
        currentUser.evmAccounts.length === 0
      ) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-wallet-${Date.now()}`,
            kind: "text",
            from: "ai",
            text: "Your CDP wallet is not connected. Please connect your wallet first and then try again.",
          },
        ]);
        return;
      }

      const viemAccount = await toViemAccount(currentUser.evmAccounts[0]);

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

      const payload = { query: cleanedQuery };

      const agentName =
        recommendedAgents.find((a) => a.id === agentIdToUse)?.name ??
        agentIdToUse;

      const firstRes = await fetch(`/api/execute/${agentIdToUse}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (firstRes.status === 200) {
        const text = await firstRes.text();

        const { resultText, summaryText, images } = await formatWithLlm(
          text,
          cleanedQuery,
          agentName
        );

        const execId = `exec-${Date.now()}`;
        const executionMessage: ExecutionMessage = {
          id: execId,
          kind: "execution",
          execution: {
            agentId: agentIdToUse,
            agentName,
            result: resultText,
            summary: summaryText,
            reviewSubmitted: false,
            rating: 5,
            reviewText: "",
            submitting: false,
            reviewMessage: null,

            images,
          },
        };

        setMessages((prev) => [
          ...prev,
          {
            id: `ai-free-${Date.now()}`,
            kind: "text",
            from: "ai",
            text: "이 에이전트는 무료로 실행되었어요.",
          },
          executionMessage,
          {
            id: `ai-next-${Date.now()}`,
            kind: "text",
            from: "ai",
            text: "The operation has been completed. Should you have any further requests, we shall be happy to recommend another agent.",
          },
        ]);

        setAgentExecuted(true);
        return;
      }

      if (firstRes.status !== 402) {
        const text = await firstRes.text();
        const msg = `Unexpected status from execute (first call): ${firstRes.status} ${firstRes.statusText}\n\n${text}`;
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-error-${Date.now()}`,
            kind: "text",
            from: "ai",
            text: `에이전트 실행에 실패했어요:\n${msg}`,
          },
        ]);
        return;
      }

      const requirements: DirectPaymentRequirements = await firstRes.json();

      if (!requirements.accepts || requirements.accepts.length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-noaccept-${Date.now()}`,
            kind: "text",
            from: "ai",
            text: "The payment requirements (paymentRequirements.accepts) are empty, so the execution cannot proceed.",
          },
        ]);
        return;
      }

      const accept = requirements.accepts[0];

      const usdcAddress = accept.asset as `0x${string}`;
      const payTo = accept.payTo as `0x${string}`;
      const valueUnits = BigInt(accept.value);
      const humanUsdc = Number(accept.value) / 1e6;

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-payinfo-${Date.now()}`,
          kind: "text",
          from: "ai",
          text:
            `Running this agent requires ${humanUsdc} USDC.\n` +
            `I will get USDC from Your wallet to complete the payment.\n\n` +
            `- 📡 Network: ${accept.network}\n- 🔹 To (agent): \`${payTo}\``,
        },
      ]);

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

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-txsent-${Date.now()}`,
          kind: "text",
          from: "ai",
          text:
            "Sent a USDC transfer transaction.\n\n" +
            `- 🔹 Tx Hash: \`${txHash}\`\n`,
        },
      ]);

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-txconfirmed-${Date.now()}`,
          kind: "text",
          from: "ai",
          text: "The transaction has been included in the block. Once the payment is confirmed, I will proceed with the agent execution.",
        },
      ]);

      const secondRes = await fetch(`/api/execute/${agentIdToUse}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TX-HASH": txHash,
        },
        body: JSON.stringify(payload),
      });

      const text2 = await secondRes.text();

      const header2 = secondRes.headers.get("X-PAYMENT-RESPONSE");
      if (header2) {
        const decoded: PaymentInfo | null =
          decodePaymentResponseHeader(header2);

        if (decoded) {
          const paidUsdc = Number(decoded.value) / 1e6;
          const payMsg =
            "Payment is complete.\n" +
            `- 📡 Network: ${decoded.network}\n` +
            `- 🔹 From: \`${decoded.from}\`\n` +
            `- 🔹 To: \`${decoded.to}\`\n` +
            `- 💸 Amount: ${paidUsdc} USDC\n` +
            (decoded.explorerUrl
              ? `- [Go to BaseScan](${decoded.explorerUrl})`
              : "");
          setMessages((prev) => [
            ...prev,
            {
              id: `ai-paid-${Date.now()}`,
              kind: "text",
              from: "ai",
              text: payMsg,
            },
          ]);
        }
      }

      const { resultText, summaryText, images } = await formatWithLlm(
        text2,
        cleanedQuery,
        agentName
      );

      const execId = `exec-${Date.now()}`;
      const executionMessage: ExecutionMessage = {
        id: execId,
        kind: "execution",
        execution: {
          agentId: agentIdToUse,
          agentName,
          result: resultText,
          summary: summaryText,
          reviewSubmitted: false,
          rating: 5,
          reviewText: "",
          submitting: false,
          reviewMessage: null,
          images, // 🔥
        },
      };

      setMessages((prev) => [
        ...prev,
        executionMessage,
        {
          id: `ai-next-${Date.now()}`,
          kind: "text",
          from: "ai",
          text:
            "The agent execution and payment have both been completed. " +
            "I can recommend another agent and help you run it if you have further requests.",
        },
      ]);

      setAgentExecuted(true);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "unknown error (executeAgent)";

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-exec-error-${Date.now()}`,
          kind: "text",
          from: "ai",
          text: `An error occurred during agent execution/payment:\n${msg}`,
        },
      ]);

      setAgentExecuted(false);
    } finally {
      setExecuting(false);
    }
  };

  const submitReview = async (executionId: string) => {
    updateExecutionMessage(executionId, (exec) => ({
      ...exec,
      submitting: true,
      reviewMessage: null,
    }));
    try {
      const current = messages.find(
        (msg) => msg.kind === "execution" && msg.id === executionId
      ) as ExecutionMessage | undefined;

      if (!current) {
        throw new Error("Execution not found");
      }

      const response = await fetch("/api/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId: current.execution.agentId,
          rating: current.execution.rating,
          review: current.execution.reviewText.trim() || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "Failed to submit review");
      }

      updateExecutionMessage(executionId, (exec) => ({
        ...exec,
        reviewSubmitted: true,
        submitting: false,
        reviewMessage:
          "Thanks for your feedback! Your rating has been recorded.",
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to submit review. Please try again.";
      updateExecutionMessage(executionId, (exec) => ({
        ...exec,
        submitting: false,
        reviewMessage: message,
      }));
    } finally {
    }
  };

  return (
    <>
      <div className="flex h-full w-full flex-col gap-6 py-6 overflow-y-auto">
        {view === "landing" ? (
          <LandingView
            prompt={prompt}
            onPromptChange={setPrompt}
            onSend={handleSend}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            recommendedAgents={landingAgents}
            loading={catalogLoading}
            error={catalogError}
            onOpenAgent={(agent) => setAgentModal(agent)}
          />
        ) : (
          <ChatView
            prompt={prompt}
            onPromptChange={setPrompt}
            onSend={handleSend}
            messages={messages}
            recommendedAgents={recommendedAgents}
            selectedAgent={primaryAgent}
            onOpenAgent={(agent) => setAgentModal(agent)}
            onConfirm={handleConfirmClick}
            searching={searching}
            searchError={searchError}
            executing={executing}
            agentExecuted={agentExecuted}
            onRateExecution={(id, value) =>
              updateExecutionMessage(id, (exec) => ({ ...exec, rating: value }))
            }
            onReviewChangeExecution={(id, value) =>
              updateExecutionMessage(id, (exec) => ({
                ...exec,
                reviewText: value.slice(0, 500),
              }))
            }
            onSubmitReview={submitReview}
            user={user}
          />
        )}
      </div>

      {agentModal ? (
        <AgentModal
          agent={agentModal}
          onClose={() => setAgentModal(null)}
          onUseAgent={() => {
            setSelectedAgentId(agentModal.id);
            setAgentExecuted(false);
            setAgentModal(null);
            setView("chat");
          }}
        />
      ) : null}
    </>
  );
}

function LandingView({
  prompt,
  onPromptChange,
  onSend,
  selectedCategory,
  onCategoryChange,
  recommendedAgents,
  loading,
  error,
  onOpenAgent,
}: {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSend: () => void | Promise<void>;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  recommendedAgents: Agent[];
  loading?: boolean;
  error?: string | null;
  onOpenAgent: (agent: Agent) => void;
}) {
  const categoriesUI: {
    id: string;
    label: string;
    icon: React.ReactNode;
    tint: string;
  }[] = [
    {
      id: "all",
      label: "All",
      icon: <Grid className="h-5 w-5" />,
      tint: "bg-gray-100 text-gray-600",
    },
    {
      id: "scraper",
      label: "Scraper",
      icon: <Bot className="h-5 w-5" />,
      tint: "bg-cyan-100 text-cyan-600",
    },
    {
      id: "research",
      label: "Research",
      icon: <Search className="h-4 w-4" />,
      tint: "bg-indigo-100 text-indigo-500",
    },
    {
      id: "cartoonist",
      label: "Cartoonist",
      icon: <Palette className="h-5 w-5" />,
      tint: "bg-orange-100 text-orange-500",
    },
    {
      id: "slides",
      label: "Slides",
      icon: <Presentation className="h-5 w-5" />,
      tint: "bg-amber-100 text-amber-500",
    },
    {
      id: "sheets",
      label: "Sheets",
      icon: <Grid className="h-5 w-5" />,
      tint: "bg-green-100 text-green-500",
    },
    {
      id: "docs",
      label: "Docs",
      icon: <PenSquare className="h-5 w-5" />,
      tint: "bg-blue-100 text-blue-500",
    },
    {
      id: "logo",
      label: "Logo",
      icon: <Feather className="h-5 w-5" />,
      tint: "bg-purple-100 text-purple-500",
    },
  ];

  return (
    <section className="flex flex-col items-center gap-12 pt-32">
      <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
        How can I help you today?
      </h1>

      <div className="flex w-[70%] flex-col items-center gap-6">
        <PromptComposer
          prompt={prompt}
          onPromptChange={onPromptChange}
          onSend={onSend}
          placeholder="Get recommendations for agents suitable for your task."
          landing
        />

        <CategoryScroller
          categories={categoriesUI}
          selectedCategory={selectedCategory}
          onCategoryChange={onCategoryChange}
        />
      </div>

      <div className="w-[80%] space-y-4 mt-8">
        <div className="flex items-center justify-center gap-3 text-sm font-semibold text-gray-600">
          <span className="h-px w-16 bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
          Recommendation
          <span className="h-px w-16 bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
        </div>
        {loading ? (
          <p className="text-sm text-gray-500 text-center pt-10">
            Loading agents...
          </p>
        ) : error ? (
          <p className="text-sm text-red-600 text-center pt-10">
            Failed to load agents: {error}
          </p>
        ) : recommendedAgents.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 pt-10">
            {recommendedAgents.slice(0, 4).map((agent, index) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                rank={index + 1}
                onOpen={() => onOpenAgent(agent)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center pt-10">
            The agent for this category is either loading or is not yet
            registered.
          </p>
        )}
      </div>
    </section>
  );
}

function ChatView({
  prompt,
  onPromptChange,
  onSend,
  messages,
  recommendedAgents,
  selectedAgent,
  onOpenAgent,
  onConfirm,
  searching,
  searchError,
  executing,
  agentExecuted,
  onRateExecution,
  onReviewChangeExecution,
  onSubmitReview,
  user,
}: {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSend: () => void | Promise<void>;
  messages: ChatMessage[];
  recommendedAgents: Agent[];
  selectedAgent: Agent | undefined;
  onOpenAgent: (agent: Agent) => void;
  onConfirm: () => void;
  searching: boolean;
  searchError: string | null;
  executing: boolean;
  agentExecuted: boolean;
  onRateExecution: (executionId: string, value: number) => void;
  onReviewChangeExecution: (executionId: string, value: string) => void;
  onSubmitReview: (executionId: string) => void;
  user: ChatUser;
}) {
  const hasRecommended = recommendedAgents.length > 0;

  return (
    <section
      className={cn(
        "relative flex h-full w-full items-stretch gap-6 overflow-hidden transition-all duration-300",
        hasRecommended ? "pr-4" : "justify-center"
      )}
    >
      <div
        className={cn(
          "flex h-full flex-col gap-4 overflow-hidden transition-all duration-300",
          hasRecommended ? "flex-[2]" : "w-full max-w-4xl"
        )}
      >
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.12em] text-gray-500">
              {user.name ?? "Guest"}
            </p>
            <h2 className="text-2xl font-semibold">
              {user.name ?? "Guest"} chat
            </h2>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-2 pb-28">
          {messages.map((message) => {
            if (message.kind === "text") {
              return (
                <ChatBubble key={message.id} from={message.from}>
                  {message.text}
                </ChatBubble>
              );
            }
            if (message.kind === "execution") {
              const exec = message.execution;
              return (
                <div
                  key={message.id}
                  className="space-y-3 rounded-2xl bg-gray-100 p-4 shadow-sm"
                >
                  <p className="text-sm font-semibold text-gray-800">
                    Execution Result
                  </p>
                  <p className="text-sm text-gray-800">{exec.summary}</p>

                  <div className="rounded-xl bg-white p-3 text-sm text-gray-800 ring-1 ring-gray-200">
                    <MarkdownRenderer content={exec.result} />
                  </div>

                  {/* 🔥 이미지 있으면 보여주기 */}
                  {exec.images?.length ? (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {exec.images.map((img, idx) => (
                        <img
                          key={idx}
                          src={
                            img.type === "base64"
                              ? `data:${img.mimeType ?? "image/png"};base64,${
                                  img.src
                                }`
                              : img.src
                          }
                          alt={img.alt ?? `Result image ${idx + 1}`}
                          className="max-h-64 rounded-xl border bg-white object-contain"
                        />
                      ))}
                    </div>
                  ) : null}

                  {!exec.reviewSubmitted ? (
                    <ReviewBox
                      rating={exec.rating}
                      onRate={(value) => onRateExecution(message.id, value)}
                      review={exec.reviewText}
                      onReviewChange={(value) =>
                        onReviewChangeExecution(message.id, value)
                      }
                      onSubmit={() => onSubmitReview(message.id)}
                      submitting={exec.submitting}
                      message={exec.reviewMessage}
                    />
                  ) : (
                    <p className="text-xs text-green-700">
                      You have submitted a review for this execution.
                    </p>
                  )}
                </div>
              );
            }
            return null;
          })}
          {searching ? (
            <div className="flex flex-col items-start gap-3">
              <div className="rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-700 shadow-sm">
                🔄 Preparing Agent
              </div>
            </div>
          ) : (
            selectedAgent &&
            !agentExecuted && (
              <div className="flex flex-col items-start gap-3">
                <AgentCard
                  agent={selectedAgent}
                  highlight
                  note="You may select another agent from the list."
                  onOpen={() => onOpenAgent(selectedAgent)}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={onConfirm}
                    disabled={executing || agentExecuted}
                    className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black/90"
                  >
                    {executing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Executing...
                      </>
                    ) : agentExecuted ? (
                      "Execution completed"
                    ) : (
                      "Confirm"
                    )}
                  </Button>
                </div>
              </div>
            )
          )}
        </div>

        <div className="pointer-events-none sticky bottom-0 z-10 mt-auto bg-white/90 pb-2">
          <div className="pointer-events-auto">
            <PromptComposer
              prompt={prompt}
              onPromptChange={onPromptChange}
              onSend={onSend}
              placeholder="Add more details or ask to keep going..."
            />
          </div>
        </div>
      </div>

      <aside
        className={cn(
          "flex max-h-full flex-col overflow-hidden rounded-3xl bg-gray-50 shadow-sm transition-all duration-300 transform-gpu",
          hasRecommended
            ? "flex-[1] max-w-sm translate-x-0 opacity-100 p-5"
            : "pointer-events-none max-w-0 translate-x-[120%] opacity-0 p-0"
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold">Recommended List</h3>
          <span className="flex items-center gap-2 text-xs text-gray-500">
            {searching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              "Ranked by score & price"
            )}
          </span>
        </div>
        {searchError ? (
          <p className="mb-3 text-xs text-red-600">
            Search error: {searchError}
          </p>
        ) : null}
        {hasRecommended ? (
          <div className="flex flex-col gap-4 overflow-y-auto">
            {recommendedAgents.map((agent, index) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                compact
                rank={index + 1}
                active={selectedAgent?.id === agent.id}
                onOpen={() => {
                  onOpenAgent(agent);
                }}
              />
            ))}
          </div>
        ) : null}
      </aside>
    </section>
  );
}

function ReviewBox({
  rating,
  onRate,
  review,
  onReviewChange,
  onSubmit,
  submitting,
  message,
}: {
  rating: number;
  onRate: (value: number) => void;
  review: string;
  onReviewChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  message: string | null;
}) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="space-y-3 rounded-xl bg-white p-3 text-sm text-gray-800 ring-1 ring-gray-200">
      <p className="font-semibold">Rate this agent</p>
      <div className="flex gap-2">
        {stars.map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onRate(star)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition",
              star <= rating
                ? "border-amber-400 bg-amber-100 text-amber-700"
                : "border-gray-300 bg-gray-50 text-gray-500"
            )}
          >
            {star}
          </button>
        ))}
      </div>
      <textarea
        value={review}
        onChange={(e) => onReviewChange(e.target.value.slice(0, 500))}
        maxLength={500}
        placeholder="Optional feedback (max 500 chars)"
        className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-gray-300"
        rows={3}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{review.length}/500</span>
        <Button
          size="sm"
          className="rounded-full bg-black text-white hover:bg-black/90"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? "Submitting..." : "Submit review"}
        </Button>
      </div>
      {message ? <p className="text-xs text-green-700">{message}</p> : null}
    </div>
  );
}

function PromptComposer({
  prompt,
  onPromptChange,
  onSend,
  placeholder,
  landing,
}: {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSend: () => void | Promise<void>;
  placeholder: string;
  landing?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [textHeight, setTextHeight] = useState(72);

  const handleChange = (value: string, target?: HTMLTextAreaElement) => {
    onPromptChange(value);
    const el = target ?? textareaRef.current;
    if (el) {
      el.style.height = "auto";
      const newHeight = Math.max(40, Math.min(el.scrollHeight, 200));
      el.style.height = `${newHeight}px`;
      setTextHeight(newHeight);
    }
  };

  return (
    <div
      className={cn(
        "flex w-full flex-col rounded-[32px] border border-gray-200 bg-white shadow-sm transition",
        landing ? "px-3 py-3" : "px-5 py-4"
      )}
    >
      <div className="flex w-full flex-col gap-3">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => handleChange(e.target.value, e.target)}
          onKeyDown={(e) => {
            // Avoid sending while IME composition is active (e.g., Korean input)
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={placeholder}
          className={cn(
            "w-full p-3 resize-none bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400",
            landing ? "min-h-[32px] leading-relaxed" : ""
          )}
          style={{ height: `${textHeight}px` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 hover:bg-gray-200"
        >
          <Plus className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 hover:bg-gray-200"
          >
            <Mic className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onSend}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-white transition hover:bg-black/80"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

type CategoryOption = {
  id: string;
  label: string;
  icon?: ReactNode;
  tint?: string;
};

function CategoryScroller({
  categories,
  selectedCategory,
  onCategoryChange,
}: {
  categories: CategoryOption[];
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {categories.map((category) => {
        const isSelected = category.id === selectedCategory;
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onCategoryChange(category.id)}
            className={cn(
              "flex min-w-[120px] flex-col items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition",
              "text-gray-600 hover:-translate-y-[2px]"
            )}
          >
            <span
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full text-base",
                isSelected
                  ? "bg-gray-50 shadow-lg"
                  : category.tint ?? "bg-gray-100 text-gray-600"
              )}
            >
              {category.icon}
            </span>
            <span
              className={cn(
                "text-xs font-semibold leading-tight text-center",
                isSelected ? "text-gray-900" : "text-gray-600"
              )}
            >
              {category.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ChatBubble({
  children,
  from,
}: {
  children: React.ReactNode;
  from: "user" | "ai";
}) {
  const isUser = from === "user";

  const alignClass = isUser
    ? "ml-auto bg-blue-100 text-white"
    : "mr-auto bg-gray-100 text-gray-900";

  return (
    <div
      className={cn(
        "max-w-2xl rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
        alignClass
      )}
    >
      {typeof children === "string" ? (
        <MarkdownRenderer content={children} />
      ) : (
        children
      )}
    </div>
  );
}

function AgentModal({
  agent,
  onClose,
  onUseAgent,
}: {
  agent: Agent;
  onClose: () => void;
  onUseAgent: () => void;
}) {
  const [tab, setTab] = useState<"about" | "example" | "reviews">("about");
  const priceValue = agent.price ?? 0;
  const ratingValue = agent.rating_avg ?? agent.rating ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-10">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-[#f7f7f7] p-6 shadow-2xl">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full px-2 py-2 text-xs font-semibold text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-semibold">{agent.name}</h3>
              <div className="flex items-center mt-2 mb-2 gap-3 text-sm font-semibold text-gray-800">
                <div className="flex items-center gap-1">
                  <Wallet className="h-4 w-4" />
                  <span>{priceValue.toFixed(3)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4" />
                  <span>{ratingValue.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-700">
                  <UserRound className="h-4 w-4" />
                  <span>{agent.author}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm font-semibold text-gray-800"></div>
          </div>

          <div className="flex gap-1">
            {(["about", "example", "reviews"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-semibold transition",
                  tab === key
                    ? "bg-gray-200 text-gray-900 sha"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                {key === "about"
                  ? "About"
                  : key === "example"
                  ? "Example"
                  : "Reviews"}
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-gray-100 p-5">
            {tab === "about" && (
              <div className="space-y-2">
                <p className="text-base font-semibold text-gray-900">
                  About this Agent
                </p>
                <p className="text-gray-800">
                  {agent.description ?? "No description yet."}
                </p>
              </div>
            )}

            {tab === "example" && (
              <div className="space-y-4">
                {(agent.examples ?? []).map((example) => {
                  if (example.type === "text") {
                    return (
                      <div
                        key={example.title}
                        className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200"
                      >
                        <p className="font-semibold text-gray-900">
                          {example.title}
                        </p>
                        <p className="mt-1 text-sm text-gray-700">
                          {example.body}
                        </p>
                      </div>
                    );
                  }

                  if (example.type === "image") {
                    return (
                      <div
                        key={example.title}
                        className="space-y-2 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200"
                      >
                        <p className="font-semibold text-gray-900">
                          {example.title}
                        </p>
                        <img
                          src={example.url}
                          alt={example.caption ?? example.title}
                          className="h-48 w-full rounded-lg object-cover"
                        />
                        {example.caption ? (
                          <p className="text-xs text-gray-600">
                            {example.caption}
                          </p>
                        ) : null}
                      </div>
                    );
                  }

                  if (example.type === "code") {
                    return (
                      <div
                        key={example.title}
                        className="space-y-2 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200"
                      >
                        <p className="font-semibold text-gray-900">
                          {example.title}
                        </p>
                        <pre className="overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
                          <code>{example.code}</code>
                        </pre>
                        <p className="text-xs text-gray-600 uppercase tracking-wide">
                          {example.language}
                        </p>
                      </div>
                    );
                  }

                  return null;
                })}

                {!(agent.examples ?? []).length ? (
                  <p className="text-sm text-gray-600">
                    No examples available yet.
                  </p>
                ) : null}
              </div>
            )}

            {tab === "reviews" && (
              <div className="space-y-3">
                {(agent.reviews ?? []).map((review) => (
                  <div
                    key={review.id}
                    className="flex items-start gap-3 rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
                      {review.user.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                        {review.user}
                        <span className="flex items-center gap-1 text-xs text-gray-700">
                          <Star className="h-4 w-4 text-amber-500" />
                          {review.rating.toFixed(1)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{review.comment}</p>
                    </div>
                  </div>
                ))}

                {!(agent.reviews ?? []).length ? (
                  <p className="text-sm text-gray-600">
                    No reviews yet. Be the first.
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onUseAgent}
              className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-black/90"
            >
              Use this agent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
