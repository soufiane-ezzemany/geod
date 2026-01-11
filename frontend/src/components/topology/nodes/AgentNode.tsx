import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonitorCheck, Server, Wifi } from "lucide-react";
import { memo } from "react";
import { Handle, Position } from "reactflow";

const AgentNode = ({ data, id }: { data: any; id: string }) => {
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
              className="text-[10px] h-5 bg-green-500/10 text-green-600 border-green-200"
            >
              Online
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
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-foreground">CPU</span>
                  <span>{data.stats.system?.cpu_percent}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-foreground">RAM</span>
                  <span>{data.stats.system?.memory?.percent}%</span>
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
        className={`w-4 h-4 ${
          data?.highlightHandle === "target"
            ? "bg-lime-500"
            : data?.highlightHandle === "source"
            ? "bg-fuchsia-500"
            : "bg-sky-600"
        } rounded-full ring-2 ring-white hover:scale-110 transition-transform cursor-pointer z-50 ${
          data?.highlightHandle === "target" ? "ring-4 ring-lime-300 scale-110 handle-pulse" : ""
        }`}
        style={{
          boxSizing: "content-box",
          width: 14,
          height: 14,
          borderRadius: 8,
          transform: "translateX(-2px)",
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className={`w-4 h-4 ${
          data?.highlightHandle === "source"
            ? "bg-fuchsia-500"
            : data?.highlightHandle === "target"
            ? "bg-lime-500"
            : "bg-sky-600"
        } rounded-full ring-2 ring-white hover:scale-110 transition-transform cursor-pointer z-50 ${
          data?.highlightHandle === "source" ? "ring-4 ring-fuchsia-300 scale-110 handle-pulse" : ""
        }`}
        style={{
          boxSizing: "content-box",
          width: 14,
          height: 14,
          borderRadius: 8,
          transform: "translateX(2px)",
        }}
      />
    </div>
  );
};

export default memo(AgentNode);
