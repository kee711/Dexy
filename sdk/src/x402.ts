// sdk/src/x402.ts
import { wrapFetchWithPayment } from "x402-fetch";
import type { WalletClient } from "viem";
import { DexyClient, type DexyClientOptions } from "./client.js";

export type DexyX402Options = DexyClientOptions & {
  walletClient: WalletClient;
  maxPayment: bigint;
};

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
