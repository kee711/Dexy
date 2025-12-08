import "dotenv/config";
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createPublicClient, http, parseAbiItem, decodeEventLog } from "viem";
import { baseSepolia } from "viem/chains";

type AgentRow = {
  id: string;
  name: string;
  url: string;
  address: string;
  price: number;
  description: string | null;
  network?: string | null;
};

type DirectAcceptOption = {
  scheme: "direct";
  network: string;
  resource: string;
  mimeType: string;
  maxTimeoutSeconds: number;
  asset: string;
  payTo: string;
  value: string;
  description?: string;
  extra: Record<string, any>;
};

type DirectPaymentRequirements = {
  x402Version: number;
  accepts: DirectAcceptOption[];
};

type PaymentSettlementResult = {
  transaction: string; // tx hash
  network: string;
  asset: string;
  value: string;
  from: string;
  to: string;
};

type ApiKeyRecord = {
  id: string;
  user_id: string;
  revoked_at: string | null;
};

type ApiKeyContext = {
  apiKeyId: string;
  userId: string;
};

function estimateTokens(text: string) {
  // Rough heuristic: ~4 chars per token
  return Math.max(1, Math.ceil(text.length / 4));
}

function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

async function validateApiKey(req: NextRequest): Promise<ApiKeyContext | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) return null;

  try {
    const service = createServiceClient();
    const keyHash = hashApiKey(rawKey);

    const { data, error } = await service
      .from("api_keys")
      .select("id, user_id, revoked_at")
      .eq("key_hash", keyHash)
      .maybeSingle<ApiKeyRecord>();

    if (error || !data || data.revoked_at) return null;

    // Update last_used_at asynchronously; ignore failures.
    (async () => {
      try {
        await service
          .from("api_keys")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", data.id);
      } catch (err) {
        console.error("[execute] failed to update api_keys.last_used_at", err);
      }
    })();

    return { apiKeyId: data.id, userId: data.user_id };
  } catch (error) {
    console.error("[execute] api key validation failed", error);
    return null;
  }
}

