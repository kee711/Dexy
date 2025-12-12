// sdk/src/x402.ts
import { wrapFetchWithPayment } from "x402-fetch";
import type { WalletClient } from "viem";
import { DexyClient, type DexyClientOptions } from "./client.js";

export type DexyX402Options = DexyClientOptions & {
  walletClient: WalletClient; // ⚡ 서버지갑 or 유저지갑 (서명 가능)
  maxPayment: bigint; // USDC 6 decimals (예: 1 USDC = 1_000_000n)
};

/**
 * x402 결제를 자동으로 처리하는 DexyClient 생성기
 *
 * - SDK는 지갑을 만들지 않는다.
 * - "SDK를 사용하는 앱"이 viem/thirdweb 등으로 WalletClient를 만들고 넘긴다.
 */
export function createDexyClientWithX402(options: DexyX402Options): DexyClient {
  const { walletClient, maxPayment, ...rest } = options;

  const paidFetch = wrapFetchWithPayment(
    fetch,
    walletClient as any,
    maxPayment
  ) as typeof fetch;

  return new DexyClient({
    ...rest,
    fetchImpl: paidFetch,
  });
}
