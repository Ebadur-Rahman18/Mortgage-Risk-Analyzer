import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

interface AIAgentPresenceIndicatorProps {
  agentName: string;
  agentSlug: string;
  gradientFrom: string;
  gradientTo: string;
}

export function AIAgentPresenceIndicator({
  agentName,
  agentSlug,
  gradientFrom,
  gradientTo,
}: AIAgentPresenceIndicatorProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/agents/${agentSlug}`)}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card shadow-sm px-3 py-1.5 animate-fade-in hover:shadow-md transition-all duration-200"
      style={{ borderColor: `hsl(${gradientFrom} / 0.3)` }}
    >
      {/* Pulsing dot */}
      <span className="relative flex h-2.5 w-2.5">
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ backgroundColor: `hsl(${gradientFrom})` }}
        />
        <span
          className="relative inline-flex rounded-full h-2.5 w-2.5"
          style={{ backgroundColor: `hsl(${gradientFrom})` }}
        />
      </span>

      {/* Sparkles icon */}
      <Sparkles
        className="h-3.5 w-3.5 animate-pulse"
        style={{ color: `hsl(${gradientFrom})` }}
      />

      {/* Agent name */}
      <span className="text-xs font-medium text-foreground">
        {agentName} <span className="text-muted-foreground">AI</span>
      </span>
    </button>
  );
}