async function logApiKeyUsage(params: {
  apiKeyId: string;
  userId: string;
  agentId: string;
  amount: number;
  tokens?: number;
  cost?: number;
  latencyMs?: number;
  status?: string;
  requestId?: string | null;
}) {
  try {
    const service = createServiceClient();
    const amount = Number(params.amount);
    const tokens = Number(params.tokens ?? 0);
    const cost = Number(params.cost ?? 0);
    const latency = Number(params.latencyMs ?? 0);
    await service.from("api_key_usage").insert({
      api_key_id: params.apiKeyId,
      user_id: params.userId,
      agent_id: params.agentId,
      amount: Number.isFinite(amount) ? Number(amount.toFixed(3)) : 0,
      tokens: Number.isFinite(tokens) ? Math.round(tokens) : 0,
      cost: Number.isFinite(cost) ? Number(cost.toFixed(3)) : 0,
      latency_ms: Number.isFinite(latency) ? Math.round(latency) : 0,
      status: params.status ?? "captured",
      request_id: params.requestId ?? randomUUID(),
    });
  } catch (error) {
    console.error("[execute] failed to log api_key_usage", error);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> } | any
) {
  const startedAt = Date.now();
  const params = await context.params;
  const agentId = params.id as string;

  const supabase = await createClient();

  console.log("params:", params);
  console.log("agentId:", agentId);

  const { data: agent, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single<AgentRow>();

  console.log("agent:", agent);

  if (error || !agent) {
    return NextResponse.json(
      { ok: false, error: "Agent not found" },
      { status: 404 }
    );
  }

  const upstreamUrl: string = agent.url;
  const priceNumber: number = Number(agent.price ?? 0);
  const network: string = agent.network ?? "base-sepolia";
  const payTo: string = agent.address;
  const description: string | null = agent.description ?? null;

  if (!upstreamUrl || !payTo) {
    return NextResponse.json(
      { ok: false, error: "Agent misconfigured (url/address missing)" },
      { status: 400 }
    );
  }

  // price 는 USDC 6 decimal 기준
  const priceUnits = BigInt(Math.round(priceNumber * 10 ** 6));

  const usdcAddress =
    process.env.BASE_SEPOLIA_USDC_ADDRESS ||
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

  const apiKeyContext = await validateApiKey(req);
  if (apiKeyContext) {
    const { response, usage } = await proxyToUpstream(
      req,
      upstreamUrl,
      startedAt
    );

    const usageCost = Number.isFinite(usage.cost) ? usage.cost : priceNumber;

    await logApiKeyUsage({
      apiKeyId: apiKeyContext.apiKeyId,
      userId: apiKeyContext.userId,
      agentId,
      amount: priceNumber,
      cost: usageCost,
      tokens: usage.tokens,
      latencyMs: usage.latencyMs,
      status: priceNumber > 0 ? "captured" : "free",
      requestId: req.headers.get("x-request-id"),
    });

    return response;
  }

  // 🔹 가격이 0이면 그냥 프록시 실행
  if (priceUnits === BigInt(0)) {
    console.log("price = 0 → free execution, skipping payment");
    const { response } = await proxyToUpstream(req, upstreamUrl, startedAt);
    return response;
  }

  const paymentRequirements = buildDirectPaymentRequirements({
    priceUnits,
    network,
    payTo,
    description: description ?? undefined,
    resource: req.nextUrl.toString(),
    usdcAddress,
  });

  const txHash = req.headers.get("x-tx-hash");

  // 🔹 클라이언트가 아직 txHash 를 안 보냈으면 402로 요구사항 리턴
  if (!txHash) {
    console.log(">>> 402 paymentRequirements:", paymentRequirements);
    return NextResponse.json(paymentRequirements, {
      status: 402,
      headers: {
        "content-type": "application/json",
        "x-402-version": "1.0",
      },
    });
  }

  // 🔹 txHash 가 있으면 온체인 결제 검증
  let settlement: PaymentSettlementResult | null = null;
  try {
    settlement = await verifyDirectPaymentOnChain(txHash, paymentRequirements);
    if (!settlement) {
      console.warn("No matching on-chain payment found for txHash:", txHash);
      return NextResponse.json(
        {
          ok: false,
          error: "Payment not found or invalid for this agent",
          requirements: paymentRequirements,
        },
        { status: 402 }
      );
    }
  } catch (e) {
    console.error("Failed to verify direct payment on-chain:", e);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to verify payment on-chain",
        requirements: paymentRequirements,
      },
      { status: 402 }
    );
  }

  // 🔹 결제가 유효하면 upstream 에이전트 호출
  const { response: resp } = await proxyToUpstream(
    req,
    upstreamUrl,
    startedAt
  );

  // 🔹 결제 settlement 정보를 헤더로 인코딩해서 내려줌
  if (settlement) {
    const headerValue = encodePaymentResponseHeader(settlement);
    resp.headers.set("X-PAYMENT-RESPONSE", headerValue);
    resp.headers.set("Access-Control-Expose-Headers", "X-PAYMENT-RESPONSE");
  }

  return resp;
}

async function proxyToUpstream(
  req: NextRequest,
  upstreamUrl: string,
  startedAt: number
): Promise<{
  response: NextResponse;
  usage: { tokens: number; cost: number; latencyMs: number };
}> {
  try {
    let body: any = undefined;
    try {
      body = await req.json();
    } catch {
      body = undefined;
    }

    const promptText =
      body && typeof body === "object" ? JSON.stringify(body) : String(body ?? "");

    const upstreamRes = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const rawText = await upstreamRes.text();
    const latencyMs = Date.now() - startedAt;
    const baseUsage = {
      tokens: estimateTokens(promptText + rawText),
      cost: priceNumber ? Number(priceNumber.toFixed(3)) : 0,
      latencyMs,
    };

    const contentType = upstreamRes.headers.get("content-type") || "";
    let parsed: any = null;
    if (contentType.includes("application/json")) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = null;
      }
    }

    if (parsed && typeof parsed === "object") {
      const normalizedOutput =
        parsed?.normalized?.output ?? parsed?.output ?? parsed?.result ?? rawText;
      const upstreamUsage = parsed?.normalized?.usage ?? parsed?.usage;
      const finalUsage = upstreamUsage
        ? {
            tokens: upstreamUsage.tokens ?? baseUsage.tokens,
            cost: upstreamUsage.cost ?? baseUsage.cost,
            latencyMs: upstreamUsage.latencyMs ?? baseUsage.latencyMs,
          }
        : baseUsage;

      const enriched = {
        ...parsed,
        usage: finalUsage,
        normalized: {
          ...(parsed?.normalized ?? {}),
          usage: finalUsage,
          output: normalizedOutput,
        },
      };

      return {
        response: NextResponse.json(enriched, {
          status: upstreamRes.status,
        }),
        usage: finalUsage,
      };
    }

    const normalized = {
      output: rawText,
      usage: baseUsage,
      normalized: { output: rawText, usage: baseUsage },
    };

    return {
      response: NextResponse.json(normalized, {
        status: upstreamRes.status,
      }),
      usage: baseUsage,
    };
  } catch (e: any) {
    console.error("Proxy to upstream failed:", e);
    const fallbackUsage = {
      tokens: 0,
      cost: 0,
      latencyMs: Date.now() - startedAt,
    };
    return {
      response: NextResponse.json(
        { ok: false, error: e.message ?? "Proxy error" },
        { status: 500 }
      ),
      usage: fallbackUsage,
    };
  }
}

