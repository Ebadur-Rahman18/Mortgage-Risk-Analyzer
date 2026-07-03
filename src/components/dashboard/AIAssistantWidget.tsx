import { Link } from "react-router-dom";
import { Brain, Search, FileText, Shield, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const quickActions = [
  {
    label: "Analyze Risk",
    icon: Shield,
    description: "AI risk assessment",
    to: "/loans?open=file-risk-agent",
  },
  {
    label: "Draft Email",
    icon: FileText,
    description: "Generate client emails",
    to: "/communication-center",
  },
  {
    label: "Find Documents",
    icon: Search,
    description: "Search knowledge base",
    to: "/knowledge",
  },
];

export function AIAssistantWidget() {
  return (
    <div className="ai-card p-6">
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 ai-glow">
                <Brain className="h-6 w-6 text-primary-foreground ai-pulse" />
              </div>
              <div className="absolute -top-1 -right-1">
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-primary-foreground">AI Assistant</h3>
              <p className="text-sm text-primary-foreground/70">Ready to help</p>
            </div>
          </div>
          <span className="ai-badge">Online</span>
        </div>

        {/* Prompt */}
        <p className="text-primary-foreground/90 mb-5 text-sm">
          "How can I help with your mortgage pipeline today?"
        </p>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className="flex flex-col items-center gap-2 rounded-lg bg-primary-foreground/10 p-3 text-center transition-all duration-200 hover:bg-primary-foreground/20 hover:scale-105 group"
            >
              <action.icon className="h-5 w-5 text-primary-foreground/80 group-hover:text-primary-foreground" />
              <span className="text-xs font-semibold text-primary-foreground">{action.label}</span>
            </Link>
          ))}
        </div>

        {/* Tip */}
        <div className="flex items-center gap-2 rounded-lg bg-accent/20 px-3 py-2 mb-4">
          <span className="text-accent text-xs">💡</span>
          <p className="text-xs text-accent">
            <span className="font-semibold">Tip:</span> Ask about loans expiring within 30 days
          </p>
        </div>

        {/* CTA */}
        <Link to="/ai">
          <Button className="w-full btn-ai group">
            <span>Open AI Chat</span>
            <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
