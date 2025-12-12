"use client";

import { ConnectButton } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { avalancheFuji } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/thirdwebClient";

const wallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
];

export default function SignInScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="flex justify-center gap-2 mb-3 text-center text-4xl font-extrabold tracking-tight">
          Welcome to <span className="text-red-400">Dexy</span>
        </h1>
        <h2 className="mb-2 text-center text-xl font-bold mt-10">
          Connecting your wallet
        </h2>
        <p className="mb-6 text-center text-sm text-gray-600">
          Please log in using an external wallet
        </p>

        <div className="flex justify-center">
          <ConnectButton
            client={client}
            wallets={wallets}
            chain={avalancheFuji}
          />
        </div>
      </div>
    </div>
  );
}
