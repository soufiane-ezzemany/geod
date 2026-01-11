import { BrowserRouter, Navigate, Route, Routes } from "react-router"
import DashboardLayout from "@/layouts/DashboardLayout"
import Dashboard from "@/pages/Dashboard"
import Nodes from "@/pages/Nodes"
import Metrics from "@/pages/Metrics"

export default function AppRoutes() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="dashboard" element={<DashboardLayout />}>
                    <Route index element={<Dashboard />} />
                    
                    {/* Nœuds */}
                    <Route path="noeuds" element={<Nodes />} />
                    
                    {/* Métriques */}
                    <Route path="metriques" element={<Metrics />} />
                </Route>
                <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
        </BrowserRouter>
    )
}