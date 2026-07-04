import { Link, useLocation } from "react-router-dom";
import logoUrl from "@/assets/mortgageai-logo.svg";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { useIsAppAdmin } from "@/hooks/useIsAppAdmin";
import { permissionKey } from "@/lib/permissions";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  CheckSquare,
  BookOpen,
  Brain,
  ChevronRight,
  Sparkles,
  Bot,
  Banknote,
  UserPlus,
  ListTodo,
  PanelLeftClose,
  PanelRight,
  Inbox,
  LineChart,
  MessageSquare,
  Shield,
  Info,
  ExternalLink,
} from "lucide-react";

const ABOUT_URL =
  (import.meta.env.VITE_ABOUT_BRAND_URL as string | undefined) ??
  "https://collabai.software/";
import { useModuleSettings, isModuleEnabled } from "@/hooks/useModuleSettings";
import {
  useAgentEnabled,
  DOCUMENT_GENERATION_AGENT_SLUG,
  EMAIL_INTELLIGENCE_AGENT_SLUG,
} from "@/hooks/useAgentEnabled";
import { useManagementScope } from "@/hooks/useManagementScope";
import { canAccessOperationsCalendar } from "@/lib/calendarAccess";
import { getNormalizedUserRoles } from "@/lib/agentRoles";
import { Button } from "@/components/ui/button";

interface SidebarItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: Array<{ title: string; href: string }>;
  badge?: string;
  adminOnly?: boolean;
  isAI?: boolean;
  /** Required permission key (e.g. "clients:read"). If set, user must have this permission to see the item. */
  permission?: string;
  /** When set, item is only shown if this module is enabled in Admin → Module Management. */
  module?: string;
  featureFlag?: "enableClients" | "enableMeetings" | "enableTasks" | "enableKnowledgeBase" | "enableAIChat" | "enableAIAgents" | "enableFeedback";
  /** When set, item is only shown if the specified AI agent is enabled. */
  agentSlug?: string;
  /** data-tour anchor id for the guided product tour. */
  tourId?: string;
}

const navigationItems: SidebarItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    tourId: "dashboard",
  },
  {
    title: "Loans",
    href: "/loans",
    icon: Banknote,
    permission: permissionKey("loans", "read"),
    module: "loans",
    tourId: "loans",
  },
  {
    title: "Risk Dashboard",
    href: "/loans/risk-dashboard",
    icon: Shield,
    permission: permissionKey("loan_risk_analyses", "read"),
    module: "mortgage_risk_copilot",
    isAI: true,
  },
  {
    title: "Borrowers",
    href: "/borrowers",
    icon: UserPlus,
    permission: permissionKey("borrowers", "read"),
    module: "loans",
    tourId: "borrowers",
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
    permission: permissionKey("tasks", "read"),
    featureFlag: "enableTasks",
    tourId: "tasks",
  },
  {
    title: "Action Items",
    href: "/action-items",
    icon: ListTodo,
    tourId: "action-items",
  },
  {
    title: "Knowledge Base",
    href: "/knowledge",
    icon: BookOpen,
    permission: permissionKey("knowledge", "read"),
    featureFlag: "enableKnowledgeBase",
    tourId: "knowledge",
  },
  {
    title: "Notifications",
    href: "/notifications",
    icon: Inbox,
    tourId: "notifications",
  },
];

const aiToolsItems: SidebarItem[] = [
  {
    title: "AI Chat",
    href: "/ai",
    icon: MessageSquare,
    isAI: true,
    featureFlag: "enableAIChat",
    permission: permissionKey("ai_chat", "read"),
  },
  {
    title: "AI Agents",
    href: "/agents",
    icon: Bot,
    isAI: true,
    featureFlag: "enableAIAgents",
  },
];

const ALL_SIDEBAR_HREFS = [...navigationItems, ...aiToolsItems].flatMap((item) => [
  item.href,
  ...(item.children?.map((child) => child.href) ?? []),
]);

/** Prefix match for nav active state, but defer to a longer peer href (e.g. /loans vs /loans/risk-dashboard). */
function isNavItemActive(pathname: string, itemHref: string, peerHrefs: string[]): boolean {
  if (pathname === itemHref) return true;
  if (!pathname.startsWith(`${itemHref}/`)) return false;

  const ownedByPeer = peerHrefs.some(
    (peer) =>
      peer !== itemHref &&
      peer.startsWith(`${itemHref}/`) &&
      (pathname === peer || pathname.startsWith(`${peer}/`)),
  );
  return !ownedByPeer;
}

