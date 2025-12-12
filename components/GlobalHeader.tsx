"use client";

import {
  useActiveAccount,
  useActiveWallet,
  useDisconnect,
  useActiveWalletChain,
  useWalletBalance,
} from "thirdweb/react";
import { avalancheFuji } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/thirdwebClient";
import { useMemo, useState } from "react";

export default function GlobalHeader() {
  const activeAccount = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const chain = useActiveWalletChain();

  const address = activeAccount?.address;

  // 🔥 여기서 테스트넷만 허용
  const isAvalancheFuji = chain?.id === avalancheFuji.id; // 43113

  const { data: balance, isLoading: balanceLoading } = useWalletBalance({
    client,
    chain,
    address,
  });

  const formattedBalance = useMemo(() => {
    if (!balance) return null;

    const num = Number(balance.displayValue);
    if (Number.isNaN(num)) return balance.displayValue; // 혹시 숫자 변환 실패하면 원본 그대로

    // 1,234.567 이런 식으로 소수 셋째 자리까지 고정
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  }, [balance]);

  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shortAddress =
    address != null
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : "Not connected";

  const handleSignOut = () => {
    if (!wallet) return;
    disconnect(wallet);
  };

  return (
    <div className="w-fit flex justify-center gap-3 rounded-full bg-white px-5 py-2 text-white shadow-md">
      <div className="flex justify-center items-center gap-2">
        {/* 네트워크 뱃지 */}
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium border ${
            isAvalancheFuji
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }`}
        >
          {chain ? `${chain.name} (${chain.id})` : "No network"}
        </span>

        {/* 네이티브 코인 잔액 (Fuji면 AVAX 테스트넷) */}
        <span className="px-2 py-1 rounded-full bg-gray-50 border border-gray-200 text-xs font-mono text-gray-800">
          {balanceLoading
            ? "Loading..."
            : balance && formattedBalance
            ? `${formattedBalance} ${balance.symbol}`
            : "--"}
        </span>

        {/* 주소 표시 + 복사 */}
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/80 border border-gray-300/60 rounded-lg hover:bg-white hover:border-gray-400/60 transition-colors"
          title={copied ? "Address copied!" : "Click to copy address"}
          disabled={!address}
        >
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <span className="font-mono text-xs font-medium text-gray-800">
            {shortAddress}
          </span>
        </button>

        <button
          onClick={handleSignOut}
          className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:border-gray-400 transition-colors"
          title="Sign Out"
        >
          {" "}
          <svg
            className="w-4 h-4 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
