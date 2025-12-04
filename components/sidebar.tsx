"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  GalleryVerticalEnd,
  House,
  PanelLeft,
  PanelRight,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import logo from "@/assets/icons/Findex-Favicon.svg";

type SidebarProps = {
  collapsed?: boolean;
  onToggle?: () => void;
};

const baseUrl = "/";

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isAgents = pathname?.startsWith("/agents");
  const [hovered, setHovered] = useState(false);

  const items = [
    {
      label: "New Chat",
      icon: <Plus className="h-4 w-4" />,
      onClick: () => {
        if (typeof window !== "undefined") {
          window.open(baseUrl, "_blank");
        }
      },
      active: false,
    },
    {
      label: "Home",
      icon: <House className="h-4 w-4" />,
      href: "/",
      active: isHome,
    },
    {
      label: "Agents",
      icon: <GalleryVerticalEnd className="h-4 w-4" />,
      href: "/agents",
      active: isAgents,
    },
  ];

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-gray-200 bg-white py-4 transition-all duration-200",
        collapsed ? "w-[68px]" : "w-[220px]"
      )}
    >
      <div className="flex items-center justify-between px-3">
        <div
          className={cn(
            "group relative flex cursor-pointer items-center gap-2 rounded-full transition",
            collapsed ? "justify-center" : "justify-start"
          )}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-black transition",
              collapsed ? "" : ""
            )}
            aria-label="Toggle sidebar"
          >
            {collapsed ? (
              hovered ? (
                <PanelRight className="h-4 w-4" />
              ) : (
                <Image src={logo} alt="Logo" width={24} height={40} priority />
              )
            ) : (
              <Image src={logo} alt="Logo" width={24} height={40} priority />
            )}
          </button>
        </div>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-full p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Collapse sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-6 flex flex-1 flex-col gap-2">
        {items.map((item) =>
          item.href ? (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                `mx-3 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition
                ${collapsed ? "justify-center" : ""}`,
                item.active
                  ? "bg-gray-100 text-black"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ) : (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className={cn(
                `mx-3 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition",
                "text-gray-700 hover:bg-gray-50 hover:text-gray-900 ${
                  collapsed ? "justify-center" : ""
                }`
              )}
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        )}
      </div>
    </aside>
  );
}
