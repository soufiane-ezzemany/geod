import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server } from "lucide-react";
import { useSocket } from "@/context/socket-context";
import { apiService } from "@/services/api.service";
import { apiLogger } from "@/lib/logger";
import type { AgentInfo } from "@/types/network";

export default function Nodes() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const { socket } = useSocket();

  useEffect(() => {
    // Initial Fetch using API service
    apiService
      .getAgents()
      .then((data) => setAgents(data))
      .catch((err) => apiLogger.error("Failed to fetch agents:", err));

    if (!socket) return;

    const handleAgentConnected = (newAgent: AgentInfo) => {
      setAgents((prev) => {
        if (prev.find((a) => a.hostname === newAgent.hostname)) return prev;
        return [...prev, newAgent];
      });
    };

    const handleAgentDisconnected = (data: { hostname: string }) => {
      setAgents((prev) => prev.filter((a) => a.hostname !== data.hostname));
    };

    socket.on("agent_connected", handleAgentConnected);
    socket.on("agent_disconnected", handleAgentDisconnected);

    return () => {
      socket.off("agent_connected", handleAgentConnected);
      socket.off("agent_disconnected", handleAgentDisconnected);
    };
  }, [socket]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nodes</h1>
        <p className="text-muted-foreground">
          List of connected agents ({agents.length})
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <Card key={agent.sid}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {agent.hostname}
              </CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{agent.ip_address}</div>
              <p className="text-xs text-muted-foreground mb-2">{agent.os}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  variant="outline"
                  className="bg-green-50 text-green-700 border-green-200"
                >
                  Online
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  Since: {new Date(agent.connected_at).toLocaleTimeString()}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {agents.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          No agents connected. Run an agent with `python agent.py`.
        </div>
      )}
    </div>
  );
}
