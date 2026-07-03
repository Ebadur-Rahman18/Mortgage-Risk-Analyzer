import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  clearPortalAccessToken,
  fetchPortalLoanSummary,
  getPortalAccessToken,
  submitPortalUpload,
  type PortalLoanSummary,
  type PortalMessage,
} from "@/lib/borrowerPortalApi";
import {
  Loader2,
  LogOut,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { PortalMilestoneTracker } from "@/components/portal/PortalMilestoneTracker";
import { PortalMessagesCard } from "@/components/portal/PortalMessagesCard";
import { PortalDisclosuresCard } from "@/components/portal/PortalDisclosuresCard";

function ConditionDueBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  let text: string;
  let className: string;

  if (diffDays < 0) {
    text = `${Math.abs(diffDays)}d overdue`;
    className = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  } else if (diffDays === 0) {
    text = "Due today";
    className = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  } else if (diffDays <= 3) {
    text = `${diffDays}d left`;
    className = "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
  } else {
    text = `${diffDays}d left`;
    className = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  }

  return (
    <Badge className={`text-[10px] font-medium ${className}`}>
      <CalendarClock className="mr-1 h-3 w-3" />
      {text}
    </Badge>
  );
}

function ConditionStatusIcon({ status }: { status: string }) {
  if (status === "received") {
    return <AlertCircle className="h-4 w-4 text-blue-500 shrink-0" />;
  }
  return <Clock className="h-4 w-4 text-amber-500 shrink-0" />;
}

