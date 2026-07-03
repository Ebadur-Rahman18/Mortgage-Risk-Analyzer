/**
 * Property Valuation (AVM) section for BorrowerDetail / LoanDetail.
 * Manual entry always available; AVM request requires integration + consent.
 */

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  usePropertyValuations,
  useCreatePropertyValuation,
  useRequestAVM,
  useDeletePropertyValuation,
  useAVMIntegrationStatus,
  useHasConsent,
  useRecordConsent,
  isRecentAVMExists,
  type PropertyValuationInsert,
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
  MapPin,
  Plus,
  Zap,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface PropertyValuationSectionProps {
  borrowerId?: string;
  loanId?: string;
  defaultAddress?: string;
  defaultCity?: string;
  defaultState?: string;
  defaultPostalCode?: string;
}

const EMPTY_FORM = {
  property_address: "",
  property_city: "",
  property_state: "",
  property_postal_code: "",
  property_type: "single_family",
  estimated_value: "",
  notes: "",
};

export function PropertyValuationSection({
  borrowerId,
  loanId,
  defaultAddress,
  defaultCity,
  defaultState,
  defaultPostalCode,
}: PropertyValuationSectionProps) {
  const { user } = useAuth();
  const { data: valuations, isLoading } = usePropertyValuations({ borrowerId, loanId });
  const createMutation = useCreatePropertyValuation();
  const avmMutation = useRequestAVM();
  const deleteMutation = useDeletePropertyValuation();
  const recordConsent = useRecordConsent();
  const { configured, active } = useAVMIntegrationStatus();
  const hasConsent = useHasConsent(borrowerId, "avm");
  const [showManualForm, setShowManualForm] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    property_address: defaultAddress ?? "",
    property_city: defaultCity ?? "",
    property_state: defaultState ?? "",
    property_postal_code: defaultPostalCode ?? "",
  });

  const recentAVMExists = isRecentAVMExists(valuations);

  const handleManualSave = async () => {
    if (!form.estimated_value) return;

    const input: PropertyValuationInsert = {
      borrower_id: borrowerId ?? null,
      loan_id: loanId ?? null,
      source: "manual",
      valuation_type: "manual",
      property_address: form.property_address || null,
      property_city: form.property_city || null,
      property_state: form.property_state || null,
      property_postal_code: form.property_postal_code || null,
      property_type: form.property_type || null,
      estimated_value: Number(form.estimated_value),
      notes: form.notes || null,
      requested_by: user?.id ?? null,
    };

    await createMutation.mutateAsync(input);
    setShowManualForm(false);
    setForm({
      ...EMPTY_FORM,
      property_address: defaultAddress ?? "",
      property_city: defaultCity ?? "",
      property_state: defaultState ?? "",
      property_postal_code: defaultPostalCode ?? "",
    });
  };

  const handleAVMClick = () => {
    if (!hasConsent && borrowerId) {
      setShowConsentDialog(true);
      return;
    }
    doAVM();
  };

  const doAVM = () => {
    const addr = form.property_address || defaultAddress;
    if (!addr) return;
    avmMutation.mutate({
      borrower_id: borrowerId,
      loan_id: loanId,
      property_address: addr,
      property_city: form.property_city || defaultCity,
      property_state: form.property_state || defaultState,
      property_postal_code: form.property_postal_code || defaultPostalCode,
    });
  };

  const handleConsentAndAVM = async () => {
    if (!user?.id || !borrowerId) return;
    await recordConsent.mutateAsync({
      borrower_id: borrowerId,
      loan_id: loanId ?? null,
      consent_type: "avm",
      consented_by: user.id,
    });
    setShowConsentDialog(false);
    setConsentChecked(false);
    doAVM();
  };

  const avmDisabled =
    !active || avmMutation.isPending || recentAVMExists ||
    !(form.property_address || defaultAddress);

  const avmTitle = !configured
    ? "Configure AVM provider in Admin → Integrations"
    : !active
      ? "Enable AVM integration first"
      : !(form.property_address || defaultAddress)
        ? "Enter a property address first"
        : recentAVMExists
          ? "An AVM was requested within the last 5 minutes"
          : "Request automated property valuation";

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
            <MapPin className="h-5 w-5 text-emerald-600" />
            <div>
              <CardTitle>Property Valuations</CardTitle>
              <CardDescription>AVM, appraisal, and manual valuations</CardDescription>
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
                AVM Active
              </Badge>
            ) : configured ? (
              <Badge variant="secondary">AVM Disabled</Badge>
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
                <DialogTitle>Add Property Valuation (Manual)</DialogTitle>
                <DialogDescription>Enter property details and estimated value manually.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pv-address">Property Address</Label>
                  <Input id="pv-address" placeholder="123 Main St" value={form.property_address}
                    onChange={(e) => setForm((p) => ({ ...p, property_address: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="pv-city">City</Label>
                    <Input id="pv-city" value={form.property_city}
                      onChange={(e) => setForm((p) => ({ ...p, property_city: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pv-state">State</Label>
                    <Input id="pv-state" maxLength={2} value={form.property_state}
                      onChange={(e) => setForm((p) => ({ ...p, property_state: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pv-zip">ZIP</Label>
                    <Input id="pv-zip" maxLength={5} value={form.property_postal_code}
                      onChange={(e) => setForm((p) => ({ ...p, property_postal_code: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Property Type</Label>
                    <Select value={form.property_type} onValueChange={(v) => setForm((p) => ({ ...p, property_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single_family">Single Family</SelectItem>
                        <SelectItem value="condo">Condo</SelectItem>
                        <SelectItem value="townhouse">Townhouse</SelectItem>
                        <SelectItem value="multi_family">Multi-Family</SelectItem>
                        <SelectItem value="2_4_unit">2-4 Unit</SelectItem>
                        <SelectItem value="manufactured">Manufactured</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pv-value">Estimated Value *</Label>
                    <Input id="pv-value" type="number" placeholder="450000" value={form.estimated_value}
                      onChange={(e) => setForm((p) => ({ ...p, estimated_value: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pv-notes">Notes</Label>
                  <Textarea id="pv-notes" placeholder="Optional notes" value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowManualForm(false)}>Cancel</Button>
                <Button onClick={handleManualSave} disabled={createMutation.isPending || !form.estimated_value}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Valuation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button size="sm" disabled={avmDisabled} onClick={handleAVMClick} title={avmTitle}>
            {avmMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            Request AVM
          </Button>
        </div>

        {/* Consent dialog */}
        <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Borrower Authorization Required</DialogTitle>
              <DialogDescription>
                Confirm that the borrower has authorized an automated property valuation
                for this transaction.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-3 py-4">
              <Checkbox id="avm-consent" checked={consentChecked}
                onCheckedChange={(v) => setConsentChecked(v === true)} />
              <Label htmlFor="avm-consent" className="text-sm leading-relaxed">
                I confirm that borrower authorization has been obtained for this
                automated property valuation request.
              </Label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowConsentDialog(false); setConsentChecked(false); }}>
                Cancel
              </Button>
              <Button onClick={handleConsentAndAVM} disabled={!consentChecked || recordConsent.isPending}>
                {recordConsent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm & Request AVM
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {!active && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              AVM integration is {configured ? "disabled" : "not configured"}. You can still
              add valuations manually. To enable automated valuations, configure the AVM provider
              in Admin → Integrations → Data Feeds.
            </AlertDescription>
          </Alert>
        )}

        {recentAVMExists && active && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              An AVM was requested within the last 5 minutes. Please wait before requesting again.
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !valuations?.length ? (
          <p className="text-sm text-center text-muted-foreground py-4">
            No property valuations on file. Use Manual Entry or Request AVM.
          </p>
        ) : (
          <div className="space-y-3">
            {valuations.map((v) => (
              <div key={v.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={v.source === "api" ? "default" : "outline"}>
                      {v.valuation_type === "avm" ? "AVM"
                        : v.valuation_type === "appraisal" ? "Appraisal"
                        : v.valuation_type === "bpo" ? "BPO"
                        : "Manual"}
                    </Badge>
                    {v.provider && (
                      <span className="text-xs text-muted-foreground">{v.provider}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDate(v.valuation_date)}
                    </span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete valuation?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove this property valuation record. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate({
                              id: v.id,
                              borrower_id: borrowerId,
                              loan_id: loanId,
                            })}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {v.property_address && (
                  <p className="text-sm text-muted-foreground">
                    {[v.property_address, v.property_city, v.property_state, v.property_postal_code]
                      .filter(Boolean).join(", ")}
                  </p>
                )}
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Estimated</p>
                    <p className="text-xl font-bold text-emerald-600">
                      {v.estimated_value != null ? fmt.format(Number(v.estimated_value)) : "—"}
                    </p>
                  </div>
                  {v.low_value != null && v.high_value != null && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      <span>Range: {fmt.format(Number(v.low_value))} – {fmt.format(Number(v.high_value))}</span>
                    </div>
                  )}
                  {v.confidence_score != null && (
                    <Badge variant="secondary">Confidence: {v.confidence_score}%</Badge>
                  )}
                </div>
                {v.comparable_sales && Array.isArray(v.comparable_sales) && v.comparable_sales.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Comparable Sales</p>
                    <div className="grid gap-1 text-xs">
                      {(v.comparable_sales as Array<{address: string; sale_price: number; sale_date: string}>).map(
                        (comp, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{comp.address}</span>
                            <span className="font-medium">
                              {fmt.format(comp.sale_price)} ({comp.sale_date})
                            </span>
                          </div>
                        ),
                      )}
                    </div>
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
