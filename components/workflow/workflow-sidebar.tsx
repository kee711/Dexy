"use client";

import { cn } from "@/lib/utils";
import { format } from "date-fns";

type WorkflowSidebarProps = {
  sessions: any[];
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
};

export function WorkflowSidebar({
  sessions,
  selectedSessionId,
  onSelectSession,
}: WorkflowSidebarProps) {
  return (
    <div className="w-64 border-r border-gray-200 bg-white flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">History</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No history found.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sessions.map((session) => {
              const date = new Date(session.startTime);
              const isSelected = session.id === selectedSessionId;

              const stepCount = session.logs.length;
              const uniqueAgents = new Set(session.logs.map((l: any) => l.agent_id)).size;
              const totalCost = session.logs.reduce((sum: number, l: any) => sum + (l.cost || 0), 0);

              return (
                <button
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={cn(
                    "w-full text-left p-4 hover:bg-gray-50 transition-colors focus:outline-none",
                    isSelected ? "bg-blue-50 hover:bg-blue-50 border-r-2 border-blue-500" : ""
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {format(date, "MMM d, HH:mm")}
                    </span>
                    {totalCost > 0 && (
                      <span className="text-xs font-mono text-gray-500">
                        ${totalCost.toFixed(3)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {stepCount} steps • {uniqueAgents} agents
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