export default function PortalDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [portalJwt, setPortalJwt] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [conditionId, setConditionId] = useState<string>("");

  // Per-condition upload state
  const [conditionFileMap, setConditionFileMap] = useState<Record<string, File | null>>({});
  const [uploadingConditionId, setUploadingConditionId] = useState<string | null>(null);

  useEffect(() => {
    const t = getPortalAccessToken();
    if (!t) {
      navigate("/portal", { replace: true });
      return;
    }
    setPortalJwt(t);
  }, [navigate]);

  const summaryQuery = useQuery({
    queryKey: ["portal-loan-summary", portalJwt],
    queryFn: () => fetchPortalLoanSummary(portalJwt!),
    enabled: !!portalJwt,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!portalJwt || !file) throw new Error("Choose a file");
      return submitPortalUpload(portalJwt, file, conditionId || null);
    },
    onSuccess: () => {
      toast.success("File submitted. Your lender will review it.");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["portal-loan-summary", portalJwt] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const conditionUploadMutation = useMutation({
    mutationFn: async ({ condId, fileToUpload }: { condId: string; fileToUpload: File }) => {
      if (!portalJwt) throw new Error("Session expired");
      return submitPortalUpload(portalJwt, fileToUpload, condId);
    },
    onSuccess: (_data, variables) => {
      toast.success("Document uploaded for this condition!");
      setConditionFileMap((prev) => ({ ...prev, [variables.condId]: null }));
      setUploadingConditionId(null);
      queryClient.invalidateQueries({ queryKey: ["portal-loan-summary", portalJwt] });
    },
    onError: (e: Error) => {
      setUploadingConditionId(null);
      toast.error(e.message);
    },
  });

  const handleConditionUpload = (condId: string) => {
    const fileToUpload = conditionFileMap[condId];
    if (!fileToUpload) {
      toast.error("Please select a file first");
      return;
    }
    setUploadingConditionId(condId);
    conditionUploadMutation.mutate({ condId, fileToUpload });
  };

  const handleLogout = () => {
    clearPortalAccessToken();
    navigate("/portal", { replace: true });
  };

  if (!portalJwt) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (summaryQuery.isLoading || !summaryQuery.data) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading your loan…</p>
      </div>
    );
  }

  if (summaryQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session expired</CardTitle>
          <CardDescription>
            {(summaryQuery.error as Error).message || "Please open a new link from your lender."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleLogout}>Start over</Button>
        </CardContent>
      </Card>
    );
  }

  const data = summaryQuery.data as PortalLoanSummary;

  const [localMessages, setLocalMessages] = useState<PortalMessage[]>([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLocalMessages(data.messages ?? []); }, [data.messages]);

  const handleNewMessage = useCallback((msg: PortalMessage) => {
    setLocalMessages((prev) => [...prev, msg]);
  }, []);

  // Borrower-assigned conditions come first, then others
  const borrowerConditions = data.conditions.filter(
    (c) => c.assigned_party === "borrower" && c.status === "pending",
  );
  const otherPendingConditions = data.conditions.filter(
    (c) => c.assigned_party !== "borrower" && c.status === "pending",
  );
  const receivedConditions = data.conditions.filter((c) => c.status === "received");

  // Check which conditions already have uploads
  const conditionsWithUploads = new Set(
    data.recent_uploads
      .filter((u) => u.loan_condition_id)
      .map((u) => u.loan_condition_id!),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loan {data.loan.loan_number}</h1>
          <p className="text-sm text-muted-foreground">
            Status: {data.loan.status}
            {data.loan.property_city || data.loan.property_state
              ? ` · ${[data.loan.property_city, data.loan.property_state].filter(Boolean).join(", ")}`
              : null}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>

      {/* ── Milestone Tracker ──────────────────────── */}
      {(data.milestones ?? []).length > 0 && (
        <PortalMilestoneTracker milestones={data.milestones} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Key dates</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Lock expiration</span>
            <p className="font-medium">
              {data.loan.lock_expiration_date ? formatDate(data.loan.lock_expiration_date) : "—"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Lock date</span>
            <p className="font-medium">
              {data.loan.lock_date ? formatDate(data.loan.lock_date) : "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Your Checklist — borrower-assigned conditions with per-condition upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Your Checklist
          </CardTitle>
          <CardDescription>
            Documents and items your lender needs from you. Upload directly against each item.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {borrowerConditions.length === 0 ? (
            <div className="flex flex-col items-center py-6 gap-2">
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
              <p className="text-sm text-muted-foreground">
                Nothing needed from you right now!
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {borrowerConditions.map((c) => {
                const hasUpload = conditionsWithUploads.has(c.id);
                const selectedFile = conditionFileMap[c.id];
                const isUploading = uploadingConditionId === c.id;
                return (
                  <li
                    key={c.id}
                    className="rounded-md border p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <ConditionStatusIcon status={c.status} />
                          <span className="font-medium text-sm">{c.condition_type}</span>
                          {c.priority === "urgent" && (
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-[9px]">
                              URGENT
                            </Badge>
                          )}
                          <ConditionDueBadge dueDate={c.due_date} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {c.description}
                        </p>
                        {c.category && (
                          <span className="text-xs text-muted-foreground">
                            Category: {c.category}
                          </span>
                        )}
                      </div>
                      {hasUpload && (
                        <Badge variant="outline" className="text-[10px] text-green-700 dark:text-green-400 shrink-0">
                          Uploaded
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="file"
                        accept=".pdf,image/jpeg,image/png,image/webp,application/pdf"
                        className={
                          "block flex-1 min-w-0 text-sm text-muted-foreground " +
                          "file:mr-3 file:cursor-pointer file:rounded-md file:border-0 " +
                          "file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground " +
                          "hover:file:bg-primary/90"
                        }
                        onChange={(e) =>
                          setConditionFileMap((prev) => ({
                            ...prev,
                            [c.id]: e.target.files?.[0] ?? null,
                          }))
                        }
                      />
                      <Button
                        size="sm"
                        disabled={!selectedFile || isUploading}
                        onClick={() => handleConditionUpload(c.id)}
                      >
                        {isUploading ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Upload
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Other outstanding conditions (not borrower-assigned) */}
      {(otherPendingConditions.length > 0 || receivedConditions.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Other conditions in progress</CardTitle>
            <CardDescription>
              These are being handled by your lender's team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {[...otherPendingConditions, ...receivedConditions].map((c) => (
                <li key={c.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{c.condition_type}</span>
                    <Badge variant={c.status === "received" ? "outline" : "secondary"} className="text-[10px]">
                      {c.status === "received" ? "Received" : "In Progress"}
                    </Badge>
                    <ConditionDueBadge dueDate={c.due_date} />
                  </div>
                  <p className="mt-1 text-muted-foreground">{c.description}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── Disclosures (DocuSign) ──────────────────────── */}
      {data.docusign_enabled && (data.disclosures ?? []).length > 0 && (
        <PortalDisclosuresCard disclosures={data.disclosures} />
      )}

      {/* ── Messages ──────────────────────── */}
      <PortalMessagesCard
        messages={localMessages}
        loanOfficerName={data.loan.loan_officer_name ?? null}
        onNewMessage={handleNewMessage}
      />

      {/* General upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload a document</CardTitle>
          <CardDescription>PDF or image, up to 25 MB. Your team will review submissions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Related condition (optional)</Label>
            <Select
              value={conditionId || "__none__"}
              onValueChange={(v) => setConditionId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="General upload" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">General upload</SelectItem>
                {data.conditions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.condition_type}: {c.description.slice(0, 60)}
                    {c.description.length > 60 ? "…" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <InputFile id="file" onFile={(f) => setFile(f)} />
          </div>
          <Button
            disabled={!file || uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Submit
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your recent submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recent_uploads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No uploads yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {data.recent_uploads.map((u) => (
                <li key={u.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-medium">{u.file_name}</span>
                  <span className="text-muted-foreground">
                    {formatDate(u.submitted_at)} · {u.review_status.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InputFile({ id, onFile }: { id: string; onFile: (f: File | null) => void }) {
  return (
    <input
      id={id}
      type="file"
      accept=".pdf,image/jpeg,image/png,image/webp,application/pdf"
      className={
        "block w-full text-sm text-muted-foreground " +
        "file:mr-4 file:cursor-pointer file:rounded-md file:border-0 " +
        "file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground " +
        "hover:file:bg-primary/90"
      }
      onChange={(e) => onFile(e.target.files?.[0] ?? null)}
    />
  );
}
