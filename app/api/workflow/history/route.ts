import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Fetch usage history for the user
  const { data: usageData, error: usageError } = await supabase
    .from("api_key_usage")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (usageError) {
    console.error("Failed to fetch api_key_usage:", usageError);
    return NextResponse.json({ error: usageError.message }, { status: 500 });
  }

  if (!usageData || usageData.length === 0) {
    return NextResponse.json({ sessions: [] });
  }

  // 2. Fetch related agents
  const agentIds = Array.from(new Set(usageData.map((row) => row.agent_id)));

  let agentsMap: Record<string, any> = {};

  if (agentIds.length > 0) {
    const { data: agentsData, error: agentsError } = await supabase
      .from("agents")
      .select("id, name, category, pricing_model, price, rating_avg, rating_count, url")
      .in("id", agentIds);

    if (agentsError) {
      console.warn("Failed to fetch agents:", agentsError);
      // Not a fatal error, just missing agent details
    } else if (agentsData) {
      agentsMap = agentsData.reduce((acc, agent) => {
        acc[agent.id] = agent;
        return acc;
      }, {} as Record<string, any>);
    }
  }

  // 3. Define Session Logic (Grouping)
  // Simple heuristic: If the time difference between two logs is > 60 seconds, it's a new session.
  // Note: usageData is ordered by created_at DESC (newest first).

  const sessions: any[] = [];
  let currentSession: any[] = [];

  // Iterate in reverse (chronological order) to build sessions more naturally? 
  // No, let's just iterate DESC and group.

  const sortedHistory = [...usageData].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let lastTime = 0;
  const SESSION_THRESHOLD_MS = 60 * 1000; // 60 seconds

  for (const log of sortedHistory) {
    const logTime = new Date(log.created_at).getTime();

    if (lastTime > 0 && logTime - lastTime > SESSION_THRESHOLD_MS) {
      // New session started
      if (currentSession.length > 0) {
        sessions.push({
          id: `session-${sessions.length + 1}`,
          startTime: currentSession[0].created_at,
          logs: currentSession,
        });
      }
      currentSession = [];
    }

    // Attach agent details to log
    const agent = agentsMap[log.agent_id] || null;
    currentSession.push({
      ...log,
      agent,
    });

    lastTime = logTime;
  }

  // Push the last session
  if (currentSession.length > 0) {
    sessions.push({
      id: `session-${sessions.length + 1}`,
      startTime: currentSession[0].created_at,
      logs: currentSession,
    });
  }

  // Return sessions (reverse order: newest session first)
  return NextResponse.json({
    sessions: sessions.reverse()
  });
}
