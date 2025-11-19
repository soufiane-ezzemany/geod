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
    Settings,
    Layers,
    BarChart3
} from "lucide-react"

const data = {
    navMain: [
        {
            title: "Tableau de bord",
            url: "#",
            icon: LayoutDashboard,
            isActive: true,
            items: [
                {
                    title: "Vue d'ensemble",
                    url: "/dashboard",
                },
                {
                    title: "Métriques temps réel",
                    url: "/dashboard/metriques",
                },
            ],
        },
        {
            title: "Topologies",
            url: "#",
            icon: Layers,
            isActive: true,
            items: [
                {
                    title: "Liste des topologies",
                    url: "/dashboard/topologies",
                },
                {
                    title: "Créer une topologie",
                    url: "/dashboard/topologies/creer",
                },
                {
                    title: "Visualiser",
                    url: "/dashboard/topologies/visualiser",
                },
            ],
        },
        {
            title: "Nœuds réseau",
            url: "#",
            icon: Network,
            isActive: true,
            items: [
                {
                    title: "Liste des nœuds",
                    url: "/dashboard/noeuds",
                },
                {
                    title: "Ajouter un nœud",
                    url: "/dashboard/noeuds/ajouter",
                },
            ],
        },
        {
            title: "Métriques",
            url: "#",
            icon: Activity,
            items: [
                {
                    title: "Surveillance",
                    url: "/dashboard/surveillance",
                },
                {
                    title: "Historique",
                    url: "/dashboard/historique",
                },
            ],
        },
        {
            title: "Rapports",
            url: "#",
            icon: BarChart3,
            items: [
                {
                    title: "Analyse réseau",
                    url: "/dashboard/rapports",
                },
            ],
        },
        {
            title: "Paramètres",
            url: "#",
            icon: Settings,
            items: [
                {
                    title: "Configuration",
                    url: "/dashboard/parametres",
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