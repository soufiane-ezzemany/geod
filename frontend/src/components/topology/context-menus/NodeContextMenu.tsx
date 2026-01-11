import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

interface NodeContextMenuProps {
  children: React.ReactNode;
  nodeId: string;
  onAction: (action: string, nodeId: string, params?: any) => void;
}

export function NodeContextMenu({ children, nodeId, onAction }: NodeContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem inset onClick={() => onAction('details', nodeId)}>
          Voir les détails
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem inset onClick={() => onAction('ping', nodeId)}>
            Ping (Test Connectivité)
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger inset>Commandes Système</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem onClick={() => onAction('restart', nodeId)}>
              Redémarrer l'agent
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  )
}
