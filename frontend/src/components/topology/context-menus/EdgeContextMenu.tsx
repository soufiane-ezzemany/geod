import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { toast } from "sonner";
import type { CommandParams, TopologyLink } from "@/types/network";

interface EdgeContextMenuProps {
  children: React.ReactNode;
  edgeId: string;
  source: string;
  target: string;
  data?: { forward?: TopologyLink; backward?: TopologyLink };
  onAction: (action: string, edgeId: string, source: string, target: string, params?: CommandParams) => void;
}

export function EdgeContextMenu({
  children,
  edgeId,
  source,
  target,
  data,
  onAction,
}: EdgeContextMenuProps) {
  
  const handleAction = (actionSource: string, actionTarget: string, action: string, params: CommandParams = {}) => {
      if (onAction) {
          onAction(action, edgeId, actionSource, actionTarget, params);
      } else {
          toast.error("Action indisponible");
      }
  };

  const renderDirectionMenu = (src: string, tgt: string, label: string, linkData?: TopologyLink) => {
      const isDisabled = !linkData;
      
      return (
        <ContextMenuSub>
            <ContextMenuSubTrigger disabled={isDisabled} inset>{label}</ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-56">
                <ContextMenuLabel className="text-xs text-muted-foreground">{src} → {tgt}</ContextMenuLabel>
                <ContextMenuSeparator />

                <ContextMenuItem onClick={() => handleAction(src, tgt, "iperf", { duration: 10 })}>
                    Lancer Iperf (10s)
                </ContextMenuItem>
            </ContextMenuSubContent>
        </ContextMenuSub>
      );
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuLabel>Actions sur le lien</ContextMenuLabel>
        <ContextMenuSeparator />
        
        {/* Forward Direction */}
        {renderDirectionMenu(source, target, `Direction: ${source} → ${target}`, data?.forward)}

        {/* Backward Direction */}
        {renderDirectionMenu(target, source, `Direction: ${target} → ${source}`, data?.backward)}

      </ContextMenuContent>
    </ContextMenu>
  );
}
