import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Info, Brain, ListChecks, MessageSquare, Users, ShieldCheck } from "lucide-react";

const CATEGORIES = [
  { id: "general", label: "General", hint: "Broad Q&A, drafting, and everyday assistance." },
  { id: "communication", label: "Communication", hint: "Emails, borrower updates, and tone-aware messaging." },
  { id: "analysis", label: "Data Analysis", hint: "Summaries, comparisons, and structured insights." },
  { id: "task_management", label: "Task Management", hint: "Checklists, follow-ups, and workflow coaching." },
] as const;

export function QuickStartWizard() {
  const steps = [
    "Name the agent and pick a category that matches its job.",
    "Write a clear system prompt (role, constraints, output format).",
    "Choose Lovable AI as the default model, or your own provider after connecting keys.",
    "Enable Memory if the agent should remember facts across chats.",
    "Save, then use Chat for threaded conversations or Run for one-off tasks.",
  ];

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4" />
          Quick start
        </CardTitle>
        <CardDescription>Five steps to a useful agent</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export function AgentCategoryGuide() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Category guide</CardTitle>
        <CardDescription>Pick the category that best matches the agent&apos;s primary job</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {CATEGORIES.map((c) => (
          <div key={c.id} className="flex flex-wrap items-baseline gap-2 text-sm">
            <Badge variant="outline">{c.label}</Badge>
            <span className="text-muted-foreground">{c.hint}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function SystemPromptGuide() {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <span>System prompt tips</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="inline-flex text-muted-foreground hover:text-foreground">
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm space-y-2 text-left">
            <p>
              <strong>Good:</strong> &quot;You are a loan coaching assistant. Use bullet points. Ask one
              clarifying question when context is missing.&quot;
            </p>
            <p>
              <strong>Avoid:</strong> vague prompts like &quot;Be helpful&quot; with no role, format, or
              boundaries.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export function MemorySystemGuide() {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium">Memory</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="inline-flex text-muted-foreground hover:text-foreground">
              <Brain className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm text-left">
            When enabled, the agent retrieves relevant past facts before each reply and extracts new
            memories after each turn. Memories apply per user and per agent — not shared across agents.
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export function MultiAgentCollaborationInfo() {
  return (
    <Alert>
      <Users className="h-4 w-4" />
      <AlertTitle>Multi-agent workflows</AlertTitle>
      <AlertDescription>
        Use specialized agents (analysis vs. communication) and pass outputs manually between chats, or
        chain ad-hoc runs from the agents page. Automated agent-to-agent orchestration is not enabled
        in this build.
      </AlertDescription>
    </Alert>
  );
}

export function HITLApprovalInfo() {
  return (
    <Alert>
      <ShieldCheck className="h-4 w-4" />
      <AlertTitle>Human in the loop</AlertTitle>
      <AlertDescription>
        Treat agent output as draft content for regulated or borrower-facing actions. Review before
        sending externally or updating loan records.
      </AlertDescription>
    </Alert>
  );
}

export function AgentChatModeInfo() {
  return (
    <Alert variant="default" className="border-muted">
      <MessageSquare className="h-4 w-4" />
      <AlertTitle>Chat vs. Run</AlertTitle>
      <AlertDescription>
        <strong>Chat</strong> keeps threaded history in <code className="text-xs">agent_messages</code>.
        <strong> Run</strong> is a single execution logged in <code className="text-xs">ai_agent_runs</code>.
        Both use the same <code className="text-xs">run-ai-agent</code> edge function.
      </AlertDescription>
    </Alert>
  );
}
