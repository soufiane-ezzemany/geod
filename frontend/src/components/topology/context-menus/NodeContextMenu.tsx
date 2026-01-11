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

interface NodeContextMenuProps {
  children: React.ReactNode;
  nodeId: string;
  onAction: (action: string, nodeId: string, params?: any) => void;
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
