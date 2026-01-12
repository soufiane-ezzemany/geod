import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Server } from "lucide-react"
import { API_ENDPOINTS } from "@/config"

interface Agent {
    sid: string;
    hostname: string;
    ip_address: string;
    os: string;
    connected_at: string;
    last_heartbeat: string;
}

export default function Nodes() {
    const [agents, setAgents] = useState<Agent[]>([]);

    useEffect(() => {
        fetch(API_ENDPOINTS.agents)
            .then(res => res.json())
            .then(data => setAgents(data))
            .catch(err => console.error("Failed to fetch agents:", err));
    }, []);

    return (
        <div className="space-y-6 p-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Nœuds</h1>
                <p className="text-muted-foreground">
                    Liste des agents connectés ({agents.length})
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
                            <p className="text-xs text-muted-foreground mb-2">
                                {agent.os}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Connecté
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                    Dep: {new Date(agent.connected_at).toLocaleTimeString()}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
            
            {agents.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                    Aucun agent connecté. Lancez un agent avec `python agent.py`.
                </div>
            )}
        </div>
    )
}