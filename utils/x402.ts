export type PaymentInfo = {
  txHash?: string;
  network?: string;
  asset?: string;
  value?: string;
  from?: string;
  to?: string;
  explorerUrl?: string;
  raw?: any;
};

export function decodePaymentResponseHeader(
  headerValue: string | null
): PaymentInfo | null {
  if (!headerValue) return null;

  try {
    // base64 → string
    const jsonString =
      typeof atob === "function"
        ? atob(headerValue)
        : Buffer.from(headerValue, "base64").toString("utf-8");

    const data = JSON.parse(jsonString);
    const txHash: string | undefined = data.transaction || data.txHash;
    const network: string | undefined = data.network;

    let explorerUrl: string | undefined;
    if (txHash && network) {
      if (network === "base" || network === "base-mainnet") {
        explorerUrl = `https://basescan.org/tx/${txHash}`;
      } else if (network.includes("sepolia")) {
        explorerUrl = `https://sepolia.basescan.org/tx/${txHash}`;
      } else {
        explorerUrl = undefined;
      }
    }

    return {
      txHash,
      network,
      asset: data.asset,
      value: data.value,
      from: data.from,
      to: data.to,
      explorerUrl,
      raw: data,
    };
  } catch (e) {
    console.error("Failed to decode X-PAYMENT-RESPONSE:", e, headerValue);
    return null;
  }
}
