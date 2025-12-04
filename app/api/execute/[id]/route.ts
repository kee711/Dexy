import "dotenv/config";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> } | any
) {
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

  // 🔹 가격이 0이면 그냥 프록시 실행
  if (priceUnits === BigInt(0)) {
    console.log("price = 0 → free execution, skipping payment");
    return proxyToUpstream(req, upstreamUrl);
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
  const resp = await proxyToUpstream(req, upstreamUrl);

  // 🔹 결제 settlement 정보를 헤더로 인코딩해서 내려줌
  if (settlement) {
    const headerValue = encodePaymentResponseHeader(settlement);
    resp.headers.set("X-PAYMENT-RESPONSE", headerValue);
    resp.headers.set("Access-Control-Expose-Headers", "X-PAYMENT-RESPONSE");
  }

  return resp;
}

async function proxyToUpstream(req: NextRequest, upstreamUrl: string) {
  try {
    let body: any = undefined;
    try {
      body = await req.json();
    } catch {
      body = undefined;
    }

    const upstreamRes = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await upstreamRes.text();

    return new NextResponse(text, {
      status: upstreamRes.status,
      headers: {
        "content-type":
          upstreamRes.headers.get("content-type") || "application/json",
      },
    });
  } catch (e: any) {
    console.error("Proxy to upstream failed:", e);
    return NextResponse.json(
      { ok: false, error: e.message ?? "Proxy error" },
      { status: 500 }
    );
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
