import { Outlet, useLocation } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import { TopNav } from "./TopNav";
import { ReactNode } from "react";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { getPermissionForPath } from "@/lib/admin-routes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { AdminSidebarProvider, useAdminSidebar } from "@/contexts/AdminSidebarContext";
import { cn } from "@/lib/utils";
import { ContactCollabAIButton } from "@/components/ContactCollabAIButton";
import { useTour } from "@/hooks/useTour";
import { TourProvider } from "@/contexts/TourContext";
import { AppTour } from "@/components/tour/AppTour";

interface AdminLayoutProps {
  children?: ReactNode;
}

function isAdminAgentChatRoute(pathname: string) {
  return /^\/admin\/agents\/[^/]+\/chat$/.test(pathname);
}

function AdminLayoutContent({ children }: AdminLayoutProps) {
  const location = useLocation();
  const { user, profileLoading } = useAuth();
  const { hasPermission, isLoading: permissionsLoading, isAdmin } = useEffectivePermissions();
  const requiredPermission = getPermissionForPath(location.pathname);
  // Admins always allowed; others need the path permission (e.g. admin:access).
  const allowed = isAdmin || hasPermission(requiredPermission);
  const { collapsed } = useAdminSidebar();
  const mainMargin = collapsed ? "ml-16" : "ml-64";
  const noRightPadding = isAdminAgentChatRoute(location.pathname);
  const tour = useTour(user?.id);

  const rootHeightClass = isAdminAgentChatRoute(location.pathname)
    ? "h-screen overflow-hidden"
    : "min-h-screen";

  const mainBaseClasses =
    "mt-16 min-h-[calc(100vh-4rem)] p-6 lg:p-8 transition-[margin] duration-200";

  const mainChatExtras = noRightPadding
    ? "pr-0 lg:pr-0 h-[calc(100vh-4rem)] overflow-hidden"
    : "";

  if (((user && profileLoading) || permissionsLoading) && !isAdmin) {
    return (
      <div className={cn(rootHeightClass, "bg-background")}>
        <AdminSidebar />
        <TopNav />
        <main
          className={cn(
            mainMargin,
            mainBaseClasses,
            "flex items-center justify-center",
            mainChatExtras
          )}
        >
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className={cn(rootHeightClass, "bg-background")}>
        <AdminSidebar />
        <TopNav />
        <main
          className={cn(
            mainMargin,
            mainBaseClasses,
            "flex items-center justify-center",
            mainChatExtras
          )}
        >
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You don&apos;t have permission to access this page. Your access is
              controlled by your assigned permissions.
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  return (
    <TourProvider value={tour}>
      <div className={cn(rootHeightClass, "bg-background")}>
        <AdminSidebar />
        <TopNav />
        <main
          className={cn(
            mainMargin,
            mainBaseClasses,
            mainChatExtras
          )}
        >
          {children || <Outlet />}
        </main>
        <AppTour tour={tour} variant="admin_panel" />
        <ContactCollabAIButton />
      </div>
    </TourProvider>
  );
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AdminSidebarProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AdminSidebarProvider>
  );
}
