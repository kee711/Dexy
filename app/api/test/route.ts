import { NextRequest, NextResponse } from "next/server";
import { runAgentTestWithGraph } from "@/agents/test/graph";
import { AgentInfoSchema } from "@/agents/test/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ParsedAgentInfo = AgentInfoSchema.omit({ id: true });
    const parsed = ParsedAgentInfo.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          issues: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const agent = parsed.data;

    const testResult = await runAgentTestWithGraph(agent);

    if (!testResult) {
      return NextResponse.json(
        { error: "Test failed: no result from graph" },
        { status: 500 }
      );
    }

    return NextResponse.json({ agent, testResult });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: "Internal server error", detail: e?.message },
      { status: 500 }
    );
  }
}
