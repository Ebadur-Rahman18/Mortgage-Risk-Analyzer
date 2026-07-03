/**
 * Credit Report section for BorrowerDetail / LoanDetail.
 * Manual entry always available; API pull requires integration + consent.
 */

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCreditReports,
  useCreateCreditReport,
  usePullCreditReport,
  useDeleteCreditReport,
  useCreditIntegrationStatus,
  useHasConsent,
  useRecordConsent,
  isRecentPullExists,
  getCreditReportExpirationStatus,
  type CreditReportInsert,
} from "@/hooks/useDataFoundation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CreditCard,
  Plus,
  Zap,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface CreditReportSectionProps {
  borrowerId: string;
  loanId?: string;
}

export function CreditReportSection({ borrowerId, loanId }: CreditReportSectionProps) {
  const { user } = useAuth();
  const { data: reports, isLoading } = useCreditReports(borrowerId);
  const createMutation = useCreateCreditReport();
  const pullMutation = usePullCreditReport();
  const deleteMutation = useDeleteCreditReport();
  const recordConsent = useRecordConsent();
  const { configured, active } = useCreditIntegrationStatus();
  const hasConsent = useHasConsent(borrowerId, "credit_pull");
  const [showManualForm, setShowManualForm] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  const recentPullExists = isRecentPullExists(reports);

  const [form, setForm] = useState({
    equifax_score: "",
    experian_score: "",
    transunion_score: "",
    representative_score: "",
    total_tradelines: "",
    open_tradelines: "",
    collections_count: "",
    notes: "",
  });

  const handleManualSave = async () => {
    const repScore =
      form.representative_score
        ? Number(form.representative_score)
        : Math.min(
            ...[form.equifax_score, form.experian_score, form.transunion_score]
              .filter(Boolean)
              .map(Number),
          ) || null;

    const input: CreditReportInsert = {
      borrower_id: borrowerId,
      loan_id: loanId ?? null,
      source: "manual",
      equifax_score: form.equifax_score ? Number(form.equifax_score) : null,
      experian_score: form.experian_score ? Number(form.experian_score) : null,
      transunion_score: form.transunion_score ? Number(form.transunion_score) : null,
      representative_score: repScore,
      total_tradelines: form.total_tradelines ? Number(form.total_tradelines) : null,
      open_tradelines: form.open_tradelines ? Number(form.open_tradelines) : null,
      collections_count: form.collections_count ? Number(form.collections_count) : 0,
      notes: form.notes || null,
      requested_by: user?.id ?? null,
    };

    await createMutation.mutateAsync(input);
    setShowManualForm(false);
    setForm({
      equifax_score: "", experian_score: "", transunion_score: "",
      representative_score: "", total_tradelines: "", open_tradelines: "",
      collections_count: "", notes: "",
    });
  };

  const handlePullClick = () => {
    if (!hasConsent) {
      setShowConsentDialog(true);
      return;
    }
    pullMutation.mutate({ borrower_id: borrowerId, loan_id: loanId });
  };

  const handleConsentAndPull = async () => {
    if (!user?.id) return;
    await recordConsent.mutateAsync({
      borrower_id: borrowerId,
      loan_id: loanId ?? null,
      consent_type: "credit_pull",
      consented_by: user.id,
    });
    setShowConsentDialog(false);
    setConsentChecked(false);
    pullMutation.mutate({ borrower_id: borrowerId, loan_id: loanId });
  };

  const pullDisabled =
    !active || pullMutation.isPending || recentPullExists;

  const pullTitle = !configured
    ? "Configure credit bureau in Admin → Integrations"
    : !active
      ? "Enable credit bureau integration first"
      : recentPullExists
        ? "A credit report was pulled within the last 5 minutes"
        : "Pull credit report via configured provider";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-rose-600" />
            <div>
              <CardTitle>Credit Reports</CardTitle>
              <CardDescription>Tri-merge credit data and scores</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasConsent && (
              <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Consent on file
              </Badge>
            )}
            {active ? (
              <Badge className="bg-emerald-600">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Integration Active
              </Badge>
            ) : configured ? (
              <Badge variant="secondary">Integration Disabled</Badge>
            ) : (
              <Badge variant="outline">Manual Only</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Dialog open={showManualForm} onOpenChange={setShowManualForm}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Manual Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Credit Report (Manual)</DialogTitle>
                <DialogDescription>
                  Enter credit scores and tradeline data manually.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="eq-score">Equifax</Label>
                    <Input id="eq-score" type="number" min={300} max={850} placeholder="720"
                      value={form.equifax_score} onChange={(e) => setForm((p) => ({ ...p, equifax_score: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ex-score">Experian</Label>
                    <Input id="ex-score" type="number" min={300} max={850} placeholder="715"
                      value={form.experian_score} onChange={(e) => setForm((p) => ({ ...p, experian_score: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tu-score">TransUnion</Label>
                    <Input id="tu-score" type="number" min={300} max={850} placeholder="710"
                      value={form.transunion_score} onChange={(e) => setForm((p) => ({ ...p, transunion_score: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rep-score">Representative</Label>
                    <Input id="rep-score" type="number" min={300} max={850} placeholder="Auto from min"
                      value={form.representative_score} onChange={(e) => setForm((p) => ({ ...p, representative_score: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="total-tl">Total Tradelines</Label>
                    <Input id="total-tl" type="number" min={0} placeholder="12"
                      value={form.total_tradelines} onChange={(e) => setForm((p) => ({ ...p, total_tradelines: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="open-tl">Open Tradelines</Label>
                    <Input id="open-tl" type="number" min={0} placeholder="5"
                      value={form.open_tradelines} onChange={(e) => setForm((p) => ({ ...p, open_tradelines: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="collections">Collections</Label>
                  <Input id="collections" type="number" min={0} placeholder="0"
                    value={form.collections_count} onChange={(e) => setForm((p) => ({ ...p, collections_count: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cr-notes">Notes</Label>
                  <Textarea id="cr-notes" placeholder="Optional notes" value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowManualForm(false)}>Cancel</Button>
                <Button onClick={handleManualSave}
                  disabled={createMutation.isPending || (!form.equifax_score && !form.experian_score && !form.transunion_score)}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Report
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button size="sm" disabled={pullDisabled} onClick={handlePullClick} title={pullTitle}>
            {pullMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            Pull Credit
          </Button>
        </div>

        {/* Consent dialog */}
        <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Borrower Authorization Required</DialogTitle>
              <DialogDescription>
                Under the Fair Credit Reporting Act (FCRA), you must have the borrower's written
                authorization before pulling their credit report. Please confirm consent has been
                obtained.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-3 py-4">
              <Checkbox
                id="consent-check"
                checked={consentChecked}
                onCheckedChange={(v) => setConsentChecked(v === true)}
              />
              <Label htmlFor="consent-check" className="text-sm leading-relaxed">
                I confirm that borrower authorization has been obtained for this credit inquiry
                with a permissible purpose under FCRA.
              </Label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowConsentDialog(false); setConsentChecked(false); }}>
                Cancel
              </Button>
              <Button onClick={handleConsentAndPull} disabled={!consentChecked || recordConsent.isPending}>
                {recordConsent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm & Pull Credit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {!active && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Credit bureau integration is {configured ? "disabled" : "not configured"}. You can
              still add credit data manually. To enable automatic pulls, configure the Credit
              Bureau provider in Admin → Integrations → Data Feeds.
            </AlertDescription>
          </Alert>
        )}

        {recentPullExists && active && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              A credit report was pulled within the last 5 minutes. Please wait before pulling again
              to avoid duplicate inquiries.
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !reports?.length ? (
          <p className="text-sm text-center text-muted-foreground py-4">
            No credit reports on file. Use Manual Entry or Pull Credit to add one.
          </p>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const expStatus = getCreditReportExpirationStatus(report);
              return (
                <div key={report.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={report.source === "api" ? "default" : "outline"}>
                        {report.source === "api" ? "API Pull" : "Manual"}
                      </Badge>
                      {report.provider && (
                        <span className="text-xs text-muted-foreground">{report.provider}</span>
                      )}
                      {expStatus === "expired" && (
                        <Badge variant="destructive">Expired</Badge>
                      )}
                      {expStatus === "expiring_soon" && (
                        <Badge className="bg-amber-500">Expiring Soon</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(report.pull_date)}
                      </span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete credit report?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove this credit report record. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate({ id: report.id, borrower_id: borrowerId })}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    <ScoreCell label="Equifax" score={report.equifax_score} />
                    <ScoreCell label="Experian" score={report.experian_score} />
                    <ScoreCell label="TransUnion" score={report.transunion_score} />
                    <ScoreCell label="Representative" score={report.representative_score} highlight />
                  </div>
                  {(report.total_tradelines != null || report.collections_count > 0) && (
                    <div className="flex gap-4 text-xs text-muted-foreground pt-1">
                      {report.total_tradelines != null && (
                        <span>Tradelines: {report.total_tradelines} ({report.open_tradelines ?? 0} open)</span>
                      )}
                      {report.collections_count > 0 && (
                        <span className="text-destructive">Collections: {report.collections_count}</span>
                      )}
                    </div>
                  )}
                  {report.expiration_date && (
                    <p className="text-xs text-muted-foreground">
                      Expires: {formatDate(report.expiration_date)}
                    </p>
                  )}
                  {report.notes && (
                    <p className="text-xs text-muted-foreground italic">{report.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreCell({ label, score, highlight }: { label: string; score: number | null; highlight?: boolean }) {
  const color =
    score == null ? "text-muted-foreground"
      : score >= 740 ? "text-emerald-600"
      : score >= 680 ? "text-amber-600"
      : "text-destructive";

  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color} ${highlight ? "underline decoration-2" : ""}`}>
        {score ?? "—"}
      </p>
    </div>
  );
}
