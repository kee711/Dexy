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

  const formatContent = (content: string, type: "prompt" | "output") => {
    if (!content) return `(No ${type} captured)`;

    try {
      const parsed = JSON.parse(content);

      // Simplification logic (Try to find the most relevant field)
      if (type === "prompt") {
        if (parsed.query) return parsed.query;
        if (parsed.input) return parsed.input;
        if (parsed.prompt) return parsed.prompt;
        if (parsed.messages) return JSON.stringify(parsed.messages, null, 2);
      } else if (type === "output") {
        if (parsed.normalized?.output) return parsed.normalized.output;
        if (parsed.output) return typeof parsed.output === 'string' ? parsed.output : JSON.stringify(parsed.output, null, 2);
        if (parsed.result) return typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed.result, null, 2);
        if (parsed.results) {
          if (Array.isArray(parsed.results) && parsed.results.length > 0) {
            const first = parsed.results[0];
            return first.snippet || first.title || JSON.stringify(parsed.results, null, 2);
          }
          return JSON.stringify(parsed.results, null, 2);
        }
        if (parsed.content) return parsed.content;
      }

      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  };

  /* Helper to extract image URL from output content if possible */
  const extractImageUrl = (content: string): string | null => {
    try {
      const parsed = JSON.parse(content);
      // Check common fields
      if (parsed.imageUrl) return parsed.imageUrl;
      if (parsed.image) return parsed.image;
      if (parsed.url && (parsed.url.match(/\.(jpeg|jpg|gif|png)$/) != null || parsed.contentType?.startsWith("image/"))) return parsed.url;
      // Check normalized output
      if (parsed.normalized?.image) return parsed.normalized.image;
      // Check result object
      if (parsed.result && typeof parsed.result === 'object') {
        if (parsed.result.imageUrl) return parsed.result.imageUrl;
        if (parsed.result.image) return parsed.result.image;
      }
      return null;
    } catch {
      return null;
    }
  };

  const imageUrl = extractImageUrl(data.output);
  const displayPrompt = formatContent(data.prompt, "prompt");
  const displayOutput = formatContent(data.output, "output");

  return (
    <div
      className={cn(
        "bg-white rounded-xl border-2 shadow-sm w-[400px] transition-all",
        data.isChanged ? "border-amber-400 ring-2 ring-amber-100" : "border-gray-200"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3" />

      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 mr-2 overflow-hidden">
            <h3 className="font-semibold text-gray-900 truncate" title={data.agentName}>{data.agentName}</h3>
            <div className="text-xs text-gray-500 font-mono truncate" title={data.agentUrl}>
              {data.agentUrl}
            </div>
          </div>
          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-gray-100 shadow-sm shrink-0">
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
              <div className="bg-gray-50 rounded-md p-2 text-xs text-gray-700 font-mono overflow-auto max-h-[150px] border border-gray-100 whitespace-pre-wrap break-words">
                {displayPrompt}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Output</div>
              {imageUrl && (
                <div className="mb-2 border border-gray-100 rounded-md overflow-hidden bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Agent Output" className="w-full h-auto object-cover max-h-[300px]" />
                </div>
              )}
              <div className="bg-gray-50 rounded-md p-2 text-xs text-gray-700 font-mono overflow-auto max-h-[200px] border border-gray-100 whitespace-pre-wrap break-words">
                {displayOutput}
              </div>
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3 !h-3" />
    </div>
  );
});
