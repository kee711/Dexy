import { useEvmAddress, useSignOut } from "@coinbase/cdp-hooks";
import { Button } from "./ui/button";
import Link from "next/link";
import { useState } from "react";

export default function GlobalHeader() {
  const { evmAddress } = useEvmAddress();
  const { signOut } = useSignOut();
  const [copied, setCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const navItems = [
    { label: "Home", href: "/" },
    { label: "Agents", href: "/agents" },
  ];
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
  return (
    <div className="w-fit flex justify-center gap-3 rounded-full bg-white px-5 py-2 text-white shadow-md">
      {navItems.map((item) => (
        <Button
          asChild
          key={item.href}
          className="rounded-full bg-[#4B6BFF] px-5 py-2 text-white shadow-md hover:bg-[#3d5ff5]"
          size="lg"
          variant="secondary"
        >
          <Link href={item.href}>{item.label}</Link>
        </Button>
      ))}

      <div className="flex justify-center items-center gap-1">
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/80 border border-gray-300/60 rounded-lg hover:bg-white hover:border-gray-400/60 transition-colors"
          title={copied ? "Address copied!" : "Click to copy address"}
        >
          <div className="w-2 h-2 rounded-full bg-gray-500"></div>
          <span className="font-mono text-xs font-medium text-gray-800">
            {`${evmAddress?.slice(0, 6)}...${evmAddress?.slice(-4)}`}
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
        <button
          onClick={() => setIsModalOpen(true)}
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
