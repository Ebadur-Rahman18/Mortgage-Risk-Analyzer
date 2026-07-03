import { useState } from "react";
import { useLoanAssets, useCreateLoanAsset, useDeleteLoanAsset } from "@/hooks/useLoanApplication";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, DollarSign, Loader2 } from "lucide-react";

const ASSET_TYPES = [
  { value: "checking", label: "Checking Account" },
  { value: "savings", label: "Savings Account" },
  { value: "investment", label: "Investment Account" },
  { value: "retirement", label: "Retirement (401k/IRA)" },
  { value: "gift", label: "Gift Funds" },
  { value: "other", label: "Other" },
];

interface Props {
  loanId: string;
  borrowerId: string;
}

export function AssetsSection({ loanId, borrowerId }: Props) {
  const { data: assets = [], isLoading } = useLoanAssets(loanId);
  const createAsset = useCreateLoanAsset();
  const deleteAsset = useDeleteLoanAsset();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ asset_type: "", institution: "", account_number: "", balance: "" });

  const totalAssets = assets.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  const handleCreate = () => {
    createAsset.mutate(
      {
        loan_id: loanId,
        borrower_id: borrowerId,
        asset_type: form.asset_type,
        institution: form.institution || null,
        account_number: form.account_number || null,
        balance: form.balance ? parseFloat(form.balance) : null,
        description: null,
      } as any,
      {
        onSuccess: () => {
          setOpen(false);
          setForm({ asset_type: "", institution: "", account_number: "", balance: "" });
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Assets</CardTitle>
          <p className="text-sm text-muted-foreground">
            Total: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalAssets)}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add Asset</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Asset</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Type</Label>
                <Select value={form.asset_type} onValueChange={(v) => setForm({ ...form, asset_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Institution</Label>
                <Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
              </div>
              <div>
                <Label>Account Number (last 4)</Label>
                <Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} maxLength={20} />
              </div>
              <div>
                <Label>Balance ($)</Label>
                <Input type="number" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} />
              </div>
              <Button onClick={handleCreate} disabled={!form.asset_type || createAsset.isPending} className="w-full">
                {createAsset.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Asset
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : assets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No assets recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {assets.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {ASSET_TYPES.find((t) => t.value === a.asset_type)?.label ?? a.asset_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.institution}{a.account_number ? ` ···${a.account_number.slice(-4)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {a.balance != null ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(a.balance)) : "—"}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => deleteAsset.mutate({ id: a.id, loanId })}>
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
