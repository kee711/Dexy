"use client";

import { useEffect, useState } from "react";
import { WorkflowGraph } from "@/components/workflow/workflow-graph";
import { WorkflowSidebar } from "@/components/workflow/workflow-sidebar";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function WorkflowPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch history
  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch("/api/workflow/history");
        if (res.ok) {
          const data = await res.json();
          setSessions(data.sessions || []);
          if (data.sessions && data.sessions.length > 0) {
            setSelectedSessionId(data.sessions[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch workflow history", error);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || null;

  // Find previous session for comparison (simple heuristic: previous index)
  const selectedIndex = sessions.findIndex((s) => s.id === selectedSessionId);
  const compareSession = selectedIndex !== -1 && selectedIndex < sessions.length - 1
    ? sessions[selectedIndex + 1]
    : undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden border border-gray-200 rounded-xl shadow-sm bg-white">
      <WorkflowSidebar
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        onSelectSession={setSelectedSessionId}
      />
      <div className="flex-1 flex flex-col relative h-full">
        {!selectedSession ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            Select a session to view workflow
          </div>
        ) : (
          <>
            <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 border shadow-sm">
              Showing Session: {selectedSessionId}
              {compareSession && <span className="text-amber-600 ml-1">(Comparing with {compareSession.id})</span>}
            </div>
            <WorkflowGraph session={selectedSession} compareSession={compareSession} />
          </>
        )}
      </div>
    </div>
  );
}
