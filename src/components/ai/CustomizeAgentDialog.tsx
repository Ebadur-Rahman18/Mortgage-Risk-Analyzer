import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAgentCustomization,
  useUpsertAgentCustomization,
  useResetAgentCustomization,
} from "@/hooks/useAgentCustomization";
import { useKnowledgeEntries } from "@/hooks/useKnowledge";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
  baseSystemPrompt: string;
}

export function CustomizeAgentDialog({
  open,
  onOpenChange,
  agentId,
  agentName,
  baseSystemPrompt,
}: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: existing, isLoading } = useAgentCustomization(agentId, userId);
  const { data: knowledge = [], isLoading: kbLoading } = useKnowledgeEntries();
  const upsert = useUpsertAgentCustomization();
  const reset = useResetAgentCustomization();

  const [prompt, setPrompt] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setPrompt(existing?.system_prompt_override ?? baseSystemPrompt ?? "");
    setSelected(existing?.knowledge_entry_ids ?? []);
    setNotes(existing?.notes ?? "");
  }, [open, existing, baseSystemPrompt]);

  const toggleEntry = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSave = async () => {
    if (!userId) return;
    await upsert.mutateAsync({
      agent_id: agentId,
      user_id: userId,
      system_prompt_override: prompt === baseSystemPrompt ? null : prompt,
      knowledge_entry_ids: selected,
      notes,
    });
    onOpenChange(false);
  };

  const handleReset = async () => {
    if (!userId) return;
    await reset.mutateAsync({ agent_id: agentId, user_id: userId });
    setPrompt(baseSystemPrompt ?? "");
    setSelected([]);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customize {agentName}</DialogTitle>
          <DialogDescription>
            Personal overrides for your account only. Other users keep the default agent.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="cust-prompt">Instructions (system prompt)</Label>
              <Textarea
                id="cust-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Knowledge Base scope</Label>
              <p className="text-xs text-muted-foreground">
                Selected entries are passed to this agent as context for your conversations.
              </p>
              <ScrollArea className="h-44 rounded-md border border-border p-3">
                {kbLoading ? (
                  <div className="text-sm text-muted-foreground">Loading...</div>
                ) : knowledge.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No knowledge entries yet. Add some in Knowledge.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {knowledge.map((k: { id: string; title: string; category?: string | null }) => (
                      <label
                        key={k.id}
                        className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 rounded p-1.5"
                      >
                        <Checkbox
                          checked={selected.includes(k.id)}
                          onCheckedChange={() => toggleEntry(k.id)}
                        />
                        <div className="text-sm">
                          <div className="font-medium text-foreground">{k.title}</div>
                          {k.category && (
                            <div className="text-xs text-muted-foreground">{k.category}</div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                {selected.length} entr{selected.length === 1 ? "y" : "ies"} selected
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cust-notes">Notes (optional)</Label>
              <Textarea
                id="cust-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any reminders for yourself about this customization..."
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={handleReset} disabled={reset.isPending}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to default
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
