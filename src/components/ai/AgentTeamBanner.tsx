import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as LucideIcons from "lucide-react";
import { Sparkles, Bot, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { agentTeams, AgentTeamAgent, AgentTeamDef } from "@/components/ai/agentTeamConfig";

function getLucideIcon(name: string): React.ComponentType<{ className?: string }> {
  const icon = (LucideIcons as Record<string, unknown>)[name];
  if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
    return icon as React.ComponentType<{ className?: string }>;
  }
  return Bot;
}

// ─── Agent Team Card (expanded state) ────────────────────────────────────────

interface AgentTeamCardProps {
  agent: AgentTeamAgent;
  team: AgentTeamDef;
}

function AgentTeamCard({ agent, team }: AgentTeamCardProps) {
  const navigate = useNavigate();
  const IconComponent = getLucideIcon(agent.icon);

  return (
    <div
      className="min-w-[200px] flex-shrink-0 rounded-xl border border-border bg-background p-4 cursor-pointer hover:shadow-md transition-all duration-200 group"
      onClick={() => navigate(`/agents/${agent.slug}`)}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
        style={{
          background: `linear-gradient(135deg, hsl(${team.gradientFrom}), hsl(${team.gradientTo}))`,
        }}
      >
        <IconComponent className="h-4 w-4 text-white" />
      </div>
      <p className="text-sm font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">
        {agent.name}
      </p>
      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{agent.description}</p>
    </div>
  );
}

// ─── Banner ───────────────────────────────────────────────────────────────────

interface AgentTeamBannerProps {
  team: keyof typeof agentTeams;
  className?: string;
}

export function AgentTeamBanner({ team: teamId, className }: AgentTeamBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const team = agentTeams[teamId];

  if (!team) return null;

  const previewIcons = team.agents.slice(0, 4);

  return (
    <div
      className={cn(
        `rounded-2xl border border-border bg-card border-b-4 ${team.accentColor} shadow-sm`,
        className
      )}
    >
      {/* Header row — always visible */}
      <button
        className="w-full flex items-center justify-between gap-3 p-4"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          {/* Overlapping icons */}
          <div className="flex -space-x-2">
            {previewIcons.map(({ icon, name }, i) => {
              const Icon = getLucideIcon(icon);
              return (
                <div
                  key={name}
                  className="w-8 h-8 rounded-full flex items-center justify-center ring-2 ring-background shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, hsl(${team.gradientFrom}), hsl(${team.gradientTo}))`,
                    zIndex: 4 - i,
                  }}
                >
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
              );
            })}
          </div>

          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-bold text-foreground">{team.name}</span>
            </div>
            <p className="text-xs text-muted-foreground">{team.tagline}</p>
          </div>
        </div>

        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded — agent cards */}
      {expanded && (
        <div className="px-4 pb-4">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {team.agents.map((agent) => (
              <AgentTeamCard key={agent.slug} agent={agent} team={team} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
