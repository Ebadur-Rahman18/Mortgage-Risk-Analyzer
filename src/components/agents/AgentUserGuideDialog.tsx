import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { AIAgent } from "@/hooks/useAIAgents";
import {
  formatAllowedRolesLine,
  getAgentUserGuide,
  getFallbackGuide,
} from "@/lib/agentUserGuides";

interface AgentUserGuideDialogProps {
  agent: AIAgent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentUserGuideDialog({ agent, open, onOpenChange }: AgentUserGuideDialogProps) {
  if (!agent) return null;

  const builtIn = getAgentUserGuide(agent.slug);
  const guide = builtIn ?? getFallbackGuide(agent);
  const rolesLine = formatAllowedRolesLine(agent.slug);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 space-y-1 px-6 pt-6 pb-3">
          <DialogTitle className="text-left leading-snug pr-8">
            How to use: {agent.name}
          </DialogTitle>
          <DialogDescription className="text-left font-mono text-xs text-muted-foreground">
            {agent.slug}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 px-6 pb-6">
          <div className="max-h-[min(calc(85vh-7.5rem),560px)] overflow-y-auto overscroll-y-contain pr-1 [scrollbar-gutter:stable]">
            <div className="space-y-4 text-sm">
              <section>
                <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Who can use it
                </h4>
                <p className="text-foreground/90 leading-relaxed">{rolesLine}</p>
              </section>

              <Separator />

              <section>
                <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  What it does
                </h4>
                <p className="text-foreground/90 leading-relaxed">{guide.summary}</p>
              </section>

              <Separator />

              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Where to go and what to do
                </h4>
                <ol className="list-decimal space-y-3 pl-4 marker:text-muted-foreground">
                  {guide.steps.map((step, i) => (
                    <li key={i} className="pl-1">
                      <span className="font-medium text-foreground">{step.title}</span>
                      {step.path ? (
                        <div className="mt-1">
                          <Link
                            to={step.path}
                            className="inline-flex rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-primary underline-offset-4 hover:underline"
                            onClick={() => onOpenChange(false)}
                          >
                            {step.path}
                          </Link>
                        </div>
                      ) : null}
                      {step.detail ? (
                        <p className="mt-1 text-muted-foreground leading-relaxed">{step.detail}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
