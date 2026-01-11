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

interface EdgeContextMenuProps {
  children: React.ReactNode;
  edgeId: string;
  source: string;
  target: string;
  onAction: (action: string, edgeId: string, source: string, target: string, params?: any) => void;
}

export function EdgeContextMenu({ children, edgeId, source, target, onAction }: EdgeContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem inset onClick={() => onAction('details', edgeId, source, target)}>
          Détails du lien
        </ContextMenuItem>
        <ContextMenuSeparator />
        
        <ContextMenuSub>
          <ContextMenuSubTrigger inset>Génération Trafic (Iperf)</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
             <ContextMenuItem onClick={() => onAction('iperf', edgeId, source, target, { type: 'tcp', duration: 10 })}>
                Flux TCP (10s)
             </ContextMenuItem>
             <ContextMenuItem onClick={() => onAction('iperf', edgeId, source, target, { type: 'udp', duration: 10 })}>
                Flux UDP (10s)
             </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        
        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger inset>Limiter la Bande Passante</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem onClick={() => onAction('bandwidth', edgeId, source, target, { limit: '1mbit' })}>
              1 Mbit/s (Edge)
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onAction('bandwidth', edgeId, source, target, { limit: '10mbit' })}>
              10 Mbit/s (4G)
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onAction('bandwidth', edgeId, source, target, { limit: '100mbit' })}>
              100 Mbit/s (Fiber)
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onAction('bandwidth', edgeId, source, target, { limit: 'unset' })}>
              Supprimer la limite
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
            <ContextMenuSubTrigger inset>Injecter de la Latence</ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
                <ContextMenuItem onClick={() => onAction('latency', edgeId, source, target, { delay: '50ms' })}>
                    50ms (Europe)
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onAction('latency', edgeId, source, target, { delay: '150ms' })}>
                    150ms (Transatlantique)
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onAction('latency', edgeId, source, target, { delay: '0ms' })}>
                    Retirer Latence
                </ContextMenuItem>
            </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  )
}
