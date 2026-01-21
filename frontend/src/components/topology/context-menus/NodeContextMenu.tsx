import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { CommandParams } from "@/types/network";

interface NodeContextMenuProps {
  children: React.ReactNode;
  nodeId: string;
  onAction: (action: string, nodeId: string, params?: CommandParams) => void;
}

export function NodeContextMenu({ children, nodeId, onAction }: NodeContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem inset onClick={() => onAction("details", nodeId)}>
          Voir les détails
        </ContextMenuItem>
        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger inset>Diagnostics Réseau</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem
              onClick={() => onAction("ping", nodeId, { target: "8.8.8.8", count: 4 })}
            >
              Ping 8.8.8.8
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onAction("traceroute", nodeId, { target: "8.8.8.8" })}>
              Traceroute 8.8.8.8
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onAction("list_connections", nodeId)}>
              Lister Connexions
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger inset>Statistiques</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem onClick={() => onAction("get_network_stats", nodeId)}>
              Stats Réseau
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onAction("get_system_stats", nodeId)}>
              Stats Système
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuSub>
            <ContextMenuSubTrigger inset>Contrôle de Trafic</ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
                <ContextMenuItem onClick={() => onAction("reset_traffic", nodeId)}>
                    Réinitialiser (Reset)
                </ContextMenuItem>
                <ContextMenuSeparator />
                
                {/* Bandwidth */}
                <ContextMenuSub>
                    <ContextMenuSubTrigger>Bande Passante</ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                        <ContextMenuItem onClick={() => onAction("bandwidth", nodeId, { limit: "1mbit" })}>1 Mbit/s</ContextMenuItem>
                        <ContextMenuItem onClick={() => onAction("bandwidth", nodeId, { limit: "10mbit" })}>10 Mbit/s</ContextMenuItem>
                        <ContextMenuItem onClick={() => onAction("bandwidth", nodeId, { limit: "100mbit" })}>100 Mbit/s</ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => {
                            const val = window.prompt("Limite (ex: 500kbit, 5mbit):", "5mbit");
                            if(val) onAction("bandwidth", nodeId, { limit: val });
                        }}>Personnalisé...</ContextMenuItem>
                    </ContextMenuSubContent>
                </ContextMenuSub>

                {/* Latency */}
                <ContextMenuSub>
                    <ContextMenuSubTrigger>Latence</ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                        <ContextMenuItem onClick={() => onAction("latency", nodeId, { delay: "20ms" })}>20ms</ContextMenuItem>
                        <ContextMenuItem onClick={() => onAction("latency", nodeId, { delay: "100ms" })}>100ms</ContextMenuItem>
                        <ContextMenuItem onClick={() => onAction("latency", nodeId, { delay: "500ms" })}>500ms</ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => {
                            const val = window.prompt("Délai (ex: 50ms):", "50ms");
                            if(val) onAction("latency", nodeId, { delay: val });
                        }}>Personnalisé...</ContextMenuItem>
                    </ContextMenuSubContent>
                </ContextMenuSub>

                {/* Packet Loss */}
                <ContextMenuSub>
                    <ContextMenuSubTrigger>Perte de Paquets</ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                        <ContextMenuItem onClick={() => onAction("loss", nodeId, { loss: "1%" })}>1%</ContextMenuItem>
                        <ContextMenuItem onClick={() => onAction("loss", nodeId, { loss: "5%" })}>5%</ContextMenuItem>
                        <ContextMenuItem onClick={() => onAction("loss", nodeId, { loss: "10%" })}>10%</ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => {
                            const val = window.prompt("Perte (ex: 2%):", "2%");
                            if(val) onAction("loss", nodeId, { loss: val });
                        }}>Personnalisé...</ContextMenuItem>
                    </ContextMenuSubContent>
                </ContextMenuSub>

            </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger inset>Iperf Server</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem onClick={() => onAction("start_iperf_server", nodeId, { port: 5201 })}>
              Démarrer Serveur
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onAction("stop_iperf", nodeId)}>
              Arrêter Serveur
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
}