export function AppSidebar() {
  const location = useLocation();
  const { profile } = useAuth();
  const { companyName } = useBranding();
  const sidebar = useAppSidebar();
  const collapsed = sidebar?.collapsed ?? false;
  const toggle = sidebar?.toggle ?? (() => {});
  const { isFeatureEnabled, isLoading } = useFeatureFlags();
  const { hasPermission } = useEffectivePermissions();
  const { isAdmin: isAppAdmin } = useIsAppAdmin();
  const { data: moduleList = [] } = useModuleSettings();
  const { isEnabled: documentGenerationAgentEnabled } = useAgentEnabled(DOCUMENT_GENERATION_AGENT_SLUG);
  const { isEnabled: emailIntelligenceAgentEnabled } = useAgentEnabled(EMAIL_INTELLIGENCE_AGENT_SLUG);
  const { showInNav: showManagerDashboardInNav } = useManagementScope();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const isAdmin =
    isAppAdmin || profile?.role === "admin" || profile?.role === "moderator";
  /**
   * Admin / moderator using the main app shell (/dashboard): show operational
   * items only — no AI Chat or Action Items (those live in the admin panel).
   */
  const adminNavAllow = new Set<string>([
    "/dashboard",
    "/loans",
    "/loans/risk-dashboard",
    "/borrowers",
    "/tasks",
    "/knowledge",
    "/notifications",
    "/agents",
  ]);
  /** Loan officer / branch manager (not platform admin): show a short nav set only. */
  const normalizedRoles = getNormalizedUserRoles(profile);
  const isLoanOfficerLiteNav =
    !isAdmin &&
    (normalizedRoles.has("loan_officer") || normalizedRoles.has("branch_manager"));
  const loanOfficerNavAllow = new Set<string>([
    "/dashboard",
    "/loans",
    "/loans/risk-dashboard",
    "/borrowers",
    "/tasks",
    "/knowledge",
    "/agents",
  ]);
  /** App role `user` (support/processor): tasks + knowledge + agents; no AI Chat, action items, or notifications in nav. */
  const isUserRoleLiteNav =
    !isAdmin && !isLoanOfficerLiteNav && profile?.role === "user";
  const userRoleNavAllow = new Set<string>([
    "/dashboard",
    "/tasks",
    "/knowledge",
    "/agents",
  ]);

  const agentEnabledMap: Record<string, boolean> = {
    [DOCUMENT_GENERATION_AGENT_SLUG]: documentGenerationAgentEnabled,
    [EMAIL_INTELLIGENCE_AGENT_SLUG]: emailIntelligenceAgentEnabled,
  };

  const filterItems = (items: SidebarItem[]) => {
    return items.filter((item) => {
      if (item.adminOnly && !isAdmin) return false;
      if (isAdmin && !adminNavAllow.has(item.href)) return false;
      if (isLoanOfficerLiteNav && !loanOfficerNavAllow.has(item.href)) return false;
      if (isUserRoleLiteNav && !userRoleNavAllow.has(item.href)) return false;
      if (item.href === "/calendar" && !canAccessOperationsCalendar(profile)) return false;
      if (item.href === "/pipeline" && !showManagerDashboardInNav) return false;
      if (item.module && !isModuleEnabled(moduleList, item.module)) return false;
      if (item.permission && !hasPermission(item.permission)) return false;
      if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) return false;
      if (item.agentSlug && !agentEnabledMap[item.agentSlug]) return false;
      return true;
    });
  };

  const visibleNavItems = filterItems(navigationItems);
  const visibleAIItems = filterItems(aiToolsItems);

  const isSectionExpanded = (item: SidebarItem) => {
    if (!item.children?.length) return false;
    const hasActiveChild = item.children.some(
      (child) => location.pathname === child.href || location.pathname.startsWith(`${child.href}/`),
    );
    return expandedSections[item.href] ?? hasActiveChild;
  };

  const toggleSection = (sectionHref: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionHref]: !(prev[sectionHref] ?? true),
    }));
  };

  const renderNavItem = (item: SidebarItem) => {
    const Icon = item.icon;
    const isActive = isNavItemActive(location.pathname, item.href, ALL_SIDEBAR_HREFS);
    const hasChildren = Boolean(item.children?.length);
    const sectionExpanded = isSectionExpanded(item);

    const content = (
      <div key={item.href}>
        {hasChildren && !collapsed ? (
          <button
            type="button"
            onClick={() => toggleSection(item.href)}
            className={cn(
              "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-all duration-200",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground sidebar-active-glow"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
            aria-label={`Toggle ${item.title} submenu`}
            aria-expanded={sectionExpanded}
          >
            <div className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
              isActive
                ? "bg-white/25"
                : "bg-white/15 group-hover:bg-white/25"
            )}>
              <Icon className={cn(
                "h-[18px] w-[18px] shrink-0",
                isActive ? "text-white" : "text-white/90"
              )} />
            </div>
            <span className="flex-1">{item.title}</span>
            <ChevronRight className={cn("h-4 w-4 text-white/70 transition-transform", sectionExpanded && "rotate-90")} />
          </button>
        ) : (
          <Link
            to={item.href}
            data-tour={item.tourId}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200",
              collapsed && "justify-center px-2",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground sidebar-active-glow"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <div className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
              isActive
                ? "bg-white/25"
                : "bg-white/15 group-hover:bg-white/25"
            )}>
              <Icon className={cn(
                "h-[18px] w-[18px] shrink-0",
                isActive ? "text-white" : "text-white/90"
              )} />
            </div>
            {!collapsed && (
              <>
                <span className="flex-1">{item.title}</span>
                {item.isAI && (
                  <span className="ai-badge">AI</span>
                )}
                {item.badge && (
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-sidebar-primary/20 text-sidebar-primary"
                  )}>
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronRight className="h-4 w-4 text-white/70" />}
              </>
            )}
          </Link>
        )}
        {!collapsed && item.children?.length && sectionExpanded ? (
          <div className="mt-1 space-y-1 pl-11">
            {item.children.map((child) => {
              const isChildActive = isNavItemActive(location.pathname, child.href, ALL_SIDEBAR_HREFS);
              return (
                <Link
                  key={child.href}
                  to={child.href}
                  className={cn(
                    "block rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    isChildActive
                      ? "bg-sidebar-primary/20 text-white"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  {child.title}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.href} delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {item.title}
            {item.isAI ? " (AI)" : ""}
          </TooltipContent>
        </Tooltip>
      );
    }
    return content;
  };

  return (
    <TooltipProvider delayDuration={0}>
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border sidebar-gradient transition-[width] duration-200 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo Area — collapse/expand icon in header (like Admin Panel); tooltip on hover */}
        <div className={cn(
          "flex h-20 items-center border-b border-sidebar-border transition-[padding] duration-200",
          collapsed ? "justify-center px-0" : "gap-3 px-6"
        )}>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={toggle}
                  aria-label="Expand sidebar"
                >
                  <PanelRight className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Expand
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              <Link
                to="/dashboard"
                className="flex min-w-0 flex-1 items-center gap-3 group"
              >
                <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-white/95 px-3 py-2 shadow-md transition-all duration-300 group-hover:shadow-xl">
                  <img
                    src={logoUrl}
                    alt="MortgageAI"
                    className="h-6 w-auto"
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                    Control Tower
                  </span>
                </div>
              </Link>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    onClick={toggle}
                    aria-label="Collapse sidebar"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Collapse
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 overflow-y-auto py-5 transition-[padding] duration-200",
          collapsed ? "px-2" : "px-3"
        )}>
          {/* Navigation Section */}
          <div className="mb-6">
            {!collapsed && (
              <div className="mb-3 px-3">
                <span className="sidebar-section-label">
                  Navigation
                </span>
              </div>
            )}
            <div className="space-y-1">
              {visibleNavItems.map(renderNavItem)}
            </div>
          </div>

          {/* AI Tools Section */}
          {visibleAIItems.length > 0 && (
            <div>
              {!collapsed && <div className="sidebar-divider mx-3" />}
              {!collapsed && (
                <div className="mb-3 px-3 flex items-center gap-2" data-tour="ai-tools">
                  <span className="sidebar-section-label">
                    AI Tools
                  </span>
                  <Sparkles className="h-3 w-3 text-amber-400" />
                </div>
              )}
              <div className="space-y-1">
                {visibleAIItems.map(renderNavItem)}
              </div>
            </div>
          )}
        </nav>

        {/* Footer with About Us + AI Branding */}
        <div className={cn(
          "border-t border-sidebar-border p-4 transition-[padding] duration-200 space-y-3",
          collapsed && "p-2 space-y-2"
        )}>
          {/* About Us */}
          {collapsed ? (
            <div className="flex justify-center">
              <a
                href={ABOUT_URL}
                target="_blank"
                rel="noopener noreferrer"
                title="About Us"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              >
                <Info className="h-4 w-4" />
              </a>
            </div>
          ) : (
            <a
              href={ABOUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <Info className="h-4 w-4 shrink-0" />
              <span className="flex-1">About Us</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          )}

          <div className={cn(
            "rounded-xl bg-gradient-to-br from-sidebar-accent to-sidebar-background border border-sidebar-border",
            collapsed ? "flex justify-center p-2" : "px-4 py-3"
          )}>
            <div className={cn(
              "flex items-center gap-2",
              collapsed && "justify-center"
            )}>
              <Bot className="h-4 w-4 shrink-0 text-sidebar-primary" />
              {!collapsed && (
                <>
                  <p className="text-sm font-semibold text-white">Powered by AI</p>
                </>
              )}
            </div>
            {!collapsed && (
              <p className="text-xs text-white/60 mt-1">v1.0.0 • Enterprise</p>
            )}
          </div>
        </div>
      </div>
    </aside>
    </TooltipProvider>
  );
}
