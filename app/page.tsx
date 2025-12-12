"use client";

import { useActiveAccount } from "thirdweb/react";

import SignInScreen from "@/components/SignInScreen";
import ChatPage from "@/app/chat/page";

export default function Home() {
  const activeAccount = useActiveAccount();

  if (!activeAccount) {
    return <SignInScreen />;
  }

  return <ChatPage />;
}
