import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  Laptop2,
  Network,
  Terminal,
  Wifi,
  Zap,
  BarChart3,
  Wrench,
  Target,
} from "lucide-react";
import type { AgentStats, CommandParams, ChaosRule } from "@/types/network";
import { ChaosEngineering } from "@/components/ChaosEngineering";
import { TargetRules } from "@/components/TargetRules";
import { cn } from "@/lib/utils";

export interface OtherNode {
  id: string;
  ip?: string;
  hostname: string;
}

interface NodeConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string | null;
  nodeData?: {
    ip?: string;
    os?: string;
    status?: string;
    stats?: AgentStats;
  };
  allNodes?: OtherNode[];
  onCommand: (command: string, params?: CommandParams) => void;
}

export function NodeConfigPanel({
  isOpen,
  onClose,
  nodeId,
  nodeData,
  allNodes = [],
  onCommand,
}: NodeConfigPanelProps) {
  if (!nodeId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden bg-white/95 backdrop-blur-xl border border-slate-200/50 shadow-2xl p-0">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 pb-4 border-b border-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary shadow-lg shadow-primary/25">
                <Laptop2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-lg">{nodeId}</span>
                <DialogDescription className="mt-0.5 text-sm">
                  Configure network, run diagnostics, and view stats
                </DialogDescription>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Node info badges */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-slate-200/50 text-sm">
              <Wifi className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium">{nodeData?.ip || "Unknown"}</span>
            </div>
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border",
                nodeData?.status === "online"
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-slate-50 border-slate-200 text-slate-600",
              )}
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  nodeData?.status === "online"
                    ? "bg-green-500 animate-pulse"
                    : "bg-slate-400",
                )}
              />
              <span className="font-medium">
                {nodeData?.status || "Unknown"}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-slate-200/50 text-sm">
              <span className="text-muted-foreground">{nodeData?.os}</span>
            </div>
          </div>
        </div>

        {/* Tabs content area with scroll */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-160px)]">
          <Tabs defaultValue="chaos" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6 bg-slate-100/80 p-1 rounded-xl">
              <TabsTrigger
                value="chaos"
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-1.5 text-sm"
              >
                <Zap className="w-4 h-4" />
                Global
              </TabsTrigger>
              <TabsTrigger
                value="target"
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-1.5 text-sm"
              >
                <Target className="w-4 h-4" />
                Target
              </TabsTrigger>
              <TabsTrigger
                value="tools"
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-1.5 text-sm"
              >
                <Wrench className="w-4 h-4" />
                Tools
              </TabsTrigger>
              <TabsTrigger
                value="stats"
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-1.5 text-sm"
              >
                <BarChart3 className="w-4 h-4" />
                Stats
              </TabsTrigger>
            </TabsList>

            {/* --- Global Chaos Tab --- */}
            <TabsContent value="chaos" className="space-y-4 mt-0">
              <ChaosEngineering
                nodeId={nodeId}
                onApplyRules={(rules: ChaosRule[]) => {
                  onCommand("chaos_control", { rules });
                }}
              />
            </TabsContent>

            {/* --- Target Rules Tab --- */}
            <TabsContent value="target" className="space-y-4 mt-0">
              <TargetRules
                nodeId={nodeId}
                availableNodes={allNodes}
                onApplyRules={(rules: ChaosRule[]) => {
                  onCommand("chaos_control", { rules });
                }}
              />
            </TabsContent>

            {/* --- Tools Tab --- */}
            <TabsContent value="tools" className="space-y-4 mt-0">
              <div className="grid gap-3">
                <div className="p-4 border rounded-xl hover:bg-slate-50/80 transition-all duration-200 hover:shadow-sm group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold flex items-center gap-2 text-base">
                      <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                        <Network className="w-4 h-4 text-green-600" />
                      </div>
                      <span>Ping Check</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onCommand("ping", { target: "8.8.8.8" })}
                      className="hover:bg-green-50 hover:border-green-300"
                    >
                      Run Ping
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground pl-10">
                    Sends 4 ICMP packets to Google DNS (8.8.8.8)
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* --- Stats Tab --- */}
            <TabsContent value="stats" className="space-y-4 mt-0">
              {!nodeData?.stats ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Activity className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-base">No live stats available</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-3">
                    {/* CPU */}
                    <div className="p-4 border rounded-xl bg-gradient-to-br from-blue-50/50 to-transparent">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-base font-medium text-muted-foreground">
                          CPU Usage
                        </span>
                        <span className="text-2xl font-bold text-blue-600">
                          {nodeData.stats.system?.cpu_percent}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500 rounded-full"
                          style={{
                            width: `${nodeData.stats.system?.cpu_percent}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Memory */}
                    <div className="p-4 border rounded-xl bg-gradient-to-br from-purple-50/50 to-transparent">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-base font-medium text-muted-foreground">
                            Memory Usage
                          </span>
                          <p className="text-sm text-muted-foreground">
                            {(
                              nodeData.stats.system?.memory?.used /
                              1024 /
                              1024
                            ).toFixed(0)}{" "}
                            MB Used
                          </p>
                        </div>
                        <span className="text-2xl font-bold text-purple-600">
                          {nodeData.stats.system?.memory?.percent}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-400 to-purple-600 transition-all duration-500 rounded-full"
                          style={{
                            width: `${nodeData.stats.system?.memory?.percent}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Disk */}
                    <div className="p-4 border rounded-xl bg-gradient-to-br from-amber-50/50 to-transparent">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-base font-medium text-muted-foreground">
                          Disk Usage
                        </span>
                        <span className="text-2xl font-bold text-amber-600">
                          {nodeData.stats.system?.disk?.percent}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500 rounded-full"
                          style={{
                            width: `${nodeData.stats.system?.disk?.percent}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
