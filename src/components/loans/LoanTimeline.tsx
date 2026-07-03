import { useTimelineEvents, useCreateTimelineEvent } from "@/hooks/useLoanTimeline";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  FileText,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/utils";

const EVENT_TYPE_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  status_change: { icon: CheckCircle2, color: "text-green-500", label: "Status Change" },
  document_uploaded: { icon: FileText, color: "text-blue-500", label: "Document" },
  note: { icon: MessageSquare, color: "text-gray-500", label: "Note" },
  condition_added: { icon: AlertTriangle, color: "text-amber-500", label: "Condition" },
  condition_cleared: { icon: CheckCircle2, color: "text-green-500", label: "Condition Cleared" },
  milestone_reached: { icon: CheckCircle2, color: "text-purple-500", label: "Milestone" },
  system: { icon: Clock, color: "text-muted-foreground", label: "System" },
};

function getEventConfig(type: string) {
  return EVENT_TYPE_CONFIG[type] ?? EVENT_TYPE_CONFIG.system;
}

const TERMINAL_STATUSES = ["closed", "cancelled", "withdrawn"];

interface LoanTimelineProps {
  loanId: string;
  loanStatus?: string;
}

export function LoanTimeline({ loanId, loanStatus }: LoanTimelineProps) {
  const { data: events, isLoading } = useTimelineEvents(loanId);
  const createEvent = useCreateTimelineEvent();
  const { hasPermission } = useEffectivePermissions();
  const isTerminal = !!loanStatus && TERMINAL_STATUSES.includes(loanStatus);
  // On closed/terminal loans, only notes are allowed (post-close communication is valid).
  const canCreate = hasPermission("loans:update");

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState(isTerminal ? "note" : "note");

  const handleSubmit = () => {
    if (!title.trim()) return;
    createEvent.mutate(
      { loan_id: loanId, event_type: eventType, title: title.trim(), description: description.trim() || null },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setEventType("note");
          setOpen(false);
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>Activity feed for this loan</CardDescription>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Timeline Event</DialogTitle>
                <DialogDescription>
                  {isTerminal
                    ? "This loan is closed. Only notes may be added."
                    : "Log a new event for this loan."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <SearchableSelect
                  value={eventType}
                  onChange={setEventType}
                  options={[
                    { value: "note", label: "Note" },
                    ...(!isTerminal ? [
                      { value: "status_change", label: "Status Change" },
                      { value: "document_uploaded", label: "Document Uploaded" },
                      { value: "condition_added", label: "Condition Added" },
                      { value: "condition_cleared", label: "Condition Cleared" },
                      { value: "milestone_reached", label: "Milestone Reached" },
                    ] : []),
                  ]}
                />
                <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
                <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={!title.trim() || createEvent.isPending}>
                  {createEvent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !events || events.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">No timeline events yet.</p>
        ) : (
          <div className="relative space-y-0">
            <div className="absolute left-[17px] top-2 bottom-2 w-px bg-border" />
            {events.map((event) => {
              const config = getEventConfig(event.event_type);
              const Icon = config.icon;
              return (
                <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className={`relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{event.title}</span>
                      <Badge variant="outline" className="text-xs">{config.label}</Badge>
                    </div>
                    {event.description && <p className="text-sm text-muted-foreground mt-0.5">{event.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(event.occurred_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
