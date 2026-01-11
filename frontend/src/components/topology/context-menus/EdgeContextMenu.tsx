import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { toast } from "sonner";

interface EdgeContextMenuProps {
  children: React.ReactNode;
  edgeId: string;
  source: string;
  target: string;
  onAction: (action: string, edgeId: string, source: string, target: string, params?: any) => void;
}

export function EdgeContextMenu({
  children,
  edgeId,
  source,
  target,
  onAction,
}: EdgeContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          inset
          className="text-red-600"
          onClick={() => {
            if (onAction) onAction("disconnect", edgeId, source, target);
            else {
              console.warn("No edge action handler");
              toast.error("Action indisponible");
            }
          }}
        >
          Déconnecter
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
