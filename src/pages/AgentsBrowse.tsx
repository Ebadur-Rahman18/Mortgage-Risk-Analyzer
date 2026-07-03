import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Bot, MessageSquare, BarChart3, ListTodo, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRoleFilteredAgents, type AIAgent, type AgentMetadata } from "@/hooks/useAIAgents";
import { useAuth } from "@/contexts/AuthContext";

const SECTION_PALETTES = [
  { sectionBadgeBg: "bg-fuchsia-600", cardGradientFrom: "296 91% 38%", cardGradientTo: "330 81% 47%" }, // magenta
  { sectionBadgeBg: "bg-cyan-600", cardGradientFrom: "186 94% 37%", cardGradientTo: "207 90% 54%" }, // cyan-blue
  { sectionBadgeBg: "bg-orange-600", cardGradientFrom: "20 90% 48%", cardGradientTo: "42 96% 52%" }, // orange
  { sectionBadgeBg: "bg-emerald-600", cardGradientFrom: "145 63% 36%", cardGradientTo: "160 84% 40%" }, // green
  { sectionBadgeBg: "bg-violet-600", cardGradientFrom: "258 90% 52%", cardGradientTo: "278 88% 57%" }, // violet
  { sectionBadgeBg: "bg-rose-600", cardGradientFrom: "340 82% 52%", cardGradientTo: "6 78% 56%" }, // rose-red
];

const QUICK_ACCESS_COUNT = 4;

function formatCategoryLabel(category: string | null) {
  if (!category) return "General";
  return category
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function normalizeCategoryKey(category: string | null) {
  if (!category) return "general";
  return category.trim().toLowerCase().replace(/\s+/g, "_");
}

function isCommunicationStyleAgent(agent: AIAgent): boolean {
  const k = normalizeCategoryKey(agent.category);
  const raw = (agent.category ?? "").toLowerCase();
  return k === "communication" || raw.includes("chat") || raw.includes("communication");
}

function getAvatar(agent: AIAgent) {
  const meta = (agent.metadata as AgentMetadata | null) ?? {};
  return meta.avatar || "🤖";
}

function inferCategoryIcon(category: string): React.ComponentType<{ className?: string }> {
  if (category.includes("meeting") || category.includes("chat") || category.includes("communication")) return MessageSquare;
  if (category.includes("analysis") || category.includes("insight") || category.includes("risk")) return BarChart3;
  if (category.includes("task") || category.includes("action") || category.includes("pipeline")) return ListTodo;
  return Layers;
}

function inferCategoryDescription(category: string, categoryLabel: string): string {
  if (category.includes("sales")) return "AI agents that help close more deals";
  if (category.includes("meeting")) return "Turn every meeting into structured, actionable outcomes";
  if (category.includes("strategy") || category.includes("eos")) return "Align your team around goals and strategic priorities";
  if (category.includes("project")) return "Accelerate delivery with AI-powered project intelligence";
  if (category.includes("communication")) return "AI agents for clear borrower and team communication";
  if (category.includes("analysis") || category.includes("insight")) return "AI agents for insights and smarter decision support";
  if (category.includes("task") || category.includes("action")) return "AI agents to prioritize and execute work efficiently";

  const lowerLabel = categoryLabel.toLowerCase();
  const normalized = normalizeCategoryKey(categoryLabel);
  const templates = [
    `Built to streamline ${lowerLabel} operations with practical AI support`,
    `Purpose-built assistants for faster ${lowerLabel} decisions and execution`,
    `Smart copilots that make ${lowerLabel} workflows easier and more consistent`,
    `AI teammates focused on improving day-to-day ${lowerLabel} outcomes`,
    `Designed to simplify ${lowerLabel} work with clear, actionable guidance`,
  ];

  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) % 2147483647;
  }

  return templates[Math.abs(hash) % templates.length];
}

function buildSectionMeta(category: string, agents: AIAgent[]) {
  const categoryLabel = formatCategoryLabel(category);
  return {
    sectionTitle: `${categoryLabel} Team`,
    tagline: inferCategoryDescription(category, categoryLabel),
    sectionIcon: inferCategoryIcon(category),
    categoryLabel,
  };
}

function pickQuickAccessAgents(enabledAgents: AIAgent[]): AIAgent[] {
  if (enabledAgents.length === 0) return [];
  const preferred = enabledAgents.filter(isCommunicationStyleAgent);
  const ordered =
    preferred.length > 0
      ? [
          ...preferred,
          ...enabledAgents.filter((a) => !preferred.includes(a)),
        ]
      : [...enabledAgents];
  return ordered.slice(0, QUICK_ACCESS_COUNT);
}

