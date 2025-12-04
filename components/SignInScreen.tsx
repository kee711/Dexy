"use client";

import { SignInModal } from "@coinbase/cdp-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

export default function SignInScreen() {
  return (
    <div className="signin-container relative h-screen w-screen flex items-center justify-center bg-white overflow-hidden">
      <div className="relative z-0 text-center max-w-md mx-auto px-6">
        <div className="mb-4">
          <h1 className="text-4xl font-bold text-black mb-4">
            Fiverr for agent
          </h1>
          <h2 className="text-md  text-gray-400 mb-4">
            Do your task using x402 Micropayments
          </h2>
        </div>
        <div className="mb-8">
          <div className="flex justify-center">
            <div className="modern-auth-button">
              <SignInModal>
                <Button
                  className="rounded-full bg-[#2c44fc] px-5 py-2 text-white shadow-md hover:bg-[#011082]"
                  size="lg"
                  variant="secondary"
                >
                  Get Started
                </Button>
              </SignInModal>
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-400 space-y-2">
          <p>Base • x402</p>
        </div>
      </div>
    </div>
  );
}
