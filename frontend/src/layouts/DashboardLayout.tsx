import Header from "@/components/header/header";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import CommandConsole from "@/components/topology/CommandConsole";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useCommandConsole } from "@/hooks/useCommandConsole";
import { Outlet } from "react-router";

export default function DashboardLayout() {
  const { entries, clear } = useCommandConsole();
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Outlet />
        </div>
        <CommandConsole entries={entries} onClear={clear} />
      </SidebarInset>
    </SidebarProvider>
  );
}
