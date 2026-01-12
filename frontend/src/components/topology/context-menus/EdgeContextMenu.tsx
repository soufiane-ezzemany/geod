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
import { toast } from "sonner";

interface EdgeContextMenuProps {
  children: React.ReactNode;
  edgeId: string;
  source: string;
  target: string;
  onAction: (action: string, edgeId: string, source: string, target: string, params?: unknown) => void;
}

export function EdgeContextMenu({
  children,
  edgeId,
  source,
  target,
  onAction,
}: EdgeContextMenuProps) {
  
  const handleAction = (action: string, params: any = {}) => {
      if (onAction) {
          onAction(action, edgeId, source, target, params);
      } else {
          toast.error("Action indisponible");
      }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        
        <ContextMenuSub>
            <ContextMenuSubTrigger inset>Contrôle de Trafic</ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
                <ContextMenuItem inset onClick={() => handleAction("reset_traffic")}>
                    Réinitialiser (Reset)
                </ContextMenuItem>
                <ContextMenuSeparator />
                
                {/* Bandwidth */}
                <ContextMenuSub>
                    <ContextMenuSubTrigger>Bande Passante</ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                        <ContextMenuItem onClick={() => handleAction("bandwidth", { limit: "1mbit" })}>1 Mbit/s</ContextMenuItem>
                        <ContextMenuItem onClick={() => handleAction("bandwidth", { limit: "10mbit" })}>10 Mbit/s</ContextMenuItem>
                        <ContextMenuItem onClick={() => handleAction("bandwidth", { limit: "100mbit" })}>100 Mbit/s</ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => {
                            const val = window.prompt("Limite (ex: 500kbit, 5mbit):", "5mbit");
                            if(val) handleAction("bandwidth", { limit: val });
                        }}>Personnalisé...</ContextMenuItem>
                    </ContextMenuSubContent>
                </ContextMenuSub>

                {/* Latency */}
                <ContextMenuSub>
                    <ContextMenuSubTrigger>Latence</ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                        <ContextMenuItem onClick={() => handleAction("latency", { delay: "20ms" })}>20ms</ContextMenuItem>
                        <ContextMenuItem onClick={() => handleAction("latency", { delay: "100ms" })}>100ms</ContextMenuItem>
                        <ContextMenuItem onClick={() => handleAction("latency", { delay: "500ms" })}>500ms</ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => {
                            const val = window.prompt("Délai (ex: 50ms):", "50ms");
                            if(val) handleAction("latency", { delay: val });
                        }}>Personnalisé...</ContextMenuItem>
                    </ContextMenuSubContent>
                </ContextMenuSub>

                {/* Packet Loss */}
                <ContextMenuSub>
                    <ContextMenuSubTrigger>Perte de Paquets</ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                        <ContextMenuItem onClick={() => handleAction("loss", { loss: "1%" })}>1%</ContextMenuItem>
                        <ContextMenuItem onClick={() => handleAction("loss", { loss: "5%" })}>5%</ContextMenuItem>
                        <ContextMenuItem onClick={() => handleAction("loss", { loss: "10%" })}>10%</ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => {
                            const val = window.prompt("Perte (ex: 2%):", "2%");
                            if(val) handleAction("loss", { loss: val });
                        }}>Personnalisé...</ContextMenuItem>
                    </ContextMenuSubContent>
                </ContextMenuSub>

            </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem inset onClick={() => handleAction("iperf", { duration: 10 })}>
            Lancer Iperf (10s)
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          inset
          className="text-red-600 focus:text-red-600"
          onClick={() => handleAction("disconnect")}
        >
          Déconnecter
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
