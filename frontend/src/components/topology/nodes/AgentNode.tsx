import { Badge } from "@/components/ui/badge";
import { Server, Wifi, MonitorCheck } from "lucide-react";
import { memo } from "react";
import { Handle, Position } from "reactflow";
import type { AgentStats } from "@/types/network";

interface AgentNodeData {
  label: string;
  ip: string;
  os: string;
  status?: string;
  stats: AgentStats | null;
  highlight?: boolean;
  highlightHandle?: "source" | "target";
  [key: string]: unknown;
}

const AgentNode = ({ data }: { data: AgentNodeData }) => {
  return (
    <div
      className={`relative transition-shadow ${data?.highlight ? "shadow-lg" : ""}`}
      style={{ minWidth: 160 }}
    >
      <div
        className={`w-44 rounded-lg border-2 bg-white/95 backdrop-blur p-2.5 shadow-sm ${
          data?.highlightHandle === "target"
            ? "border-green-300 ring-2 ring-offset-1 ring-green-300"
            : data?.highlightHandle === "source"
              ? "border-amber-300 ring-2 ring-offset-1 ring-amber-300"
              : "border-slate-200"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Server className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs font-bold truncate">{data.label}</span>
          </div>
          <Badge
            variant="outline"
            className={`text-[9px] h-4 px-1.5 shrink-0 ${
              data.status === "online"
                ? "bg-green-500/15 text-green-600 border-green-300"
                : "bg-slate-500/10 text-slate-500 border-slate-200"
            }`}
          >
            {data.status === "online" ? "Online" : "Offline"}
          </Badge>
        </div>

        {/* Info */}
        <div className="mt-1.5 text-[10px] text-muted-foreground space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-2.5 h-2.5" />
            <span>{data.ip}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MonitorCheck className="w-2.5 h-2.5" />
            <span>{data.os}</span>
          </div>
        </div>

        {/* Compact Stats Row */}
        {data.stats && (
          <div className="mt-2 pt-1.5 border-t border-slate-100 flex justify-between text-[9px]">
            <div className="text-center">
              <div className="font-semibold text-slate-600">CPU</div>
              <div className="text-muted-foreground">
                {data.stats.system?.cpu_percent}%
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-slate-600">RAM</div>
              <div className="text-muted-foreground">
                {data.stats.system?.memory?.percent}%
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-slate-600">Disk</div>
              <div className="text-muted-foreground">
                {data.stats.system?.disk?.percent}%
              </div>
            </div>
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="opacity-0 pointer-events-none w-1 h-1"
        style={{ visibility: "hidden" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="opacity-0 pointer-events-none w-1 h-1"
        style={{ visibility: "hidden" }}
      />
    </div>
  );
};

export default memo(AgentNode);
