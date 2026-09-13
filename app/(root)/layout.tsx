import { auth } from "@clerk/nextjs/server"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

// Mirrors the check in proxy.ts — lets local dev run without Clerk keys
// configured instead of auth() throwing.
const isClerkConfigured =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

/**
 * @component DashboardLayout
 * @description Shared shell (sidebar + main) for every signed-in route —
 * dashboard, agents, plugins, and runs all render through this layout, so
 * gating access here protects all four without needing path matching in
 * proxy.ts. Redirects to sign-in before rendering anything if there's no
 * active session.
 */
const DashboardLayout = async ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  if (isClerkConfigured) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId) return redirectToSignIn();
  }

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