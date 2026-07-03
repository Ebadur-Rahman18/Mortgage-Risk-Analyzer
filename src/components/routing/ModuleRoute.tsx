import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { useModuleSettings, isModuleEnabled } from "@/hooks/useModuleSettings";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

interface ModuleRouteProps {
  module?: string;
  requiredRole?: "admin" | "moderator" | "user";
  requiredPermission?: string;
  /** When set, route is only accessible if this module is enabled in Module Management (admin). */
  requiresModule?: string;
  requiresFeatureFlag?: "enableMeetings" | "enableTasks" | "enableKnowledgeBase" | "enableAIChat" | "enableNotifications" | "enableClients" | "enableAIAgents" | "enableFeedback";
  children?: React.ReactNode;
}

export function ModuleRoute({
  module,
  requiredRole,
  requiredPermission,
  requiresModule,
  requiresFeatureFlag,
  children,
}: ModuleRouteProps) {
  const { user, profile, loading, profileLoading } = useAuth();
  const { isFeatureEnabled, isLoading: flagsLoading } = useFeatureFlags();
  const { hasPermission, isLoading: permissionsLoading, isAdmin } = useEffectivePermissions();
  const { data: moduleList, isLoading: modulesLoading } = useModuleSettings();
  const toastShownRef = useRef(false);

  // Show toast when feature is disabled (only once)
  useEffect(() => {
    if (!flagsLoading && requiresFeatureFlag && !isFeatureEnabled(requiresFeatureFlag) && !toastShownRef.current) {
      toastShownRef.current = true;
      toast.error("This feature is currently disabled", {
        description: "Contact your administrator to enable this module.",
      });
    }
  }, [flagsLoading, requiresFeatureFlag, isFeatureEnabled]);

  if (loading || (user && profileLoading) || flagsLoading || permissionsLoading || (requiresModule && modulesLoading)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check module enabled (admin toggle) if required.
  // Admins bypass the module toggle so they can always access for configuration.
  if (requiresModule && !isAdmin && !isModuleEnabled(moduleList, requiresModule)) {
    if (!toastShownRef.current) {
      toastShownRef.current = true;
      toast.error("This module is currently disabled", {
        description: "A product owner can enable it in Admin → Module Management.",
      });
    }
    return <Navigate to="/dashboard" replace />;
  }

  // Check feature flag if required
  if (requiresFeatureFlag && !isFeatureEnabled(requiresFeatureFlag)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check role if required
  if (requiredRole) {
    const hasRole = checkRole(profile?.role, requiredRole);
    if (!hasRole) {
      return (
        <div className="flex h-screen items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You don't have the required permissions to access this module.
              Required role: {requiredRole}
            </AlertDescription>
          </Alert>
        </div>
      );
    }
  }

  // Check permission (e.g. clients:read, loan_programs:read)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don&apos;t have permission to access this module. Contact your
            administrator to request access.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
}

// MCT Lite: explicit role check for the three system roles.
//   admin         → satisfies any required role
//   loan_officer  → satisfies "loan_officer" or "user"
//   user          → satisfies only "user"
// Legacy "moderator" is treated as admin for backward compatibility.
function checkRole(
  userRole: string | undefined,
  requiredRole: "admin" | "moderator" | "user"
): boolean {
  if (!userRole) return false;
  if (userRole === "admin" || userRole === "moderator") return true;
  if (userRole === "loan_officer") return requiredRole !== "admin" && requiredRole !== "moderator";
  if (userRole === "user") return requiredRole === "user";
  return false;
}
