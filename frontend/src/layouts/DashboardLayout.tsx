import Header from "@/components/header/header";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import CommandConsole from "@/components/topology/CommandConsole";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useCommandConsole } from "@/hooks/useCommandConsole";
import { Outlet } from "react-router";

export default function DashboardLayout() {
  const { entries, clear } = useCommandConsole();
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="h-screen overflow-hidden">
        <Header />
        <div className="flex flex-1 flex-col gap-3 p-3 pt-0 overflow-hidden">
          <Outlet />
        </div>
        <CommandConsole entries={entries} onClear={clear} />
        <Toaster />
      </SidebarInset>
    </SidebarProvider>
  );
}