function buildDirectPaymentRequirements(input: {
  priceUnits: bigint;
  network: string;
  payTo: string;
  description?: string;
  resource: string;
  usdcAddress: string;
}): DirectPaymentRequirements {
  const { priceUnits, network, payTo, description, resource, usdcAddress } =
    input;

  const accept: DirectAcceptOption = {
    scheme: "direct",
    network,
    resource,
    mimeType: "application/json",
    maxTimeoutSeconds: 300,
    asset: usdcAddress,
    payTo,
    value: priceUnits.toString(),
    description,
    extra: {
      mode: "direct-transfer",
      note: "Client must call ERC20.transfer() from their own wallet",
    },
  };

  return {
    x402Version: 1,
    accepts: [accept],
  };
}

async function verifyDirectPaymentOnChain(
  txHash: string,
  requirements: DirectPaymentRequirements
): Promise<PaymentSettlementResult | null> {
  const accept = requirements.accepts[0];

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const usdcAddress = accept.asset as `0x${string}`;
  const expectedValue = BigInt(accept.value);
  const expectedPayTo = accept.payTo.toLowerCase();

  console.log("=== verifyDirectPaymentOnChain ===");
  console.log("txHash:", txHash);
  console.log("expected usdcAddress:", usdcAddress);
  console.log("expected payTo:", expectedPayTo);
  console.log("expected value:", expectedValue.toString());

  const receipt = await publicClient.getTransactionReceipt({
    hash: txHash as `0x${string}`,
  });

  if (!receipt) {
    console.warn("No receipt for tx:", txHash);
    return null;
  }

  console.log("receipt.status:", receipt.status);
  console.log("receipt.to:", receipt.to);
  console.log("receipt.logs.length:", receipt.logs.length);

  if (receipt.status !== "success") {
    console.warn("Tx not successful or reverted:", txHash);
    return null;
  }

  const transferEvent = parseAbiItem(
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  );

  const decodedTransfers: {
    from: string;
    to: string;
    value: bigint;
  }[] = [];

  // 🔍 이 tx 안의 모든 로그를 직접 스캔하면서, usdcAddress 에서 발생한 Transfer 만 디코드
  for (const log of receipt.logs) {
    console.log(
      "raw log:",
      "address=",
      log.address,
      "topics=",
      log.topics,
      "data=",
      log.data
    );

    if (log.address.toLowerCase() !== usdcAddress.toLowerCase()) continue;

    try {
      const decoded = decodeEventLog({
        abi: [transferEvent],
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName === "Transfer") {
        const args = decoded.args as any;
        const from = (args.from as string) ?? "";
        const to = (args.to as string) ?? "";
        const v = BigInt(args.value);

        decodedTransfers.push({ from, to, value: v });

        console.log(
          "decoded Transfer:",
          "from=",
          from,
          "to=",
          to,
          "value=",
          v.toString()
        );
      }
    } catch (e) {
      console.log("failed to decode log for usdcAddress:", e);
    }
  }

  if (!decodedTransfers.length) {
    console.warn(
      "No Transfer logs for this usdcAddress in tx receipt. Payment not found."
    );
    return null;
  }

  const matched = decodedTransfers.find(
    (log) =>
      log.to.toLowerCase() === expectedPayTo && log.value === expectedValue
  );

  if (!matched) {
    console.warn(
      "Transfer logs exist, but none matched (to + value). Payment invalid."
    );
    return null;
  }

  const settlement: PaymentSettlementResult = {
    transaction: txHash,
    network: accept.network,
    asset: usdcAddress,
    value: accept.value,
    from: matched.from,
    to: matched.to,
  };

  console.log("Direct payment settlement result:", settlement);
  return settlement;
}

function encodePaymentResponseHeader(
  settlement: PaymentSettlementResult
): string {
  const payload = {
    ...settlement,
    x402Version: 1,
  };

  const jsonString = JSON.stringify(payload);
  const base64 = Buffer.from(jsonString, "utf-8").toString("base64");
  return base64;
}
