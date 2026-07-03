import { useState } from "react";
import { useLoanReo, useCreateLoanReo, useDeleteLoanReo } from "@/hooks/useLoanApplication";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Home, Loader2 } from "lucide-react";

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "multi_family", label: "Multi-Family" },
  { value: "investment", label: "Investment Property" },
];

interface Props {
  loanId: string;
  borrowerId: string;
}

export function ReoSection({ loanId, borrowerId }: Props) {
  const { data: properties = [], isLoading } = useLoanReo(loanId);
  const createReo = useCreateLoanReo();
  const deleteReo = useDeleteLoanReo();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    property_address: "", property_city: "", property_state: "",
    property_type: "", market_value: "", mortgage_balance: "", monthly_mortgage: "", rental_income: "",
  });

  const fmt = (v: number | null) =>
    v != null ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v)) : "—";

  const handleCreate = () => {
    createReo.mutate(
      {
        loan_id: loanId,
        borrower_id: borrowerId,
        property_address: form.property_address,
        property_city: form.property_city || null,
        property_state: form.property_state || null,
        property_postal_code: null,
        property_type: form.property_type || null,
        market_value: form.market_value ? parseFloat(form.market_value) : null,
        mortgage_balance: form.mortgage_balance ? parseFloat(form.mortgage_balance) : null,
        monthly_mortgage: form.monthly_mortgage ? parseFloat(form.monthly_mortgage) : null,
        rental_income: form.rental_income ? parseFloat(form.rental_income) : null,
        status: "retained",
        description: null,
      } as any,
      {
        onSuccess: () => {
          setOpen(false);
          setForm({ property_address: "", property_city: "", property_state: "", property_type: "", market_value: "", mortgage_balance: "", monthly_mortgage: "", rental_income: "" });
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Real Estate Owned</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add Property</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Real Estate Owned</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Property Address</Label>
                <Input value={form.property_address} onChange={(e) => setForm({ ...form, property_address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>City</Label><Input value={form.property_city} onChange={(e) => setForm({ ...form, property_city: e.target.value })} /></div>
                <div><Label>State</Label><Input value={form.property_state} onChange={(e) => setForm({ ...form, property_state: e.target.value })} maxLength={2} /></div>
              </div>
              <div>
                <Label>Property Type</Label>
                <Select value={form.property_type} onValueChange={(v) => setForm({ ...form, property_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Market Value ($)</Label><Input type="number" value={form.market_value} onChange={(e) => setForm({ ...form, market_value: e.target.value })} /></div>
                <div><Label>Mortgage Balance ($)</Label><Input type="number" value={form.mortgage_balance} onChange={(e) => setForm({ ...form, mortgage_balance: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Monthly Mortgage ($)</Label><Input type="number" value={form.monthly_mortgage} onChange={(e) => setForm({ ...form, monthly_mortgage: e.target.value })} /></div>
                <div><Label>Rental Income ($)</Label><Input type="number" value={form.rental_income} onChange={(e) => setForm({ ...form, rental_income: e.target.value })} /></div>
              </div>
              <Button onClick={handleCreate} disabled={!form.property_address || createReo.isPending} className="w-full">
                {createReo.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Property
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : properties.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No real estate owned recorded.</p>
        ) : (
          <div className="space-y-2">
            {properties.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{p.property_address}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.property_city}, {p.property_state} · {PROPERTY_TYPES.find((t) => t.value === p.property_type)?.label ?? p.property_type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold">Value: {fmt(p.market_value)}</p>
                    <p className="text-xs text-muted-foreground">Mortgage: {fmt(p.mortgage_balance)}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteReo.mutate({ id: p.id, loanId })}>
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
