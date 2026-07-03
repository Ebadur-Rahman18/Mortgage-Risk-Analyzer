/**
 * Pricing & Rate Lock module navigation config.
 * Centralized for consistency between sidebar and in-page tabs.
 * Add/remove or enable/disable tabs here for future integrations.
 */
import { permissionKey } from "@/lib/permissions";

export interface PricingTabItem {
  label: string;
  path: string;
  /** Permission required to see this tab. Omit for Calculator (uses parent pricing:read). */
  permission?: string;
  /** Limit to organization / branch manager scope (hides from personal LO pricing tab strip). */
  branchOrOrgOnly?: boolean;
}

/** Tabs shown in Pricing layout (order preserved). */
export const PRICING_TABS: PricingTabItem[] = [
  { label: "Calculator", path: "/pricing" },
  {
    label: "Quick quote",
    path: "/pricing/quick",
    permission: permissionKey("pricing", "calculate"),
  },
  { label: "Datastore", path: "/pricing/datastores", permission: permissionKey("rate_sheets", "manage") },
  { label: "Locks", path: "/pricing/locks", permission: permissionKey("rate_locks", "read") },
  {
    label: "Investor",
    path: "/pricing/investor-submissions",
    permission: permissionKey("rate_locks", "read"),
  },
  {
    label: "Hedge",
    path: "/pricing/hedge",
    permission: permissionKey("rate_locks", "read"),
    branchOrOrgOnly: true,
  },
];

/** Sidebar sub-items for Pricing & Rate Lock (permission-aware). Kept for future use. */
export const PRICING_SIDEBAR_CHILDREN = [
  { title: "Calculator", href: "/pricing", permission: permissionKey("pricing", "calculate") },
  { title: "Quick quote", href: "/pricing/quick", permission: permissionKey("pricing", "calculate") },
  { title: "Datastore", href: "/pricing/datastores", permission: permissionKey("rate_sheets", "manage") },
  { title: "Locks", href: "/pricing/locks", permission: permissionKey("rate_locks", "read") },
  {
    title: "Investor",
    href: "/pricing/investor-submissions",
    permission: permissionKey("rate_locks", "read"),
  },
  {
    title: "Hedge",
    href: "/pricing/hedge",
    permission: permissionKey("rate_locks", "read"),
  },
];
