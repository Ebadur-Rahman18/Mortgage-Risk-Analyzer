import { Outlet, useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { useManagementScope } from "@/hooks/useManagementScope";
import { PRICING_TABS } from "@/lib/pricing-nav";

export function PricingLayout() {
  const location = useLocation();
  const { hasPermission } = useEffectivePermissions();
  const { scope } = useManagementScope();

  const visibleTabs = PRICING_TABS.filter((tab) => {
    if (tab.branchOrOrgOnly && scope !== "org" && scope !== "branch") {
      return false;
    }
    if (!tab.permission) return true;
    return hasPermission(tab.permission);
  });

  const isActive = (path: string) => {
    if (path === "/pricing") return location.pathname === "/pricing" || location.pathname === "/pricing/calculator";
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border">
        <nav className="flex gap-1" aria-label="Pricing module tabs">
          {visibleTabs.map((tab) => {
            const active = isActive(tab.path);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={cn(
                  "px-4 py-3 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2",
                  active
                    ? "border-primary text-foreground bg-muted/50"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="min-h-[400px]">
        <Outlet />
      </div>
    </div>
  );
}
