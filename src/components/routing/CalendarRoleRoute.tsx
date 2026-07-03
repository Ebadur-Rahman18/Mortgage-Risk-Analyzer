import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessOperationsCalendar } from "@/lib/calendarAccess";
import { Loader2 } from "lucide-react";

/**
 * Restricts child routes to admin, loan_officer, and branch_manager (app or custom role name).
 */
export function CalendarRoleRoute() {
  const { user, profile, loading, profileLoading } = useAuth();

  if (loading || (user && profileLoading)) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canAccessOperationsCalendar(profile)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
