/**
 * Employment Verification section for BorrowerDetail / LoanDetail.
 * Manual entry always available; API verify requires integration + consent.
 */

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useEmploymentVerifications,
  useCreateEmploymentVerification,
  useVerifyEmployment,
  useDeleteEmploymentVerification,
  useVOEIntegrationStatus,
  useHasConsent,
  useRecordConsent,
  isRecentVerifyExists,
  type EmploymentVerificationInsert,
} from "@/hooks/useDataFoundation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Briefcase,
  Plus,
  Zap,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Trash2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface EmploymentVerificationSectionProps {
  borrowerId: string;
  loanId?: string;
}

const EMPTY_FORM = {
  employer_name: "",
  job_title: "",
  employment_status: "active",
  start_date: "",
  annual_income: "",
  monthly_income: "",
  pay_frequency: "monthly",
  notes: "",
};

export function EmploymentVerificationSection({
  borrowerId,
  loanId,
}: EmploymentVerificationSectionProps) {
  const { user } = useAuth();
  const { data: verifications, isLoading } = useEmploymentVerifications(borrowerId);
  const createMutation = useCreateEmploymentVerification();
  const verifyMutation = useVerifyEmployment();
  const deleteMutation = useDeleteEmploymentVerification();
  const recordConsent = useRecordConsent();
  const { configured, active } = useVOEIntegrationStatus();
  const hasConsent = useHasConsent(borrowerId, "voe_voi");
  const [showManualForm, setShowManualForm] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const recentVerifyExists = isRecentVerifyExists(verifications);

  const handleManualSave = async () => {
    if (!form.employer_name.trim()) return;

    const input: EmploymentVerificationInsert = {
      borrower_id: borrowerId,
      loan_id: loanId ?? null,
      source: "manual",
      verification_type: "voe_voi",
      employer_name: form.employer_name.trim(),
      job_title: form.job_title || null,
      employment_status: form.employment_status || null,
      start_date: form.start_date || null,
      annual_income: form.annual_income ? Number(form.annual_income) : null,
      monthly_income: form.monthly_income ? Number(form.monthly_income) : null,
      pay_frequency: form.pay_frequency || null,
      verified: false,
      notes: form.notes || null,
      requested_by: user?.id ?? null,
    };

    await createMutation.mutateAsync(input);
    setShowManualForm(false);
    setForm(EMPTY_FORM);
  };

  const handleVerifyClick = () => {
    if (!hasConsent) {
      setShowConsentDialog(true);
      return;
    }
    verifyMutation.mutate({ borrower_id: borrowerId, loan_id: loanId });
  };

  const handleConsentAndVerify = async () => {
    if (!user?.id) return;
    await recordConsent.mutateAsync({
      borrower_id: borrowerId,
      loan_id: loanId ?? null,
      consent_type: "voe_voi",
      consented_by: user.id,
    });
    setShowConsentDialog(false);
    setConsentChecked(false);
    verifyMutation.mutate({ borrower_id: borrowerId, loan_id: loanId });
  };

  const verifyDisabled = !active || verifyMutation.isPending || recentVerifyExists;

  const verifyTitle = !configured
    ? "Configure VOE/VOI provider in Admin → Integrations"
    : !active
      ? "Enable VOE/VOI integration first"
      : recentVerifyExists
        ? "A verification was run within the last 5 minutes"
        : "Verify employment via configured provider";

  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-amber-600" />
            <div>
              <CardTitle>Employment & Income</CardTitle>
              <CardDescription>VOE / VOI verification records</CardDescription>
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
                <DialogTitle>Add Employment Record (Manual)</DialogTitle>
                <DialogDescription>Enter employer and income details manually.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="emp-name">Employer Name *</Label>
                    <Input id="emp-name" placeholder="Acme Corp" value={form.employer_name}
                      onChange={(e) => setForm((p) => ({ ...p, employer_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="job-title">Job Title</Label>
                    <Input id="job-title" placeholder="Software Engineer" value={form.job_title}
                      onChange={(e) => setForm((p) => ({ ...p, job_title: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Employment Status</Label>
                    <Select value={form.employment_status} onValueChange={(v) => setForm((p) => ({ ...p, employment_status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="self_employed">Self-Employed</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input id="start-date" type="date" value={form.start_date}
                      onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="annual-income">Annual Income</Label>
                    <Input id="annual-income" type="number" placeholder="95000" value={form.annual_income}
                      onChange={(e) => setForm((p) => ({ ...p, annual_income: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="monthly-income">Monthly Income</Label>
                    <Input id="monthly-income" type="number" placeholder="7917" value={form.monthly_income}
                      onChange={(e) => setForm((p) => ({ ...p, monthly_income: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pay Frequency</Label>
                    <Select value={form.pay_frequency} onValueChange={(v) => setForm((p) => ({ ...p, pay_frequency: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Biweekly</SelectItem>
                        <SelectItem value="semimonthly">Semi-monthly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="voe-notes">Notes</Label>
                  <Textarea id="voe-notes" placeholder="Optional notes" value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowManualForm(false)}>Cancel</Button>
                <Button onClick={handleManualSave}
                  disabled={createMutation.isPending || !form.employer_name.trim()}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Record
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button size="sm" disabled={verifyDisabled} onClick={handleVerifyClick} title={verifyTitle}>
            {verifyMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            Verify via API
          </Button>
        </div>

        {/* Consent dialog */}
        <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Borrower Authorization Required</DialogTitle>
              <DialogDescription>
                You must have the borrower's authorization before verifying their employment
                and income records through a third-party provider.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-3 py-4">
              <Checkbox id="voe-consent" checked={consentChecked}
                onCheckedChange={(v) => setConsentChecked(v === true)} />
              <Label htmlFor="voe-consent" className="text-sm leading-relaxed">
                I confirm that borrower authorization has been obtained for this employment
                and income verification.
              </Label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowConsentDialog(false); setConsentChecked(false); }}>
                Cancel
              </Button>
              <Button onClick={handleConsentAndVerify} disabled={!consentChecked || recordConsent.isPending}>
                {recordConsent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm & Verify
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {!active && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              VOE/VOI integration is {configured ? "disabled" : "not configured"}. You can still
              add employment records manually. To enable automatic verification, configure the
              VOE/VOI provider in Admin → Integrations → Data Feeds.
            </AlertDescription>
          </Alert>
        )}

        {recentVerifyExists && active && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              A verification was run within the last 5 minutes. Please wait before running again.
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !verifications?.length ? (
          <p className="text-sm text-center text-muted-foreground py-4">
            No employment records on file. Use Manual Entry or Verify via API.
          </p>
        ) : (
          <div className="space-y-3">
            {verifications.map((v) => (
              <div key={v.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={v.source === "api" ? "default" : "outline"}>
                      {v.source === "api" ? "API Verified" : "Manual"}
                    </Badge>
                    {v.verified && (
                      <Badge className="bg-emerald-600">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                    {v.employment_status && (
                      <Badge variant="secondary">{v.employment_status.replace("_", " ")}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDate(v.created_at)}
                    </span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete verification?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove this employment record. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate({ id: v.id, borrower_id: borrowerId })}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Employer</span>
                    <p className="font-medium">{v.employer_name || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Title</span>
                    <p className="font-medium">{v.job_title || "—"}</p>
                  </div>
                </div>
                {(v.annual_income != null || v.monthly_income != null) && (
                  <div className="flex gap-4 text-sm">
                    {v.annual_income != null && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span>{fmt.format(Number(v.annual_income))}/yr</span>
                      </div>
                    )}
                    {v.monthly_income != null && (
                      <span className="text-muted-foreground">
                        ({fmt.format(Number(v.monthly_income))}/mo)
                      </span>
                    )}
                    {v.pay_frequency && (
                      <Badge variant="outline" className="text-xs">{v.pay_frequency}</Badge>
                    )}
                  </div>
                )}
                {v.notes && (
                  <p className="text-xs text-muted-foreground italic">{v.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
