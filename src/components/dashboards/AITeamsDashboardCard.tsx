import { useNavigate } from "react-router-dom";
import * as LucideIcons from "lucide-react";
import { Sparkles, Bot, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { allTeams, AgentTeamDef } from "@/components/ai/agentTeamConfig";
import { useAuth } from "@/contexts/AuthContext";

function getLucideIcon(name: string): React.ComponentType<{ className?: string }> {
  const icon = (LucideIcons as Record<string, unknown>)[name];
  if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
    return icon as React.ComponentType<{ className?: string }>;
  }
  return Bot;
}

// ─── Role-based filtering ─────────────────────────────────────────────────────

function getVisibleTeams(role: string | undefined): AgentTeamDef[] {
  // Admins see all teams; all other roles see all teams in this implementation
  return allTeams;
}

// ─── Team Mini Card ───────────────────────────────────────────────────────────

interface TeamMiniCardProps {
  team: AgentTeamDef;
  onExplore: () => void;
}

function TeamMiniCard({ team, onExplore }: TeamMiniCardProps) {
  const previewIcons = team.agents.slice(0, 4);

  return (
    <div
      className={`min-w-[240px] flex-shrink-0 rounded-2xl border border-border border-b-4 ${team.accentColor} bg-card shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden`}
    >
      {/* Top gradient strip */}
      <div
        className="h-2 w-full"
        style={{
          background: `linear-gradient(135deg, hsl(${team.gradientFrom}), hsl(${team.gradientTo}))`,
        }}
      />

      <div className="p-4">
        {/* Overlapping icons */}
        <div className="flex -space-x-2.5 mb-3">
          {previewIcons.map(({ icon, name }, i) => {
            const Icon = getLucideIcon(icon);
            return (
              <div
                key={name}
                className="w-10 h-10 rounded-full flex items-center justify-center ring-2 ring-background shadow-md"
                style={{
                  background: `linear-gradient(135deg, hsl(${team.gradientFrom}), hsl(${team.gradientTo}))`,
                  zIndex: 4 - i,
                }}
              >
                <Icon className="h-4 w-4 text-white" />
              </div>
            );
          })}
        </div>

        <p className="text-sm font-bold text-foreground leading-tight">{team.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5 mb-3">
          {team.agents.length} agents
        </p>

        <button
          onClick={onExplore}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:gap-2 transition-all duration-150"
        >
          Explore <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Dashboard Card ───────────────────────────────────────────────────────────

export function AITeamsDashboardCard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const visibleTeams = getVisibleTeams(profile?.role);
  const totalAgents = visibleTeams.reduce((sum, t) => sum + t.agents.length, 0);

  return (
    <div className="rounded-2xl border border-primary/20 bg-card shadow-md overflow-hidden relative">
      {/* Subtle rainbow gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          background:
            "linear-gradient(135deg, hsl(280 70% 50%), hsl(190 80% 45%), hsl(150 70% 40%), hsl(30 90% 50%))",
        }}
      />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-base font-bold text-foreground">Your AI Team</p>
            <p className="text-xs text-muted-foreground">
              {totalAgents} specialized agents across {visibleTeams.length} teams
            </p>
          </div>
        </div>

        {/* Horizontally scrollable team mini-cards */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {visibleTeams.map((team) => (
            <TeamMiniCard
              key={team.id}
              team={team}
              onExplore={() => navigate(`/agents#team-${team.id}`)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-primary hover:text-primary gap-1 text-xs font-semibold"
            onClick={() => navigate("/agents")}
          >
            Browse All Agents <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
