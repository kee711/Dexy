"use client";

import {
  useIsInitialized,
  useIsSignedIn,
  useGetAccessToken,
} from "@coinbase/cdp-hooks";
import { useEffect, useState } from "react";

import { LoadingCard } from "@/components/ui/loading-spinner";
import SignInScreen from "@/components/SignInScreen";
import ChatPage from "./chat/page";

type AppUser = {
  id: string;
  cdp_user_id: string | null;
  name: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
};

export default function Home() {
  const { isInitialized } = useIsInitialized();
  const { isSignedIn } = useIsSignedIn();
  const { getAccessToken } = useGetAccessToken();

  const [user, setUser] = useState<AppUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);

  useEffect(() => {
    if (!isSignedIn) {
      setUser(null);
      return;
    }

    const fetchUser = async () => {
      setLoadingUser(true);
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) return;

        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });

        if (!res.ok) {
          console.error("session error", await res.text());
          return;
        }

        const data = await res.json();
        setUser(data.user);
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUser().catch(console.error);
  }, [isSignedIn, getAccessToken]);

  // 1) CDP SDK 초기화 대기
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingCard message="loading CDP..." />
      </div>
    );
  }

  // 2) 로그인 안 된 상태
  if (!isSignedIn) {
    return <SignInScreen />;
  }

  // 3) 로그인은 됐는데, 아직 DB 유저 정보를 못 불러온 상태
  if (loadingUser || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingCard message="loading user..." />
      </div>
    );
  }

  // 4) CDP 로그인 + DB 유저 정보까지 준비 완료
  return <ChatPage user={user} />;
  // return <ChatPage />;
}
