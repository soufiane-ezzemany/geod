import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HardDrive, MonitorCheck, Server, Wifi } from "lucide-react";
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
  [key: string]: unknown; // Allow for other ReactFlow data props if any
}

const AgentNode = ({ data }: { data: AgentNodeData }) => {
  return (
    <div
      className={`relative transition-shadow ${data?.highlight ? "shadow-lg" : ""}`}
      style={{ minWidth: 220 }}
    >
      <Card
        className={`w-64 border-2 bg-background/95 backdrop-blur ${
          data?.highlightHandle === "target"
            ? "border-green-200 ring-2 ring-offset-2 ring-green-300"
            : data?.highlightHandle === "source"
            ? "border-amber-200 ring-2 ring-offset-2 ring-amber-300"
            : "border-primary/20"
        }`}
      >
        <CardHeader className="p-3 pb-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              {data.label}
            </CardTitle>
            <Badge
              variant="outline"
              className={`text-[10px] h-5 ${
                data.status === "online"
                  ? "bg-green-500/10 text-green-600 border-green-200"
                  : "bg-slate-500/10 text-slate-600 border-slate-200"
              }`}
            >
              {data.status === "online" ? "Online" : "Offline"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-2 text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-2">
            <Wifi className="w-3 h-3" />
            <span>{data.ip}</span>
          </div>
          <div className="flex items-center gap-2">
            <MonitorCheck className="w-3 h-3" />
            <span>{data.os}</span>
          </div>
          <div className="mt-2 pt-2 border-t">
            <div className="text-[10px] font-semibold">Détails</div>
            {data.stats ? (
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-foreground">CPU</span>
                  <span>{data.stats.system?.cpu_percent}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-foreground">RAM</span>
                  <span>{data.stats.system?.memory?.percent}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-foreground flex items-center gap-1">
                    <HardDrive className="w-3 h-3" /> Disk
                  </span>
                  <span>{data.stats.system?.disk?.percent}%</span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground mt-1">
                Aucune statistique disponible
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Handle
        type="target"
        position={Position.Top}
        className="opacity-0 pointer-events-none w-1 h-1"
        style={{
          visibility: 'hidden'
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="opacity-0 pointer-events-none w-1 h-1"
        style={{
            visibility: 'hidden'
        }}
      />
    </div>
  );
};

export default memo(AgentNode);
