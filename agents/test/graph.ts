import "dotenv/config";
import { StateGraph, END, START } from "@langchain/langgraph";

import { AgentTestGraphState, AgentInfo, AgentTestResult } from "./types";

import { generateTestsNode } from "./nodes/generateTests";
import { callApiNode } from "./nodes/callApi";
import { basicChecksNode } from "./nodes/basicChecks";
import { llmJudgeNode } from "./nodes/llmJudge";
import { aggregateNode } from "./nodes/aggregate";

export function buildAgentTestGraph() {
  const graph = new StateGraph(AgentTestGraphState)
    .addNode("generate_tests", generateTestsNode)
    .addNode("call_api", callApiNode)
    .addNode("basic_checks", basicChecksNode)
    .addNode("unified_judge", llmJudgeNode)
    .addNode("aggregate", aggregateNode)
    .addEdge(START, "generate_tests")
    .addEdge("generate_tests", "call_api")
    .addEdge("call_api", "basic_checks")
    .addEdge("basic_checks", "unified_judge")
    .addEdge("unified_judge", "aggregate")
    .addEdge("aggregate", END);

  return graph.compile();
}

export async function runAgentTestWithGraph(
  agent: AgentInfo
): Promise<AgentTestResult | undefined> {
  const compiled = buildAgentTestGraph();

  const finalState = await compiled.invoke({
    agent,
    queries: [],
    rawResponses: [],
    basicChecks: [],
    judgeEvals: [],
    finalResult: undefined,
  });

  return finalState.finalResult;
}
