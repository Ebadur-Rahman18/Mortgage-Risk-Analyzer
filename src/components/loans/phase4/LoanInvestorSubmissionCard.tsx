import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useInvestorSubmissions,
  useInvestorSubmissionMutations,
  type InvestorSubmissionStatus,
} from "@/hooks/useInvestorSubmission";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { useManagementScope } from "@/hooks/useManagementScope";
import { permissionKey } from "@/lib/permissions";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Loader2, Truck, FolderOpen } from "lucide-react";

const STATUSES: InvestorSubmissionStatus[] = [
  "draft",
  "submitted",
  "in_review",
  "cleared",
  "rejected",
];

interface Props {
  loanId: string;
}

export function LoanInvestorSubmissionCard({ loanId }: Props) {
  const { hasPermission } = useEffectivePermissions();
  const { scope } = useManagementScope();
  const canView = hasPermission("loans:read");
  const canMutate =
    hasPermission(permissionKey("loans", "update")) ||
    hasPermission(permissionKey("admin", "access")) ||
    scope === "branch";

  const { data: rows = [], isLoading } = useInvestorSubmissions(loanId);
  const { upsertDraft, logStubSubmit } = useInvestorSubmissionMutations(loanId);

  const [investorCode, setInvestorCode] = useState("");
  const [notes, setNotes] = useState("");

  if (!canView) return null;

  const saveDraft = async () => {
    try {
      await upsertDraft.mutateAsync({
        investor_code: investorCode.trim() || "TBD",
        notes: notes.trim() || undefined,
        status: "draft",
      });
      toast.success("Draft saved.");
      setInvestorCode("");
      setNotes("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const setStatus = async (id: string, code: string, status: InvestorSubmissionStatus) => {
    try {
      await upsertDraft.mutateAsync({ id, investor_code: code, status });
      if (status === "submitted") {
        await logStubSubmit.mutateAsync(id);
      }
      toast.success("Updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-4 w-4" />
          Investor delivery
        </CardTitle>
        <CardDescription>
          Manual investor package tracking. External TPO connector is off until enabled in Integrations.
          Upload package files under{" "}
          <Link className="text-primary underline font-medium inline-flex items-center gap-1" to={`/loans/${loanId}#loan-documents`}>
            <FolderOpen className="h-3 w-3" />
            Documents
          </Link>{" "}
          on this loan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <ul className="space-y-3 text-sm">
            {rows.map((r) => (
              <li key={r.id} className="rounded-md border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{r.investor_code || "—"}</span>
                  <span className="text-xs uppercase text-muted-foreground">{r.status.replace("_", " ")}</span>
                </div>
                {r.notes ? <p className="text-xs text-muted-foreground whitespace-pre-wrap">{r.notes}</p> : null}
                {canMutate ? (
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={r.status}
                      onValueChange={(v) =>
                        void setStatus(r.id, r.investor_code, v as InvestorSubmissionStatus)
                      }
                    >
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={logStubSubmit.isPending}
                      onClick={() => void logStubSubmit.mutateAsync(r.id)}
                    >
                      Log vendor submit (stub)
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No investor submissions yet.</p>
            ) : null}
          </ul>
        )}

        {canMutate ? (
          <div className="space-y-3 rounded-md border bg-muted/20 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`inv-code-${loanId}`}>Investor code</Label>
                <Input
                  id={`inv-code-${loanId}`}
                  value={investorCode}
                  onChange={(e) => setInvestorCode(e.target.value)}
                  placeholder="e.g. INVESTOR_A"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`inv-notes-${loanId}`}>Notes / checklist</Label>
              <Textarea
                id={`inv-notes-${loanId}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Stips, package version, etc."
              />
            </div>
            <Button type="button" size="sm" onClick={() => void saveDraft()} disabled={upsertDraft.isPending}>
              {upsertDraft.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              New draft
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
