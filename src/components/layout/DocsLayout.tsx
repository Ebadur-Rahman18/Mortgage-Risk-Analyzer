import { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebarProvider, useAppSidebar } from "@/contexts/AppSidebarContext";
import { AdminSidebarProvider, useAdminSidebar } from "@/contexts/AdminSidebarContext";
import { AppSidebar } from "./AppSidebar";
import { AdminSidebar } from "./AdminSidebar";
import { TopNav } from "./TopNav";
import { PublicDocsLayout } from "./PublicDocsLayout";
import { cn } from "@/lib/utils";

function DocsLayoutContent({ children }: { children: ReactNode }) {
  const sidebar = useAppSidebar();
  const collapsed = sidebar?.collapsed ?? false;

  return (
    <div className="bg-background min-h-screen">
      <AppSidebar />
      <TopNav />
      <main
        className={cn(
          "mt-16 min-h-[calc(100vh-4rem)] p-6 lg:p-8 transition-[margin-left] duration-200 ease-in-out",
          collapsed ? "ml-16" : "ml-64",
        )}
      >
        <div className="mx-auto max-w-7xl px-6">{children}</div>
      </main>
    </div>
  );
}

function AdminDocsLayoutContent({ children }: { children: ReactNode }) {
  const sidebar = useAdminSidebar();
  const collapsed = sidebar?.collapsed ?? false;

  return (
    <div className="bg-background min-h-screen">
      <AdminSidebar />
      <TopNav />
      <main
        className={cn(
          "mt-16 min-h-[calc(100vh-4rem)] p-6 lg:p-8 transition-[margin-left] duration-200 ease-in-out",
          collapsed ? "ml-16" : "ml-64",
        )}
      >
        <div className="mx-auto max-w-7xl px-6">{children}</div>
      </main>
    </div>
  );
}

export function DocsLayout({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Keep promotional docs experience for logged-out visitors.
    return <PublicDocsLayout>{children}</PublicDocsLayout>;
  }

  // Logged-in docs should use the same sidebar shell as the rest of the app.
  const role = profile?.role;
  const isAdminLike = role === "admin" || role === "moderator";

  if (isAdminLike) {
    return (
      <AdminSidebarProvider>
        <AdminDocsLayoutContent>{children}</AdminDocsLayoutContent>
      </AdminSidebarProvider>
    );
  }

  return (
    <AppSidebarProvider>
      <DocsLayoutContent>{children}</DocsLayoutContent>
    </AppSidebarProvider>
  );
}

