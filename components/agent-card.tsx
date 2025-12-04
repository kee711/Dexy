import { cn } from "@/lib/utils";
import { Agent } from "@/lib/agents";
import { ImageIcon, Star, UserRound, Wallet } from "lucide-react";

type AgentCardProps = {
  agent: Agent;
  compact?: boolean;
  highlight?: boolean;
  active?: boolean;
  rank?: number;
  onSelect?: () => void;
  onOpen?: () => void;
  note?: string;
};

export function AgentCard({
  agent,
  highlight,
  active,
  rank,
  onSelect,
  onOpen,
  note,
}: AgentCardProps) {
  const ratingValue = agent.rating_avg ?? agent.rating ?? 0;
  const priceValue = agent.price ?? 0;
  const scoreValue =
    agent.score ?? agent.fitness_score ?? agent.similarity ?? 0;
  const normalizedScore = agent.test_score ?? 0;
  const handleClick = () => {
    if (onOpen) onOpen();
    if (onSelect) onSelect();
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex cursor-pointer flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-md",
        highlight && "bg-gray-50",
        active && "bg-gray-200"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
          {rank ? `#${rank}` : agent.rank ? `#${agent.rank}` : "Top pick"}
          <span className="rounded-full bg-white px-2 py-1 text-[11px] text-gray-500">
            Verified run score {normalizedScore.toFixed(1)}
          </span>
        </div>
        {/* {onSelect || onOpen ? (
          <span className="text-[11px] text-[#4B6BFF]">choose</span>
        ) : null} */}
      </div>

      <div className="flex flex-col gap-3">
        {/* <div className="flex h-32 items-center justify-center rounded-lg bg-gray-300">
          <ImageIcon className="h-8 w-8 text-gray-600" />
        </div> */}
        <div className="space-y-1 text-sm">
          <p className="text-base font-semibold">{agent.name}</p>
          <div className="flex items-center gap-2 text-gray-600">
            <UserRound className="h-4 w-4" />
            <span className="text-xs">By {agent.author}</span>
          </div>
          {/* <p className="text-gray-700">{agent.description ?? "No description yet."}</p> */}
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm font-medium text-gray-800">
        <div className="flex items-center gap-1">
          <Wallet className="h-4 w-4" />
          <span>{priceValue.toFixed(3)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 text-amber-500" />
          <span>{ratingValue.toFixed(1)}</span>
        </div>
      </div>

      {note ? <p className="text-sm text-gray-600">{note}</p> : null}
    </div>
  );
}
