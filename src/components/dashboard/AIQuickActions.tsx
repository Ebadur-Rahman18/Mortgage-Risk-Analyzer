import { Link } from "react-router-dom";
import { 
  Zap, 
  TrendingUp, 
  Clock, 
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const aiCapabilities = [
  {
    title: "Pipeline Analysis",
    description: "AI monitors your loan pipeline for bottlenecks",
    icon: TrendingUp,
    status: "active",
  },
  {
    title: "Deadline Alerts",
    description: "Get notified about approaching deadlines",
    icon: Clock,
    status: "active",
  },
  {
    title: "Risk Detection",
    description: "Automatic flagging of high-risk applications",
    icon: AlertTriangle,
    status: "active",
  },
  {
    title: "Smart Automation",
    description: "Automate repetitive tasks with AI agents",
    icon: Zap,
    status: "available",
  },
];

export function AIQuickActions() {
  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">AI Capabilities</CardTitle>
            <Sparkles className="h-4 w-4 text-amber-500" />
          </div>
          <Link 
            to="/agents" 
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {aiCapabilities.map((capability) => (
            <div
              key={capability.title}
              className="flex items-center gap-3 rounded-lg border border-border/50 p-3 transition-all duration-200 hover:border-border hover:bg-muted/30"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <capability.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {capability.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {capability.description}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {capability.status === "active" ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-xs font-medium text-green-600">Active</span>
                  </>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">Available</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
