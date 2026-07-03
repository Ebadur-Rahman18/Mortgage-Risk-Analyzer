import { useState } from "react";
import { useLoanLiabilities, useCreateLoanLiability, useDeleteLoanLiability } from "@/hooks/useLoanApplication";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, CreditCard, Loader2 } from "lucide-react";

const LIABILITY_TYPES = [
  { value: "mortgage", label: "Mortgage" },
  { value: "auto_loan", label: "Auto Loan" },
  { value: "student_loan", label: "Student Loan" },
  { value: "credit_card", label: "Credit Card" },
  { value: "personal_loan", label: "Personal Loan" },
  { value: "other", label: "Other" },
];

interface Props {
  loanId: string;
  borrowerId: string;
}

export function LiabilitiesSection({ loanId, borrowerId }: Props) {
  const { data: liabilities = [], isLoading } = useLoanLiabilities(loanId);
  const createLiability = useCreateLoanLiability();
  const deleteLiability = useDeleteLoanLiability();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    liability_type: "", creditor: "", account_number: "",
    monthly_payment: "", unpaid_balance: "", months_remaining: "", to_be_paid_off: false,
  });

  const totalMonthly = liabilities.reduce((sum, l) => sum + (Number(l.monthly_payment) || 0), 0);

  const handleCreate = () => {
    createLiability.mutate(
      {
        loan_id: loanId,
        borrower_id: borrowerId,
        liability_type: form.liability_type,
        creditor: form.creditor || null,
        account_number: form.account_number || null,
        monthly_payment: form.monthly_payment ? parseFloat(form.monthly_payment) : null,
        unpaid_balance: form.unpaid_balance ? parseFloat(form.unpaid_balance) : null,
        months_remaining: form.months_remaining ? parseInt(form.months_remaining) : null,
        to_be_paid_off: form.to_be_paid_off,
        description: null,
      } as any,
      {
        onSuccess: () => {
          setOpen(false);
          setForm({ liability_type: "", creditor: "", account_number: "", monthly_payment: "", unpaid_balance: "", months_remaining: "", to_be_paid_off: false });
        },
      }
    );
  };

  const fmt = (v: number | null) =>
    v != null ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v)) : "—";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Liabilities</CardTitle>
          <p className="text-sm text-muted-foreground">Total monthly: {fmt(totalMonthly)}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add Liability</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Liability</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Type</Label>
                <Select value={form.liability_type} onValueChange={(v) => setForm({ ...form, liability_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {LIABILITY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Creditor</Label>
                <Input value={form.creditor} onChange={(e) => setForm({ ...form, creditor: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Monthly Payment ($)</Label>
                  <Input type="number" value={form.monthly_payment} onChange={(e) => setForm({ ...form, monthly_payment: e.target.value })} />
                </div>
                <div>
                  <Label>Unpaid Balance ($)</Label>
                  <Input type="number" value={form.unpaid_balance} onChange={(e) => setForm({ ...form, unpaid_balance: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Months Remaining</Label>
                <Input type="number" value={form.months_remaining} onChange={(e) => setForm({ ...form, months_remaining: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.to_be_paid_off} onCheckedChange={(v) => setForm({ ...form, to_be_paid_off: v })} />
                <Label>To be paid off at closing</Label>
              </div>
              <Button onClick={handleCreate} disabled={!form.liability_type || createLiability.isPending} className="w-full">
                {createLiability.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Liability
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : liabilities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No liabilities recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {liabilities.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {LIABILITY_TYPES.find((t) => t.value === l.liability_type)?.label ?? l.liability_type}
                      {l.to_be_paid_off && <span className="ml-2 text-xs text-amber-600">(Pay off at closing)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{l.creditor ?? "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold">{fmt(l.monthly_payment)}/mo</p>
                    <p className="text-xs text-muted-foreground">Balance: {fmt(l.unpaid_balance)}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteLiability.mutate({ id: l.id, loanId })}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
