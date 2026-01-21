import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    Activity, 
    ArrowRightLeft, 
    Gauge, 
    Laptop2, 
    Network, 
    Terminal, 
    Trash2,
    Wifi
} from "lucide-react";
import { useState } from "react";
import type { CommandParams } from "@/types/network";

interface NodeConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string | null;
  nodeData?: {
    ip?: string;
    os?: string;
    status?: string;
    stats?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  onCommand: (command: string, params?: CommandParams) => void;
}

export function NodeConfigPanel({
  isOpen,
  onClose,
  nodeId,
  nodeData,
  onCommand,
}: NodeConfigPanelProps) {
  // Traffic Control State
  const [bandwidth, setBandwidth] = useState("");
  const [latency, setLatency] = useState("");
  const [loss, setLoss] = useState("");

  if (!nodeId) return null;

  const handleApplyTraffic = () => {
    if (bandwidth) onCommand("bandwidth", { limit: bandwidth });
    if (latency) onCommand("latency", { delay: latency });
    if (loss) onCommand("loss", { loss: loss });
  };

  const handleResetTraffic = () => {
    onCommand("reset_traffic");
    setBandwidth("");
    setLatency("");
    setLoss("");
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Laptop2 className="w-5 h-5 text-primary" />
            {nodeId}
          </SheetTitle>
          <SheetDescription>
            Configure network interface, run diagnostics, and view real-time statistics.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground border p-3 rounded-lg bg-slate-50">
            <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4" />
                {nodeData?.ip || "Unknown IP"}
            </div>
            <div className="w-px h-4 bg-slate-300" />
            <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                {nodeData?.status || "Unknown Status"}
            </div>
             <div className="w-px h-4 bg-slate-300" />
             <div>{nodeData?.os}</div>
        </div>

        <Tabs defaultValue="traffic" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="traffic">Traffic Control</TabsTrigger>
            <TabsTrigger value="tools">Diagnostics</TabsTrigger>
            <TabsTrigger value="stats">System Stats</TabsTrigger>
          </TabsList>

          {/* --- Traffic Control Tab --- */}
          <TabsContent value="traffic" className="space-y-6">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-blue-500" />
                        Interface Constraints (eth0)
                    </h3>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={handleResetTraffic}
                    >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Reset All
                    </Button>
                </div>
                
                <div className="grid gap-4 p-4 border rounded-lg bg-card shadow-sm">
                    <div className="grid gap-2">
                        <Label htmlFor="bandwidth">Bandwidth Limit</Label>
                        <Input 
                            id="bandwidth" 
                            placeholder="e.g. 10mbit, 500kbit" 
                            value={bandwidth}
                            onChange={(e) => setBandwidth(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground">Limits outgoing capacity.</p>
                    </div>
                    
                    <div className="grid gap-2">
                        <Label htmlFor="latency">Added Latency</Label>
                        <Input 
                            id="latency" 
                            placeholder="e.g. 50ms, 100ms" 
                            value={latency}
                            onChange={(e) => setLatency(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground">Adds artificial delay to packets.</p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="loss">Packet Loss</Label>
                        <Input 
                            id="loss" 
                            placeholder="e.g. 1%, 5%" 
                            value={loss}
                            onChange={(e) => setLoss(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground">Randomly drops percentage of packets.</p>
                    </div>

                    <Button className="mt-2" onClick={handleApplyTraffic}>
                        <ArrowRightLeft className="w-4 h-4 mr-2" />
                        Apply Rules
                    </Button>
                </div>
            </div>
          </TabsContent>

          {/* --- Tools Tab --- */}
          <TabsContent value="tools" className="space-y-6">
             <div className="grid gap-4">
                <div className="p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold flex items-center gap-2">
                            <Network className="w-4 h-4 text-green-600" /> Ping Check
                        </div>
                        <Button size="sm" variant="outline" onClick={() => onCommand("ping", { target: "8.8.8.8" })}>Run Ping</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Sends 4 ICMP packets to Google DNS (8.8.8.8) to check basic connectivity.
                    </p>
                </div>

                <div className="p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold flex items-center gap-2">
                            <Terminal className="w-4 h-4 text-amber-600" /> Traceroute
                        </div>
                        <Button size="sm" variant="outline" onClick={() => onCommand("traceroute", { target: "8.8.8.8" })}>Run Trace</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Maps the route packets take to reach 8.8.8.8.
                    </p>
                </div>

                <div className="p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold flex items-center gap-2">
                            <Activity className="w-4 h-4 text-purple-600" /> Iperf Server
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => onCommand("stop_iperf")}>Stop</Button>
                            <Button size="sm" onClick={() => onCommand("start_iperf_server")}>Start</Button>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Starts an Iperf3 server on port 5201 to allow other nodes to test bandwidth against this node.
                    </p>
                </div>
             </div>
          </TabsContent>

          {/* --- Stats Tab --- */}
          <TabsContent value="stats" className="space-y-4">
             {!nodeData?.stats ? (
                 <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                     <Activity className="w-8 h-8 mb-2 opacity-20" />
                     No live stats available.
                 </div>
             ) : (
                 <div className="grid gap-4">
                     {/* CPU */}
                     <div className="p-4 border rounded-lg bg-card">
                         <div className="text-sm font-medium text-muted-foreground mb-1">CPU Usage</div>
                         <div className="text-2xl font-bold">{nodeData.stats.system?.cpu_percent}%</div>
                         <div className="w-full bg-slate-100 h-2 mt-2 rounded-full overflow-hidden">
                             <div 
                                className="h-full bg-blue-500 transition-all duration-500" 
                                style={{ width: `${nodeData.stats.system?.cpu_percent}%` }} 
                             />
                         </div>
                     </div>

                     {/* Memory */}
                     <div className="p-4 border rounded-lg bg-card">
                         <div className="text-sm font-medium text-muted-foreground mb-1">Memory Usage</div>
                         <div className="text-2xl font-bold">{nodeData.stats.system?.memory?.percent}%</div>
                         <div className="text-xs text-muted-foreground mt-1">
                             {(nodeData.stats.system?.memory?.used / 1024 / 1024).toFixed(0)} MB Used
                         </div>
                         <div className="w-full bg-slate-100 h-2 mt-2 rounded-full overflow-hidden">
                             <div 
                                className="h-full bg-purple-500 transition-all duration-500" 
                                style={{ width: `${nodeData.stats.system?.memory?.percent}%` }} 
                             />
                         </div>
                     </div>
                     
                     {/* Disk */}
                     <div className="p-4 border rounded-lg bg-card">
                         <div className="text-sm font-medium text-muted-foreground mb-1">Disk Usage</div>
                         <div className="text-2xl font-bold">{nodeData.stats.system?.disk?.percent}%</div>
                         <div className="w-full bg-slate-100 h-2 mt-2 rounded-full overflow-hidden">
                             <div 
                                className="h-full bg-amber-500 transition-all duration-500" 
                                style={{ width: `${nodeData.stats.system?.disk?.percent}%` }} 
                             />
                         </div>
                     </div>
                 </div>
             )}
             <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => onCommand("get_system_stats")}>
                    Refresh Stats
                </Button>
             </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
