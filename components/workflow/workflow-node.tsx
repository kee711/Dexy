import { memo, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { ChevronDown, ChevronRight, Star, Zap, DollarSign, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type WorkflowNodeData = {
  agentName: string;
  agentUrl: string;
  ratingAvg?: number;
  ratingCount?: number;
  price: number;
  latencyMs: number;
  cost: number;
  tokens: number;
  prompt: string;
  output: string;
  timestamp: string;
  isChanged?: boolean; // If this node is different from the comparison session
};

export const WorkflowNode = memo((props: NodeProps<Node<WorkflowNodeData>>) => {
  const { data } = props;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "bg-white rounded-xl border-2 shadow-sm min-w-[300px] transition-all",
        data.isChanged ? "border-amber-400 ring-2 ring-amber-100" : "border-gray-200"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3" />

      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold text-gray-900">{data.agentName}</h3>
            <div className="text-xs text-gray-500 font-mono truncate max-w-[200px]" title={data.agentUrl}>
              {data.agentUrl}
            </div>
          </div>
          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-gray-100 shadow-sm">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-medium text-gray-700">
              {data.ratingAvg ? data.ratingAvg.toFixed(1) : "-"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Cost</span>
            <div className="flex items-center gap-1 text-xs font-medium text-gray-700">
              <DollarSign className="w-3 h-3" />
              {data.cost.toFixed(4)}
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Latency</span>
            <div className="flex items-center gap-1 text-xs font-medium text-gray-700">
              <Clock className="w-3 h-3" />
              {data.latencyMs}ms
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Tokens</span>
            <div className="flex items-center gap-1 text-xs font-medium text-gray-700">
              <Zap className="w-3 h-3" />
              {data.tokens}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 w-full mb-2"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {expanded ? "Hide Details" : "Show Details (Prompt & Output)"}
        </button>

        {expanded && (
          <div className="space-y-3 animation-in fade-in slide-in-from-top-1 duration-200">
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Prompt</div>
              <div className="bg-gray-50 rounded-md p-2 text-xs text-gray-700 font-mono overflow-auto max-h-[100px] border border-gray-100">
                {data.prompt || "(No prompt captured)"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Output</div>
              <div className="bg-gray-50 rounded-md p-2 text-xs text-gray-700 font-mono overflow-auto max-h-[150px] border border-gray-100">
                {data.output || "(No output captured)"}
              </div>
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3 !h-3" />
    </div>
  );
});
