import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import logoUrl from "@/assets/mortgageai-logo.svg";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useIntegrationStatus } from "@/hooks/useIntegrationStatus";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { getPermissionForPath } from "@/lib/admin-routes";
import { useAdminSidebar } from "@/contexts/AdminSidebarContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LayoutDashboard,
  Users,
  Shield,
  Activity,
  Settings,
  Zap,
  Database,
  ArrowLeft,
  CheckCircle2,
  FileText,
  ListChecks,
  Code,
  Map,
  Brain,
  BarChart,
  ChevronDown,
  MessageSquare,
  Layers,
  Bot,
  ShieldAlert,
  PanelLeftClose,
  PanelRight,
  Clock,
  ScrollText,
  Scale,
  FolderTree,
  Calendar,
  BookOpen,
  Info,
  ExternalLink,
} from "lucide-react";

const ABOUT_URL =
  (import.meta.env.VITE_ABOUT_BRAND_URL as string | undefined) ??
  "https://collabai.software/";

interface SidebarItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

interface SidebarGroup {
  title: string;
  items: SidebarItem[];
  /** data-tour anchor id for the guided product tour (placed on the section trigger). */
  tourId?: string;
}

const sidebarGroups: SidebarGroup[] = [
  {
    title: "DASHBOARD",
    tourId: "admin-overview",
    items: [
      { title: "Overview", href: "/admin", icon: LayoutDashboard },
    ],
  },
  {
    title: "USERS & ACCESS",
    tourId: "admin-users",
    items: [
      { title: "User Management", href: "/admin/users", icon: Users },
      { title: "Role Management", href: "/admin/roles", icon: Shield },
    ],
  },
  {
    title: "AI",
    tourId: "admin-ai",
    items: [
      { title: "LLM Config", href: "/admin/ai/llm-config", icon: Brain },
      { title: "AI Agents", href: "/admin/agents", icon: Bot },
      { title: "AI Usage", href: "/admin/ai-usage", icon: BarChart },
    ],
  },
  {
    title: "SYSTEM",
    tourId: "admin-system",
    items: [
      { title: "Module Management", href: "/admin/modules", icon: Layers },
      { title: "System Settings", href: "/admin/settings", icon: Settings },
      { title: "Integrations", href: "/admin/integrations", icon: Zap },
      { title: "Activity Logs", href: "/admin/logs", icon: Activity },
      { title: "Knowledge Categories", href: "/admin/knowledge-categories", icon: BookOpen },
      { title: "Document extracts", href: "/admin/knowledge-documents", icon: ScrollText },
    ],
  },
];

export function AdminSidebar() {
  const location = useLocation();
  const { status: integrationStatus } = useIntegrationStatus();
  const { hasPermission } = useEffectivePermissions();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const sidebar = useAdminSidebar();
  const collapsed = sidebar?.collapsed ?? false;
  const toggle = sidebar?.toggle ?? (() => {});

  // Track which groups are expanded
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Initialize expanded state based on active route
  useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    sidebarGroups.forEach((group) => {
      const hasActiveItem = group.items.some((item) => location.pathname === item.href);
      initialExpanded[group.title] = hasActiveItem || group.title === "DASHBOARD";
    });
    setExpandedGroups(initialExpanded);
  }, []);

  // Update expanded state when route changes
  useEffect(() => {
    sidebarGroups.forEach((group) => {
      const hasActiveItem = group.items.some((item) => location.pathname === item.href);
      if (hasActiveItem) {
        setExpandedGroups((prev) => ({ ...prev, [group.title]: true }));
      }
    });
  }, [location.pathname]);

  const toggleGroup = (groupTitle: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupTitle]: !prev[groupTitle],
    }));
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-border bg-white transition-[width] duration-200 ease-in-out overflow-hidden",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className={cn("flex h-20 items-center border-b border-border flex-shrink-0", collapsed ? "justify-center px-0" : "gap-3 px-6")}>
          {collapsed ? (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggle} aria-label="Expand sidebar">
              <PanelRight className="h-5 w-5" />
            </Button>
          ) : (
            <>
              <Link to="/admin" className="flex min-w-0 flex-1 items-center gap-3 group">
                <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2">
                  <img
                    src={logoUrl}
                    alt="MortgageAI"
                    className="h-6 w-auto"
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                    Admin Panel
                  </span>
                </div>
              </Link>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={toggle} aria-label="Collapse sidebar">
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              {sidebarGroups.flatMap((group) =>
                group.items
                  .filter((item) => {
                    if (item.adminOnly && !isAdmin) return false;
                    return hasPermission(getPermissionForPath(item.href));
                  })
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                          isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                        )}
                        title={item.title}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                      </Link>
                    );
                  })
              )}
            </div>
          ) : (
          <div className="space-y-2">
            {sidebarGroups.map((group) => {
              const visibleItems = group.items.filter((item) => {
                if (item.adminOnly && !isAdmin) return false;
                return hasPermission(getPermissionForPath(item.href));
              });
              if (visibleItems.length === 0) return null;

              const isExpanded = expandedGroups[group.title] ?? true;
              const hasActiveItem = visibleItems.some(
                (item) => location.pathname === item.href
              );

              return (
                <Collapsible
                  key={group.title}
                  open={isExpanded}
                  onOpenChange={() => toggleGroup(group.title)}
                >
                  <CollapsibleTrigger
                    data-tour={group.tourId}
                    className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span>{group.title}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        isExpanded ? "rotate-0" : "-rotate-90"
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1">
                    {visibleItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href;
                        const isIntegrations = item.href === "/admin/integrations";

                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                          className={cn(
                            "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-[18px] w-[18px] shrink-0",
                              isActive
                                ? "text-primary-foreground"
                                : "text-muted-foreground group-hover:text-foreground"
                            )}
                          />
                          <span className="flex-1">{item.title}</span>
                          {isIntegrations && integrationStatus && integrationStatus.connected > 0 && (
                            <Badge
                              variant={isActive ? "secondary" : "default"}
                              className="h-5 min-w-[20px] px-1.5 text-xs"
                            >
                              {integrationStatus.connected}
                            </Badge>
                          )}
                        </Link>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
          )}
        </nav>

        {/* Footer - About Us + Back to Dashboard */}
        <div className="border-t border-border p-4 space-y-2">
          {/* About Us */}
          {collapsed ? (
            <a
              href={ABOUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground mx-auto transition-colors"
              title="About Us"
            >
              <Info className="h-4 w-4" />
            </a>
          ) : (
            <a
              href={ABOUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Info className="h-4 w-4 shrink-0" />
              <span className="flex-1">About Us</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground/60" />
            </a>
          )}

          {/* Back to Dashboard */}
          {collapsed ? (
            <Link
              to="/dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 mx-auto"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              to="/dashboard"
              className="flex items-center gap-3 rounded-lg bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
