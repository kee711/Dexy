"use client";

import { createContext, PropsWithChildren, useContext, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { useEvmAddress, useSignOut } from "@coinbase/cdp-hooks";

type HeaderContextValue = {
  showHeader: boolean;
  setShowHeader: (value: boolean) => void;
};

const HeaderContext = createContext<HeaderContextValue | null>(null);

export function useHeaderVisibility() {
  const ctx = useContext(HeaderContext);
  if (!ctx) {
    throw new Error("useHeaderVisibility must be used within AppFrame");
  }
  return ctx;
}

export function AppFrame({ children }: PropsWithChildren) {
  const { evmAddress } = useEvmAddress();
  const [collapsed, setCollapsed] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const isLoggedIn = !!evmAddress; // 로그인 여부

  return (
    <HeaderContext.Provider value={{ showHeader, setShowHeader }}>
      <div className="flex h-screen overflow-hidden bg-white text-gray-900">
        <div className="h-full overflow-hidden">
          {isLoggedIn && (
            <Sidebar
              collapsed={collapsed}
              onToggle={() => setCollapsed((prev) => !prev)}
            />
          )}
        </div>
        <div className="flex h-full flex-1 flex-col overflow-hidden">
          {showHeader ? (
            <div className="flex items-center justify-end px-6 py-4">
              {isLoggedIn && <GlobalHeader />}
            </div>
          ) : null}
          <div className="flex-1 overflow-hidden px-6">{children}</div>
        </div>
      </div>
    </HeaderContext.Provider>
  );
}

// 원하면 default로도 쓸 수 있게
export default AppFrame;

export function GlobalHeader() {
  const { evmAddress } = useEvmAddress();
  const { signOut } = useSignOut();
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    if (!evmAddress) return;

    try {
      await navigator.clipboard.writeText(evmAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  const shortAddress =
    evmAddress != null
      ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}`
      : "Not connected";

  return (
    <div className="w-fit flex justify-center gap-3 rounded-full bg-white px-5 py-2 text-white shadow-md">
      <div className="flex justify-center items-center gap-1">
        {/* 주소 표시 + 복사 버튼 */}
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/80 border border-gray-300/60 rounded-lg hover:bg-white hover:border-gray-400/60 transition-colors"
          title={copied ? "Address copied!" : "Click to copy address"}
        >
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <span className="font-mono text-xs font-medium text-gray-800">
            {shortAddress}
          </span>
          {copied ? (
            <svg
              className="w-3.5 h-3.5 text-gray-600 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="w-3.5 h-3.5 text-gray-500 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          )}
        </button>

        {/* Fund Wallet 버튼 – 아직 모달은 없으니 onClick은 비워둠 */}
        <button
          onClick={() => {}}
          className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:border-gray-400 transition-colors"
          title="Fund Wallet"
        >
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
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        </button>

        {/* Sign Out 버튼 */}
        <button
          onClick={signOut}
          className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:border-gray-400 transition-colors"
          title="Sign Out"
        >
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
