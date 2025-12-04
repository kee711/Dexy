"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AgentCard } from "@/components/agent-card";
import { Button } from "@/components/ui/button";
import type { Agent } from "@/lib/agents";
import GlobalHeader from "@/components/GlobalHeader";
import { createClient } from "@/lib/supabase/client";
import {
  Bot,
  Grid,
  Palette,
  PenSquare,
  Presentation,
  Search,
} from "lucide-react";

export default function AgentsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoriesUI: {
    id: string;
    label: string;
    icon: ReactNode | null;
    tint: string;
  }[] = [
    { id: "all", label: "All", icon: null, tint: "" },
    {
      id: "scraper",
      label: "Scraper",
      icon: <Bot className="h-4 w-4" />,
      tint: "bg-cyan-100 text-cyan-600",
    },
    {
      id: "research",
      label: "Research",
      icon: <Search className="h-4 w-4" />,
      tint: "bg-indigo-100 text-indigo-500",
    },
    {
      id: "cartoonist",
      label: "Cartoonist",
      icon: <Palette className="h-4 w-4" />,
      tint: "bg-orange-100 text-orange-500",
    },
    {
      id: "slides",
      label: "Slides",
      icon: <Presentation className="h-4 w-4" />,
      tint: "bg-amber-100 text-amber-500",
    },
    {
      id: "sheets",
      label: "Sheets",
      icon: <Grid className="h-4 w-4" />,
      tint: "bg-green-100 text-green-500",
    },
    {
      id: "docs",
      label: "Docs",
      icon: <PenSquare className="h-4 w-4" />,
      tint: "bg-blue-100 text-blue-500",
    },
    {
      id: "logo",
      label: "Logo",
      icon: <Bot className="h-4 w-4" />,
      tint: "bg-purple-100 text-purple-500",
    },
  ];

  useEffect(() => {
    const loadAgents = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("agents")
          .select(
            "id, name, author, description, category, price, rating_avg, rating_count, test_score, pricing_model, url"
          );

        if (error) throw new Error(error.message);

        const sorted =
          data?.sort((a, b) => {
            const aRating = (a.rating_avg ?? 0) + (a.rating_count ?? 0) * 0.001;
            const bRating = (b.rating_avg ?? 0) + (b.rating_count ?? 0) * 0.001;
            if (bRating === aRating) {
              return (a.price ?? 0) - (b.price ?? 0);
            }
            return bRating - aRating;
          }) ?? [];

        setAgents(
          sorted.map((agent, index) => ({
            ...agent,
            rank: index + 1,
            rating: agent.rating_avg ?? undefined,
          }))
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load agents";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadAgents();
  }, []);

  const filteredAgents = useMemo(() => {
    if (selectedCategory === "all") return agents;
    return agents.filter((agent) => agent.category === selectedCategory);
  }, [agents, selectedCategory]);

  return (
    <main className="h-full overflow-auto bg-white px-4 text-gray-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold">Agents</h1>
            <p className="text-sm text-gray-600">
              Browse all vetted agents. Filter by category to jump to what you
              need.
            </p>
          </div>
          <Button
            asChild
            className="rounded-full bg-[#2c44fc] px-5 py-2 text-white hover:bg-[#011082]"
            size="lg"
          >
            <Link href="/register">Register</Link>
          </Button>
        </header>

        <CategoryFilters
          selected={selectedCategory}
          onSelect={setSelectedCategory}
          categories={categoriesUI}
        />

        <section className="space-y-3">
          {error ? (
            <p className="text-sm text-red-600">
              Failed to load agents: {error}
            </p>
          ) : loading ? (
            <p className="text-sm text-gray-500">Loading agents...</p>
          ) : filteredAgents.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAgents.map((agent, index) => (
                <AgentCard key={agent.id} agent={agent} rank={index + 1} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No agents found.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function CategoryFilters({
  selected,
  onSelect,
  categories,
}: {
  selected: string;
  onSelect: (value: string) => void;
  categories: {
    id: string;
    label: string;
    icon: React.ReactNode | null;
    tint: string;
  }[];
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {categories.map((category) => {
        const isSelected = category.id === selected;
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            className={`flex min-w-[80px] items-center gap-2 rounded-full px-2 py-1.5 text-sm font-semibold transition ${
              isSelected
                ? "border border-gray-100 bg-gray-50 text-gray-700 shadow-md"
                : "border border-gray-100 text-gray-500 hover:bg-gray-300"
            }`}
          >
            {category.icon ? (
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full ${category.tint}`}
              >
                {category.icon}
              </span>
            ) : null}
            <span>{category.label}</span>
          </button>
        );
      })}
    </div>
  );
}
