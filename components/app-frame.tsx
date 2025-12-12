"use client";

import { createContext, PropsWithChildren, useContext, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { useActiveAccount } from "thirdweb/react";
import GlobalHeader from "./GlobalHeader";

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
  const activeAccount = useActiveAccount();
  const [collapsed, setCollapsed] = useState(false);
  const [showHeader, setShowHeader] = useState(true);

  const isLoggedIn = !!activeAccount;

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

export default AppFrame;
