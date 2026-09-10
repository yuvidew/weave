import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

const DashboardLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <main className="w-full">
         {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default DashboardLayout