export default function AgentsBrowse() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: visibleAgents = [], isLoading } = useRoleFilteredAgents();

  const showCustomize = profile?.role !== "user";

  const enabledAgents = useMemo(
    () => [...visibleAgents].sort((a, b) => a.name.localeCompare(b.name)),
    [visibleAgents],
  );

  const quickAccessAgents = useMemo(() => pickQuickAccessAgents(enabledAgents), [enabledAgents]);

  const quickAccessIdSet = useMemo(
    () => new Set(quickAccessAgents.map((a) => a.id)),
    [quickAccessAgents],
  );

  const groupedAgents = useMemo(() => {
    const groups = new Map<string, AIAgent[]>();
    for (const agent of enabledAgents) {
      const key = normalizeCategoryKey(agent.category);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(agent);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [enabledAgents]);

  const groupedAgentsBelowQuick = useMemo(() => {
    if (quickAccessIdSet.size === 0) return groupedAgents;
    return groupedAgents
      .map(([category, agents]) => [category, agents.filter((a) => !quickAccessIdSet.has(a.id))] as const)
      .filter(([, agents]) => agents.length > 0);
  }, [groupedAgents, quickAccessIdSet]);

  return (
    <div className="space-y-12 p-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Sparkles className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">AI Agents</h1>
        </div>
        <p className="text-muted-foreground text-base">
          Browse the currently enabled agents configured in Admin
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
          Loading agents...
        </div>
      ) : enabledAgents.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Bot className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">No enabled agents available</p>
          <p className="text-sm text-muted-foreground">
            Ask an admin to enable agents in Admin → AI Agents.
          </p>
        </div>
      ) : (
        <>
          {quickAccessAgents.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Chat team</h2>
              <p className="text-sm text-muted-foreground -mt-2">
                Start a conversation with your top assistants{showCustomize ? ", or open customize to tune prompts and knowledge scope" : ""}.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {quickAccessAgents.map((agent, i) => {
                  const palette = SECTION_PALETTES[i % SECTION_PALETTES.length];
                  const catKey = normalizeCategoryKey(agent.category);
                  const sectionTheme = buildSectionMeta(catKey, [agent]);
                  return (
                    <div
                      key={agent.slug}
                      className="group rounded-2xl border border-border overflow-hidden bg-card shadow-md hover:shadow-xl transition-all duration-300 flex flex-col"
                    >
                      <div
                        className="h-20 relative cursor-pointer"
                        style={{
                          background: `linear-gradient(135deg, hsl(${palette.cardGradientFrom}), hsl(${palette.cardGradientTo}))`,
                        }}
                        onClick={() => navigate(`/agents/${agent.id}/chat`)}
                        role="presentation"
                      >
                        <Badge className="absolute top-2 right-2 border-0 bg-background/90 text-foreground text-xs">
                          {sectionTheme.categoryLabel}
                        </Badge>
                        <button
                          type="button"
                          className="absolute -bottom-5 left-4 h-11 w-11 rounded-full bg-slate-900 border-[3px] border-background flex items-center justify-center text-lg shadow-lg hover:scale-105 transition-transform"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/agents/${agent.id}/chat`);
                          }}
                          aria-label={`Chat with ${agent.name}`}
                        >
                          <span className="translate-y-[1px]">{getAvatar(agent)}</span>
                        </button>
                      </div>
                      <div className="pt-7 px-4 pb-4 flex flex-col flex-1">
                        <p className="text-base font-semibold text-foreground leading-tight">{agent.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 flex-1">
                          {agent.description?.trim() || "No description provided."}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => navigate(`/agents/${agent.id}/chat`)}
                          >
                            <MessageSquare className="h-4 w-4 mr-1.5" /> Chat
                          </Button>
                          {showCustomize ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                              onClick={() => navigate(`/agents/${agent.slug}`)}
                            >
                              Customize
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {groupedAgentsBelowQuick.map(([category, agents], sectionIndex) => {
            const sectionTheme = buildSectionMeta(category, agents);
            const palette = SECTION_PALETTES[sectionIndex % SECTION_PALETTES.length];
            const TeamIcon = sectionTheme.sectionIcon;
            return (
              <section key={category} id={`team-${category}`} className="space-y-4 scroll-mt-24">
                <div className="flex items-start gap-3">
                  <div className={`h-11 w-11 shrink-0 rounded-xl ${palette.sectionBadgeBg} flex items-center justify-center shadow-sm`}>
                    <TeamIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">{sectionTheme.sectionTitle}</h2>
                    <p className="text-muted-foreground text-sm">{sectionTheme.tagline}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {agents.map((agent) => (
                    <div
                      key={agent.slug}
                      className="group rounded-2xl border border-border overflow-hidden bg-card shadow-md hover:shadow-xl transition-all duration-300 flex flex-col"
                    >
                      <div
                        className="h-24 relative"
                        style={{
                          background: `linear-gradient(135deg, hsl(${palette.cardGradientFrom}), hsl(${palette.cardGradientTo}))`,
                        }}
                      >
                        <Badge className="absolute top-3 right-3 border-0 bg-background/90 text-foreground">
                          {sectionTheme.categoryLabel}
                        </Badge>
                        <div className="absolute -bottom-6 left-5 h-12 w-12 rounded-full bg-slate-900 border-[3px] border-background flex items-center justify-center text-xl shadow-lg">
                          <span className="translate-y-[1px]">{getAvatar(agent)}</span>
                        </div>
                      </div>
                      <div className="pt-8 px-5 pb-5 flex flex-col flex-1">
                        <p className="text-lg font-semibold text-foreground leading-tight">{agent.name}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mt-2 flex-1">
                          {agent.description?.trim() || "No description provided."}
                        </p>
                        <div className="mt-4 flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => navigate(`/agents/${agent.id}/chat`)}
                          >
                            <MessageSquare className="h-4 w-4 mr-1.5" /> Chat
                          </Button>
                          {showCustomize ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/agents/${agent.slug}`)}
                            >
                              Customize
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
