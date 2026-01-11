import * as React from "react"
import { NavMain } from "@/components/sidebar/nav-main"
import { AppLogo } from "@/components/sidebar/app-logo"
import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarRail,
} from "@/components/ui/sidebar"
import {
    LayoutDashboard,
    Network,
    Activity,
} from "lucide-react"

const data = {
    navMain: [
        {
            title: "Tableau de bord",
            url: "/dashboard",
            icon: LayoutDashboard,
            isActive: true,
            items: [
                {
                    title: "Topologie",
                    url: "/dashboard",
                },
            ],
        },
        {
            title: "Nœuds",
            url: "/dashboard/noeuds",
            icon: Network,
            items: [
                {
                    title: "Liste des nœuds",
                    url: "/dashboard/noeuds",
                },
            ],
        },
        {
            title: "Métriques",
            url: "/dashboard/metriques",
            icon: Activity,
            items: [
                {
                    title: "Temps réel",
                    url: "/dashboard/metriques",
                },
            ],
        },
    ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <AppLogo />
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={data.navMain} />
            </SidebarContent>
            <SidebarRail />
        </Sidebar>
    )
}
