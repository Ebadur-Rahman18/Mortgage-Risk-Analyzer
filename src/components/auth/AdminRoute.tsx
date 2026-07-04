import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAppAdmin } from "@/hooks/useIsAppAdmin";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function AdminRoute() {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading: adminLoading, error, userEmail, profileRole } =
    useIsAppAdmin();

  if (loading || (user && adminLoading)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don&apos;t have permission to access this area. This section is
            restricted to administrators only.
            <span className="mt-2 block text-xs opacity-80">
              Signed in as {userEmail ?? "unknown"}
              {profileRole
                ? ` (app role: ${profileRole})`
                : " (app role not loaded)"}
              {error ? ` — ${error.message}` : ""}
            </span>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <Outlet />;
}
