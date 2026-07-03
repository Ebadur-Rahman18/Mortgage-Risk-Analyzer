import { useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import * as LucideIcons from "lucide-react";
import { ArrowLeft, ExternalLink, Bot, Sparkles, Zap, BookOpen, MapPin, MessageSquare, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getAgentUserGuide, getFallbackGuide } from "@/lib/agentUserGuides";
import { useAIAgents, type AIAgent, type AgentMetadata } from "@/hooks/useAIAgents";
import { useAuth } from "@/contexts/AuthContext";
import { isAgentAllowedForUser } from "@/lib/agentRoles";
import { CustomizeAgentDialog } from "@/components/ai/CustomizeAgentDialog";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLucideIcon(name: string): React.ComponentType<{ className?: string }> {
  const icon = (LucideIcons as Record<string, unknown>)[name];
  if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
    return icon as React.ComponentType<{ className?: string }>;
  }
  return Bot;
}

const CATEGORY_BADGE: Record<string, string> = {
  communication: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  analysis: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  task_management: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  general: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
};

function formatCategoryLabel(category: string | null) {
  if (!category) return "General";
  return category
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function getAvatar(agent: AIAgent) {
  const meta = (agent.metadata as AgentMetadata | null) ?? {};
  return meta.avatar || "🤖";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const loanContext = (location.state as { loanContext?: Record<string, unknown> } | null)?.loanContext;
  const { data: dbAgents = [] } = useAIAgents();
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const selectedAgent = dbAgents.find((a) => a.slug === slug && a.is_enabled);
  const showCustomize = profile?.role !== "user";

  const allowed =
    selectedAgent &&
    isAgentAllowedForUser(selectedAgent.slug, profile, selectedAgent.required_role ?? null);

  if (!selectedAgent || !allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-lg font-semibold text-foreground">Agent not found</p>
        <Button variant="outline" onClick={() => navigate("/agents")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> All Agents
        </Button>
      </div>
    );
  }

  const guide = getAgentUserGuide(selectedAgent.slug) ?? getFallbackGuide(selectedAgent);

  // Collect all unique paths from steps for "Where to find it"
  const whereToFindPaths = guide.steps
    .filter((step) => !!step.path)
    .reduce<{ label: string; path: string }[]>((acc, step) => {
      const p = step.path!;
      if (!acc.some((e) => e.path === p)) {
        acc.push({ label: step.title, path: p });
      }
      return acc;
    }, []);

  // Primary CTA uses the first navigable path
  const whereToFind = whereToFindPaths.length > 0 ? whereToFindPaths[0] : undefined;
  const category = selectedAgent.category ?? "general";
  const categoryLabel = formatCategoryLabel(selectedAgent.category);

  const gradientFrom = "199 89% 48%";
  const gradientTo = "187 100% 42%";
  const IconComponent = getLucideIcon("Bot");
  const categoryBadgeClass = CATEGORY_BADGE[category] ?? CATEGORY_BADGE.general;

  // Sibling agents (same category, excluding current)
  const siblingAgents = dbAgents
    .filter((a) => a.is_enabled && a.slug !== selectedAgent.slug && (a.category ?? "general") === category)
    .sort((a, b) => a.name.localeCompare(b.name));

  const TeamIcon = Bot;

  return (
    <div className="p-6 space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/agents")} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        All Agents
      </Button>

      {/* Hero card */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-md">
        {/* Gradient banner */}
        <div
          className="h-36 sm:h-44 relative"
          style={{
            background: `linear-gradient(135deg, hsl(${gradientFrom}), hsl(${gradientTo}))`,
          }}
        >
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full opacity-20 bg-white" />
            <div className="absolute bottom-0 left-1/4 w-32 h-32 rounded-full opacity-10 bg-white" />
          </div>
        </div>

        {/* Hero body */}
        <div className="px-6 pb-6">
          {/* Icon overlay */}
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl ring-4 ring-background -mt-10 relative z-10"
            style={{
              background: `linear-gradient(135deg, hsl(${gradientFrom}), hsl(${gradientTo}))`,
            }}
          >
            <IconComponent className="h-9 w-9 text-white" />
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">{selectedAgent.name}</h1>
              <Badge className={`${categoryBadgeClass} border-0`}>{categoryLabel}</Badge>
              <p className="text-base text-muted-foreground max-w-xl">
                {selectedAgent.description || guide.summary}
              </p>
            </div>

            {/* Primary CTA — Start Chat */}
            <div className="hidden sm:flex flex-col gap-2 shrink-0">
              <Button
                size="lg"
                className="font-semibold text-white shadow-lg hover:shadow-xl transition-all"
                style={{
                  background: `linear-gradient(135deg, hsl(${gradientFrom}), hsl(${gradientTo}))`,
                }}
                onClick={() =>
                  navigate(`/agents/${selectedAgent.id}/chat`, {
                    state: loanContext ? { loanContext } : undefined,
                  })
                }
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Start Chat
              </Button>
              {whereToFind && (
                <Button variant="outline" size="sm" onClick={() => navigate(whereToFind!.path)}>
                  <ExternalLink className="h-3.5 w-3.5 mr-2" />
                  Go to {whereToFind.label}
                </Button>
              )}
              {showCustomize ? (
                <Button variant="outline" size="sm" onClick={() => setCustomizeOpen(true)}>
                  <Settings className="h-3.5 w-3.5 mr-2" />
                  Customize
                </Button>
              ) : null}
            </div>
          </div>

          {/* CTA — mobile */}
          <div className="sm:hidden w-full mt-4 flex flex-col gap-2">
            <Button
              size="lg"
              className="w-full font-semibold text-white shadow-lg"
              style={{
                background: `linear-gradient(135deg, hsl(${gradientFrom}), hsl(${gradientTo}))`,
              }}
              onClick={() =>
                navigate(`/agents/${selectedAgent.id}/chat`, {
                  state: loanContext ? { loanContext } : undefined,
                })
              }
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Start Chat
            </Button>
            {whereToFind && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(whereToFind!.path)}>
                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                Go to {whereToFind.label}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main — accordion */}
        <div className="lg:col-span-2">
          <Accordion
            type="multiple"
            defaultValue={["capabilities", "how-to-use", "where"]}
            className="space-y-3"
          >
            {/* Capabilities */}
            <AccordionItem
              value="capabilities"
              className="border rounded-xl px-5 bg-card shadow-sm"
            >
              <AccordionTrigger className="hover:no-underline font-bold text-base gap-3">
                <span className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  What this agent does
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{guide.summary}</p>
              </AccordionContent>
            </AccordionItem>

            {/* How to use */}
            {guide.steps.length > 0 && (
              <AccordionItem
                value="how-to-use"
                className="border rounded-xl px-5 bg-card shadow-sm"
              >
                <AccordionTrigger className="hover:no-underline font-bold text-base gap-3">
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    How to use it
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                  <ul className="space-y-3">
                    {guide.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-muted text-foreground text-xs font-bold shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">{step.title}</p>
                          {step.path && (
                            <Link
                              to={step.path}
                              className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-primary underline-offset-4 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {step.path}
                            </Link>
                          )}
                          {step.detail && (
                            <p className="text-sm text-muted-foreground leading-relaxed">{step.detail}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Where to find */}
            {whereToFindPaths.length > 0 && (
              <AccordionItem
                value="where"
                className="border rounded-xl px-5 bg-card shadow-sm"
              >
                <AccordionTrigger className="hover:no-underline font-bold text-base gap-3">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Where to find it
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                  <ul className="space-y-2">
                    {whereToFindPaths.map((entry) => (
                      <li key={entry.path}>
                        <Link
                          to={entry.path}
                          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                        >
                          <ExternalLink className="h-4 w-4 shrink-0" />
                          <span>{entry.label}</span>
                          <span className="font-mono text-xs text-muted-foreground">({entry.path})</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Agent info card */}
          <div className="rounded-2xl border border-border bg-card shadow-sm p-5 space-y-4">
            <h3 className="text-base font-bold text-foreground">Agent Info</h3>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Built by</p>
                <p className="text-sm font-medium text-foreground">Mortgage CT</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Avatar</p>
                <div className="text-2xl">{getAvatar(selectedAgent)}</div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Category</p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryBadgeClass}`}>
                  {categoryLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Other agents in team */}
          {siblingAgents.length > 0 && (
            <div className="rounded-2xl border border-border bg-card shadow-sm p-5">
              <h3 className="text-base font-bold text-foreground mb-3">Other agents in this team</h3>
              <ul className="space-y-2">
                {siblingAgents.map((sibling) => {
                  const SiblingIcon = Bot;
                  return (
                    <li key={sibling.slug}>
                      <Link
                        to={`/agents/${sibling.slug}`}
                        className="flex items-center gap-3 group rounded-lg p-2 hover:bg-muted/50 transition-colors"
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            background: `linear-gradient(135deg, hsl(${gradientFrom} / 0.15), hsl(${gradientTo} / 0.15))`,
                          }}
                        >
                          <SiblingIcon className="h-4 w-4 text-foreground" />
                        </div>
                        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {sibling.name}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
      {showCustomize ? (
        <CustomizeAgentDialog
          open={customizeOpen}
          onOpenChange={setCustomizeOpen}
          agentId={selectedAgent.id}
          agentName={selectedAgent.name}
          baseSystemPrompt={selectedAgent.system_prompt ?? ""}
        />
      ) : null}
    </div>
  );
}
