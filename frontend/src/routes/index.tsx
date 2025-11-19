import { BrowserRouter, Navigate, Route, Routes } from "react-router"
import DashboardLayout from "@/layouts/DashboardLayout"
import Dashboard from "@/pages/Dashboard"
import Topologies from "@/pages/Topologies"
import Nodes from "@/pages/Nodes"
import Metrics from "@/pages/Metrics"
import Settings from "@/pages/Settings"

export default function AppRoutes() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="dashboard" element={<DashboardLayout />}>
                    <Route index element={<Dashboard />} />
                    
                    {/* Topologies */}
                    <Route path="topologies" element={<Topologies />} />
                    <Route path="topologies/creer" element={<Topologies />} />
                    <Route path="topologies/visualiser" element={<Topologies />} />
                    
                    {/* Nœuds */}
                    <Route path="noeuds" element={<Nodes />} />
                    <Route path="noeuds/ajouter" element={<Nodes />} />
                    
                    {/* Métriques */}
                    <Route path="metriques" element={<Metrics />} />
                    <Route path="surveillance" element={<Metrics />} />
                    <Route path="historique" element={<Metrics />} />
                    
                    {/* Rapports */}
                    <Route path="rapports" element={<Metrics />} />
                    
                    {/* Paramètres */}
                    <Route path="parametres" element={<Settings />} />
                </Route>
                <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
        </BrowserRouter>
    )
}

