"use client";

import { useMemo, useEffect } from "react";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Node,
  Edge,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { WorkflowNode } from "./workflow-node";

type WorkflowGraphProps = {
  session: any;
  compareSession?: any; // For future diff implementation
};

const nodeTypes = {
  workflowNode: WorkflowNode,
};

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 320;
  const nodeHeight = 200; // Estimated height

  dagreGraph.setGraph({ rankdir: "TB" });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export function WorkflowGraph({ session, compareSession }: WorkflowGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (!session || !session.logs) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Sort logs by time ascending just in case
    const sortedLogs = [...session.logs].sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const newNodes: Node[] = sortedLogs.map((log: any, index: number) => {
      // Check for changes if compareSession exists
      let isChanged = false;
      if (compareSession && compareSession.logs[index]) {
        if (compareSession.logs[index].agent_id !== log.agent_id) {
          isChanged = true;
        }
      }

      return {
        id: log.id,
        type: "workflowNode",
        data: {
          agentName: log.agent?.name || "Unknown Agent",
          agentUrl: log.agent?.url || "N/A",
          ratingAvg: log.agent?.rating_avg,
          ratingCount: log.agent?.rating_count,
          price: log.amount,
          latencyMs: log.latency_ms,
          cost: log.cost,
          tokens: log.tokens,
          prompt: log.meta?.prompt,
          output: log.meta?.output,
          timestamp: log.created_at,
          isChanged,
        },
        position: { x: 0, y: 0 }, // Will be set by layout
      };
    });

    const newEdges: Edge[] = [];
    for (let i = 0; i < sortedLogs.length - 1; i++) {
      newEdges.push({
        id: `e${sortedLogs[i].id}-${sortedLogs[i + 1].id}`,
        source: sortedLogs[i].id,
        target: sortedLogs[i + 1].id,
        animated: true,
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      });
    }

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      newNodes,
      newEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [session, compareSession, setNodes, setEdges]);

  return (
    <div className="flex-1 h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
      >
        <Background gap={16} size={1} color="#e2e8f0" />
        <Controls />
        <MiniMap zoomable pannable />
      </ReactFlow>
    </div>
  );
}
