import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"
import { Network } from "lucide-react"

export function AppLogo() {
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary">
                        <Network className="size-4 text-primary-foreground" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">GEOD</span>
                        <span className="truncate text-xs text-muted-foreground">Réseau</span>
                    </div>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}