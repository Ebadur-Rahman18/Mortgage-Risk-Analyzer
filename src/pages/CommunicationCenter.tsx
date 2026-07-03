// @ts-nocheck — MCT Lite: hidden module, not reachable at runtime
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { useAgentEnabled, DOCUMENT_GENERATION_AGENT_SLUG } from "@/hooks/useAgentEnabled";
import {
  useBorrowerCommunicationsList,
  useGenerateBorrowerCommunication,
  type BorrowerCommStatus,
  type BorrowerCommunicationListRow,
} from "@/hooks/useBorrowerCommunications";
import { useLoans } from "@/hooks/useLoans";
import { BORROWER_COMMUNICATION_DOC_TYPES } from "@/lib/borrowerCommunicationPrompt";
import { BorrowerUpdateDraft } from "@/components/communications/BorrowerUpdateDraft";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, ShieldAlert } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { queryKeys } from "@/lib/cache";
import { logCrud } from "@/lib/activity-logger";

const TAB_TO_FILTER: Record<string, BorrowerCommStatus | "all"> = {
  all: "all",
  draft: "draft",
  approved: "approved",
  sent: "sent",
  rejected: "rejected",
};

function docTypeLabel(value: string) {
  return BORROWER_COMMUNICATION_DOC_TYPES.find((d) => d.value === value)?.label ?? value;
}

export default function CommunicationCenter() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isEnabled, isLoading: agentLoading } = useAgentEnabled(DOCUMENT_GENERATION_AGENT_SLUG);
  const [tab, setTab] = useState<string>("all");
  const filter = TAB_TO_FILTER[tab] ?? "all";
  const { data: rows = [], isLoading: listLoading } = useBorrowerCommunicationsList(filter);
  const { data: loansResult } = useLoans();
  const loans = loansResult?.rows ?? [];
  const generate = useGenerateBorrowerCommunication();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [loanId, setLoanId] = useState<string>("");
  const [docType, setDocType] = useState<string>("status_update");
  const [channel, setChannel] = useState<string>("email");
  const [audience, setAudience] = useState<string>("borrower");
  const [tone, setTone] = useState<string>("professional");
  const [lengthPref, setLengthPref] = useState<string>("medium");
  const [extra, setExtra] = useState<string>("");

  const loanIdFromUrl = searchParams.get("loanId");

  useEffect(() => {
    if (loanIdFromUrl && loans.some((l) => l.id === loanIdFromUrl)) {
      setLoanId(loanIdFromUrl);
      setGenerateOpen(true);
    }
  }, [loanIdFromUrl, loans]);

  useEffect(() => {
    if (docType === "escalation_note") {
      setAudience("internal");
    }
  }, [docType]);

  if (agentLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isEnabled) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold">Communication Center Agent is disabled</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Enable the Communication Center Agent in Admin → Agents to create and manage document drafts from this page.
        </p>
      </div>
    );
  }

  const handleGenerate = async () => {
    if (!loanId) return;
    const result = await generate.mutateAsync({
      loan_id: loanId,
      doc_type: docType,
      channel,
      audience: docType === "escalation_note" ? "internal" : audience,
      tone,
      length_pref: lengthPref,
      extra_instructions: extra.trim() || undefined,
    });
    await queryClient.refetchQueries({ queryKey: queryKeys.borrowerCommunications.all });
    logCrud("create", "document", result.id, {
      loan_id: loanId,
      doc_type: docType,
      channel,
      audience: docType === "escalation_note" ? "internal" : audience,
    });
    setGenerateOpen(false);
    setExtra("");
    setTab("draft");
    setExpandedId(result.id);
    if (loanIdFromUrl) {
      searchParams.delete("loanId");
      setSearchParams(searchParams, { replace: true });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="h-8 w-8 text-primary" />
            Communication Center
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-drafted loan documents and messages from live loan data. Review, edit, approve, then send outside the app.
          </p>
        </div>
        <Button onClick={() => setGenerateOpen(true)}>New draft</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-4">
          {listLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No drafts yet</CardTitle>
                <CardDescription>Create a draft from a loan using New draft.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            rows.map((row) => {
              const isExpanded = expandedId === row.id;
              return (
                <div key={row.id} className="space-y-3">
                  <CommunicationRow
                    row={row}
                    expanded={isExpanded}
                    onToggle={() => setExpandedId((id) => (id === row.id ? null : row.id))}
                  />
                  {isExpanded ? <BorrowerUpdateDraft row={row} /> : null}
                </div>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate document draft</DialogTitle>
            <DialogDescription>
              Uses live loan data. Output is saved as a draft for your review.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Loan</Label>
              <Select value={loanId} onValueChange={setLoanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select loan" />
                </SelectTrigger>
                <SelectContent>
                  {loans.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.loan_number}
                      {l.borrowers
                        ? ` — ${[l.borrowers.first_name, l.borrowers.last_name].filter(Boolean).join(" ")}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BORROWER_COMMUNICATION_DOC_TYPES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Channel</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Audience</Label>
                <Select
                  value={docType === "escalation_note" ? "internal" : audience}
                  onValueChange={setAudience}
                  disabled={docType === "escalation_note"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="borrower">Borrower</SelectItem>
                    <SelectItem value="realtor">Realtor</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Length</Label>
                <Select value={lengthPref} onValueChange={setLengthPref}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="long">Long</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Extra instructions (optional)</Label>
              <Textarea
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                rows={3}
                placeholder="e.g. Mention we are waiting on the appraisal."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={!loanId || generate.isPending}>
              {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CommunicationRow({
  row,
  expanded,
  onToggle,
}: {
  row: BorrowerCommunicationListRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const loanNumber = row.loans?.loan_number ?? row.loan_id.slice(0, 8);
  return (
    <Card className={expanded ? "ring-2 ring-primary/30" : ""}>
      <CardHeader className="cursor-pointer py-4" onClick={onToggle}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              <Link
                to={`/loans/${row.loan_id}`}
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {loanNumber}
              </Link>
              <span className="text-muted-foreground font-normal"> · </span>
              <span className="font-normal text-muted-foreground">{docTypeLabel(row.doc_type)}</span>
            </CardTitle>
            <CardDescription>{formatDate(row.created_at)}</CardDescription>
          </div>
          <Badge variant="outline">{row.status.replace("_", " ")}</Badge>
        </div>
      </CardHeader>
    </Card>
  );
}
